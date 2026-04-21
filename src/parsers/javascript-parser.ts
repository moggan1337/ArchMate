/**
 * ArchMate - JavaScript Parser
 * AST-based code analysis using Babel parser (JavaScript subset)
 */

import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import {
  CodeEntity,
  EntityType,
  Visibility,
  Language,
  ImportInfo,
  Property,
  Method,
  Parameter,
  Relationship,
} from '../types';
import { IParser } from './parser-registry';

export class JavaScriptParser implements IParser {
  readonly language: Language = 'javascript';

  /**
   * Check if this parser can handle the file
   */
  canParse(filePath: string): boolean {
    const ext = filePath.toLowerCase();
    return ext.endsWith('.js') || ext.endsWith('.jsx') || ext.endsWith('.mjs') || ext.endsWith('.cjs');
  }

  /**
   * Parse JavaScript source code
   */
  parse(source: string, filePath: string): CodeEntity[] {
    const entities: CodeEntity[] = [];

    try {
      const ast = parser.parse(source, {
        sourceType: 'module',
        plugins: [
          'jsx',
          'classProperties',
          'exportDefaultFrom',
          'exportNamespaceFrom',
          'dynamicImport',
        ],
        attachComment: true,
      });

      const imports = this.extractImports(ast);

      traverse(ast, {
        // Class declarations
        ClassDeclaration: (path) => {
          const entity = this.parseClass(path, filePath, imports);
          if (entity) entities.push(entity);
        },

        // Function declarations
        FunctionDeclaration: (path) => {
          const entity = this.parseFunction(path, filePath, imports);
          if (entity) entities.push(entity);
        },

        // Variable declarations (const/let with object patterns)
        VariableDeclaration: (path) => {
          const declarations = this.parseVariableDeclaration(path, filePath);
          entities.push(...declarations);
        },

        // Export default
        ExportDefaultDeclaration: (path) => {
          const entity = this.parseExportDefault(path, filePath);
          if (entity) entities.push(entity);
        },
      });
    } catch (error) {
      console.error(`Error parsing ${filePath}:`, error);
    }

    return entities;
  }

  /**
   * Extract imports from AST
   */
  private extractImports(ast: parser.ParseResult<t.File>): ImportInfo[] {
    const imports: ImportInfo[] = [];

    traverse(ast, {
      ImportDeclaration: (path) => {
        const specifiers: string[] = [];
        let isDefault = false;
        let isNamespace = false;

        path.node.specifiers.forEach(spec => {
          if (t.isImportDefaultSpecifier(spec)) {
            isDefault = true;
            specifiers.push((spec.imported as t.Identifier).name);
          } else if (t.isImportNamespaceSpecifier(spec)) {
            isNamespace = true;
            specifiers.push(`* as ${spec.local.name}`);
          } else if (t.isImportSpecifier(spec)) {
            specifiers.push((spec.imported as t.Identifier).name);
          }
        });

        imports.push({
          source: path.node.source.value,
          imported: specifiers,
          isDefault,
          isNamespace,
        });
      },
    });

    return imports;
  }

  /**
   * Parse class declaration
   */
  private parseClass(
    path: traverse.NodePath<t.ClassDeclaration>,
    filePath: string,
    imports: ImportInfo[]
  ): CodeEntity | null {
    const node = path.node;
    const className = node.id?.name || 'AnonymousClass';

    const decorators = this.parseDecorators(node.decorators);
    let entityType: EntityType = 'class';

    if (decorators.includes('Component') || decorators.includes('controller')) {
      entityType = 'component';
    } else if (decorators.includes('Service')) {
      entityType = 'service';
    }

    const properties: Property[] = [];
    const methods: Method[] = [];
    const dependencies: string[] = [];

    path.traverse({
      ClassMethod: (methodPath) => {
        const method = this.parseClassMethod(methodPath);
        methods.push(method);
        method.calls.forEach(call => {
          if (!dependencies.includes(call)) {
            dependencies.push(call);
          }
        });
      },

      ClassProperty: (propPath) => {
        const prop = this.parseClassProperty(propPath);
        properties.push(prop);
        if (prop.type && !dependencies.includes(prop.type)) {
          dependencies.push(prop.type);
        }
      },
    });

    return {
      id: `${filePath}:${className}`,
      name: className,
      type: entityType,
      file: filePath,
      line: node.loc?.start.line || 0,
      column: node.loc?.start.column || 0,
      visibility: 'public',
      modifiers: [],
      documentation: this.getDocumentation(node.leadingComments),
      properties,
      methods,
      dependencies,
      annotations: decorators,
      imports,
      exports: [className],
    };
  }

