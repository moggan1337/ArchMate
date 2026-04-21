/**
 * ArchMate - Architecture Diagram Generator
 * Main entry point
 */

export * from './types';
export * from './parsers';
export * from './analysis';
export * from './generators';
export * from './exporters';
export { ArchMateCLI } from './cli';

// Default configuration
export const DEFAULT_CONFIG = {
  maxFileSize: 1024 * 1024, // 1MB
  ignorePaths: [
    'node_modules',
    'dist',
    'build',
    'target',
    '.git',
    '__pycache__',
    'coverage',
    '.next',
    '.nuxt',
  ],
  supportedLanguages: [
    'typescript',
    'javascript',
    'python',
    'java',
    'csharp',
    'go',
    'rust',
  ],
  supportedDiagramTypes: [
    'uml-class',
    'uml-component',
    'uml-sequence',
    'c4-context',
    'c4-container',
    'c4-component',
    'c4-deployment',
    'er-diagram',
    'dependency-graph',
    'cloud-aws',
    'cloud-gcp',
    'cloud-azure',
    'iac-terraform',
    'iac-kubernetes',
  ],
  supportedFormats: [
    'plantuml',
    'mermaid',
    'png',
    'svg',
    'html',
    'json',
  ],
};

export default {
  DEFAULT_CONFIG,
};
