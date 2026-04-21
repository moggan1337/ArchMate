/**
 * ArchMate - C4 Model Diagram Generator
 * Generates C4 context, container, and component diagrams
 */

import {
  CodeEntity,
  Relationship,
  DependencyGraph,
  DiagramOptions,
  DiagramType,
} from '../types';

export type C4Level = 'context' | 'container' | 'component' | 'deployment';

export interface C4Config {
  format: 'plantuml' | 'mermaid';
  level: C4Level;
  systemName: string;
  systemDescription: string;
  includeExternal: boolean;
}

/**
 * C4 Model Diagram Generator
 */
export class C4DiagramGenerator {
  private config: C4Config;

  constructor(config: Partial<C4Config> = {}) {
    this.config = {
      format: config.format || 'plantuml',
      level: config.level || 'container',
      systemName: config.systemName || 'My System',
      systemDescription: config.systemDescription || 'System description',
      includeExternal: config.includeExternal ?? true,
    };
  }

  /**
   * Generate C4 diagram
   */
  generate(
    entities: CodeEntity[],
    relationships: Relationship[],
    graph?: DependencyGraph
  ): string {
    switch (this.config.level) {
      case 'context':
        return this.generateContextDiagram(entities, relationships);
      case 'container':
        return this.generateContainerDiagram(entities, relationships);
      case 'component':
        return this.generateComponentDiagram(entities, relationships);
      case 'deployment':
        return this.generateDeploymentDiagram(entities, relationships);
      default:
        return this.generateContainerDiagram(entities, relationships);
    }
  }

  /**
   * Generate C4 Context diagram
   */
  private generateContextDiagram(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): string {
    if (this.config.format === 'mermaid') {
      return this.generateContextMermaid(entities, relationships);
    }
    return this.generateContextPlantUML(entities, relationships);
  }

  /**
   * Generate PlantUML context diagram
   */
  private generateContextPlantUML(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): string {
    const lines: string[] = [
      '@startuml',
      '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml',
      '',
      'LAYOUT_WITH_LEGEND()',
      '',
      `title System Context diagram for ${this.config.systemName}`,
      '',
      'Person(person_alias, "Label", "Optional technology")',
      'System(system_alias, "Label", "Optional technology")',
      '',
      'System_Boundary(c1, "Container') {
      '}',
      '',
      'Rel(person_alias, system_alias, "Label")',
      '',
      'SHOW_LEGEND()',
      '',
      '@enduml',
    ];

    return lines.join('\n');
  }

  /**
   * Generate Mermaid context diagram
   */
  private generateContextMermaid(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): string {
    const lines: string[] = [
      '```mermaid',
      'C4Context',
      '',
      `ContainerDb(system, "${this.config.systemName}", "")`,
      '',
      'BiRelation(person, system, "Uses")',
      '',
      '```',
    ];

    return lines.join('\n');
  }

  /**
   * Generate C4 Container diagram
   */
  private generateContainerDiagram(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): string {
    if (this.config.format === 'mermaid') {
      return this.generateContainerMermaid(entities, relationships);
    }
    return this.generateContainerPlantUML(entities, relationships);
  }

  /**
   * Generate PlantUML container diagram
   */
  private generateContainerPlantUML(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): string {
    const lines: string[] = [
      '@startuml',
      '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml',
      '',
      'LAYOUT_WITH_LEGEND()',
      '',
      `title Container diagram for ${this.config.systemName}`,
      '',
    ];

    // Add containers
    const containers = this.categorizeEntities(entities);

    Object.entries(containers).forEach(([category, ents]) => {
      ents.forEach(entity => {
        const technology = this.getTechnology(entity);
        lines.push(`Container(${this.toCamelCase(entity.name)}, "${entity.name}", "${technology}", "")`);
      });
    });

    lines.push('');

    // Add relationships
    relationships.forEach(rel => {
      const source = this.getEntityName(rel.source);
      const target = this.getEntityName(rel.target);
      lines.push(`Rel(${this.toCamelCase(source)}, ${this.toCamelCase(target)}, "${rel.label || 'Uses'}")`);
    });

    lines.push('');
    lines.push('SHOW_LEGEND()');
    lines.push('@enduml');

    return lines.join('\n');
  }

  /**
   * Generate Mermaid container diagram
   */
  private generateContainerMermaid(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): string {
    const lines: string[] = [
      '```mermaid',
      'C4Container',
      '',
      `title Container diagram for ${this.config.systemName}`,
      '',
    ];

    // Add containers
    const containers = this.categorizeEntities(entities);

    Object.entries(containers).forEach(([category, ents]) => {
      ents.forEach(entity => {
        const technology = this.getTechnology(entity);
        lines.push(`Container(${this.toCamelCase(entity.name)}, "${entity.name}", "${technology}")`);
      });
    });

    lines.push('');

    // Add relationships
    relationships.forEach(rel => {
      const source = this.getEntityName(rel.source);
      const target = this.getEntityName(rel.target);
      lines.push(`BiRel(${this.toCamelCase(source)}, ${this.toCamelCase(target)}, "${rel.label || 'Uses'}")`);
    });

    lines.push('```');

    return lines.join('\n');
  }

