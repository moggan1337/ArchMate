/**
 * ArchMate - Code Analysis Engine
 * Main analysis orchestration and graph building
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import {
  CodeEntity,
  Relationship,
  DependencyGraph,
  DependencyNode,
  DependencyEdge,
  AnalysisResult,
  AnalysisMetrics,
  AnalysisWarning,
  AnalyzedFile,
  Language,
  DiagramType,
  ParserConfig,
  EntityFilter,
} from '../types';
import { ParserRegistry, parserRegistry } from '../parsers';

export interface AnalyzerOptions {
  includeExternal?: boolean;
  maxFileSize?: number;
  ignorePaths?: string[];
  parseComments?: boolean;
  resolveImports?: boolean;
}

/**
 * Main code analyzer
 */
export class CodeAnalyzer {
  private registry: ParserRegistry;
  private options: AnalyzerOptions;

  constructor(options: AnalyzerOptions = {}) {
    this.registry = parserRegistry;
    this.options = {
      includeExternal: false,
      maxFileSize: 1024 * 1024, // 1MB default
      ignorePaths: ['node_modules', 'dist', 'build', 'target', '.git', '__pycache__'],
      parseComments: true,
      resolveImports: true,
      ...options,
    };
  }

  /**
   * Analyze a directory or file
   */
  async analyze(targetPath: string, language?: Language): Promise<AnalysisResult> {
    const stats = await fs.stat(targetPath);
    const isDirectory = stats.isDirectory();

    // Detect language if not provided
    if (!language) {
      language = await this.detectLanguage(targetPath);
    }

    // Get file patterns
    const filePatterns = this.getFilePatterns(language);

    // Find all relevant files
    const files = isDirectory
      ? await this.findFiles(targetPath, filePatterns)
      : [targetPath];

    // Parse all files
    const entities: CodeEntity[] = [];
    const analyzedFiles: AnalyzedFile[] = [];
    let totalLines = 0;

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const fileStats = await fs.stat(file);

        if (fileStats.size > this.options.maxFileSize!) {
          console.warn(`Skipping ${file} - exceeds max size`);
          continue;
        }

        const parser = this.registry.getParser(language);
        if (parser) {
          const fileEntities = parser.parse(content, file);
          entities.push(...fileEntities);

          const lines = content.split('\n').length;
          totalLines += lines;

          analyzedFiles.push({
            path: file,
            language,
            size: fileStats.size,
            entities: fileEntities.length,
            imports: fileEntities.reduce((sum, e) => sum + e.imports.length, 0),
            exports: fileEntities.reduce((sum, e) => sum + e.exports.length, 0),
          });
        }
      } catch (error) {
        console.error(`Error analyzing ${file}:`, error);
      }
    }

    // Parse relationships
    const relationships = this.parseAllRelationships(entities);

    // Build dependency graph
    const graph = this.buildDependencyGraph(entities, relationships);

    // Calculate metrics
    const metrics = this.calculateMetrics(entities, relationships, analyzedFiles, totalLines);

    // Detect warnings
    const warnings = this.detectWarnings(entities, relationships, graph);

    return {
      entities,
      relationships,
      graph,
      metrics,
      warnings,
      language: language || 'typescript',
      files: analyzedFiles,
    };
  }

  /**
   * Detect language from file or directory
   */
  private async detectLanguage(targetPath: string): Promise<Language> {
    const stats = await fs.stat(targetPath);
    
    if (stats.isFile()) {
      const ext = path.extname(targetPath).toLowerCase();
      return this.registry.detectLanguage(ext) || 'typescript';
    }

    // Check for package.json
    if (await fs.pathExists(path.join(targetPath, 'package.json'))) {
      return 'typescript';
    }

    // Check for requirements.txt or setup.py
    if (await fs.pathExists(path.join(targetPath, 'requirements.txt')) ||
        await fs.pathExists(path.join(targetPath, 'setup.py'))) {
      return 'python';
    }

    // Check for pom.xml
    if (await fs.pathExists(path.join(targetPath, 'pom.xml'))) {
      return 'java';
    }

    // Check for *.csproj
    if (await fs.pathExists(targetPath)) {
      const files = await fs.readdir(targetPath);
      if (files.some(f => f.endsWith('.csproj'))) {
        return 'csharp';
      }
    }

    return 'typescript'; // Default
  }

  /**
   * Get file patterns for language
   */
  private getFilePatterns(language: Language): string[] {
    switch (language) {
      case 'typescript':
      case 'javascript':
        return ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];
      case 'python':
        return ['**/*.py'];
      case 'java':
        return ['**/*.java'];
      case 'csharp':
        return ['**/*.cs'];
      case 'go':
        return ['**/*.go'];
      case 'rust':
        return ['**/*.rs'];
      default:
        return ['**/*.ts', '**/*.js'];
    }
  }

  /**
   * Find all relevant files
   */
  private async findFiles(rootPath: string, patterns: string[]): Promise<string[]> {
    const files: string[] = [];

    for (const pattern of patterns) {
      const matches = await this.glob(pattern, rootPath);
      files.push(...matches);
    }

    // Filter out ignored paths
    return files.filter(file => {
      return !this.options.ignorePaths!.some(ignorePath =>
        file.includes(ignorePath)
      );
    });
  }

  /**
   * Simple glob implementation
   */
  private async glob(pattern: string, rootPath: string): Promise<string[]> {
    const files: string[] = [];
    const regex = this.patternToRegex(pattern);

    const search = async (dir: string) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await search(fullPath);
          } else if (entry.isFile() && regex.test(fullPath)) {
            files.push(fullPath);
          }
        }
      } catch {
        // Ignore permission errors
      }
    };

    await search(rootPath);
    return files;
  }

  /**
   * Convert glob pattern to regex
   */
  private patternToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*');
    return new RegExp(escaped, 'i');
  }

  /**
   * Parse relationships for all entities
   */
  private parseAllRelationships(entities: CodeEntity[]): Relationship[] {
    const relationships: Relationship[] = [];

    entities.forEach(entity => {
      // Method call relationships
      entity.methods.forEach(method => {
        method.calls.forEach(call => {
          const targetEntity = this.findEntityByCall(entities, call);
          if (targetEntity && targetEntity.id !== entity.id) {
            relationships.push({
              id: `${entity.id}:${method.name}->${targetEntity.id}`,
              source: entity.id,
              target: targetEntity.id,
              type: 'calls',
              label: `${method.name}()`,
            });
          }
        });
      });

      // Dependency relationships
      entity.dependencies.forEach(dep => {
        const targetEntity = entities.find(e =>
          e.name === dep ||
          e.name === dep.split('.')[0] ||
          e.exports.includes(dep)
        );

        if (targetEntity && targetEntity.id !== entity.id) {
          relationships.push({
            id: `${entity.id}->${targetEntity.id}`,
            source: entity.id,
            target: targetEntity.id,
            type: 'depends-on',
            label: 'depends on',
          });
        }
      });
    });

    // Remove duplicates
    return this.deduplicateRelationships(relationships);
  }

  /**
   * Find entity by method call
   */
  private findEntityByCall(entities: CodeEntity[], call: string): CodeEntity | undefined {
    const [obj, method] = call.split('.');

    // Try to match by object name
    const byObject = entities.find(e => e.name === obj);
    if (byObject) {
      // Check if method exists
      if (method && byObject.methods.some(m => m.name === method)) {
        return byObject;
      }
      return byObject;
    }

    // Try to match by method name
    if (method) {
      return entities.find(e => e.methods.some(m => m.name === method));
    }

    return undefined;
  }

  /**
   * Deduplicate relationships
   */
  private deduplicateRelationships(relationships: Relationship[]): Relationship[] {
    const seen = new Set<string>();
    return relationships.filter(rel => {
      const key = `${rel.source}:${rel.target}:${rel.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Build dependency graph
   */
  private buildDependencyGraph(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): DependencyGraph {
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];
    const nodeIds = new Set<string>();

    // Create nodes
    entities.forEach(entity => {
      if (!nodeIds.has(entity.id)) {
        nodes.push({
          id: entity.id,
          label: entity.name,
          type: entity.type,
          group: this.extractNamespace(entity.file),
          layer: this.assignLayer(entity.type),
          metadata: {
            file: entity.file,
            line: entity.line,
            methods: entity.methods.length,
            properties: entity.properties.length,
            annotations: entity.annotations,
          },
        });
        nodeIds.add(entity.id);
      }
    });

    // Create edges
    relationships.forEach(rel => {
      if (nodeIds.has(rel.source) && nodeIds.has(rel.target)) {
        edges.push({
          source: rel.source,
          target: rel.target,
          label: rel.label,
          type: rel.type,
        });
      }
    });

    // Calculate depth
    const depth = this.calculateGraphDepth(nodes, edges);

    // Find cycles
    const cycles = this.findCycles(nodes, edges);

    return {
      nodes,
      edges,
      metadata: {
        language: 'typescript',
        totalFiles: new Set(entities.map(e => e.file)).size,
        totalEntities: entities.length,
        totalRelationships: relationships.length,
        cycles,
        depth,
      },
    };
  }

  /**
   * Extract namespace from file path
   */
  private extractNamespace(filePath: string): string {
    const parts = filePath.split(path.sep);
    // Common source directories
    const srcIndex = parts.findIndex(p =>
      ['src', 'lib', 'app', 'application', 'source'].includes(p.toLowerCase())
    );

    if (srcIndex >= 0 && srcIndex < parts.length - 1) {
      const namespaceParts = parts.slice(srcIndex + 1, -1);
      // Find common prefixes
      if (namespaceParts.length > 2) {
        return namespaceParts.slice(0, 2).join('/');
      }
      return namespaceParts.join('/') || 'root';
    }

    return parts[parts.length - 2] || 'root';
  }

  /**
   * Assign layer based on entity type
   */
  private assignLayer(type: string): string {
    switch (type) {
      case 'controller':
      case 'component':
        return 'presentation';
      case 'service':
        return 'business';
      case 'repository':
      case 'model':
        return 'data';
      case 'class':
      case 'interface':
      default:
        return 'domain';
    }
  }

  /**
   * Calculate graph depth (longest path)
   */
  private calculateGraphDepth(nodes: DependencyNode[], edges: DependencyEdge[]): number {
    const adjacency = new Map<string, string[]>();

    edges.forEach(edge => {
      if (!adjacency.has(edge.source)) {
        adjacency.set(edge.source, []);
      }
      adjacency.get(edge.source)!.push(edge.target);
    });

    const visited = new Set<string>();
    const memo = new Map<string, number>();

    const dfs = (nodeId: string): number => {
      if (memo.has(nodeId)) return memo.get(nodeId)!;

      const neighbors = adjacency.get(nodeId) || [];
      if (neighbors.length === 0) {
        memo.set(nodeId, 0);
        return 0;
      }

      let maxDepth = 0;
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          maxDepth = Math.max(maxDepth, dfs(neighbor) + 1);
        }
      }

      memo.set(nodeId, maxDepth);
      return maxDepth;
    };

    let maxDepth = 0;
    for (const node of nodes) {
      visited.clear();
      maxDepth = Math.max(maxDepth, dfs(node.id));
    }

    return maxDepth;
  }

  /**
   * Find cycles in the graph
   */
  private findCycles(nodes: DependencyNode[], edges: DependencyEdge[]): string[][] {
    const adjacency = new Map<string, string[]>();
    edges.forEach(edge => {
      if (!adjacency.has(edge.source)) {
        adjacency.set(edge.source, []);
      }
      adjacency.get(edge.source)!.push(edge.target);
    });

    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = adjacency.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (recursionStack.has(neighbor)) {
          // Found cycle
          const cycleStart = path.indexOf(neighbor);
          if (cycleStart >= 0) {
            cycles.push([...path.slice(cycleStart), neighbor]);
          }
        }
      }

      path.pop();
      recursionStack.delete(nodeId);
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    }

    return cycles;
  }

  /**
   * Calculate analysis metrics
   */
  private calculateMetrics(
    entities: CodeEntity[],
    relationships: Relationship[],
    files: AnalyzedFile[],
    totalLines: number
  ): AnalysisMetrics {
    // Count by type
    const typeCount = new Map<string, number>();
    entities.forEach(e => {
      typeCount.set(e.type, (typeCount.get(e.type) || 0) + 1);
    });

    // Calculate coupling (average connections per entity)
    const coupling = files.length > 0
      ? relationships.length / entities.length
      : 0;

    // Calculate cohesion (methods per class average)
    const classEntities = entities.filter(e => e.type === 'class');
    const cohesion = classEntities.length > 0
      ? classEntities.reduce((sum, e) => sum + e.methods.length, 0) / classEntities.length
      : 0;

    // Cyclomatic complexity estimate
    const complexity = relationships.filter(r => r.type === 'calls').length;

    return {
      totalFiles: files.length,
      totalLines,
      totalEntities: entities.length,
      totalRelationships: relationships.length,
      cyclomaticComplexity: complexity,
      depthOfInheritance: this.calculateDIT(entities),
      coupling,
      cohesion,
    };
  }

  /**
   * Calculate Depth of Inheritance Tree
   */
  private calculateDIT(entities: CodeEntity[]): number {
    const inheritance = new Map<string, string[]>();

    entities.forEach(entity => {
      entity.dependencies.forEach(dep => {
        const parent = entities.find(e => e.name === dep);
        if (parent) {
          if (!inheritance.has(entity.id)) {
            inheritance.set(entity.id, []);
          }
          inheritance.get(entity.id)!.push(parent.id);
        }
      });
    });

    const depths = new Map<string, number>();

    const dfs = (entityId: string): number => {
      if (depths.has(entityId)) return depths.get(entityId)!;

      const parents = inheritance.get(entityId) || [];
      if (parents.length === 0) {
        depths.set(entityId, 0);
        return 0;
      }

      const maxParentDepth = Math.max(...parents.map(p => dfs(p)));
      const depth = maxParentDepth + 1;
      depths.set(entityId, depth);
      return depth;
    };

    let maxDIT = 0;
    for (const entity of entities) {
      maxDIT = Math.max(maxDIT, dfs(entity.id));
    }

    return maxDIT;
  }

  /**
   * Detect warnings in the codebase
   */
  private detectWarnings(
    entities: CodeEntity[],
    relationships: Relationship[],
    graph: DependencyGraph
  ): AnalysisWarning[] {
    const warnings: AnalysisWarning[] = [];

    // Circular dependencies
    graph.metadata.cycles.forEach(cycle => {
      warnings.push({
        type: 'circular-dependency',
        message: `Circular dependency detected: ${cycle.join(' -> ')}`,
        severity: 'warning',
      });
    });

    // High coupling
    const avgConnections = relationships.length / entities.length;
    if (avgConnections > 10) {
      warnings.push({
        type: 'high-coupling',
        message: `High coupling detected: ${avgConnections.toFixed(2)} avg connections per entity`,
        severity: 'warning',
      });
    }

    // Deep nesting
    if (graph.metadata.depth > 6) {
      warnings.push({
        type: 'deep-nesting',
        message: `Deep dependency nesting: ${graph.metadata.depth} levels`,
        severity: 'info',
      });
    }

    // Missing types
    entities.forEach(entity => {
      entity.properties.forEach(prop => {
        if (prop.type === 'any') {
          warnings.push({
            type: 'missing-type',
            file: entity.file,
            entity: entity.name,
            message: `Property '${prop.name}' in ${entity.name} has implicit 'any' type`,
            severity: 'info',
          });
        }
      });
    });

    return warnings;
  }

  /**
   * Filter entities by criteria
   */
  filterEntities(entities: CodeEntity[], filter: EntityFilter): CodeEntity[] {
    return entities.filter(entity => {
      // Type filter
      if (filter.types && !filter.types.includes(entity.type)) {
        return false;
      }

      // Visibility filter
      if (filter.visibility && entity.visibility !== filter.visibility) {
        return false;
      }

      // Name pattern filter
      if (filter.namePattern && !filter.namePattern.test(entity.name)) {
        return false;
      }

      // Annotation filter
      if (filter.hasAnnotation && !filter.hasAnnotation.some(a =>
        entity.annotations.includes(a)
      )) {
        return false;
      }

      // Namespace filter
      if (filter.namespaces && filter.namespaces.length > 0) {
        const entityNamespace = this.extractNamespace(entity.file);
        if (!filter.namespaces.some(ns => entityNamespace.includes(ns))) {
          return false;
        }
      }

      return true;
    });
  }
}

export default CodeAnalyzer;
