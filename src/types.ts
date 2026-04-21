/**
 * ArchMate - Architecture Diagram Generator
 * Core type definitions and interfaces
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Represents a code entity extracted from source code
 */
export interface CodeEntity {
  id: string;
  name: string;
  type: EntityType;
  file: string;
  line: number;
  column: number;
  visibility: Visibility;
  modifiers: Modifier[];
  documentation?: string;
  properties: Property[];
  methods: Method[];
  dependencies: string[];
  annotations: string[];
  imports: ImportInfo[];
  exports: string[];
}

/**
 * Types of code entities
 */
export type EntityType = 
  | 'class'
  | 'interface'
  | 'enum'
  | 'struct'
  | 'namespace'
  | 'module'
  | 'function'
  | 'method'
  | 'variable'
  | 'constant'
  | 'type'
  | 'service'
  | 'component'
  | 'controller'
  | 'repository'
  | 'model';

/**
 * Visibility modifiers
 */
export type Visibility = 'public' | 'private' | 'protected' | 'internal' | 'package';

/**
 * Language modifiers
 */
export type Modifier = 
  | 'static'
  | 'abstract'
  | 'final'
  | 'readonly'
  | 'async'
  | 'virtual'
  | 'override'
  | 'sealed'
  | 'partial';

/**
 * Property/Field definition
 */
export interface Property {
  name: string;
  type: string;
  visibility: Visibility;
  isStatic: boolean;
  isReadonly: boolean;
  isOptional: boolean;
  defaultValue?: string;
  decorators: string[];
}

/**
 * Method definition
 */
export interface Method {
  name: string;
  parameters: Parameter[];
  returnType: string;
  visibility: Visibility;
  isStatic: boolean;
  isAsync: boolean;
  isAbstract: boolean;
  decorators: string[];
  body?: string;
  calls: string[]; // Methods called within this method
}

/**
 * Method parameter
 */
export interface Parameter {
  name: string;
  type: string;
  isOptional: boolean;
  isRest: boolean;
  defaultValue?: string;
}

/**
 * Import information
 */
export interface ImportInfo {
  source: string;
  imported: string[];
  isDefault: boolean;
  isNamespace: boolean;
}

/**
 * Relationship between entities
 */
export interface Relationship {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  label?: string;
  sourceCardinality?: string;
  targetCardinality?: string;
  sourceMultiplicity?: Multiplicity;
  targetMultiplicity?: Multiplicity;
}

export type RelationshipType = 
  | 'extends'
  | 'implements'
  | 'uses'
  | 'contains'
  | 'references'
  | 'calls'
  | 'creates'
  | 'depends-on'
  | 'associates'
  | 'aggregates'
  | 'composes'
  | 'connects-to'
  | 'depends'
  | 'realizes'
  | 'triggers'
  | 'sends';

export type Multiplicity = '0..1' | '1' | '0..*' | '1..*' | '*';

/**
 * Dependency graph node
 */
export interface DependencyNode {
  id: string;
  label: string;
  type: EntityType;
  group?: string;
  layer?: string;
  metadata: Record<string, unknown>;
}

/**
 * Dependency graph edge
 */
export interface DependencyEdge {
  source: string;
  target: string;
  label?: string;
  weight?: number;
  type: RelationshipType;
}

/**
 * Complete dependency graph
 */
export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  metadata: GraphMetadata;
}

/**
 * Graph metadata
 */
export interface GraphMetadata {
  language: string;
  framework?: string;
  totalFiles: number;
  totalEntities: number;
  totalRelationships: number;
  cycles: string[][];
  depth: number;
}

// ============================================================================
// Diagram Types
// ============================================================================

/**
 * Supported diagram types
 */
export type DiagramType = 
  | 'uml-class'
  | 'uml-component'
  | 'uml-sequence'
  | 'uml-activity'
  | 'uml-state'
  | 'c4-context'
  | 'c4-container'
  | 'c4-component'
  | 'c4-deployment'
  | 'er-diagram'
  | 'dependency-graph'
  | 'cloud-aws'
  | 'cloud-gcp'
  | 'cloud-azure'
  | 'iac-terraform'
  | 'iac-kubernetes'
  | 'sequence-call';

/**
 * Diagram configuration
 */
export interface DiagramConfig {
  type: DiagramType;
  title: string;
  description?: string;
  entities: CodeEntity[];
  relationships: Relationship[];
  graph: DependencyGraph;
  options: DiagramOptions;
}

/**
 * Diagram generation options
 */
export interface DiagramOptions {
  showVisibility?: boolean;
  showTypes?: boolean;
  showMethods?: boolean;
  showProperties?: boolean;
  showDocComments?: boolean;
  showModifiers?: boolean;
  maxDepth?: number;
  filter?: EntityFilter;
  groupBy?: 'namespace' | 'layer' | 'type' | 'file' | 'none';
  layout?: 'horizontal' | 'vertical' | 'radial' | 'tree';
  theme?: 'light' | 'dark' | 'auto';
  colorScheme?: ColorScheme;
  includeExternal?: boolean;
  focusPaths?: string[];
  excludePaths?: string[];
}