  /**
   * Generate C4 Component diagram
   */
  private generateComponentDiagram(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): string {
    if (this.config.format === 'mermaid') {
      return this.generateComponentMermaid(entities, relationships);
    }
    return this.generateComponentPlantUML(entities, relationships);
  }

  /**
   * Generate PlantUML component diagram
   */
  private generateComponentPlantUML(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): string {
    const lines: string[] = [
      '@startuml',
      '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml',
      '',
      'LAYOUT_WITH_LEGEND()',
      '',
      `title Component diagram for ${this.config.systemName}`,
      '',
    ];

    // Add components
    entities.forEach(entity => {
      const technology = this.getTechnology(entity);
      lines.push(`Component(${this.toCamelCase(entity.name)}, "${entity.name}", "${technology}")`);
    });

    lines.push('');

    // Add relationships
    relationships.forEach(rel => {
      const source = this.getEntityName(rel.source);
      const target = this.getEntityName(rel.target);
      lines.push(`Rel(${this.toCamelCase(source)}, ${this.toCamelCase(target)}, "${rel.label || 'Uses'}")`);
    });

    lines.push('');
    lines.push('SHOW_LEGEND()');
    lines.push('@enduml');

    return lines.join('\n');
  }

  /**
   * Generate Mermaid component diagram
   */
  private generateComponentMermaid(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): string {
    const lines: string[] = [
      '```mermaid',
      'C4Component',
      '',
      `title Component diagram for ${this.config.systemName}`,
      '',
    ];

    // Add components
    entities.forEach(entity => {
      const technology = this.getTechnology(entity);
      lines.push(`Component(${this.toCamelCase(entity.name)}, "${entity.name}", "${technology}")`);
    });

    lines.push('');

    // Add relationships
    relationships.forEach(rel => {
      const source = this.getEntityName(rel.source);
      const target = this.getEntityName(rel.target);
      lines.push(`Rel(${this.toCamelCase(source)}, ${this.toCamelCase(target)}, "${rel.label || 'Uses'}")`);
    });

    lines.push('```');

    return lines.join('\n');
  }

  /**
   * Generate C4 Deployment diagram
   */
  private generateDeploymentDiagram(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): string {
    if (this.config.format === 'mermaid') {
      return this.generateDeploymentMermaid(entities, relationships);
    }
    return this.generateDeploymentPlantUML(entities, relationships);
  }

  /**
   * Generate PlantUML deployment diagram
   */
  private generateDeploymentPlantUML(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): string {
    const lines: string[] = [
      '@startuml',
      '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Deployment.puml',
      '',
      'LAYOUT_WITH_LEGEND()',
      '',
      `title Deployment diagram for ${this.config.systemName}`,
      '',
      'Node(localhost, "localhost", "Docker") {',
      '    Container(web_app, "Web Application", "React")',
      '    ContainerDb(database, "Database", "PostgreSQL")',
      '}',
      '',
      'Rel(web_app, database, "Reads/Writes")',
      '',
      'SHOW_LEGEND()',
      '@enduml',
    ];

    return lines.join('\n');
  }

  /**
   * Generate Mermaid deployment diagram
   */
  private generateDeploymentMermaid(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): string {
    const lines: string[] = [
      '```mermaid',
      'C4Deployment',
      '',
      `title Deployment diagram for ${this.config.systemName}`,
      '',
      'ContainerDb( postgres, "Database", "PostgreSQL", "Stores data")',
      '',
      '```',
    ];

    return lines.join('\n');
  }

  /**
   * Categorize entities by type
   */
  private categorizeEntities(entities: CodeEntity[]): Record<string, CodeEntity[]> {
    const categories: Record<string, CodeEntity[]> = {
      presentation: [],
      business: [],
      data: [],
      domain: [],
      external: [],
    };

    entities.forEach(entity => {
      switch (entity.type) {
        case 'controller':
        case 'component':
          categories.presentation.push(entity);
          break;
        case 'service':
          categories.business.push(entity);
          break;
        case 'repository':
        case 'model':
          categories.data.push(entity);
          break;
        default:
          categories.domain.push(entity);
      }
    });

    return categories;
  }

  /**
   * Get technology string for entity
   */
  private getTechnology(entity: CodeEntity): string {
    const techMap: Record<string, string> = {
      controller: 'REST API',
      service: 'Business Logic',
      repository: 'Data Access',
      component: 'Component',
      model: 'Data Model',
      class: 'Class',
      interface: 'Interface',
    };

    return techMap[entity.type] || 'Technology';
  }

  /**
   * Convert to CamelCase
   */
  private toCamelCase(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_([a-z])/g, (_, c) => c.toUpperCase())
      .replace(/^./, s => s.toLowerCase());
  }

  /**
   * Get entity name from ID
   */
  private getEntityName(entityId: string): string {
    const parts = entityId.split(':');
    return parts[parts.length - 1];
  }
}

export default C4DiagramGenerator;
