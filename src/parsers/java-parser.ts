/**
 * ArchMate - Java Parser
 * Pattern-based code analysis for Java source files
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
} from '../types';
import { IParser } from './parser-registry';

export class JavaParser implements IParser {
  readonly language: Language = 'java';

  /**
   * Check if this parser can handle the file
   */
  canParse(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.java');
  }

  /**
   * Parse Java source code
   */
  parse(source: string, filePath: string): CodeEntity[] {
    const entities: CodeEntity[] = [];

    // Extract imports
    const imports = this.extractImports(source);

    // Extract package declaration
    const packageMatch = source.match(/^package\s+([\w.]+);/m);
    const packageName = packageMatch ? packageMatch[1] : '';

    // Extract classes, interfaces, enums
    const classRegex = /(?:public\s+|private\s+|protected\s+)?(?:abstract\s+|final\s+|strictfp\s+)*(class|interface|enum)\s+(\w+)(?:\s+extends\s+([\w<>.,\s]+))?(?:\s+implements\s+([\w<>.,\s]+))?/g;
    let match;

    while ((match = classRegex.exec(source)) !== null) {
      const keyword = match[1];
      const className = match[2];
      const extends_ = match[3]?.trim();
      const implements_ = match[4]?.trim();

      const classEntity = this.parseJavaClass(
        source,
        className,
        keyword,
        extends_,
        implements_,
        filePath,
        packageName,
        imports,
        match.index
      );

      entities.push(classEntity);
    }

    return entities;
  }

  /**
   * Extract imports from Java source
   */
  private extractImports(source: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const importRegex = /^import\s+(?:static\s+)?([\w.*]+);/gm;
    let match;

    while ((match = importRegex.exec(source)) !== null) {
      const fullImport = match[1];
      const parts = fullImport.split('.');

      imports.push({
        source: fullImport,
        imported: [parts[parts.length - 1]],
        isDefault: fullImport.includes('.*'),
        isNamespace: fullImport.includes('.*'),
      });
    }

    return imports;
  }

  /**
   * Parse Java class/interface/enum
   */
  private parseJavaClass(
    source: string,
    className: string,
    keyword: string,
    extends_: string | undefined,
    implements_: string | undefined,
    filePath: string,
    packageName: string,
    imports: ImportInfo[],
    startIndex: number
  ): CodeEntity {
    // Find class boundaries
    const classStart = source.substring(0, startIndex).lastIndexOf('{');
    let braceCount = 0;
    let classEnd = classStart;

    for (let i = classStart; i < source.length; i++) {
      if (source[i] === '{') braceCount++;
      else if (source[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          classEnd = i;
          break;
        }
      }
    }

    const classBody = source.substring(classStart + 1, classEnd);
    const lines = source.substring(0, classStart).split('\n');
    const lineNumber = lines.length;

    // Determine entity type
    let entityType: EntityType = 'class';
    if (keyword === 'interface') {
      entityType = 'interface';
    } else if (keyword === 'enum') {
      entityType = 'enum';
    }

    // Extract annotations
    const classAnnotations = this.getJavaAnnotations(lines, lines.length - 1);

    // Detect stereotype from annotations
    if (classAnnotations.includes('Component')) {
      entityType = 'component';
    } else if (classAnnotations.includes('Service')) {
      entityType = 'service';
    } else if (classAnnotations.includes('Controller') || classAnnotations.includes('RestController')) {
      entityType = 'controller';
    } else if (classAnnotations.includes('Repository')) {
      entityType = 'repository';
    } else if (classAnnotations.includes('Entity')) {
      entityType = 'model';
    }

    // Parse fields
    const fields = this.parseJavaFields(classBody, lineNumber, filePath);

    // Parse methods
    const methods = this.parseJavaMethods(classBody, lineNumber, filePath);

    // Build dependencies
    const dependencies: string[] = [];
    if (extends_) {
      dependencies.push(extends_.split('<')[0].trim());
    }
    if (implements_) {
      implements_.split(',').forEach(impl => {
        dependencies.push(impl.split('<')[0].trim());
      });
    }
    fields.forEach(field => {
      if (!dependencies.includes(field.type)) {
        dependencies.push(field.type);
      }
    });

    return {
      id: `${filePath}:${className}`,
      name: className,
      type: entityType,
      file: filePath,
      line: lineNumber,
      column: 0,
      visibility: 'public',
      modifiers: [],
      documentation: this.getJavaDoc(lines),
      properties: fields,
      methods,
      dependencies,
      annotations: classAnnotations,
      imports,
      exports: [className],
    };
  }

  /**
   * Parse Java fields
   */
  private parseJavaFields(
    classBody: string,
    startLine: number,
    filePath: string
  ): Property[] {
    const fields: Property[] = [];
    const fieldRegex = /(?:@\w+(?:\([^)]*\))?\s+)*(?:(public|private|protected)\s+)?(?:(?:static|final|volatile|transient)\s+)*(?:final\s+)?(\w+(?:<[^>]+>)?(?:\[\])*)\s+(\w+)(?:\s*=\s*([^;]+))?;/g;
    let match;

    while ((match = fieldRegex.exec(classBody)) !== null) {
      const visibility = this.getVisibility(match[1]);
      const type = match[2];
      const name = match[3];
      const defaultValue = match[4];

      if (!name.startsWith('this.') && !name.includes('$')) {
        fields.push({
          name,
          type,
          visibility,
          isStatic: match[0].includes('static'),
          isReadonly: match[0].includes('final'),
          isOptional: false,
          defaultValue,
          decorators: [],
        });
      }
    }

    return fields;
  }

  /**
   * Parse Java methods
   */
  private parseJavaMethods(
    classBody: string,
    startLine: number,
    filePath: string
  ): Method[] {
    const methods: Method[] = [];

    // Match method declarations with balanced braces
    const methodRegex = /(?:@\w+(?:\([^)]*\))?\s+)*((?:public|private|protected)\s+)?(?:(?:static|final|abstract|synchronized)\s+)*(\w+(?:<[^>]+>)?)\s+(\w+)\s*\(([^)]*)\)(?:\s+throws\s+([\w,\s]+))?\s*\{/g;
    let match;

    while ((match = methodRegex.exec(classBody)) !== null) {
      const visibility = this.getVisibility(match[1]);
      const returnType = match[2];
      const methodName = match[3];
      const params = this.parseJavaParams(match[4]);
      const throws = match[5];

      // Extract method body calls
      const bodyStart = match.index + match[0].length - 1;
      const calls = this.extractJavaCalls(classBody, bodyStart);

      methods.push({
        name: methodName,
        parameters: params,
        returnType,
        visibility,
        isStatic: match[0].includes('static'),
        isAsync: false,
        isAbstract: match[0].includes('abstract'),
        decorators: [],
        calls,
      });
    }

    return methods;
  }

  /**
   * Parse Java parameters
   */
  private parseJavaParams(paramsStr: string): Parameter[] {
    if (!paramsStr.trim()) return [];

    return paramsStr.split(',').map(param => {
      const parts = param.trim().split(/\s+/);
      const type = parts[0] || 'Object';
      const name = parts[1] || 'arg';
      const isOptional = param.includes('@Nullable') || param.includes('Optional');

      return {
        name,
        type,
        isOptional,
        isRest: name.startsWith('...'),
      };
    });
  }

  /**
   * Extract method calls from Java code
   */
  private extractJavaCalls(body: string, startIndex: number): string[] {
    const calls: string[] = [];
    const callRegex = /(\w+)\.(\w+)\s*\(/g;
    let match;

    while ((match = callRegex.exec(body.substring(startIndex))) !== null) {
      const obj = match[1];
      const method = match[2];
      if (!['this', 'super', 'if', 'for', 'while', 'switch', 'try', 'catch'].includes(obj)) {
        calls.push(`${obj}.${method}`);
      }
    }

    return [...new Set(calls)];
  }

  /**
   * Get Java annotations for a line
   */
  private getJavaAnnotations(lines: string[], lineIndex: number): string[] {
    const annotations: string[] = [];

    for (let i = lineIndex - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('@')) {
        annotations.push(line.substring(1).split('(')[0].trim());
      } else if (line && !line.startsWith('//') && !line.startsWith('*')) {
        break;
      }
    }

    return annotations;
  }

  /**
   * Get JavaDoc comment
   */
  private getJavaDoc(lines: string[]): string | undefined {
    const javadocRegex = /\/\*\*([\s\S]*?)\*\//;
    const lastLines = lines.slice(-10).join('\n');
    const match = lastLines.match(javadocRegex);

    if (match) {
      return match[1]
        .replace(/^\s*\*\s*/gm, '')
        .replace(/^\s*\*\/?/gm, '')
        .trim();
    }

    return undefined;
  }

  /**
   * Get visibility modifier
   */
  private getVisibility(modifier: string | undefined): Visibility {
    switch (modifier?.trim()) {
      case 'private':
        return 'private';
      case 'protected':
        return 'protected';
      default:
        return 'public';
    }
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
          const isInheritance = entity.type === 'class' && targetEntity.type === 'class';
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
