#!/usr/bin/env node

/**
 * ArchMate CLI
 * Command-line interface for architecture diagram generation
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import {
  CodeAnalyzer,
} from '../analysis';
import {
  UMLClassDiagramGenerator,
  UMLComponentDiagramGenerator,
  SequenceDiagramGenerator,
  C4DiagramGenerator,
  ERDiagramGenerator,
  CloudArchitectureGenerator,
  IaCArchitectureGenerator,
} from '../generators';
import {
  DiagramExporter,
} from '../exporters';
import {
  DiagramType,
  ExportFormat,
  Language,
} from '../types';

// Version from package.json
const packageJson = require('../../package.json');

/**
 * Main CLI application
 */
class ArchMateCLI {
  private program: Command;

  constructor() {
    this.program = new Command();
    this.setupProgram();
  }

  /**
   * Setup CLI program
   */
  private setupProgram(): void {
    this.program
      .name('archmate')
      .description('Auto-generate architecture diagrams from source code')
      .version(packageJson.version)
      .option('-v, --verbose', 'Verbose output')
      .option('-o, --output <path>', 'Output directory', './archmate-output');

    // Analyze command
    this.program
      .command('analyze <path>')
      .description('Analyze source code and extract architecture')
      .option('-l, --language <lang>', 'Source language', 'auto')
      .option('-o, --output <path>', 'Output file for analysis results')
      .option('--json', 'Output as JSON')
      .action(async (targetPath: string, options: Record<string, unknown>) => {
        await this.analyze(targetPath, options);
      });

    // Generate command
    this.program
      .command('generate <path>')
      .description('Generate architecture diagrams')
      .option('-t, --type <type>', 'Diagram type', 'uml-class')
      .option('-f, --format <format>', 'Output format', 'plantuml')
      .option('-o, --output <path>', 'Output file')
      .option('-l, --language <lang>', 'Source language', 'auto')
      .option('--no-parse-comments', 'Skip parsing comments')
      .action(async (targetPath: string, options: Record<string, unknown>) => {
        await this.generate(targetPath, options);
      });

    // List supported types
    this.program
      .command('list-types')
      .description('List supported diagram types')
      .action(() => {
        this.listTypes();
      });

    // List supported formats
    this.program
      .command('list-formats')
      .description('List supported export formats')
      .action(() => {
        this.listFormats();
      });

    // Watch mode
    this.program
      .command('watch <path>')
      .description('Watch for file changes and regenerate diagrams')
      .option('-t, --type <type>', 'Diagram type', 'uml-class')
      .option('-f, --format <format>', 'Output format', 'html')
      .action(async (targetPath: string, options: Record<string, unknown>) => {
        await this.watch(targetPath, options);
      });
  }

  /**
   * Run the CLI
   */
  async run(args: string[]): Promise<void> {
    await this.program.parseAsync(args);
  }

  /**
   * Analyze source code
   */
  private async analyze(targetPath: string, options: Record<string, unknown>): Promise<void> {
    const verbose = this.program.opts().verbose;

    if (verbose) {
      console.log(`Analyzing: ${targetPath}`);
      console.log(`Language: ${options.language}`);
    }

    const analyzer = new CodeAnalyzer({
      parseComments: !options['no-parse-comments'],
    });

    const language = options.language === 'auto' ? undefined : options.language as Language;
    const result = await analyzer.analyze(targetPath, language);

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('\n📊 Analysis Results');
      console.log('='.repeat(50));
      console.log(`Files analyzed: ${result.metrics.totalFiles}`);
      console.log(`Total entities: ${result.metrics.totalEntities}`);
      console.log(`Total relationships: ${result.metrics.totalRelationships}`);
      console.log(`Total lines: ${result.metrics.totalLines}`);
      console.log(`Coupling: ${result.metrics.coupling.toFixed(2)}`);
      console.log(`Cohesion: ${result.metrics.cohesion.toFixed(2)}`);
      console.log(`Graph depth: ${result.graph.metadata.depth}`);
      console.log(`Circular dependencies: ${result.graph.metadata.cycles.length}`);

      if (result.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        result.warnings.forEach(w => {
          console.log(`  [${w.severity}] ${w.message}`);
        });
      }
    }

