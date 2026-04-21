/**
 * ArchMate - TypeScript/JavaScript Parser
 * AST-based code analysis using Babel parser
 */

import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import {
  CodeEntity,
  EntityType,
  Visibility,
  Modifier,
  Property,
  Method,
  Parameter,
  ImportInfo,
  Relationship,
  RelationshipType,
  Language
} from '../types';
import { IParser } from './parser-registry';

export class TypeScriptParser implements IParser {
  readonly language: Language = 'typescript';

  /**
   * Check if this parser can handle the file
   */
  canParse(filePath: string): boolean {
    const ext = filePath.toLowerCase();
    return ext.endsWith('.ts') || ext.endsWith('.tsx') || ext.endsWith('.mts');
  }

  /**
   * Parse TypeScript source code
   */
  parse(source: string, filePath: string): CodeEntity[] {
    const entities: CodeEntity[] = [];
    
    try {
      const ast = parser.parse(source, {
        sourceType: 'module',
        plugins: [
          'typescript',
          'jsx',
          'decorators-legacy',
          'classProperties',
          'exportDefaultFrom',
          'exportNamespaceFrom',
          'dynamicImport',
        ],
        attachComment: true,
      });

      // Extract imports first for dependency resolution
      const imports = this.extractImports(ast);

      traverse(ast, {
        // Class declarations
        ClassDeclaration: (path) => {
          const entity = this.parseClass(path, filePath, imports);
          if (entity) entities.push(entity);
        },
        
        // Interface declarations
        InterfaceDeclaration: (path) => {
          const entity = this.parseInterface(path, filePath, imports);
          if (entity) entities.push(entity);
        },
        
        // Type alias declarations
        TypeAlias: (path) => {
          const entity = this.parseTypeAlias(path, filePath);
          if (entity) entities.push(entity);
        },
        
        // Enum declarations
        EnumDeclaration: (path) => {
          const entity = this.parseEnum(path, filePath);
          if (entity) entities.push(entity);
        },
        
        // Function declarations
        FunctionDeclaration: (path) => {
          const entity = this.parseFunction(path, filePath, imports);
          if (entity) entities.push(entity);
        },
        
        // Export assignments
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

    // Check for decorators
    const decorators = this.parseDecorators(node.decorators);

    // Determine entity type based on decorators
    let entityType: EntityType = 'class';
    if (decorators.includes('Component') || decorators.includes('controller')) {
      entityType = 'component';
    } else if (decorators.includes('Service')) {
      entityType = 'service';
    } else if (decorators.includes('Controller')) {
      entityType = 'controller';
    } else if (decorators.includes('Repository')) {
      entityType = 'repository';
    } else if (decorators.includes('Model')) {
      entityType = 'model';
    }

    // Extract properties
    const properties: Property[] = [];
    const methods: Method[] = [];
    const dependencies: string[] = [];
    const extends_ = node.superClass ? this.getTypeName(node.superClass) : undefined;

    // Process class body
    path.traverse({
      ClassMethod: (methodPath) => {
        const method = this.parseClassMethod(methodPath);
        methods.push(method);
        
        // Collect method calls for sequence diagrams
        method.calls.forEach(call => {
          if (!dependencies.includes(call)) {
            dependencies.push(call);
          }
        });
      },
      
      ClassProperty: (propPath) => {
        const prop = this.parseClassProperty(propPath);
        properties.push(prop);
        
        // Check for type dependencies
        if (prop.type && !dependencies.includes(prop.type)) {
          dependencies.push(prop.type);
        }
      },
    });

    // Check for implements
    const implements_: string[] = [];
    if (node.implements) {
      node.implements.forEach(impl => {
        implements_.push(this.getTypeName(impl));
      });
    }

    // Add extends/implements as dependencies
    if (extends_ && !dependencies.includes(extends_)) {
      dependencies.push(extends_);
    }
    implements_.forEach(impl => {
      if (!dependencies.includes(impl)) {
        dependencies.push(impl);
      }
    });

    return {
      id: `${filePath}:${className}`,
      name: className,
      type: entityType,
      file: filePath,
      line: node.loc?.start.line || 0,
      column: node.loc?.start.column || 0,
      visibility: 'public',
      modifiers: this.getModifiers(node.decorators),
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
   * Parse interface declaration
   */
  private parseInterface(
    path: traverse.NodePath<t.InterfaceDeclaration>,
    filePath: string,
    imports: ImportInfo[]
  ): CodeEntity | null {
    const node = path.node;
    const interfaceName = node.id.name;

    const properties: Property[] = [];
    const methods: Method[] = [];

    // Process interface body
    path.traverse({
      TSPropertySignature: (propPath) => {
        const prop = this.parseTSPropertySignature(propPath);
        properties.push(prop);
      },
      
      TSMethodSignature: (methodPath) => {
        const method = this.parseTSMethodSignature(methodPath);
        methods.push(method);
      },
    });

    // Get extends interfaces
    const extends_: string[] = [];
    if (node.extends) {
      node.extends.forEach(ext => {
        extends_.push(this.getTypeName(ext));
      });
    }

    return {
      id: `${filePath}:${interfaceName}`,
      name: interfaceName,
      type: 'interface',
      file: filePath,
      line: node.loc?.start.line || 0,
      column: node.loc?.start.column || 0,
      visibility: 'public',
      modifiers: [],
      documentation: this.getDocumentation(node.leadingComments),
      properties,
      methods,
      dependencies: extends_,
      annotations: [],
      imports,
      exports: [interfaceName],
    };
  }

  /**
   * Parse type alias
   */
  private parseTypeAlias(
    path: traverse.NodePath<t.TypeAlias>,
    filePath: string
  ): CodeEntity | null {
    const node = path.node;
    const typeName = (node.id as t.Identifier).name;

    return {
      id: `${filePath}:${typeName}`,
      name: typeName,
      type: 'type',
      file: filePath,
      line: node.loc?.start.line || 0,
      column: node.loc?.start.column || 0,
      visibility: 'public',
      modifiers: [],
      documentation: this.getDocumentation(node.leadingComments),
      properties: [],
      methods: [],
      dependencies: [this.getTypeName(node.right)],
      annotations: [],
      imports: [],
      exports: [typeName],
    };
  }

  /**
   * Parse enum declaration
   */
  private parseEnum(
    path: traverse.NodePath<t.EnumDeclaration>,
    filePath: string
  ): CodeEntity | null {
    const node = path.node;
    const enumName = node.id.name;

    const properties: Property[] = [];
    let value = 0;

    node.members.forEach((member, index) => {
      const memberName = (member.id as t.Identifier).name;
      let propType = 'number';
      let defaultVal: string | undefined;

      if (t.isNumericLiteral(member.init)) {
        value = member.init.value;
        defaultVal = String(value);
      } else if (t.isStringLiteral(member.init)) {
        propType = 'string';
        defaultVal = member.init.value;
      } else {
        defaultVal = String(value);
      }

      properties.push({
        name: memberName,
        type: propType,
        visibility: 'public',
        isStatic: false,
        isReadonly: true,
        isOptional: false,
        defaultValue: defaultVal,
        decorators: [],
      });

      value++;
    });

    return {
      id: `${filePath}:${enumName}`,
      name: enumName,
      type: 'enum',
      file: filePath,
      line: node.loc?.start.line || 0,
      column: node.loc?.start.column || 0,
      visibility: 'public',
      modifiers: node.declare ? ['final'] : [],
      documentation: this.getDocumentation(node.leadingComments),
      properties,
      methods: [],
      dependencies: [],
      annotations: [],
      imports: [],
      exports: [enumName],
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
        returnType: node.returnType ? this.getTypeName(node.returnType.typeAnnotation) : 'void',
        visibility: 'public',
        isStatic: false,
        isAsync: node.async,
        isAbstract: false,
        decorators: this.getModifiers(node.decorators),
        calls,
      }],
      dependencies: calls,
      annotations: this.parseDecorators(node.decorators),
      imports,
      exports: [],
    };
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
    const methodName = node.key instanceof Identifier ? node.key.name : String(node.key);
    
    const parameters = this.parseParameters(node.params);
    const calls = this.extractMethodCalls(path);

    return {
      name: methodName,
      parameters,
      returnType: node.returnType ? this.getTypeName(node.returnType.typeAnnotation) : 'void',
      visibility: this.getVisibility(node.accessibility),
      isStatic: node.static || false,
      isAsync: node.async || false,
      isAbstract: false,
      decorators: this.getModifiers(node.decorators),
      calls,
    };
  }

  /**
   * Parse class property
   */
  private parseClassProperty(path: traverse.NodePath<t.ClassProperty>): Property {
    const node = path.node;
    const propName = node.key instanceof Identifier ? node.key.name : String(node.key);

    return {
      name: propName,
      type: node.typeAnnotation ? this.getTypeName(node.typeAnnotation.typeAnnotation) : 'any',
      visibility: this.getVisibility(node.accessibility),
      isStatic: node.static || false,
      isReadonly: node.readonly || false,
      isOptional: node.optional || false,
      defaultValue: node.init ? this.getInitValue(node.init) : undefined,
      decorators: this.parseDecorators(node.decorators),
    };
  }

  /**
   * Parse TypeScript property signature
   */
  private parseTSPropertySignature(path: traverse.NodePath<t.TSPropertySignature>): Property {
    const node = path.node;
    const propName = (node.key as t.Identifier).name;

    return {
      name: propName,
      type: node.typeAnnotation ? this.getTypeName(node.typeAnnotation.typeAnnotation) : 'any',
      visibility: 'public',
      isStatic: false,
      isReadonly: node.readonly || false,
      isOptional: node.optional || false,
      decorators: [],
    };
  }

  /**
   * Parse TypeScript method signature
   */
  private parseTSMethodSignature(path: traverse.NodePath<t.TSMethodSignature>): Method {
    const node = path.node;
    const methodName = (node.key as t.Identifier).name;
    const parameters = node.parameters?.map((param) => {
      if (t.isIdentifier(param)) {
        return {
          name: param.name,
          type: 'any',
          isOptional: false,
          isRest: false,
        };
      }
      return { name: 'unknown', type: 'any', isOptional: false, isRest: false };
    }) || [];

    return {
      name: methodName,
      parameters,
      returnType: node.typeAnnotation ? this.getTypeName(node.typeAnnotation.typeAnnotation) : 'void',
      visibility: 'public',
      isStatic: false,
      isAsync: false,
      isAbstract: false,
      decorators: [],
      calls: [],
    };
  }

  /**
   * Parse parameters
   */
  private parseParameters(params: t.FunctionDeclaration['params']): Parameter[] {
    return params.map(param => {
      const name = t.isIdentifier(param) ? param.name : 'unknown';
      const typeAnnotation = t.isIdentifier(param) ? param.typeAnnotation : null;
      
      return {
        name,
        type: typeAnnotation ? this.getTypeName(typeAnnotation.typeAnnotation) : 'any',
        isOptional: t.isIdentifier(param) && !!param.optional,
        isRest: t.isRestElement(param) || false,
        defaultValue: t.isIdentifier(param) && param.init ? this.getInitValue(param.init) : undefined,
      };
    });
  }

  /**
   * Extract function calls from method body
   */
  private extractFunctionCalls(path: traverse.NodePath<t.FunctionDeclaration>): string[] {
    const calls: string[] = [];

    path.traverse({
      CallExpression: (callPath) => {
        const callee = callPath.node.callee;
        if (t.isMemberExpression(callee)) {
          const obj = this.getTypeName(callee.object);
          const prop = callee.property instanceof Identifier ? callee.property.name : '';
          if (obj && prop) {
            calls.push(`${obj}.${prop}`);
          }
        } else if (callee instanceof Identifier) {
          calls.push(callee.name);
        }
      },
    });

    return calls;
  }

  /**
   * Extract method calls from class method
   */
  private extractMethodCalls(path: traverse.NodePath<t.ClassMethod>): string[] {
    const calls: string[] = [];

    path.traverse({
      CallExpression: (callPath) => {
        const callee = callPath.node.callee;
        if (t.isMemberExpression(callee)) {
          const obj = this.getTypeName(callee.object);
          const prop = callee.property instanceof Identifier ? callee.property.name : '';
          if (obj && prop) {
            calls.push(`${obj}.${prop}`);
          }
        } else if (callee instanceof Identifier) {
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
          return dec.expression.name;
        }
        return '';
      })
      .filter(Boolean);
  }

  /**
   * Get modifiers from decorators
   */
  private getModifiers(decorators: t.Decorator[] | undefined): Modifier[] {
    const modifiers: Modifier[] = [];
    const decoratorNames = this.parseDecorators(decorators);
    
    if (decoratorNames.includes('static')) modifiers.push('static');
    if (decoratorNames.includes('readonly')) modifiers.push('readonly');
    if (decoratorNames.includes('async')) modifiers.push('async');
    if (decoratorNames.includes('abstract')) modifiers.push('abstract');
    if (decoratorNames.includes('final')) modifiers.push('final');
    
    return modifiers;
  }

  /**
   * Get visibility from accessibility
   */
  private getVisibility(accessibility?: 'public' | 'private' | 'protected'): Visibility {
    switch (accessibility) {
      case 'private':
        return 'private';
      case 'protected':
        return 'protected';
      default:
        return 'public';
    }
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

    switch (node.type) {
      case 'Identifier':
        return (node as t.Identifier).name;
      case 'TSAnyKeyword':
        return 'any';
      case 'TSUnknownKeyword':
        return 'unknown';
      case 'TSNumberKeyword':
        return 'number';
      case 'TSStringKeyword':
        return 'string';
      case 'TSBooleanKeyword':
        return 'boolean';
      case 'TSVoidKeyword':
        return 'void';
      case 'TSNullKeyword':
        return 'null';
      case 'TSUndefinedKeyword':
        return 'undefined';
      case 'TSObjectKeyword':
        return 'object';
      case 'TSArrayType':
        return `${this.getTypeName((node as t.TSArrayType).elementType)}[]`;
      case 'TSUnionType':
        return (node as t.TSUnionType).types.map(t => this.getTypeName(t)).join(' | ');
      case 'TSIntersectionType':
        return (node as t.TSIntersectionType).types.map(t => this.getTypeName(t)).join(' & ');
      case 'TSTypeReference':
        return this.getTypeName((node as t.TSTypeReference).typeName);
      case 'TSTypeLiteral':
        return 'object';
      case 'TSTupleType':
        return 'tuple';
      case 'TSFunctionType':
        return 'Function';
      case 'TSConditionalType':
        return 'conditional';
      case 'TSMappedType':
        return 'mapped';
      case 'TSIndexedAccessType':
        return 'indexed';
      case 'MemberExpression':
        const member = node as t.MemberExpression;
        return `${this.getTypeName(member.object)}.${this.getTypeName(member.property)}`;
      default:
        return 'any';
    }
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
      return node.name;
    }
    if (t.isArrayExpression(node)) {
      return '[]';
    }
    if (t.isObjectExpression(node)) {
      return '{}';
    }
    return undefined;
  }

  /**
   * Parse relationships between entities
   */
  parseRelationships(entities: CodeEntity[]): Relationship[] {
    const relationships: Relationship[] = [];

    entities.forEach(entity => {
      // Add dependency relationships
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

      // Check for extends/implements relationships
      entity.properties.forEach(prop => {
        const targetEntity = entities.find(e => e.name === prop.type);
        if (targetEntity) {
          relationships.push({
            id: `${entity.id}--${targetEntity.id}`,
            source: entity.id,
            target: targetEntity.id,
            type: 'associates',
            label: prop.name,
          });
        }
      });
    });

    return relationships;
  }
}

// Type for Identifier (commonly used but not always exported)
type Identifier = t.Identifier;