  /**
   * Parse function declaration
   */
  private parseFunction(
    path: traverse.NodePath<t.FunctionDeclaration>,
    filePath: string,
    imports: ImportInfo[]
  ): CodeEntity | null {
    const node = path.node;
    const functionName = node.id?.name || 'anonymous';

    const parameters = this.parseParameters(node.params);
    const calls = this.extractFunctionCalls(path);

    return {
      id: `${filePath}:${functionName}`,
      name: functionName,
      type: 'function',
      file: filePath,
      line: node.loc?.start.line || 0,
      column: node.loc?.start.column || 0,
      visibility: 'public',
      modifiers: node.async ? ['async'] : [],
      documentation: this.getDocumentation(node.leadingComments),
      properties: [],
      methods: [{
        name: functionName,
        parameters,
        returnType: 'any',
        visibility: 'public',
        isStatic: false,
        isAsync: node.async,
        isAbstract: false,
        decorators: [],
        calls,
      }],
      dependencies: calls,
      annotations: this.parseDecorators(node.decorators),
      imports,
      exports: [],
    };
  }

  /**
   * Parse variable declarations
   */
  private parseVariableDeclaration(
    path: traverse.NodePath<t.VariableDeclaration>,
    filePath: string
  ): CodeEntity[] {
    const entities: CodeEntity[] = [];

    path.node.declarations.forEach(decl => {
      if (t.isIdentifier(decl.id)) {
        const name = decl.id.name;
        const initValue = decl.init ? this.getInitValue(decl.init) : undefined;

        entities.push({
          id: `${filePath}:${name}`,
          name,
          type: 'variable',
          file: filePath,
          line: path.node.loc?.start.line || 0,
          column: path.node.loc?.start.column || 0,
          visibility: 'public',
          modifiers: [],
          documentation: undefined,
          properties: [],
          methods: [],
          dependencies: initValue ? [initValue] : [],
          annotations: [],
          imports: [],
          exports: [name],
        });
      }
    });

    return entities;
  }

  /**
   * Parse export default
   */
  private parseExportDefault(
    path: traverse.NodePath<t.ExportDefaultDeclaration>,
    filePath: string
  ): CodeEntity | null {
    const node = path.node;
    const declaration = node.declaration;

    let name = 'default';
    let entityType: EntityType = 'function';

    if (t.isIdentifier(declaration)) {
      name = declaration.name;
    } else if (t.isClassDeclaration(declaration) && declaration.id) {
      name = declaration.id.name;
      entityType = 'class';
    } else if (t.isFunctionDeclaration(declaration) && declaration.id) {
      name = declaration.id.name;
      entityType = 'function';
    }

    return {
      id: `${filePath}:${name}`,
      name,
      type: entityType,
      file: filePath,
      line: node.loc?.start.line || 0,
      column: node.loc?.start.column || 0,
      visibility: 'public',
      modifiers: [],
      documentation: undefined,
      properties: [],
      methods: [],
      dependencies: [],
      annotations: [],
      imports: [],
      exports: [name],
    };
  }

  /**
   * Parse class method
   */
  private parseClassMethod(path: traverse.NodePath<t.ClassMethod>): Method {
    const node = path.node;
    const methodName = node.key instanceof t.Identifier ? node.key.name : String(node.key);

    const parameters = this.parseParameters(node.params);
    const calls = this.extractMethodCalls(path);

    return {
      name: methodName,
      parameters,
      returnType: 'any',
      visibility: 'public',
      isStatic: node.static || false,
      isAsync: node.async || false,
      isAbstract: false,
      decorators: this.parseDecorators(node.decorators),
      calls,
    };
  }

