/**
 * ArchMate - UML Class Diagram Generator
 * Generates PlantUML and Mermaid format class diagrams
 */

import {
  CodeEntity,
  Relationship,
  DependencyGraph,
  DiagramOptions,
  DiagramType,
  EntityType,
  Visibility,
  Property,
  Method,
} from '../types';

export interface GeneratorConfig {
  format: 'plantuml' | 'mermaid';
  showVisibility: boolean;
  showTypes: boolean;
  showMethods: boolean;
  showProperties: boolean;
  showDocComments: boolean;
  showModifiers: boolean;
  groupBy: 'namespace' | 'layer' | 'type' | 'file' | 'none';
}

/**
 * UML Class Diagram Generator
 */
export class UMLClassDiagramGenerator {
  private config: GeneratorConfig;

  constructor(config: Partial<GeneratorConfig> = {}) {
    this.config = {
      format: config.format || 'plantuml',
      showVisibility: config.showVisibility ?? true,
      showTypes: config.showTypes ?? true,
      showMethods: config.showMethods ?? true,
      showProperties: config.showProperties ?? true,
      showDocComments: config.showDocComments ?? false,
      showModifiers: config.showModifiers ?? true,
      groupBy: config.groupBy || 'none',
    };
  }

  /**
   * Generate UML class diagram
   */
  generate(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): string {
    if (this.config.format === 'mermaid') {
      return this.generateMermaid(entities, relationships);
    }
    return this.generatePlantUML(entities, relationships);
  }

  /**
   * Generate PlantUML diagram
   */
  private generatePlantUML(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): string {
    const lines: string[] = [
      '@startuml',
      'skinparam classAttributeIconSize 0',
      '',
    ];

    // Add stereotype colors
    lines.push('skinparam stereotypeCBackgroundColor #DarkSlateGray');
    lines.push('skinparam stereotypeCBackgroundColor<<Service>> #LightBlue');
    lines.push('skinparam stereotypeCBackgroundColor<<Controller>> #LightGreen');
    lines.push('skinparam stereotypeCBackgroundColor<<Repository>> #LightYellow');
    lines.push('');

    // Generate class definitions
    entities.forEach(entity => {
      lines.push(...this.generateClassDefinition(entity));
      lines.push('');
    });

    // Generate relationships
    relationships.forEach(rel => {
      lines.push(this.generateRelationship(rel));
    });

    lines.push('');
    lines.push('@enduml');

    return lines.join('\n');
  }

  /**
   * Generate Mermaid diagram
   */
  private generateMermaid(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): string {
    const lines: string[] = [
      '```mermaid',
      'classDiagram',
      '',
    ];

    // Generate class definitions
    entities.forEach(entity => {
      lines.push(...this.generateMermaidClass(entity));
      lines.push('');
    });

    // Generate relationships
    relationships.forEach(rel => {
      lines.push(this.generateMermaidRelationship(rel));
    });

    lines.push('```');

    return lines.join('\n');
  }

  /**
   * Generate class definition for PlantUML
   */
  private generateClassDefinition(entity: CodeEntity): string[] {
    const lines: string[] = [];

    // Stereotype
    const stereotype = this.getStereotype(entity);
    const visibility = this.getVisibilityChar(entity.visibility);

    if (stereotype) {
      lines.push(`class "${entity.name}" ${stereotype} {`);
    } else {
      lines.push(`class "${entity.name}" {`);
    }

    // Documentation comment
    if (this.config.showDocComments && entity.documentation) {
      lines.push(`  /\\"${entity.documentation}\\"`);
    }

    // Properties
    if (this.config.showProperties) {
      entity.properties.forEach(prop => {
        lines.push(`  ${this.formatProperty(prop)}`);
      });
    }

    // Methods
    if (this.config.showMethods) {
      entity.methods.forEach(method => {
        lines.push(`  ${this.formatMethod(method)}`);
      });
    }

    lines.push('}');

    return lines;
  }

  /**
   * Generate class definition for Mermaid
   */
  private generateMermaidClass(entity: CodeEntity): string[] {
    const lines: string[] = [];

    // Add stereotype as note
    const stereotype = this.getStereotype(entity);
    if (stereotype) {
      lines.push(`    note for "${entity.name}" ${stereotype}`);
    }

    // Add class with stereotype
    if (stereotype) {
      lines.push(`class "${entity.name}"${stereotype}`);
    } else {
      lines.push(`class "${entity.name}"`);
    }

    return lines;
  }

  /**
   * Get stereotype based on entity type
   */
  private getStereotype(entity: CodeEntity): string {
    if (entity.annotations.includes('Component') || entity.type === 'component') {
      return '<<Component>>';
    }
    if (entity.annotations.includes('Service') || entity.type === 'service') {
      return '<<Service>>';
    }
    if (entity.annotations.includes('Controller') || entity.type === 'controller') {
      return '<<Controller>>';
    }
    if (entity.annotations.includes('Repository') || entity.type === 'repository') {
      return '<<Repository>>';
    }
    if (entity.annotations.includes('Entity') || entity.type === 'model') {
      return '<<Entity>>';
    }
    if (entity.type === 'interface') {
      return '<<interface>>';
    }
    if (entity.type === 'enum') {
      return '<<enumeration>>';
    }
    return '';
  }