/**
 * Entity filter configuration
 */
export interface EntityFilter {
  types?: EntityType[];
  namespaces?: string[];
  visibility?: Visibility;
  namePattern?: RegExp;
  hasAnnotation?: string[];
}

/**
 * Color scheme for diagrams
 */
export interface ColorScheme {
  background: string;
  nodeFill: string;
  nodeStroke: string;
  edgeStroke: string;
  textColor: string;
  accentColors: Record<EntityType, string>;
}

/**
 * Generated diagram output
 */
export interface DiagramOutput {
  format: ExportFormat;
  content: string | Buffer;
  metadata: OutputMetadata;
}

export type ExportFormat = 'plantuml' | 'mermaid' | 'json' | 'png' | 'svg' | 'html';

/**
 * Output metadata
 */
export interface OutputMetadata {
  diagramType: DiagramType;
  generatedAt: Date;
  entityCount: number;
  relationshipCount: number;
  fileCount: number;
  language: string;
}

// ============================================================================
// Parser Types
// ============================================================================

/**
 * Parser configuration
 */
export interface ParserConfig {
  language: Language;
  filePatterns: string[];
  excludePatterns: string[];
  parseOptions: ParseOptions;
}

export type Language = 
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'java'
  | 'csharp'
  | 'go'
  | 'rust'
  | 'cpp'
  | 'ruby'
  | 'php';

export interface ParseOptions {
  parseComments: boolean;
  parseJsx: boolean;
  parseDecorators: boolean;
  resolveImports: boolean;
  extractDocComments: boolean;
}

// ============================================================================
// Sequence Diagram Types
// ============================================================================

/**
 * Sequence diagram element
 */
export interface SequenceElement {
  type: 'actor' | 'object' | 'activation' | 'message' | 'return' | 'self-call' | 'async-message';
  actor?: string;
  from?: string;
  to?: string;
  message?: string;
  returnValue?: string;
  activationStart?: boolean;
  activationEnd?: boolean;
  timestamp?: number;
  isAsync?: boolean;
  isSelfCall?: boolean;
}

/**
 * Sequence diagram
 */
export interface SequenceDiagram {
  title: string;
  actors: string[];
  elements: SequenceElement[];
  loops: SequenceLoop[];
  alternatives: SequenceAlternative[];
  options: SequenceOptions;
}

export interface SequenceLoop {
  condition: string;
  startIndex: number;
  endIndex: number;
}

export interface SequenceAlternative {
  condition: string;
  startIndex: number;
  endIndex: number;
}

export interface SequenceOptions {
  showTimestamps: boolean;
  showReturnValues: boolean;
  groupByClass: boolean;
  maxDepth: number;
}

// ============================================================================
// Cloud Architecture Types
// ============================================================================

/**
 * Cloud provider
 */
export type CloudProvider = 'aws' | 'gcp' | 'azure' | 'multi';

/**
 * AWS resource mapping
 */
export interface AWSResource {
  service: string;
  resourceType: string;
  name: string;
  properties: Record<string, unknown>;
  connections: string[];
}

/**
 * GCP resource mapping
 */
export interface GCPResource {
  product: string;
  resourceType: string;
  name: string;
  properties: Record<string, unknown>;
  connections: string[];
}

/**
 * Azure resource mapping
 */
export interface AzureResource {
  resourceType: string;
  name: string;
  properties: Record<string, unknown>;
  connections: string[];
}

/**
 * Cloud architecture
 */
export interface CloudArchitecture {
  provider: CloudProvider;
  regions: CloudRegion[];
  resources: CloudResource[];
  connections: CloudConnection[];
  securityGroups: SecurityGroup[];
}

export interface CloudRegion {
  name: string;
  zones: string[];
}

export interface CloudResource {
  id: string;
  type: string;
  name: string;
  region?: string;
  properties: Record<string, unknown>;
}

export interface CloudConnection {
  from: string;
  to: string;
  protocol?: string;
  port?: number;
}

export interface SecurityGroup {
  name: string;
  rules: SecurityRule[];
}

export interface SecurityRule {
  direction: 'inbound' | 'outbound';
  protocol: string;
  port: string;
  source?: string;
  destination?: string;
}

// ============================================================================
// IaC Types
// ============================================================================

/**
 * IaC framework
 */
export type IaCFramework = 'terraform' | 'kubernetes' | 'ansible' | 'cloudformation' | 'pulumi';

/**
 * Terraform resource
 */
export interface TerraformResource {
  type: string;
  name: string;
  provider: string;
  properties: Record<string, unknown>;
  dependencies: string[];
  modules: string[];
}

