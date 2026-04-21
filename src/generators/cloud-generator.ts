/**
 * ArchMate - Cloud Architecture Diagram Generator
 * Generates AWS, GCP, and Azure architecture diagrams
 */

import {
  CodeEntity,
  Relationship,
  CloudProvider,
  CloudResource,
  CloudConnection,
  AWSResource,
  GCPResource,
  AzureResource,
} from '../types';

export interface CloudConfig {
  provider: CloudProvider;
  format: 'plantuml' | 'mermaid';
  region: string;
  showLabels: boolean;
  showArrows: boolean;
}

/**
 * Cloud Architecture Diagram Generator
 */
export class CloudArchitectureGenerator {
  private config: CloudConfig;

  constructor(config: Partial<CloudConfig> = {}) {
    this.config = {
      provider: config.provider || 'aws',
      format: config.format || 'plantuml',
      region: config.region || 'us-east-1',
      showLabels: config.showLabels ?? true,
      showArrows: config.showArrows ?? true,
    };
  }

  /**
   * Generate cloud architecture diagram
   */
  generate(
    entities: CodeEntity[],
    relationships: Relationship[]
  ): string {
    const resources = this.mapToCloudResources(entities);
    const connections = this.extractConnections(relationships);

    switch (this.config.provider) {
      case 'aws':
        return this.generateAWS(resources, connections);
      case 'gcp':
        return this.generateGCP(resources, connections);
      case 'azure':
        return this.generateAzure(resources, connections);
      default:
        return this.generateMultiCloud(resources, connections);
    }
  }

  /**
   * Map code entities to cloud resources
   */
  private mapToCloudResources(entities: CodeEntity[]): CloudResource[] {
    return entities.map(entity => {
      const resourceType = this.inferResourceType(entity);
      const cloudSpecific = this.getCloudSpecificResource(entity, resourceType);

      return {
        id: entity.id,
        type: resourceType,
        name: entity.name,
        properties: {
          ...cloudSpecific,
          language: 'code',
          methods: entity.methods.length,
        },
      };
    });
  }

  /**
   * Infer resource type from entity
   */
  private inferResourceType(entity: CodeEntity): string {
    switch (entity.type) {
      case 'controller':
      case 'component':
        return 'Compute';
      case 'service':
        return 'Lambda';
      case 'repository':
        return 'Database';
      case 'model':
        return 'Storage';
      default:
        return 'Service';
    }
  }

  /**
   * Get cloud-specific resource details
   */
  private getCloudSpecificResource(entity: CodeEntity, resourceType: string): Record<string, unknown> {
    switch (this.config.provider) {
      case 'aws':
        return this.getAWSResource(entity, resourceType);
      case 'gcp':
        return this.getGCPResource(entity, resourceType);
      case 'azure':
        return this.getAzureResource(entity, resourceType);
      default:
        return {};
    }
  }

  /**
   * Get AWS resource mapping
   */
  private getAWSResource(entity: CodeEntity, resourceType: string): AWSResource {
    const resourceMap: Record<string, AWSResource> = {
      'Compute': {
        service: 'Amazon EC2',
        resourceType: 'Instance',
        name: entity.name,
        properties: {
          instanceType: 't3.medium',
        },
        connections: [],
      },
      'Lambda': {
        service: 'AWS Lambda',
        resourceType: 'Function',
        name: entity.name,
        properties: {
          runtime: 'nodejs18.x',
          memory: 512,
          timeout: 30,
        },
        connections: [],
      },
      'Database': {
        service: 'Amazon RDS',
        resourceType: 'Instance',
        name: entity.name,
        properties: {
          engine: 'postgres',
          instanceClass: 'db.t3.micro',
        },
        connections: [],
      },
      'Storage': {
        service: 'Amazon S3',
        resourceType: 'Bucket',
        name: entity.name,
        properties: {
          acl: 'private',
        },
        connections: [],
      },
      'Service': {
        service: 'Amazon ECS',
        resourceType: 'Service',
        name: entity.name,
        properties: {
          launchType: 'FARGATE',
        },
        connections: [],
      },
    };

    return resourceMap[resourceType] || resourceMap['Service'];
  }

  /**
   * Get GCP resource mapping
   */
  private getGCPResource(entity: CodeEntity, resourceType: string): GCPResource {
    const resourceMap: Record<string, GCPResource> = {
      'Compute': {
        product: 'Compute Engine',
        resourceType: 'Instance',
        name: entity.name,
        properties: {
          machineType: 'e2-medium',
        },
        connections: [],
      },
      'Lambda': {
        product: 'Cloud Functions',
        resourceType: 'Function',
        name: entity.name,
        properties: {
          runtime: 'nodejs18',
        },
        connections: [],
      },
      'Database': {
        product: 'Cloud SQL',
        resourceType: 'Instance',
        name: entity.name,
        properties: {
          databaseVersion: 'POSTGRES_14',
        },
        connections: [],
      },
      'Storage': {
        product: 'Cloud Storage',
        resourceType: 'Bucket',
        name: entity.name,
        properties: {
          storageClass: 'STANDARD',
        },
        connections: [],
      },
      'Service': {
        product: 'Cloud Run',
        resourceType: 'Service',
        name: entity.name,
        properties: {
          platform: 'managed',
        },
        connections: [],
      },
    };

    return resourceMap[resourceType] || resourceMap['Service'];
  }