  /**
   * Get visibility character
   */
  private getVisibilityChar(visibility: Visibility): string {
    switch (visibility) {
      case 'private': return '-';
      case 'protected': return '#';
      case 'package': return '~';
      default: return '+';
    }
  }

  /**
   * Format property
   */
  private formatProperty(prop: Property): string {
    const parts: string[] = [];

    if (this.config.showVisibility) {
      parts.push(this.getVisibilityChar(prop.visibility));
    }

    parts.push(prop.name);

    if (this.config.showTypes && prop.type !== 'any') {
      parts.push(`: ${prop.type}`);
    }

    if (this.config.showModifiers) {
      if (prop.isStatic) parts.unshift('{static}');
      if (prop.isReadonly) parts.unshift('{readOnly}');
    }

    return parts.join(' ');
  }

  /**
   * Format method
   */
  private formatMethod(method: Method): string {
    const parts: string[] = [];

    if (this.config.showVisibility) {
      parts.push(this.getVisibilityChar(method.visibility));
    }

    parts.push(method.name);
    parts.push('(');
    parts.push(method.parameters.map(p => {
      const paramParts = [p.name];
      if (this.config.showTypes && p.type !== 'any') {
        paramParts.push `: ${p.type}`);
      }
      return paramParts.join('(');
    }).join(', '));
    parts.push(')');

    if (this.config.showTypes && method.returnType !== 'void' && method.returnType !== 'any') {
      parts.push(`: ${method.returnType}`);
    }

    if (this.config.showModifiers) {
      if (method.isStatic) parts.unshift('{static}');
      if (method.isAsync) parts.push('*');
      if (method.isAbstract) parts.unshift('{abstract}');
    }

    return parts.join(' ');
  }

  /**
   * Generate PlantUML relationship
   */
  private generateRelationship(rel: Relationship): string {
    const sourceName = this.getEntityName(rel.source);
    const targetName = this.getEntityName(rel.target);

    switch (rel.type) {
      case 'extends':
        return `${sourceName} --|> ${targetName} : extends`;

      case 'implements':
        return `${sourceName} ..|> ${targetName} : implements`;

      case 'associates':
        return `${sourceName} --> ${targetName}${rel.label ? ` : ${rel.label}` : ''}`;

      case 'aggregates':
        return `${sourceName} o-- ${targetName}${rel.label ? ` : ${rel.label}` : ''}`;

      case 'composes':
        return `${sourceName} *-- ${targetName}${rel.label ? ` : ${rel.label}` : ''}`;

      case 'depends':
        return `${sourceName} ..> ${targetName} : depends`;

      case 'calls':
        return `${sourceName} ..> ${targetName} : ${rel.label || 'calls'}`;

      case 'uses':
        return `${sourceName} -.-> ${targetName} : uses`;

      default:
        return `${sourceName} --> ${targetName}`;
    }
  }

  /**
   * Generate Mermaid relationship
   */
  private generateMermaidRelationship(rel: Relationship): string {
    const sourceName = this.getEntityName(rel.source);
    const targetName = this.getEntityName(rel.target);

    let arrow = '--|>';
    let label = rel.label || '';

    switch (rel.type) {
      case 'extends':
        arrow = '--|>';
        label = label || 'extends';
        break;

      case 'implements':
        arrow = '..|>';
        label = label || 'implements';
        break;

      case 'associates':
        arrow = '-->';
        break;

      case 'aggregates':
        arrow = 'o--';
        break;

      case 'composes':
        arrow = '*--';
        break;

      case 'depends':
        arrow = '..>';
        break;

      case 'calls':
        arrow = '..>';
        label = label || 'calls';
        break;

      case 'uses':
        arrow = '..>';
        label = label || 'uses';
        break;

      default:
        arrow = '-->';
    }

    if (label) {
      return `${sourceName} ${arrow} ${targetName} : ${label}`;
    }
    return `${sourceName} ${arrow} ${targetName}`;
  }

  /**
   * Extract entity name from ID
   */
  private getEntityName(entityId: string): string {
    const parts = entityId.split(':');
    return parts[parts.length - 1];
  }
}

/**
 * UML Component Diagram Generator
 */
export class UMLComponentDiagramGenerator extends UMLClassDiagramGenerator {
  constructor(config: Partial<GeneratorConfig> = {}) {
    super({ ...config, showMethods: false, showProperties: false });
  }

  /**
   * Generate component diagram
   */
  generate(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): string {
    const lines: string[] = [
      '@startuml',
      '',
      'skinparam componentStyle uml2',
      '',
    ];

    // Group entities by type
    const components = entities.filter(e =>
      e.type === 'component' || e.type === 'service' ||
      e.type === 'controller' || e.type === 'repository'
    );

    const interfaces = entities.filter(e => e.type === 'interface');

    // Generate components
    components.forEach(comp => {
      lines.push(`[${comp.name}]`);
    });

    lines.push('');

    // Generate interfaces
    interfaces.forEach(intf => {
      lines.push(`() "${intf.name}"`);
    });

    lines.push('');

    // Generate relationships
    relationships.forEach(rel => {
      const sourceName = this.getEntityName(rel.source);
      const targetName = this.getEntityName(rel.target);

      lines.push(`${sourceName} --> ${targetName}`);
    });

    lines.push('');
    lines.push('@enduml');

    return lines.join('\n');
  }
}

export default UMLClassDiagramGenerator;
