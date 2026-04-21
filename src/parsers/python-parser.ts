/**
 * ArchMate - Python Parser
 * AST-based code analysis for Python source files
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

// Simple regex-based Python parser (AST parsing would require Python's ast module)
// For production, consider using python-parser or similar libraries

export class PythonParser implements IParser {
  readonly language: Language = 'python';

  /**
   * Check if this parser can handle the file
   */
  canParse(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.py');
  }

  /**
   * Parse Python source code
   */
  parse(source: string, filePath: string): CodeEntity[] {
    const entities: CodeEntity[] = [];

    // Extract imports
    const imports = this.extractImports(source);

    // Extract classes
    const classMatches = source.match(/^class\s+(\w+)(?:\([^)]+\))?\s*:/gm);
    if (classMatches) {
      classMatches.forEach(match => {
        const className = match.replace(/^class\s+/, '').replace(/\(.*/, '').replace(/\s*:/, '');
        const classEntity = this.parsePythonClass(source, className, filePath, imports);
        entities.push(classEntity);
      });
    }

    // Extract functions (not inside classes)
    const lines = source.split('\n');
    let inClass = false;
    let classIndent = 0;

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Track class scope
      if (trimmed.startsWith('class ') && trimmed.endsWith(':')) {
        inClass = true;
        classIndent = line.search(/\S/);
      } else if (inClass && line.search(/\S/) <= classIndent && trimmed) {
        inClass = false;
      }

      // Extract top-level functions
      if (!inClass && /^def\s+(\w+)\s*\(/.test(trimmed)) {
        const funcMatch = trimmed.match(/^def\s+(\w+)\s*\(([^)]*)\)/);
        if (funcMatch) {
          const funcName = funcMatch[1];
          const params = this.parsePythonParams(funcMatch[2]);
          const calls = this.extractPythonCalls(lines, index);

          entities.push({
            id: `${filePath}:${funcName}`,
            name: funcName,
            type: 'function',
            file: filePath,
            line: index + 1,
            column: line.indexOf('def'),
            visibility: 'public',
            modifiers: [],
            documentation: this.getDocstring(lines, index),
            properties: [],
            methods: [{
              name: funcName,
              parameters: params,
              returnType: 'Any',
              visibility: 'public',
              isStatic: false,
              isAsync: trimmed.includes('async'),
              isAbstract: false,
              decorators: this.getDecorators(lines, index),
              calls,
            }],
            dependencies: calls,
            annotations: this.getDecorators(lines, index),
            imports,
            exports: [funcName],
          });
        }
      }
    });

    return entities;
  }

  /**
   * Extract imports from Python source
   */
  private extractImports(source: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const importRegex = /^((?:import|from)\s+[\w.]+)(?:\s+import\s+(.+))?/gm;
    let match;

    while ((match = importRegex.exec(source)) !== null) {
      const fullImport = match[0];
      const imported: string[] = [];

      if (match[2]) {
        // from X import Y, Z
        match[2].split(',').forEach(item => {
          imported.push(item.trim().split(' as ')[0].trim());
        });
      }

      imports.push({
        source: fullImport.replace(/^from\s+/, '').replace(/^import\s+/, '').trim(),
        imported,
        isDefault: false,
        isNamespace: fullImport.startsWith('import '),
      });
    }

    return imports;
  }

  /**
   * Parse Python class
   */
  private parsePythonClass(
    source: string,
    className: string,
    filePath: string,
    imports: ImportInfo[]
  ): CodeEntity {
    const lines = source.split('\n');
    const classLineIndex = lines.findIndex(line =>
      line.trim().startsWith(`class ${className}`)
    );

    const classLine = lines[classLineIndex] || '';
    const classIndent = classLine.search(/\S/);
    const properties: Property[] = [];
    const methods: Method[] = [];
    const dependencies: string[] = [];

    // Get parent classes
    const parentMatch = classLine.match(/\(([^)]+)\)/);
    const parents = parentMatch ? parentMatch[1].split(',').map(p => p.trim()) : [];

    // Parse class body
    let methodIndent = classIndent + 4;
    let inMethod = false;
    let currentMethod: { start: number; lines: string[] } | null = null;
    const methodLines: string[] = [];

    for (let i = classLineIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const lineIndent = line.search(/\S/);

      // Check if we've exited the class
      if (lineIndent <= classIndent && trimmed && !trimmed.startsWith('#')) {
        break;
      }

      // Skip indentation and empty lines
      if (lineIndent < methodIndent && !inMethod) {
        continue;
      }

      // Decorator detection
      if (trimmed.startsWith('@') && !inMethod) {
        methodLines.push(trimmed);
        continue;
      }

      // Method detection
      const methodMatch = trimmed.match(/^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?\s*:/);
      if (methodMatch && lineIndent === methodIndent) {
        // Process previous method
        if (currentMethod) {
          const parsedMethod = this.parsePythonMethod(
            currentMethod.lines,
            currentMethod.start,
            filePath
          );
          methods.push(parsedMethod);
          parsedMethod.calls.forEach(call => {
            if (!dependencies.includes(call)) {
              dependencies.push(call);
            }
          });
        }

        // Start new method
        currentMethod = { start: i, lines: [line] };
        inMethod = true;
      } else if (inMethod && currentMethod) {
        currentMethod.lines.push(line);

        // Check for end of method
        if (lineIndent <= methodIndent && trimmed && !trimmed.startsWith('#')) {
          inMethod = false;
          const parsedMethod = this.parsePythonMethod(
            currentMethod.lines,
            currentMethod.start,
            filePath
          );
          methods.push(parsedMethod);
          parsedMethod.calls.forEach(call => {
            if (!dependencies.includes(call)) {
              dependencies.push(call);
            }
          });
          currentMethod = null;
        }
      } else if (!trimmed.startsWith('#') && lineIndent > methodIndent && !trimmed.startsWith('@')) {
        // Property assignment at class level
        const propMatch = trimmed.match(/^(\w+)\s*=/);
        if (propMatch && !inMethod) {
          const propName = propMatch[1];
          if (!propName.startsWith('_') || propName.startsWith('__')) {
            properties.push({
              name: propName,
              type: 'Any',
              visibility: propName.startsWith('__') ? 'private' : 'public',
              isStatic: false,
              isReadonly: false,
              isOptional: false,
              decorators: [],
            });
          }
        }
      }
    }

    // Process last method
    if (currentMethod) {
      const parsedMethod = this.parsePythonMethod(
        currentMethod.lines,
        currentMethod.start,
        filePath
      );
      methods.push(parsedMethod);
      parsedMethod.calls.forEach(call => {
        if (!dependencies.includes(call)) {
          dependencies.push(call);
        }
      });
    }

    // Determine entity type
    let entityType: EntityType = 'class';
    const decorators = this.getDecorators(lines, classLineIndex);
    if (decorators.includes('dataclass')) {
      entityType = 'model';
    } else if (decorators.includes('service') || decorators.includes('Service')) {
      entityType = 'service';
    } else if (decorators.includes('controller') || decorators.includes('Controller')) {
      entityType = 'controller';
    }

    return {
      id: `${filePath}:${className}`,
      name: className,
      type: entityType,
      file: filePath,
      line: classLineIndex + 1,
      column: classLine.indexOf('class'),
      visibility: 'public',
      modifiers: [],
      documentation: this.getDocstring(lines, classLineIndex),
      properties,
      methods,
      dependencies: [...parents, ...dependencies],
      annotations: decorators,
      imports,
      exports: [className],
    };
  }

  /**
   * Parse Python method
   */
  private parsePythonMethod(
    lines: string[],
    startLine: number,
    filePath: string
  ): Method {
    const firstLine = lines[0].trim();
    const methodMatch = firstLine.match(/^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?\s*:/);

    if (!methodMatch) {
      return {
        name: 'unknown',
        parameters: [],
        returnType: 'Any',
        visibility: 'public',
        isStatic: false,
        isAsync: false,
        isAbstract: false,
        decorators: [],
        calls: [],
      };
    }

    const methodName = methodMatch[1];
    const params = this.parsePythonParams(methodMatch[2]);
    const returnType = methodMatch[3] || 'None';
    const isAsync = firstLine.includes('async');
    const decorators = this.getDecorators(lines, startLine);

    // Extract method calls from body
    const calls: string[] = [];
    const bodyStart = lines[0].indexOf(':') + 1;

    lines.slice(1).forEach(line => {
      const trimmed = line.trim();
      // Match method calls like self.method(), obj.method(), etc.
      const callMatch = trimmed.match(/(?:self\.|(\w+)\.)(\w+)\s*\(/);
      if (callMatch) {
        const obj = callMatch[1] || 'self';
        const method = callMatch[2];
        calls.push(`${obj}.${method}`);
      }

      // Match function calls
      const funcMatch = trimmed.match(/^(\w+)\s*\(/);
      if (funcMatch && !['if', 'for', 'while', 'with', 'return', 'raise', 'assert'].includes(funcMatch[1])) {
        calls.push(funcMatch[1]);
      }
    });

    return {
      name: methodName,
      parameters: params,
      returnType,
      visibility: methodName.startsWith('_') ? 'private' : 'public',
      isStatic: decorators.includes('staticmethod'),
      isAsync,
      isAbstract: decorators.includes('abstractmethod'),
      decorators,
      calls,
    };
  }

  /**
   * Parse Python function parameters
   */
  private parsePythonParams(paramsStr: string): Parameter[] {
    if (!paramsStr.trim()) return [];

    return paramsStr.split(',').map(param => {
      const parts = param.trim().split(':');
      const name = parts[0].trim().split('=')[0].trim();
      const type = parts[1]?.trim().split('=')[0].trim() || 'Any';
      const defaultValue = parts[0].includes('=') ? parts[0].split('=')[1].trim() : undefined;

      return {
        name,
        type,
        isOptional: !!defaultValue || type.includes('Optional'),
        isRest: name.startsWith('*'),
        defaultValue,
      };
    });
  }

  /**
   * Get decorators for a line
   */
  private getDecorators(lines: string[], lineIndex: number): string[] {
    const decorators: string[] = [];

    for (let i = lineIndex - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('@')) {
        decorators.push(line.substring(1).split('(')[0].trim());
      } else if (line && !line.startsWith('#')) {
        break;
      }
    }

    return decorators;
  }

  /**
   * Get docstring for a definition
   */
  private getDocstring(lines: string[], lineIndex: number): string | undefined {
    const line = lines[lineIndex];
    const afterLine = lines.slice(lineIndex + 1).join('\n');

    const docstringMatch = afterLine.match(/^\s*"""([\s\S]*?)"""/);
    if (docstringMatch) {
      return docstringMatch[1].trim();
    }

    const singleQuoteMatch = afterLine.match(/^\s*'''([\s\S]*?)'''/);
    if (singleQuoteMatch) {
      return singleQuoteMatch[1].trim();
    }

    return undefined;
  }

  /**
   * Extract Python function calls from lines
   */
  private extractPythonCalls(lines: string[], startIndex: number): string[] {
    const calls: string[] = [];

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      const callMatch = line.match(/(\w+)\s*\(/);
      if (callMatch && !['if', 'for', 'while', 'with', 'return', 'raise', 'print', 'assert', 'len', 'str', 'int', 'float', 'list', 'dict', 'set', 'tuple', 'range', 'enumerate', 'zip', 'map', 'filter'].includes(callMatch[1])) {
        if (!calls.includes(callMatch[1])) {
          calls.push(callMatch[1]);
        }
      }
    }

    return calls;
  }

  /**
   * Parse relationships between entities
   */
  parseRelationships(entities: CodeEntity[]): Relationship[] {
    const relationships: Relationship[] = [];

    entities.forEach(entity => {
      // Add inheritance relationships
      entity.dependencies.forEach(dep => {
        const targetEntity = entities.find(e => e.name === dep);

        if (targetEntity && targetEntity.id !== entity.id) {
          relationships.push({
            id: `${entity.id}->${targetEntity.id}`,
            source: entity.id,
            target: targetEntity.id,
            type: 'extends',
            label: 'extends',
          });
        }
      });

      // Add dependency relationships
      entity.methods.forEach(method => {
        method.calls.forEach(call => {
          const [obj, methodName] = call.split('.');
          const targetEntity = entities.find(e =>
            e.name === obj ||
            e.methods.some(m => m.name === methodName)
          );

          if (targetEntity && targetEntity.id !== entity.id) {
            relationships.push({
              id: `${entity.id}--${targetEntity.id}`,
              source: entity.id,
              target: targetEntity.id,
              type: 'calls',
              label: call,
            });
          }
        });
      });
    });

    return relationships;
  }
}
