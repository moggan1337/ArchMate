/**
 * ArchMate - ER Diagram Generator
 * Generates Entity-Relationship diagrams
 */

import {
  CodeEntity,
  Relationship,
  DBEntity,
  DBColumn,
  ERDiagram,
  ERRelationship,
  DBForeignKey,
} from '../types';

export interface ERConfig {
  format: 'plantuml' | 'mermaid' | 'dbml';
  showTypes: boolean;
  showNullability: boolean;
  showDefaults: boolean;
  showIndexes: boolean;
  notation: 'crow' | 'uml' | 'idefx1x';
}

/**
 * ER Diagram Generator
 */
export class ERDiagramGenerator {
  private config: ERConfig;

  constructor(config: Partial<ERConfig> = {}) {
    this.config = {
      format: config.format || 'plantuml',
      showTypes: config.showTypes ?? true,
      showNullability: config.showNullability ?? true,
      showDefaults: config.showDefaults ?? false,
      showIndexes: config.showIndexes ?? false,
      notation: config.notation || 'crow',
    };
  }

  /**
   * Generate ER diagram from entities and relationships
   */
  generate(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): string {
    // Convert code entities to database entities
    const dbEntities = this.convertToDBEntities(entities);
    const erRelationships = this.extractRelationships(dbEntities, relationships);

    const diagram: ERDiagram = {
      entities: dbEntities,
      relationships: erRelationships,
      options: {
        showSchema: false,
        showTypes: this.config.showTypes,
        showNullability: this.config.showNullability,
        showDefaults: this.config.showDefaults,
        showIndexes: this.config.showIndexes,
        notation: this.config.notation === 'crow' ? ' crow\'s foot' : 'uml',
      },
    };

    switch (this.config.format) {
      case 'mermaid':
        return this.generateMermaid(diagram);
      case 'dbml':
        return this.generateDBML(diagram);
      default:
        return this.generatePlantUML(diagram);
    }
  }

  /**
   * Convert code entities to database entities
   */
  private convertToDBEntities(entities: CodeEntity[]): DBEntity[] {
    const dbEntities: DBEntity[] = [];

    entities.forEach(entity => {
      // Focus on model/entity types
      if (entity.type === 'model' || entity.type === 'class' || entity.type === 'entity') {
        const columns: DBColumn[] = [];
        const primaryKey: string[] = [];
        const foreignKeys: DBForeignKey[] = [];

        // Convert properties to columns
        entity.properties.forEach(prop => {
          const isPrimaryKey = prop.name.toLowerCase() === 'id' ||
            prop.annotations.includes('Id') ||
            prop.annotations.includes('PrimaryKey');

          if (isPrimaryKey) {
            primaryKey.push(prop.name);
          }

          // Check for foreign key
          const isForeignKey = prop.name.endsWith('id') ||
            prop.name.endsWith('Id') ||
            prop.annotations.includes('ForeignKey');

          if (isForeignKey) {
            const referencedTable = this.inferReferencedTable(prop.name, entities);
            if (referencedTable) {
              foreignKeys.push({
                column: prop.name,
                references: {
                  table: referencedTable,
                  column: 'id',
                  onDelete: 'cascade',
                  onUpdate: 'cascade',
                },
              });
            }
          }

          columns.push({
            name: prop.name,
            type: this.mapToDBType(prop.type),
            nullable: prop.isOptional,
            isPrimaryKey,
            isForeignKey,
            defaultValue: prop.defaultValue,
            isUnique: prop.annotations.includes('Unique'),
            isAutoIncrement: prop.annotations.includes('AutoIncrement') ||
              prop.annotations.includes('GeneratedValue'),
          });
        });

        // Add methods as columns if they look like relationships
        entity.methods.forEach(method => {
          if (method.name.startsWith('get') || method.name.startsWith('set')) {
            const propName = method.name.replace(/^(get|set)/, '');
            const lowerPropName = propName.charAt(0).toLowerCase() + propName.slice(1);

            if (!columns.some(c => c.name === lowerPropName)) {
              columns.push({
                name: lowerPropName,
                type: 'VARCHAR(255)',
                nullable: true,
                isPrimaryKey: false,
                isForeignKey: false,
                isUnique: false,
                isAutoIncrement: false,
              });
            }
          }
        });

        dbEntities.push({
          name: entity.name,
          columns,
          primaryKey,
          foreignKeys,
          indexes: [],
          constraints: [],
        });
      }
    });

    return dbEntities;
  }

