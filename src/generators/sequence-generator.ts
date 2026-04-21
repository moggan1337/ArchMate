/**
 * ArchMate - Sequence Diagram Generator
 * Generates sequence diagrams from method calls
 */

import {
  CodeEntity,
  Method,
  SequenceDiagram,
  SequenceElement,
  SequenceLoop,
  SequenceAlternative,
  Relationship,
} from '../types';

export interface SequenceConfig {
  format: 'plantuml' | 'mermaid';
  showReturnValues: boolean;
  showTimestamps: boolean;
  groupByClass: boolean;
  maxDepth: number;
}

/**
 * Sequence Diagram Generator
 */
export class SequenceDiagramGenerator {
  private config: SequenceConfig;

  constructor(config: Partial<SequenceConfig> = {}) {
    this.config = {
      format: config.format || 'plantuml',
      showReturnValues: config.showReturnValues ?? true,
      showTimestamps: config.showTimestamps ?? false,
      groupByClass: config.groupByClass ?? true,
      maxDepth: config.maxDepth ?? 5,
    };
  }

  /**
   * Generate sequence diagram
   */
  generate(
    entities: CodeEntity[],
    relationships: Relationship[],
    entryPoints?: string[]
  ): string {
    const diagram = this.buildSequenceDiagram(entities, relationships, entryPoints);

    if (this.config.format === 'mermaid') {
      return this.generateMermaid(diagram);
    }
    return this.generatePlantUML(diagram);
  }

  /**
   * Build internal sequence diagram representation
   */
  private buildSequenceDiagram(
    entities: CodeEntity[],
    relationships: Relationship[],
    entryPoints?: string[]
  ): SequenceDiagram {
    const elements: SequenceElement[] = [];
    const actors = new Set<string>();
    const loops: SequenceLoop[] = [];
    const alternatives: SequenceAlternative[] = [];

    // Determine entry points
    const startPoints = entryPoints || this.findEntryPoints(entities);

    // Build call graph
    const callGraph = this.buildCallGraph(entities, relationships);

    // Process from entry points
    startPoints.forEach(startPoint => {
      const actor = this.getActorName(startPoint);
      actors.add(actor);

      const processed = new Set<string>();
      this.processCallChain(
        startPoint,
        callGraph,
        entities,
        actor,
        elements,
        actors,
        processed,
        0
      );
    });

    return {
      title: 'Sequence Diagram',
      actors: Array.from(actors),
      elements,
      loops,
      alternatives,
      options: {
        showTimestamps: this.config.showTimestamps,
        showReturnValues: this.config.showReturnValues,
        groupByClass: this.config.groupByClass,
        maxDepth: this.config.maxDepth,
      },
    };
  }

  /**
   * Find entry points (public methods with no incoming calls)
   */
  private findEntryPoints(entities: CodeEntity[]): string[] {
    const publicMethods = entities
      .filter(e => e.visibility === 'public')
      .flatMap(e => e.methods.map(m => `${e.name}.${m.name}`));

    return publicMethods.slice(0, 3); // Limit to first 3
  }

  /**
   * Build call graph
   */
  private buildCallGraph(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): Map<string, string[]> {
    const callGraph = new Map<string, string[]>();

    // From method calls
    entities.forEach(entity => {
      const entityId = entity.name;
      const calls: string[] = [];

      entity.methods.forEach(method => {
        method.calls.forEach(call => {
          const [obj, methodName] = call.split('.');
          if (obj && methodName) {
            calls.push(`${obj}.${methodName}`);
          }
        });
      });

      if (calls.length > 0) {
        callGraph.set(entityId, calls);
      }
    });

    return callGraph;
  }

  /**
   * Process call chain
   */
  private processCallChain(
    current: string,
    callGraph: Map<string, string[]>,
    entities: CodeEntity[],
    fromActor: string,
    elements: SequenceElement[],
    actors: Set<string>,
    processed: Set<string>,
    depth: number
  ): void {
    if (depth >= this.config.maxDepth) return;

    const [obj, methodName] = current.split('.');
    const toActor = this.getActorName(current);
    actors.add(toActor);

    // Add activation
    elements.push({
      type: 'activation',
      actor: toActor,
      activationStart: true,
    });

    // Add message
    elements.push({
      type: 'message',
      from: fromActor,
      to: toActor,
      message: methodName || current,
    });

    // Process called methods
    const calledEntity = entities.find(e => e.name === obj || e.name === toActor);
    if (calledEntity && methodName) {
      const method = calledEntity.methods.find(m => m.name === methodName);
      if (method) {
        method.calls.forEach(call => {
          const callKey = `${call}`;
          if (!processed.has(callKey)) {
            processed.add(callKey);
            this.processCallChain(
              call,
              callGraph,
              entities,
              toActor,
              elements,
              actors,
              processed,
              depth + 1
            );
          }
        });
      }
    }

    // Add return
    if (this.config.showReturnValues) {
      elements.push({
        type: 'return',
        from: toActor,
        to: fromActor,
        returnValue: 'response',
      });
    }

    // End activation
    elements.push({
      type: 'activation',
      actor: toActor,
      activationEnd: true,
    });
  }