  /**
   * Get Azure resource mapping
   */
  private getAzureResource(entity: CodeEntity, resourceType: string): AzureResource {
    const resourceMap: Record<string, AzureResource> = {
      'Compute': {
        resourceType: 'Virtual Machine',
        name: entity.name,
        properties: {
          vmSize: 'Standard_D2s_v3',
        },
        connections: [],
      },
      'Lambda': {
        resourceType: 'Azure Functions',
        name: entity.name,
        properties: {
          runtime: 'node',
        },
        connections: [],
      },
      'Database': {
        resourceType: 'Azure SQL Database',
        name: entity.name,
        properties: {
          sku: 'S0',
        },
        connections: [],
      },
      'Storage': {
        resourceType: 'Blob Storage',
        name: entity.name,
        properties: {
          accessTier: 'Hot',
        },
        connections: [],
      },
      'Service': {
        resourceType: 'App Service',
        name: entity.name,
        properties: {
          sku: 'Free',
        },
        connections: [],
      },
    };

    return resourceMap[resourceType] || resourceMap['Service'];
  }

  /**
   * Extract connections from relationships
   */
  private extractConnections(relationships: Relationship[]): CloudConnection[] {
    return relationships
      .filter(rel => rel.type === 'calls' || rel.type === 'uses' || rel.type === 'depends-on')
      .map(rel => ({
        from: this.getEntityName(rel.source),
        to: this.getEntityName(rel.target),
        protocol: 'HTTPS',
        port: 443,
      }));
  }

  /**
   * Get entity name from ID
   */
  private getEntityName(entityId: string): string {
    const parts = entityId.split(':');
    return parts[parts.length - 1];
  }

  /**
   * Generate AWS architecture diagram
   */
  private generateAWS(resources: CloudResource[], connections: CloudConnection[]): string {
    if (this.config.format === 'mermaid') {
      return this.generateAWSMermaid(resources, connections);
    }
    return this.generateAWSPlantUML(resources, connections);
  }

  /**
   * Generate AWS PlantUML diagram
   */
  private generateAWSPlantUML(resources: CloudResource[], connections: CloudConnection[]): string {
    const lines: string[] = [
      '@startuml',
      '!include https://raw.githubusercontent.com/awslabs/aws-icons-for-plantuml/main/dist/AWSCommon.puml',
      '!include https://raw.githubusercontent.com/awslabs/aws-icons-for-plantuml/main/dist/General/AWSRegion.puml',
      '!include https://raw.githubusercontent.com/awslabs/aws-icons-for-plantuml/main/dist/Compute/EC2Instance.puml',
      '!include https://raw.githubusercontent.com/awslabs/aws-icons-for-plantuml/main/dist/Compute/LambdaFunction.puml',
      '!include https://raw.githubusercontent.com/awslabs/aws-icons-for-plantuml/main/dist/Database/RDSInstance.puml',
      '!include https://raw.githubusercontent.com/awslabs/aws-icons-for-plantuml/main/dist/Storage/S3Bucket.puml',
      '!include https://raw.githubusercontent.com/awslabs/aws-icons-for-plantuml/main/dist/ApplicationIntegration/APIGateway.puml',
      '',
      'title AWS Architecture',
      '',
      `rectangle "Region: ${this.config.region}" {`,
    ];

    // Group resources by type
    const grouped = this.groupByType(resources);

    Object.entries(grouped).forEach(([type, resources]) => {
      lines.push(`  package "${type}" {`);
      resources.forEach(resource => {
        const icon = this.getAWSIcon(resource.type);
        lines.push(`    ${icon}(${this.toPascalCase(resource.name)}, "${resource.name}")`);
      });
      lines.push('  }');
    });

    lines.push('}');
    lines.push('');

    // Add connections
    connections.forEach(conn => {
      lines.push(`${this.toPascalCase(conn.from)} ${this.getArrow()} ${this.toPascalCase(conn.to)}`);
    });

    lines.push('');
    lines.push('@enduml');

    return lines.join('\n');
  }

  /**
   * Generate AWS Mermaid diagram
   */
  private generateAWSMermaid(resources: CloudResource[], connections: CloudConnection[]): string {
    const lines: string[] = [
      '```mermaid',
      'flowchart TB',
      '',
    ];

    // Add resources
    resources.forEach(resource => {
      const icon = this.getMermaidIcon(resource.type);
      lines.push(`    ${this.toKebabCase(resource.name)}["${icon} ${resource.name}"]`);
    });

    lines.push('');

    // Add connections
    connections.forEach(conn => {
      lines.push(`    ${this.toKebabCase(conn.from)} --> ${this.toKebabCase(conn.to)}`);
    });

    lines.push('```');

    return lines.join('\n');
  }