  /**
   * Parse class property
   */
  private parseClassProperty(path: traverse.NodePath<t.ClassProperty>): Property {
    const node = path.node;
    const propName = node.key instanceof t.Identifier ? node.key.name : String(node.key);

    return {
      name: propName,
      type: 'any',
      visibility: 'public',
      isStatic: node.static || false,
      isReadonly: node.readonly || false,
      isOptional: node.optional || false,
      defaultValue: node.init ? this.getInitValue(node.init) : undefined,
      decorators: this.parseDecorators(node.decorators),
    };
  }

  /**
   * Parse parameters
   */
  private parseParameters(params: t.FunctionDeclaration['params']): Parameter[] {
    return params.map(param => {
      const name = t.isIdentifier(param) ? param.name : 'unknown';
      return {
        name,
        type: 'any',
        isOptional: t.isIdentifier(param) && !!param.optional,
        isRest: t.isRestElement(param) || false,
        defaultValue: t.isIdentifier(param) && param.init ? this.getInitValue(param.init) : undefined,
      };
    });
  }

  /**
   * Extract function calls
   */
  private extractFunctionCalls(path: traverse.NodePath<t.FunctionDeclaration>): string[] {
    const calls: string[] = [];

    path.traverse({
      CallExpression: (callPath) => {
        const callee = callPath.node.callee;
        if (t.isMemberExpression(callee)) {
          const obj = this.getTypeName(callee.object);
          const prop = callee.property instanceof t.Identifier ? callee.property.name : '';
          if (obj && prop) {
            calls.push(`${obj}.${prop}`);
          }
        } else if (callee instanceof t.Identifier) {
          calls.push(callee.name);
        }
      },
    });

    return calls;
  }

  /**
   * Extract method calls
   */
  private extractMethodCalls(path: traverse.NodePath<t.ClassMethod>): string[] {
    const calls: string[] = [];

    path.traverse({
      CallExpression: (callPath) => {
        const callee = callPath.node.callee;
        if (t.isMemberExpression(callee)) {
          const obj = this.getTypeName(callee.object);
          const prop = callee.property instanceof t.Identifier ? callee.property.name : '';
          if (obj && prop) {
            calls.push(`${obj}.${prop}`);
          }
        } else if (callee instanceof t.Identifier) {
          calls.push(callee.name);
        }
      },
    });

    return calls;
  }

  /**
   * Parse decorators
   */
  private parseDecorators(decorators: t.Decorator[] | undefined): string[] {
    if (!decorators) return [];
    return decorators
      .map(dec => {
        if (t.isIdentifier(dec.expression)) {
          return (dec.expression as t.Identifier).name;
        }
        return '';
      })
      .filter(Boolean);
  }

  /**
   * Get documentation from comments
   */
  private getDocumentation(comments: t.Comment | t.CommentBlock[] | undefined): string | undefined {
    if (!comments) return undefined;
    if (Array.isArray(comments)) {
      return comments.map(c => c.value.trim()).join('\n');
    }
    return comments.value.trim();
  }

  /**
   * Get type name from AST node
   */
  private getTypeName(node: t.Node | null | undefined): string {
    if (!node) return 'any';
    if (node.type === 'Identifier') {
      return (node as t.Identifier).name;
    }
    return 'any';
  }

  /**
   * Get initial value as string
   */
  private getInitValue(node: t.Expression): string | undefined {
    if (t.isStringLiteral(node)) {
      return `'${node.value}'`;
    }
    if (t.isNumericLiteral(node)) {
      return String(node.value);
    }
    if (t.isBooleanLiteral(node)) {
      return String(node.value);
    }
    if (t.isNullLiteral(node)) {
      return 'null';
    }
    if (t.isIdentifier(node)) {
      return (node as t.Identifier).name;
    }
    if (t.isArrayExpression(node)) {
      return '[]';
    }
    if (t.isObjectExpression(node)) {
      return '{}';
    }
    if (t.isNewExpression(node)) {
      return this.getTypeName(node.callee);
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
          e.name === dep.split('.')[0] ||
          dep.includes(e.name)
        );

        if (targetEntity && targetEntity.id !== entity.id) {
          relationships.push({
            id: `${entity.id}->${targetEntity.id}`,
            source: entity.id,
            target: targetEntity.id,
            type: 'uses',
            label: 'uses',
          });
        }
      });
    });

    return relationships;
  }
}
