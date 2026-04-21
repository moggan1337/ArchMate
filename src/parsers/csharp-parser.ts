/**
 * ArchMate - C# Parser
 * Pattern-based code analysis for C# source files
 */

import {
  CodeEntity,
  EntityType,
  Visibility,
  Language,
  Property,
  Method,
  Parameter,
  Relationship,
  ImportInfo,
  Modifier,
} from '../types';
import { IParser } from './parser-registry';

export class CSharpParser implements IParser {
  readonly language: Language = 'csharp';

  /**
   * Check if this parser can handle the file
   */
  canParse(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.cs');
  }

  /**
   * Parse C# source code
   */
  parse(source: string, filePath: string): CodeEntity[] {
    const entities: CodeEntity[] = [];

    // Extract using statements
    const imports = this.extractImports(source);

    // Extract namespace
    const namespaceMatch = source.match(/namespace\s+([\w.]+)/);
    const namespace_ = namespaceMatch ? namespaceMatch[1] : '';

    // Extract classes, interfaces, structs, enums
    const typeRegex = /(?:(\[[\w\s,]*\])\s+)*(?:(public|private|protected|internal)\s+)?(?:(?:abstract|sealed|static|partial)\s+)*(class|interface|struct|enum|record)\s+(\w+)(?:\s*:\s*([\w,\s<>]+))?/g;
    let match;

    while ((match = typeRegex.exec(source)) !== null) {
      const attributes = match[1] || '';
      const visibility = match[2];
      const modifiers = match[3] || '';
      const keyword = match[4];
      const typeName = match[5];
      const extends_ = match[6];

      const typeEntity = this.parseCSharpType(
        source,
        typeName,
        keyword,
        extends_,
        attributes,
        visibility,
        modifiers,
        filePath,
        namespace_,
        imports,
        match.index
      );

      entities.push(typeEntity);
    }

    return entities;
  }

  /**
   * Extract using statements
   */
  private extractImports(source: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const usingRegex = /^using\s+([\w.]+)(?:\s*=\s*[^;]+)?;/gm;
    let match;

    while ((match = usingRegex.exec(source)) !== null) {
      imports.push({
        source: match[1],
        imported: [match[1].split('.').pop() || match[1]],
        isDefault: false,
        isNamespace: true,
      });
    }

    return imports;
  }

  /**
   * Parse C# type (class, interface, struct, enum, record)
   */
  private parseCSharpType(
    source: string,
    typeName: string,
    keyword: string,
    extends_: string | undefined,
    attributes: string,
    visibility: string | undefined,
    modifiers: string,
    filePath: string,
    namespace_: string,
    imports: ImportInfo[],
    startIndex: number
  ): CodeEntity {
    // Find type boundaries
    let braceCount = 0;
    let typeStart = -1;
    let typeEnd = -1;

    for (let i = startIndex; i < source.length; i++) {
      if (source[i] === '{') {
        if (braceCount === 0) {
          typeStart = i;
        }
        braceCount++;
      } else if (source[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          typeEnd = i;
          break;
        }
      }
    }

    const typeBody = typeStart >= 0 && typeEnd >= 0
      ? source.substring(typeStart + 1, typeEnd)
      : '';

    const lines = source.substring(0, startIndex).split('\n');
    const lineNumber = lines.length;

    // Determine entity type
    let entityType: EntityType = 'class';
    if (keyword === 'interface') {
      entityType = 'interface';
    } else if (keyword === 'struct') {
      entityType = 'struct';
    } else if (keyword === 'enum') {
      entityType = 'enum';
    } else if (keyword === 'record') {
      entityType = 'class';
    }

    // Parse attributes
    const parsedAttributes = this.parseAttributes(attributes);

    // Detect stereotype from attributes
    if (parsedAttributes.includes('Controller') || parsedAttributes.includes('ApiController')) {
      entityType = 'controller';
    } else if (parsedAttributes.includes('Service') || parsedAttributes.includes('Scoped') || parsedAttributes.includes('Singleton') || parsedAttributes.includes('Transient')) {
      entityType = 'service';
    } else if (parsedAttributes.includes('Repository')) {
      entityType = 'repository';
    } else if (parsedAttributes.includes('Entity') || parsedAttributes.includes('Table')) {
      entityType = 'model';
    } else if (parsedAttributes.includes('Component')) {
      entityType = 'component';
    }

    // Parse properties and fields
    const properties = this.parseCSharpProperties(typeBody, lineNumber, filePath);

    // Parse methods
    const methods = this.parseCSharpMethods(typeBody, lineNumber, filePath);

    // Build modifiers
    const modifierList: Modifier[] = [];
    if (modifiers.includes('abstract')) modifierList.push('abstract');
    if (modifiers.includes('static')) modifierList.push('static');
    if (modifiers.includes('sealed')) modifierList.push('sealed');
    if (modifiers.includes('partial')) modifierList.push('partial');

    // Build dependencies
    const dependencies: string[] = [];
    if (extends_) {
      extends_.split(',').forEach(dep => {
        dependencies.push(dep.trim().split('<')[0].trim());
      });
    }
    properties.forEach(prop => {
      const baseType = prop.type.split('<')[0].trim();
      if (!dependencies.includes(baseType)) {
        dependencies.push(baseType);
      }
    });

    return {
      id: `${filePath}:${typeName}`,
      name: typeName,
      type: entityType,
      file: filePath,
      line: lineNumber,
      column: 0,
      visibility: this.getVisibility(visibility),
      modifiers: modifierList,
      documentation: this.getXMLDoc(lines),
      properties,
      methods,
      dependencies,
      annotations: parsedAttributes,
      imports,
      exports: [typeName],
    };
  }