/**
 * Kubernetes resource
 */
export interface K8sResource {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
  };
  spec?: Record<string, unknown>;
  connections: string[];
}

/**
 * IaC architecture
 */
export interface IaCArchitecture {
  framework: IaCFramework;
  resources: IaCResource[];
  variables: IaCVariable[];
  outputs: IaCOutput[];
  modules: IaCModule[];
  connections: IaCConnection[];
}

export type IaCResource = TerraformResource | K8sResource;

export interface IaCVariable {
  name: string;
  type: string;
  defaultValue?: unknown;
  description?: string;
}

export interface IaCOutput {
  name: string;
  value: string;
  description?: string;
}

export interface IaCModule {
  name: string;
  source: string;
  dependencies: string[];
}

export interface IaCConnection {
  from: string;
  to: string;
  type: 'creates' | 'references' | 'depends-on' | 'configures';
}

// ============================================================================
// ER Diagram Types
// ============================================================================

/**
 * Database entity (table)
 */
export interface DBEntity {
  name: string;
  schema?: string;
  columns: DBColumn[];
  primaryKey: string[];
  foreignKeys: DBForeignKey[];
  indexes: DBIndex[];
  constraints: DBConstraint[];
}

export interface DBColumn {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  defaultValue?: string;
  isUnique: boolean;
  isAutoIncrement: boolean;
}

export interface DBForeignKey {
  column: string;
  references: {
    table: string;
    column: string;
    onDelete?: 'cascade' | 'restrict' | 'set null' | 'no action';
    onUpdate?: 'cascade' | 'restrict' | 'set null' | 'no action';
  };
}

export interface DBIndex {
  name: string;
  columns: string[];
  isUnique: boolean;
  type?: 'btree' | 'hash' | 'gist';
}

export interface DBConstraint {
  name: string;
  type: 'check' | 'unique' | 'exclude';
  definition: string;
}

/**
 * ER Diagram
 */
export interface ERDiagram {
  entities: DBEntity[];
  relationships: ERRelationship[];
  options: DBOption;
}

export interface ERRelationship {
  from: {
    entity: string;
    column: string;
  };
  to: {
    entity: string;
    column: string;
  };
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  isIdentifying: boolean;
}

export interface DBOption {
  showSchema: boolean;
  showTypes: boolean;
  showNullability: boolean;
  showDefaults: boolean;
  showIndexes: boolean;
  showConstraints: boolean;
  notation: ' crow's foot' | 'uml' | 'idEF1x';
}

// ============================================================================
// Analysis Types
// ============================================================================

/**
 * Analysis result
 */
export interface AnalysisResult {
  entities: CodeEntity[];
  relationships: Relationship[];
  graph: DependencyGraph;
  metrics: AnalysisMetrics;
  warnings: AnalysisWarning[];
  language: Language;
  files: AnalyzedFile[];
}

export interface AnalyzedFile {
  path: string;
  language: Language;
  size: number;
  entities: number;
  imports: number;
  exports: number;
}

export interface AnalysisMetrics {
  totalFiles: number;
  totalLines: number;
  totalEntities: number;
  totalRelationships: number;
  cyclomaticComplexity: number;
  depthOfInheritance: number;
  coupling: number;
  cohesion: number;
}

export interface AnalysisWarning {
  type: 'circular-dependency' | 'unused-import' | 'missing-type' | 'deep-nesting' | 'high-coupling';
  file?: string;
  entity?: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Main configuration
 */
export interface ArchMateConfig {
  project: ProjectConfig;
  analysis: AnalysisConfig;
  diagrams: DiagramsConfig;
  export: ExportConfig;
  output: OutputConfig;
}

export interface ProjectConfig {
  root: string;
  language: Language;
  frameworks: string[];
  buildTool: 'npm' | 'yarn' | 'pnpm' | 'maven' | 'gradle' | 'cargo' | 'dotnet' | 'none';
  testPattern?: string;
}

export interface AnalysisConfig {
  parseComments: boolean;
  extractTypes: boolean;
  detectPatterns: boolean;
  analyzeDependencies: boolean;
  maxFileSize: number;
  ignorePaths: string[];
  includePatterns: string[];
}

export interface DiagramsConfig {
  defaultType: DiagramType;
  autoDetect: boolean;
  preferredFormat: ExportFormat;
  theme: 'light' | 'dark';
  maxDepth: number;
  showExternal: boolean;
}

export interface ExportConfig {
  defaultFormat: ExportFormat;
  outputDir: string;
  fileNaming: ' kebab-case' | 'snake_case' | 'camelCase' | 'PascalCase';
  includeMetadata: boolean;
}

export interface OutputConfig {
  console: {
    color: boolean;
    verbose: boolean;
  };
  file: {
    enabled: boolean;
    path: string;
  };
}
