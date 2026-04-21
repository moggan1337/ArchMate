/**
 * ArchMate - Infrastructure as Code (IaC) Diagram Generator
 * Generates diagrams from Terraform and Kubernetes configurations
 */

import {
  CodeEntity,
  Relationship,
  IaCFramework,
  TerraformResource,
  K8sResource,
  IaCArchitecture,
  IaCResource,
  IaCConnection,
} from '../types';

export interface IaCConfig {
  framework: IaCFramework;
  format: 'plantuml' | 'mermaid';
  showVariables: boolean;
  showOutputs: boolean;
  showModules: boolean;
}

/**
 * IaC Architecture Diagram Generator
 */
export class IaCArchitectureGenerator {
  private config: IaCConfig;

  constructor(config: Partial<IaCConfig> = {}) {
    this.config = {
      framework: config.framework || 'terraform',
      format: config.format || 'plantuml',
      showVariables: config.showVariables ?? true,
      showOutputs: config.showOutputs ?? true,
      showModules: config.showModules ?? true,
    };
  }

  /**
   * Generate IaC architecture diagram
   */
  generate(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): string {
    switch (this.config.framework) {
      case 'terraform':
        return this.generateTerraform(entities, relationships);
      case 'kubernetes':
        return this.generateKubernetes(entities, relationships);
      case 'cloudformation':
        return this.generateCloudFormation(entities, relationships);
      default:
        return this.generateTerraform(entities, relationships);
    }
  }

  /**
   * Generate Terraform diagram
   */
  private generateTerraform(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): string {
    const architecture = this.buildTerraformArchitecture(entities, relationships);

    if (this.config.format === 'mermaid') {
      return this.generateTerraformMermaid(architecture);
    }
    return this.generateTerraformPlantUML(architecture);
  }

  /**
   * Build Terraform architecture
   */
  private buildTerraformArchitecture(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): IaCArchitecture {
    const resources: TerraformResource[] = [];
    const connections: IaCConnection[] = [];

    // Map entities to Terraform resources
    entities.forEach(entity => {
      const resource = this.mapToTerraformResource(entity);
      if (resource) {
        resources.push(resource);
      }
    });

    // Map relationships to connections
    relationships.forEach(rel => {
      if (rel.type === 'calls' || rel.type === 'uses' || rel.type === 'depends-on') {
        connections.push({
          from: this.getEntityName(rel.source),
          to: this.getEntityName(rel.target),
          type: 'depends-on',
        });
      }
    });

    return {
      framework: 'terraform',
      resources,
      variables: this.generateTerraformVariables(entities),
      outputs: this.generateTerraformOutputs(entities),
      modules: this.generateTerraformModules(entities),
      connections,
    };
  }

  /**
   * Map entity to Terraform resource
   */
  private mapToTerraformResource(entity: CodeEntity): TerraformResource | null {
    const typeMap = this.getTerraformTypeMapping();

    if (!typeMap[entity.type]) {
      return null;
    }

    return {
      type: typeMap[entity.type].type,
      name: entity.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      provider: typeMap[entity.type].provider,
      properties: this.extractTerraformProperties(entity),
      dependencies: entity.dependencies.map(d => d.toLowerCase().replace(/[^a-z0-9]/g, '_')),
      modules: [],
    };
  }

  /**
   * Get Terraform type mapping
   */
  private getTerraformTypeMapping(): Record<string, { type: string; provider: string }> {
    return {
      'controller': { type: 'aws_instance', provider: 'aws' },
      'service': { type: 'aws_lambda_function', provider: 'aws' },
      'repository': { type: 'aws_db_instance', provider: 'aws' },
      'model': { type: 'aws_dynamodb_table', provider: 'aws' },
      'component': { type: 'aws_ecs_service', provider: 'aws' },
      'class': { type: 'aws_resource', provider: 'aws' },
      'interface': { type: 'aws_resource', provider: 'aws' },
    };
  }