  /**
   * Map TypeScript/Java type to database type
   */
  private mapToDBType(type: string): string {
    const typeMap: Record<string, string> = {
      'string': 'VARCHAR(255)',
      'String': 'VARCHAR(255)',
      'number': 'INTEGER',
      'int': 'INTEGER',
      'Int32': 'INTEGER',
      'Int64': 'BIGINT',
      'float': 'FLOAT',
      'double': 'DOUBLE',
      'decimal': 'DECIMAL(10,2)',
      'boolean': 'BOOLEAN',
      'bool': 'BOOLEAN',
      'Date': 'TIMESTAMP',
      'DateTime': 'TIMESTAMP',
      'timestamp': 'TIMESTAMP',
      'any': 'TEXT',
      'object': 'JSONB',
      'JSON': 'JSONB',
      'Array': 'ARRAY',
      'any[]': 'ARRAY',
      'string[]': 'TEXT[]',
      'number[]': 'INTEGER[]',
    };

    // Handle generic types
    const genericMatch = type.match(/^(\w+)<(\w+)>$/);
    if (genericMatch) {
      const [, baseType, genericType] = genericMatch;
      if (baseType === 'Array' || baseType === 'List') {
        return `${this.mapToDBType(genericType)}[]`;
      }
      if (baseType === 'Map') {
        return 'JSONB';
      }
    }

    // Handle arrays
    if (type.endsWith('[]')) {
      const elementType = type.slice(0, -2);
      return `${this.mapToDBType(elementType)}[]`;
    }

    // Handle optional types
    const optionalType = type.replace(/\?$/, '');
    if (optionalType !== type) {
      return this.mapToDBType(optionalType);
    }

    return typeMap[type] || 'VARCHAR(255)';
  }

  /**
   * Infer referenced table from foreign key name
   */
  private inferReferencedTable(fkName: string, entities: CodeEntity[]): string | undefined {
    // Remove 'id' suffix
    let tableName = fkName.replace(/[iI][dD]$/, '');

    // Convert to PascalCase for matching
    tableName = tableName.charAt(0).toUpperCase() + tableName.slice(1);

    // Find matching entity
    const matchingEntity = entities.find(e =>
      e.name.toLowerCase() === tableName.toLowerCase() ||
      e.name.toLowerCase() === `${tableName.toLowerCase()}`
    );

    return matchingEntity?.name;
  }

  /**
   * Extract ER relationships
   */
  private extractRelationships(
    dbEntities: DBEntity[],
    relationships: Relationship[]
  ): ERRelationship[] {
    const erRelationships: ERRelationship[] = [];

    dbEntities.forEach(entity => {
      entity.foreignKeys.forEach(fk => {
        const targetEntity = dbEntities.find(e =>
          e.name.toLowerCase() === fk.references.table.toLowerCase()
        );

        if (targetEntity) {
          const fromCardinality = entity.columns.filter(c => !c.isPrimaryKey).length > 1
            ? 'many'
            : 'one';
          const toCardinality = targetEntity.primaryKey.length > 1 ||
            targetEntity.columns.filter(c => !c.isPrimaryKey).length > 1
            ? 'many'
            : 'one';

          erRelationships.push({
            from: {
              entity: entity.name,
              column: fk.column,
            },
            to: {
              entity: targetEntity.name,
              column: fk.references.column,
            },
            type: `${fromCardinality}-to-${toCardinality}`,
            isIdentifying: true,
          });
        }
      });
    });

    return erRelationships;
  }

