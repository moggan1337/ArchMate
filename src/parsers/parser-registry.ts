/**
 * ArchMate - Parser Registry
 * Central registry for language-specific parsers
 */

import { Language, ParserConfig, AnalysisResult, CodeEntity, Relationship } from '../types';
import { TypeScriptParser } from './typescript-parser';
import { JavaScriptParser } from './javascript-parser';
import { PythonParser } from './python-parser';
import { JavaParser } from './java-parser';
import { CSharpParser } from './csharp-parser';

/**
 * Parser interface
 */
export interface IParser {
  readonly language: Language;
  canParse(filePath: string): boolean;
  parse(source: string, filePath: string): CodeEntity[];
  parseRelationships(entities: CodeEntity[]): Relationship[];
}

/**
 * Parser registry for managing all language parsers
 */
export class ParserRegistry {
  private parsers: Map<Language, IParser> = new Map();
  private extensions: Map<string, Language> = new Map();

  constructor() {
    this.registerDefaultParsers();
  }

  /**
   * Register default parsers
   */
  private registerDefaultParsers(): void {
    // TypeScript parser
    const tsParser = new TypeScriptParser();
    this.register('typescript', tsParser);
    
    // JavaScript parser
    const jsParser = new JavaScriptParser();
    this.register('javascript', jsParser);
    
    // Python parser
    const pyParser = new PythonParser();
    this.register('python', pyParser);
    
    // Java parser
    const javaParser = new JavaParser();
    this.register('java', javaParser);
    
    // C# parser
    const csParser = new CSharpParser();
    this.register('csharp', csParser);
  }

  /**
   * Register a parser for a language
   */
  register(language: Language, parser: IParser): void {
    this.parsers.set(language, parser);
  }

  /**
   * Get parser for a language
   */
  getParser(language: Language): IParser | undefined {
    return this.parsers.get(language);
  }

  /**
   * Detect language from file extension
   */
  detectLanguage(filePath: string): Language | undefined {
    const ext = filePath.toLowerCase().split('.').pop();
    if (ext) {
      return this.extensions.get(ext);
    }
    return undefined;
  }

  /**
   * Register file extension mapping
   */
  registerExtension(extension: string, language: Language): void {
    this.extensions.set(extension.toLowerCase().replace(/^\./, ''), language);
  }

  /**
   * Get all registered languages
   */
  getSupportedLanguages(): Language[] {
    return Array.from(this.parsers.keys());
  }

  /**
   * Check if a language is supported
   */
  isSupported(language: Language): boolean {
    return this.parsers.has(language);
  }
}

// Export singleton instance
export const parserRegistry = new ParserRegistry();

// Register default extensions
parserRegistry.registerExtension('.ts', 'typescript');
parserRegistry.registerExtension('.tsx', 'typescript');
parserRegistry.registerExtension('.js', 'javascript');
parserRegistry.registerExtension('.jsx', 'javascript');
parserRegistry.registerExtension('.mjs', 'javascript');
parserRegistry.registerExtension('.cjs', 'javascript');
parserRegistry.registerExtension('.py', 'python');
parserRegistry.registerExtension('.java', 'java');
parserRegistry.registerExtension('.cs', 'csharp');
parserRegistry.registerExtension('.go', 'go');
parserRegistry.registerExtension('.rs', 'rust');