  /**
   * Extract Terraform properties
   */
  private extractTerraformProperties(entity: CodeEntity): Record<string, unknown> {
    const properties: Record<string, unknown> = {};

    // Map entity properties to resource attributes
    entity.properties.forEach(prop => {
      const key = prop.name.toLowerCase().replace(/([A-Z])/g, '_$1');
      properties[key] = prop.defaultValue || this.inferPropertyValue(prop.type);
    });

    // Add computed properties
    properties.tags = {
      Name: entity.name,
      ManagedBy: 'Terraform',
    };

    return properties;
  }

  /**
   * Infer default value for property type
   */
  private inferPropertyValue(type: string): unknown {
    if (type.includes('string') || type.includes('String')) return '""';
    if (type.includes('number') || type.includes('int') || type.includes('Int')) return 0;
    if (type.includes('bool') || type.includes('boolean')) return true;
    return null;
  }

  /**
   * Generate Terraform variables
   */
  private generateTerraformVariables(entities: CodeEntity[]): { name: string; type: string; defaultValue?: unknown }[] {
    const variables: { name: string; type: string; defaultValue?: unknown }[] = [];

    entities.forEach(entity => {
      entity.properties.forEach(prop => {
        if (!prop.defaultValue) {
          variables.push({
            name: `${entity.name.toLowerCase()}_${prop.name.toLowerCase()}`,
            type: this.mapToHCLType(prop.type),
          });
        }
      });
    });

    return variables.slice(0, 10); // Limit variables
  }

  /**
   * Map type to HCL type
   */
  private mapToHCLType(type: string): string {
    if (type.includes('[]')) return `list(string)`;
    if (type.includes('Map') || type.includes('object')) return `map(string)`;
    if (type.includes('string') || type.includes('String')) return 'string';
    if (type.includes('number') || type.includes('int') || type.includes('Int')) return 'number';
    if (type.includes('bool') || type.includes('boolean')) return 'bool';
    return 'string';
  }

  /**
   * Generate Terraform outputs
   */
  private generateTerraformOutputs(entities: CodeEntity[]): { name: string; value: string; description?: string }[] {
    const outputs: { name: string; value: string; description?: string }[] = [];

    entities.forEach(entity => {
      outputs.push({
        name: `${entity.name.toLowerCase()}_id`,
        value: `${entity.name.toLowerCase()}.id`,
        description: `The ID of the ${entity.name} resource`,
      });
    });

    return outputs;
  }

  /**
   * Generate Terraform modules
   */
  private generateTerraformModules(entities: CodeEntity[]): { name: string; source: string; dependencies: string[] }[] {
    const modules: { name: string; source: string; dependencies: string[] }[] = [];

    // Group entities by namespace/file
    const groups = new Map<string, CodeEntity[]>();
    entities.forEach(entity => {
      const group = entity.file.split('/').slice(-2, -1)[0] || 'core';
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)!.push(entity);
    });

    groups.forEach((groupEntities, groupName) => {
      if (groupEntities.length > 1) {
        modules.push({
          name: groupName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          source: `./modules/${groupName.toLowerCase()}`,
          dependencies: groupEntities.map(e => e.name.toLowerCase().replace(/[^a-z0-9]/g, '_')),
        });
      }
    });