  /**
   * Get actor name from method reference
   */
  private getActorName(methodRef: string): string {
    const [obj] = methodRef.split('.');
    return obj || methodRef;
  }

  /**
   * Generate PlantUML diagram
   */
  private generatePlantUML(diagram: SequenceDiagram): string {
    const lines: string[] = [
      '@startuml',
      'sequenceDiagram',
      '',
    ];

    // Add participants
    diagram.actors.forEach(actor => {
      lines.push(`participant ${actor}`);
    });
    lines.push('');

    // Add elements
    diagram.elements.forEach(element => {
      lines.push(...this.formatPlantUMLElement(element));
    });

    // Add loops
    diagram.loops.forEach(loop => {
      lines.push(`loop ${loop.condition}`);
      // Add loop body elements
      lines.push(`end`);
    });

    // Add alternatives
    diagram.alternatives.forEach(alt => {
      lines.push(`alt ${alt.condition}`);
      // Add alt body elements
      lines.push(`else`);
      lines.push(`end`);
    });

    lines.push('');
    lines.push('@enduml');

    return lines.join('\n');
  }

  /**
   * Generate Mermaid diagram
   */
  private generateMermaid(diagram: SequenceDiagram): string {
    const lines: string[] = [
      '```mermaid',
      'sequenceDiagram',
      '',
    ];

    // Add participants
    diagram.actors.forEach(actor => {
      lines.push(`    participant ${actor}`);
    });
    lines.push('');

    // Add elements
    diagram.elements.forEach(element => {
      lines.push(...this.formatMermaidElement(element));
    });

    lines.push('```');

    return lines.join('\n');
  }

  /**
   * Format PlantUML element
   */
  private formatPlantUMLElement(element: SequenceElement): string[] {
    const lines: string[] = [];

    switch (element.type) {
      case 'message':
        if (element.from && element.to) {
          lines.push(`${element.from}->>+${element.to}: ${element.message}`);
        }
        break;

      case 'return':
        if (element.from && element.to) {
          if (this.config.showReturnValues && element.returnValue) {
            lines.push(`${element.from}-->>-${element.to}: ${element.returnValue}`);
          } else {
            lines.push(`${element.from}-->-${element.to}:`);
          }
        }
        break;

      case 'async-message':
        if (element.from && element.to) {
          lines.push(`${element.from}-->+${element.to}: ${element.message}`);
        }
        break;

      case 'self-call':
        if (element.actor && element.message) {
          lines.push(`${element.actor}+->+${element.actor}: ${element.message}`);
        }
        break;

      case 'activation':
        if (element.activationStart) {
          lines.push(`activate ${element.actor}`);
        } else if (element.activationEnd) {
          lines.push(`deactivate ${element.actor}`);
        }
        break;
    }

    return lines;
  }

  /**
   * Format Mermaid element
   */
  private formatMermaidElement(element: SequenceElement): string[] {
    const lines: string[] = [];
    const indent = '    ';

    switch (element.type) {
      case 'message':
        if (element.from && element.to) {
          lines.push(`${indent}${element.from}->>+${element.to}: ${element.message}`);
        }
        break;

      case 'return':
        if (element.from && element.to) {
          if (this.config.showReturnValues && element.returnValue) {
            lines.push(`${indent}${element.from}-->>-${element.to}: ${element.returnValue}`);
          } else {
            lines.push(`${indent}${element.from}-->-${element.to}`);
          }
        }
        break;

      case 'async-message':
        if (element.from && element.to) {
          lines.push(`${indent}${element.from}-->>+${element.to}: ${element.message}`);
        }
        break;

      case 'self-call':
        if (element.actor && element.message) {
          lines.push(`${indent}${element.actor}+->+${element.actor}: ${element.message}`);
        }
        break;

      case 'activation':
        if (element.activationStart) {
          lines.push(`${indent}activate ${element.actor}`);
        } else if (element.activationEnd) {
          lines.push(`${indent}deactivate ${element.actor}`);
        }
        break;
    }

    return lines;
  }
}

export default SequenceDiagramGenerator;