  /**
   * Parse attributes string
   */
  private parseAttributes(attributes: string): string[] {
    if (!attributes) return [];

    return attributes
      .replace(/[\[\]]/g, '')
      .split(',')
      .map(attr => attr.trim())
      .filter(Boolean);
  }

  /**
   * Parse C# properties
   */
  private parseCSharpProperties(
    typeBody: string,
    startLine: number,
    filePath: string
  ): Property[] {
    const properties: Property[] = [];

    // Match auto-properties and fields
    const propRegex = /(?:\[([\w\s,]*)\]\s+)*(?:(public|private|protected|internal)\s+)?(?:(?:static|readonly|const|volatile)\s+)*(?:(\w+(?:<[^>]+>)?(?:\[\])*)\s+)?(\w+)\s*(?:{\s*get\s*;\s*set\s*;\s*}|=\s*([^;]+);|;)/g;
    let match;

    while ((match = propRegex.exec(typeBody)) !== null) {
      const propAttributes = match[1] || '';
      const visibility = match[2];
      const propType = match[3] || 'object';
      const propName = match[4];
      const defaultValue = match[5];

      if (propName && !propName.startsWith('_') && !propName.includes('<')) {
        properties.push({
          name: propName,
          type: propType,
          visibility: this.getVisibility(visibility),
          isStatic: match[0].includes('static'),
          isReadonly: match[0].includes('readonly'),
          isOptional: propType.includes('?'),
          defaultValue,
          decorators: this.parseAttributes(propAttributes),
        });
      }
    }

    return properties;
  }

  /**
   * Parse C# methods
   */
  private parseCSharpMethods(
    typeBody: string,
    startLine: number,
    filePath: string
  ): Method[] {
    const methods: Method[] = [];

    // Match method declarations
    const methodRegex = /(?:\[([\w\s,]*)\]\s+)*(?:(public|private|protected|internal)\s+)?(?:(?:static|virtual|override|abstract|sealed|async)\s+)*(\w+(?:<[^>]+>)?(?:\[\])*)\s+(\w+)\s*\(([^)]*)\)(?:\s*where\s+[\w:\s+]+)?\s*(?:{|=>)/g;
    let match;

    while ((match = methodRegex.exec(typeBody)) !== null) {
      const methodAttributes = match[1] || '';
      const visibility = match[2];
      const returnType = match[3];
      const methodName = match[4];
      const params = match[5];

      if (methodName && !methodName.match(/^(get_|set_|add_|remove_)/)) {
        const parameters = this.parseCSharpParams(params);
        const isAsync = match[0].includes('async');
        const isStatic = match[0].includes('static');
        const isAbstract = match[0].includes('abstract');

        methods.push({
          name: methodName,
          parameters,
          returnType,
          visibility: this.getVisibility(visibility),
          isStatic,
          isAsync,
          isAbstract,
          decorators: this.parseAttributes(methodAttributes),
          calls: [],
        });
      }
    }

    return methods;
  }

  /**
   * Parse C# parameters
   */
  private parseCSharpParams(paramsStr: string): Parameter[] {
    if (!paramsStr.trim()) return [];

    return paramsStr.split(',').map(param => {
      const trimmed = param.trim();
      const parts = trimmed.split(/\s+/);
      const type = parts[0] || 'object';
      const name = parts.slice(1).join(' ').split('=')[0].trim() || 'arg';
      const defaultValue = trimmed.includes('=') ? trimmed.split('=')[1].trim() : undefined;

      return {
        name,
        type: type.replace(/\?$/, ''),
        isOptional: trimmed.includes('?') || !!defaultValue,
        isRest: name.startsWith('params'),
        defaultValue,
      };
    });
  }

  /**
   * Get visibility
   */
  private getVisibility(modifier: string | undefined): Visibility {
    switch (modifier?.trim()) {
      case 'private':
        return 'private';
      case 'protected':
        return 'protected';
      case 'internal':
        return 'internal';
      default:
        return 'public';
    }
  }

  /**
   * Get XML documentation
   */
  private getXMLDoc(lines: string[]): string | undefined {
    const docRegex = ////\s*(.+)/g;
    const docLines = lines.slice(-20).join('\n').match(docRegex);

    if (docLines) {
      return docLines
        .map(line => line.replace(////\s*/, ''))
        .join('\n')
        .trim();
    }

    return undefined;
  }

  /**
   * Parse relationships between entities
   */
  parseRelationships(entities: CodeEntity[]): Relationship[] {
    const relationships: Relationship[] = [];

    entities.forEach(entity => {
      entity.dependencies.forEach(dep => {
        const targetEntity = entities.find(e =>
          e.name === dep ||
          e.name === dep.split('<')[0].trim()
        );

        if (targetEntity && targetEntity.id !== entity.id) {
          const isInheritance =
            (entity.type === 'class' && targetEntity.type === 'class') ||
            (entity.type === 'interface' && targetEntity.type === 'interface');

          relationships.push({
            id: `${entity.id}->${targetEntity.id}`,
            source: entity.id,
            target: targetEntity.id,
            type: isInheritance ? 'extends' : 'implements',
            label: isInheritance ? 'extends' : 'implements',
          });
        }
      });
    });

    return relationships;
  }
}