  /**
   * Generate PlantUML ER diagram
   */
  private generatePlantUML(diagram: ERDiagram): string {
    const lines: string[] = [
      '@startuml',
      '!pragma layout elk',
      '',
      'hide circle',
      'hide methods',
      'hide stereotypes',
      '',
    ];

    // Generate entities
    diagram.entities.forEach(entity => {
      lines.push(`entity "${entity.name}" {`);
      lines.push('  <<table>>');

      // Primary key
      if (entity.primaryKey.length > 0) {
        lines.push(`  ${entity.primaryKey.join(', ')}`);
      }

      // Columns
      entity.columns.forEach(column => {
        let colDef = `  ${column.name}`;

        if (this.config.showTypes) {
          colDef += ` : ${column.type}`;
        }

        if (this.config.showNullability && column.nullable) {
          colDef += ' (PK)';
        }

        lines.push(colDef);
      });

      lines.push('}');
      lines.push('');
    });

    // Generate relationships
    diagram.relationships.forEach(rel => {
      const notation = this.getRelationshipNotation(rel.type);
      lines.push(`${rel.from.entity} ${notation} ${rel.to.entity}`);
    });

    lines.push('');
    lines.push('@enduml');

    return lines.join('\n');
  }

  /**
   * Generate Mermaid ER diagram
   */
  private generateMermaid(diagram: ERDiagram): string {
    const lines: string[] = [
      '```mermaid',
      'erDiagram',
      '',
    ];

    // Generate entities with columns
    diagram.entities.forEach(entity => {
      const entityName = entity.name.replace(/\s+/g, '_');
      lines.push(`    ${entityName} {`);

      entity.columns.forEach(column => {
        let type = column.type;
        if (column.isPrimaryKey) {
          type += ' PK';
        }
        if (column.isForeignKey) {
          type += ' FK';
        }
        if (this.config.showNullability && column.nullable) {
          type += ' nullable';
        }
        lines.push(`        ${column.name} ${type}`);
      });

      lines.push('    }');
      lines.push('');
    });

    // Generate relationships
    diagram.relationships.forEach(rel => {
      const fromName = rel.from.entity.replace(/\s+/g, '_');
      const toName = rel.to.entity.replace(/\s+/g, '_');

      let cardinality = '';
      switch (rel.type) {
        case 'one-to-one':
          cardinality = '||--||';
          break;
        case 'one-to-many':
          cardinality = '||--o{';
          break;
        case 'many-to-many':
          cardinality = 'o{--o{';
          break;
        default:
          cardinality = '||--||';
      }

      lines.push(`    ${fromName} ${cardinality} ${toName} : "${rel.from.column} -> ${rel.to.column}"`);
    });

    lines.push('```');

    return lines.join('\n');
  }

  /**
   * Generate DBML
   */
  private generateDBML(diagram: ERDiagram): string {
    const lines: string[] = [
      '// Database Schema',
      '',
    ];

    // Generate tables
    diagram.entities.forEach(entity => {
      lines.push(`Table ${entity.name.toLowerCase()} {`);
      lines.push(`  ${entity.primaryKey.join(', ')} [pk]`);

      entity.columns.forEach(column => {
        let colDef = `  ${column.name} ${column.type}`;

        if (!column.nullable) {
          colDef += ' [not null]';
        }
        if (column.isUnique) {
          colDef += ' [unique]';
        }
        if (column.isAutoIncrement) {
          colDef += ' [increment]';
        }

        lines.push(colDef);
      });

      lines.push('}');
      lines.push('');
    });

    // Generate refs
    diagram.relationships.forEach(rel => {
      lines.push(`Ref: ${rel.from.entity}.${rel.from.column} > ${rel.to.entity}.${rel.to.column} [${rel.type}]`);
    });

    return lines.join('\n');
  }

  /**
   * Get relationship notation for PlantUML
   */
  private getRelationshipNotation(type: string): string {
    switch (type) {
      case 'one-to-one':
        return '||--||';
      case 'one-to-many':
        return '||--o{';
      case 'many-to-many':
        return 'o{--o{';
      default:
        return '||--||';
    }
  }
}

export default ERDiagramGenerator;