  /**
   * Generate GCP architecture diagram
   */
  private generateGCP(resources: CloudResource[], connections: CloudConnection[]): string {
    const lines: string[] = [
      '@startuml',
      '!include https://raw.githubusercontent.com/plantuml-stdlib/gilbarbara-plantuml-sprites/main/sprites/gcp.puml',
      '',
      'title GCP Architecture',
      '',
    ];

    // Add resources
    resources.forEach(resource => {
      const sprite = this.getGCPIcon(resource.type);
      lines.push(`package "${resource.type}" {`);
      lines.push(`    sprite ${sprite} ${resource.name}`);
      lines.push('}');
    });

    lines.push('');

    // Add connections
    connections.forEach(conn => {
      lines.push(`${conn.from} --> ${conn.to}`);
    });

    lines.push('@enduml');

    return lines.join('\n');
  }

  /**
   * Generate Azure architecture diagram
   */
  private generateAzure(resources: CloudResource[], connections: CloudConnection[]): string {
    const lines: string[] = [
      '@startuml',
      '',
      '!include https://raw.githubusercontent.com/plantuml-stdlib/Azure-PlantUML/release-v2/dist/AzureCommon.puml',
      '',
      'title Azure Architecture',
      '',
    ];

    // Add resources
    resources.forEach(resource => {
      const icon = this.getAzureIcon(resource.type);
      lines.push(`AzureEntity( ${resource.name}, "${resource.name}", "${resource.type}", "")`);
    });

    lines.push('');

    // Add connections
    connections.forEach(conn => {
      lines.push(`${conn.from} --> ${conn.to}`);
    });

    lines.push('@enduml');

    return lines.join('\n');
  }

  /**
   * Generate multi-cloud diagram
   */
  private generateMultiCloud(resources: CloudResource[], connections: CloudConnection[]): string {
    const lines: string[] = [
      '@startuml',
      '',
      'title Multi-Cloud Architecture',
      '',
    ];

    // Group by provider (using type as proxy)
    const grouped = this.groupByType(resources);

    ['AWS', 'GCP', 'Azure'].forEach(cloud => {
      lines.push(`package "${cloud}" {`);
      if (grouped[cloud]) {
        grouped[cloud].forEach(resource => {
          lines.push(`  [${resource.name}]`);
        });
      }
      lines.push('}');
    });

    lines.push('');

    connections.forEach(conn => {
      lines.push(`${conn.from} --> ${conn.to}`);
    });

    lines.push('@enduml');

    return lines.join('\n');
  }

  /**
   * Group resources by type
   */
  private groupByType(resources: CloudResource[]): Record<string, CloudResource[]> {
    const grouped: Record<string, CloudResource[]> = {};

    resources.forEach(resource => {
      if (!grouped[resource.type]) {
        grouped[resource.type] = [];
      }
      grouped[resource.type].push(resource);
    });

    return grouped;
  }

  /**
   * Get AWS icon name
   */
  private getAWSIcon(type: string): string {
    const icons: Record<string, string> = {
      'Compute': 'EC2Instance',
      'Lambda': 'LambdaFunction',
      'Database': 'RDSInstance',
      'Storage': 'S3Bucket',
      'Service': 'ECSService',
    };
    return icons[type] || 'GenericForlder';
  }

  /**
   * Get GCP icon name
   */
  private getGCPIcon(type: string): string {
    const icons: Record<string, string> = {
      'Compute': 'gcp-compute',
      'Lambda': 'gcp-functions',
      'Database': 'gcp-sql',
      'Storage': 'gcp-storage',
      'Service': 'gcp-run',
    };
    return icons[type] || 'gcp-generic';
  }

  /**
   * Get Azure icon name
   */
  private getAzureIcon(type: string): string {
    const icons: Record<string, string> = {
      'Compute': 'VirtualMachine',
      'Lambda': 'Functions',
      'Database': 'SQLDatabase',
      'Storage': 'BlobStorage',
      'Service': 'AppService',
    };
    return icons[type] || 'GenericResource';
  }

  /**
   * Get Mermaid icon
   */
  private getMermaidIcon(type: string): string {
    const icons: Record<string, string> = {
      'Compute': '🖥️',
      'Lambda': 'λ',
      'Database': '🗄️',
      'Storage': '📦',
      'Service': '⚙️',
    };
    return icons[type] || '🔧';
  }

  /**
   * Get arrow type
   */
  private getArrow(): string {
    return this.config.showArrows ? '-->>' : '---';
  }

  /**
   * Convert to PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_([a-z])/g, (_, c) => c.toUpperCase())
      .replace(/^./, s => s.toUpperCase());
  }

  /**
   * Convert to kebab-case
   */
  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }
}

export default CloudArchitectureGenerator;