    if (options.output) {
      await fs.writeJSON(options.output as string, result, { spaces: 2 });
      console.log(`\n✅ Results saved to ${options.output}`);
    }
  }

  /**
   * Generate diagram
   */
  private async generate(targetPath: string, options: Record<string, unknown>): Promise<void> {
    const verbose = this.program.opts().verbose;
    const diagramType = options.type as DiagramType || 'uml-class';
    const exportFormat = options.format as ExportFormat || 'plantuml';
    const outputPath = (options.output || this.program.opts().output) as string;

    if (verbose) {
      console.log(`Generating diagram for: ${targetPath}`);
      console.log(`Diagram type: ${diagramType}`);
      console.log(`Export format: ${exportFormat}`);
    }

    // Analyze source code
    const analyzer = new CodeAnalyzer();
    const language = options.language === 'auto' ? undefined : options.language as Language;
    const analysisResult = await analyzer.analyze(targetPath, language);

    if (verbose) {
      console.log(`Found ${analysisResult.entities.length} entities`);
    }

    // Generate diagram based on type
    let content: string;

    switch (diagramType) {
      case 'uml-class':
        const classGen = new UMLClassDiagramGenerator({ format: exportFormat === 'mermaid' ? 'mermaid' : 'plantuml' });
        content = classGen.generate(analysisResult.entities, analysisResult.relationships);
        break;

      case 'uml-component':
        const componentGen = new UMLComponentDiagramGenerator({ format: exportFormat === 'mermaid' ? 'mermaid' : 'plantuml' });
        content = componentGen.generate(analysisResult.entities, analysisResult.relationships);
        break;

      case 'uml-sequence':
        const sequenceGen = new SequenceDiagramGenerator({ format: exportFormat === 'mermaid' ? 'mermaid' : 'plantuml' });
        content = sequenceGen.generate(analysisResult.entities, analysisResult.relationships);
        break;

      case 'c4-context':
      case 'c4-container':
      case 'c4-component':
      case 'c4-deployment':
        const c4Gen = new C4DiagramGenerator({
          format: exportFormat === 'mermaid' ? 'mermaid' : 'plantuml',
          level: diagramType.replace('c4-', '') as 'context' | 'container' | 'component' | 'deployment',
        });
        content = c4Gen.generate(analysisResult.entities, analysisResult.relationships, analysisResult.graph);
        break;

      case 'er-diagram':
        const erGen = new ERDiagramGenerator({ format: exportFormat === 'dbml' ? 'dbml' : exportFormat === 'mermaid' ? 'mermaid' : 'plantuml' });
        content = erGen.generate(analysisResult.entities, analysisResult.relationships);
        break;

      case 'cloud-aws':
        const awsGen = new CloudArchitectureGenerator({ provider: 'aws', format: exportFormat === 'mermaid' ? 'mermaid' : 'plantuml' });
        content = awsGen.generate(analysisResult.entities, analysisResult.relationships);
        break;

      case 'cloud-gcp':
        const gcpGen = new CloudArchitectureGenerator({ provider: 'gcp', format: exportFormat === 'mermaid' ? 'mermaid' : 'plantuml' });
        content = gcpGen.generate(analysisResult.entities, analysisResult.relationships);
        break;

      case 'cloud-azure':
        const azureGen = new CloudArchitectureGenerator({ provider: 'azure', format: exportFormat === 'mermaid' ? 'mermaid' : 'plantuml' });
        content = azureGen.generate(analysisResult.entities, analysisResult.relationships);
        break;

      case 'iac-terraform':
        const tfGen = new IaCArchitectureGenerator({ framework: 'terraform', format: exportFormat === 'mermaid' ? 'mermaid' : 'plantuml' });
        content = tfGen.generate(analysisResult.entities, analysisResult.relationships);
        break;

      case 'iac-kubernetes':
        const k8sGen = new IaCArchitectureGenerator({ framework: 'kubernetes', format: exportFormat === 'mermaid' ? 'mermaid' : 'plantuml' });
        content = k8sGen.generate(analysisResult.entities, analysisResult.relationships);
        break;

      default:
        const defaultGen = new UMLClassDiagramGenerator({ format: 'plantuml' });
        content = defaultGen.generate(analysisResult.entities, analysisResult.relationships);
    }

    // Export diagram
    const exporter = new DiagramExporter({
      format: exportFormat,
      outputPath: outputPath || './archmate-output',
    });

    const output = await exporter.export(content, diagramType, {
      entityCount: analysisResult.entities.length,
      relationshipCount: analysisResult.relationships.length,
      fileCount: analysisResult.files.length,
      language: analysisResult.language,
    });

    if (outputPath) {
      const savedPath = await exporter.save(output, diagramType);
      console.log(`\n✅ Diagram saved to ${savedPath}`);
    } else {
      console.log('\n' + content);
    }
  }

  /**
   * List supported diagram types
   */
  private listTypes(): void {
    const types: Record<string, string> = {
      'uml-class': 'UML Class Diagram - Shows classes, interfaces, and relationships',
      'uml-component': 'UML Component Diagram - Shows components and interfaces',
      'uml-sequence': 'UML Sequence Diagram - Shows method call sequences',
      'uml-activity': 'UML Activity Diagram - Shows workflow activities',
      'uml-state': 'UML State Diagram - Shows state transitions',
      'c4-context': 'C4 Context Diagram - System context overview',
      'c4-container': 'C4 Container Diagram - Container-level architecture',
      'c4-component': 'C4 Component Diagram - Component-level details',
      'c4-deployment': 'C4 Deployment Diagram - Deployment infrastructure',
      'er-diagram': 'Entity-Relationship Diagram - Database schema',
      'dependency-graph': 'Dependency Graph - Module dependencies',
      'cloud-aws': 'AWS Cloud Architecture',
      'cloud-gcp': 'GCP Cloud Architecture',
      'cloud-azure': 'Azure Cloud Architecture',
      'iac-terraform': 'Terraform IaC Architecture',
      'iac-kubernetes': 'Kubernetes Architecture',
    };

    console.log('\n📊 Supported Diagram Types\n');
    Object.entries(types).forEach(([key, desc]) => {
      console.log(`  ${key.padEnd(20)} ${desc}`);
    });
    console.log();
  }

  /**
   * List supported export formats
   */
  private listFormats(): void {
    const formats: Record<string, string> = {
      'plantuml': 'PlantUML text format (.puml)',
      'mermaid': 'Mermaid text format (.mmd)',
      'png': 'PNG image (requires PlantUML server)',
      'svg': 'SVG vector image (requires PlantUML server)',
      'html': 'Interactive HTML viewer with zoom',
      'json': 'JSON with metadata',
    };

    console.log('\n📦 Supported Export Formats\n');
    Object.entries(formats).forEach(([key, desc]) => {
      console.log(`  ${key.padEnd(10)} ${desc}`);
    });
    console.log();
  }

  /**
   * Watch for changes
   */
  private async watch(targetPath: string, options: Record<string, unknown>): Promise<void> {
    console.log(`Watching ${targetPath} for changes...`);
    console.log('Press Ctrl+C to stop.\n');

    const debounce = require('lodash/debounce') || ((fn: Function) => fn);
    
    const regenerate = debounce(async () => {
      console.log(`\n🔄 Changes detected, regenerating...`);
      try {
        await this.generate(targetPath, options);
      } catch (error) {
        console.error('Error regenerating diagram:', error);
      }
    }, 500);

    // Simple file watcher using fs.watch
    const watchDir = path.dirname(targetPath);
    const watcher = fs.watch(watchDir, { recursive: true }, (eventType, filename) => {
      if (filename && (filename.endsWith('.ts') || filename.endsWith('.js') || filename.endsWith('.py'))) {
        regenerate();
      }
    });

    process.on('SIGINT', () => {
      watcher.close();
      console.log('\n\n👋 Stopped watching.');
      process.exit(0);
    });
  }
}

// Run CLI
const cli = new ArchMateCLI();
cli.run(process.argv).catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

export { ArchMateCLI };