    return modules;
  }

  /**
   * Generate Terraform PlantUML diagram
   */
  private generateTerraformPlantUML(architecture: IaCArchitecture): string {
    const lines: string[] = [
      '@startuml',
      '',
      'skinparam rectangle<<resource>> {',
      '  BackgroundColor #7F52FF',
      '  FontColor #FFFFFF',
      '  BorderColor #7F52FF',
      '}',
      '',
      'title Terraform Infrastructure Diagram',
      '',
    ];

    // Add modules if enabled
    if (this.config.showModules && architecture.modules.length > 0) {
      lines.push('package "Modules" {');
      architecture.modules.forEach(mod => {
        lines.push(`  rectangle "${mod.name}" {`);
        lines.push(`    [${mod.dependencies.join(']\n    [')}]`);
        lines.push('  }');
      });
      lines.push('}');
      lines.push('');
    }

    // Group resources by type
    const grouped = this.groupByResourceType(architecture.resources);

    Object.entries(grouped).forEach(([category, resources]) => {
      lines.push(`package "${category}" {`);
      resources.forEach(resource => {
        lines.push(`  rectangle "${resource.type}.${resource.name}" <<resource>> {`);
        lines.push(`    attribute "id" = "${resource.name}"`);
        lines.push(`    attribute "provider" = "${resource.provider}"`);
        lines.push('  }');
      });
      lines.push('}');
      lines.push('');
    });

    // Add connections
    architecture.connections.forEach(conn => {
      const fromName = conn.from.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const toName = conn.to.toLowerCase().replace(/[^a-z0-9]/g, '_');
      lines.push(`${fromName} --> ${toName}`);
    });

    lines.push('');
    lines.push('@enduml');

    return lines.join('\n');
  }

  /**
   * Generate Terraform Mermaid diagram
   */
  private generateTerraformMermaid(architecture: IaCArchitecture): string {
    const lines: string[] = [
      '```mermaid',
      'flowchart TB',
      '',
    ];

    // Add resources
    architecture.resources.forEach(resource => {
      const resourceId = `${resource.type}_${resource.name}`;
      lines.push(`    ${resourceId}["${resource.type}<br>${resource.name}"]`);
    });

    lines.push('');

    // Add connections
    architecture.connections.forEach(conn => {
      const fromName = conn.from.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const toName = conn.to.toLowerCase().replace(/[^a-z0-9]/g, '_');
      lines.push(`    ${fromName} --> ${toName}`);
    });

    lines.push('```');

    return lines.join('\n');
  }

  /**
   * Generate Kubernetes diagram
   */
  private generateKubernetes(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): string {
    if (this.config.format === 'mermaid') {
      return this.generateKubernetesMermaid(entities, relationships);
    }
    return this.generateKubernetesPlantUML(entities, relationships);
  }

  /**
   * Generate Kubernetes PlantUML diagram
   */
  private generateKubernetesPlantUML(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): string {
    const lines: string[] = [
      '@startuml',
      '',
      'skinparam rectangle<<pod>> {',
      '  BackgroundColor #326CE5',
      '  FontColor #FFFFFF',
      '}',
      '',
      'skinparam rectangle<<service>> {',
      '  BackgroundColor #326CE5',
      '  FontColor #FFFFFF',
      '}',
      '',
      'title Kubernetes Architecture',
      '',
      'rectangle "Kubernetes Cluster" {',
    ];

    // Map entities to K8s resources
    const k8sResources = this.mapToK8sResources(entities);

    // Group by namespace
    const byNamespace = this.groupByNamespace(k8sResources);

    Object.entries(byNamespace).forEach(([namespace, resources]) => {
      lines.push(`  package "${namespace}" {`);
      resources.forEach(resource => {
        const rectType = resource.kind.toLowerCase();
        lines.push(`    rectangle "${resource.metadata.name}" <<${rectType}>> {`);
        lines.push(`      kind: ${resource.kind}`);
        lines.push(`      apiVersion: ${resource.apiVersion}`);
        if (resource.metadata.labels) {
          lines.push(`      labels: ${JSON.stringify(resource.metadata.labels)}`);
        }
        lines.push('    }');
      });
      lines.push('  }');
    });

    lines.push('}');
    lines.push('');
    lines.push('@enduml');

    return lines.join('\n');
  }

  /**
   * Generate Kubernetes Mermaid diagram
   */
  private generateKubernetesMermaid(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): string {
    const lines: string[] = [
      '```mermaid',
      'flowchart TB',
      '',
      '    subgraph cluster["Kubernetes Cluster"]',
    ];

    const k8sResources = this.mapToK8sResources(entities);
    const byNamespace = this.groupByNamespace(k8sResources);

    Object.entries(byNamespace).forEach(([namespace, resources]) => {
      lines.push(`        subgraph ns_${namespace.replace(/[^a-z0-9]/gi, '_')}["${namespace}"]`);
      resources.forEach(resource => {
        const icon = this.getK8sIcon(resource.kind);
        lines.push(`            ${resource.metadata.name}["${icon} ${resource.kind}: ${resource.metadata.name}"]`);
      });
      lines.push('        end');
    });

    lines.push('    end');

    lines.push('```');

    return lines.join('\n');
  }

  /**
   * Map entities to Kubernetes resources
   */
  private mapToK8sResources(entities: CodeEntity[]): K8sResource[] {
    const resources: K8sResource[] = [];

    entities.forEach(entity => {
      const kind = this.inferK8sKind(entity);
      if (kind) {
        resources.push({
          apiVersion: this.getK8sApiVersion(kind),
          kind,
          metadata: {
            name: entity.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            namespace: 'default',
            labels: {
              app: entity.name.toLowerCase(),
              tier: this.getK8sTier(entity.type),
            },
          },
          connections: entity.dependencies.map(d => d.toLowerCase().replace(/[^a-z0-9]/g, '-')),
        });
      }
    });

    return resources;
  }

  /**
   * Infer Kubernetes kind from entity type
   */
  private inferK8sKind(entity: CodeEntity): string | null {
    const kindMap: Record<string, string> = {
      'controller': 'Deployment',
      'component': 'Deployment',
      'service': 'Service',
      'repository': 'PersistentVolumeClaim',
      'model': 'ConfigMap',
    };

    return kindMap[entity.type] || 'Deployment';
  }

  /**
   * Get Kubernetes API version
   */
  private getK8sApiVersion(kind: string): string {
    const versionMap: Record<string, string> = {
      'Deployment': 'apps/v1',
      'Service': 'v1',
      'ConfigMap': 'v1',
      'PersistentVolumeClaim': 'v1',
      'Ingress': 'networking.k8s.io/v1',
      'StatefulSet': 'apps/v1',
      'DaemonSet': 'apps/v1',
    };

    return versionMap[kind] || 'v1';
  }

  /**
   * Get Kubernetes tier
   */
  private getK8sTier(type: string): string {
    const tierMap: Record<string, string> = {
      'controller': 'frontend',
      'component': 'frontend',
      'service': 'backend',
      'repository': 'data',
      'model': 'data',
    };

    return tierMap[type] || 'backend';
  }

  /**
   * Get Kubernetes icon for Mermaid
   */
  private getK8sIcon(kind: string): string {
    const iconMap: Record<string, string> = {
      'Deployment': '📦',
      'Service': '🔌',
      'ConfigMap': '📝',
      'PersistentVolumeClaim': '💾',
      'Ingress': '🌐',
      'StatefulSet': '📊',
      'DaemonSet': '👥',
    };

    return iconMap[kind] || '⚙️';
  }

  /**
   * Group resources by namespace
   */
  private groupByNamespace(resources: K8sResource[]): Record<string, K8sResource[]> {
    const grouped: Record<string, K8sResource[]> = {};

    resources.forEach(resource => {
      const ns = resource.metadata.namespace || 'default';
      if (!grouped[ns]) {
        grouped[ns] = [];
      }
      grouped[ns].push(resource);
    });

    return grouped;
  }

  /**
   * Generate CloudFormation diagram
   */
  private generateCloudFormation(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): string {
    const lines: string[] = [
      '@startuml',
      '',
      'title AWS CloudFormation Architecture',
      '',
    ];

    entities.forEach(entity => {
      lines.push(`rectangle "${entity.name}"`);
    });

    lines.push('');
    lines.push('@enduml');

    return lines.join('\n');
  }

  /**
   * Group resources by type
   */
  private groupByResourceType(resources: TerraformResource[]): Record<string, TerraformResource[]> {
    const grouped: Record<string, TerraformResource[]> = {};

    resources.forEach(resource => {
      const type = resource.type.split('_')[1] || 'other';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(resource);
    });

    return grouped;
  }

  /**
   * Get entity name from ID
   */
  private getEntityName(entityId: string): string {
    const parts = entityId.split(':');
    return parts[parts.length - 1];
  }
}

export default IaCArchitectureGenerator;
