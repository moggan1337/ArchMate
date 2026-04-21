/**
 * ArchMate - Diagram Exporter
 * Handles export to various formats (PlantUML, Mermaid, PNG, SVG, HTML)
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { DiagramType, ExportFormat, DiagramOutput, OutputMetadata } from '../types';

/**
 * Export configuration
 */
export interface ExportConfig {
  format: ExportFormat;
  outputPath: string;
  includeMetadata?: boolean;
  plantUMLServer?: string;
  imageWidth?: number;
  imageHeight?: number;
  theme?: 'light' | 'dark';
}

/**
 * Diagram Exporter
 */
export class DiagramExporter {
  private config: ExportConfig;

  constructor(config: Partial<ExportConfig> = {}) {
    this.config = {
      format: config.format || 'plantuml',
      outputPath: config.outputPath || './output',
      includeMetadata: config.includeMetadata ?? true,
      plantUMLServer: config.plantUMLServer || 'https://www.plantuml.com/plantuml',
      imageWidth: config.imageWidth || 1920,
      imageHeight: config.imageHeight || 1080,
      theme: config.theme || 'light',
      ...config,
    };
  }

  /**
   * Export diagram to specified format
   */
  async export(
    content: string,
    diagramType: DiagramType,
    metadata: Partial<OutputMetadata>
  ): Promise<DiagramOutput> {
    const fullMetadata: OutputMetadata = {
      diagramType,
      generatedAt: new Date(),
      entityCount: metadata.entityCount || 0,
      relationshipCount: metadata.relationshipCount || 0,
      fileCount: metadata.fileCount || 0,
      language: metadata.language || 'typescript',
    };

    switch (this.config.format) {
      case 'plantuml':
        return this.exportPlantUML(content, fullMetadata);
      case 'mermaid':
        return this.exportMermaid(content, fullMetadata);
      case 'png':
        return this.exportPNG(content, fullMetadata);
      case 'svg':
        return this.exportSVG(content, fullMetadata);
      case 'html':
        return this.exportHTML(content, fullMetadata);
      case 'json':
        return this.exportJSON(content, fullMetadata);
      default:
        return this.exportPlantUML(content, fullMetadata);
    }
  }

  /**
   * Export to PlantUML format
   */
  private exportPlantUML(content: string, metadata: OutputMetadata): DiagramOutput {
    return {
      format: 'plantuml',
      content,
      metadata,
    };
  }

  /**
   * Export to Mermaid format
   */
  private exportMermaid(content: string, metadata: OutputMetadata): DiagramOutput {
    return {
      format: 'mermaid',
      content,
      metadata,
    };
  }

  /**
   * Export to PNG using PlantUML server
   */
  private async exportPNG(content: string, metadata: OutputMetadata): Promise<DiagramOutput> {
    try {
      // Encode PlantUML for URL
      const encoded = this.encodePlantUML(content);
      const url = `${this.config.plantUMLServer}/png/${encoded}`;

      // For browser/node environments, we'd use puppeteer here
      // For now, return placeholder content
      return {
        format: 'png',
        content: `<!-- PNG Export URL: ${url} -->`,
        metadata,
      };
    } catch (error) {
      console.error('PNG export failed:', error);
      return {
        format: 'png',
        content: content, // Fallback to PlantUML
        metadata,
      };
    }
  }

  /**
   * Export to SVG using PlantUML server
   */
  private async exportSVG(content: string, metadata: OutputMetadata): Promise<DiagramOutput> {
    try {
      const encoded = this.encodePlantUML(content);
      const url = `${this.config.plantUMLServer}/svg/${encoded}`;

      return {
        format: 'svg',
        content: `<!-- SVG Export URL: ${url} -->`,
        metadata,
      };
    } catch (error) {
      console.error('SVG export failed:', error);
      return {
        format: 'svg',
        content: content,
        metadata,
      };
    }
  }

  /**
   * Export to interactive HTML
   */
  private exportHTML(content: string, metadata: OutputMetadata): DiagramOutput {
    const html = this.generateInteractiveHTML(content, metadata);

    return {
      format: 'html',
      content: html,
      metadata,
    };
  }

  /**
   * Export to JSON
   */
  private exportJSON(content: string, metadata: OutputMetadata): DiagramOutput {
    const json = JSON.stringify({
      metadata,
      content: content,
      diagram: content,
    }, null, 2);

    return {
      format: 'json',
      content: json,
      metadata,
    };
  }

  /**
   * Save diagram to file
   */
  async save(output: DiagramOutput, filename?: string): Promise<string> {
    await fs.ensureDir(this.config.outputPath);

    const extension = this.getExtension(output.format);
    const defaultName = `${output.metadata.diagramType}-${Date.now()}`;
    const finalFilename = filename || defaultName;
    const fullPath = path.join(this.config.outputPath, `${finalFilename}${extension}`);

    if (typeof output.content === 'string') {
      await fs.writeFile(fullPath, output.content, 'utf-8');
    } else {
      await fs.writeFile(fullPath, output.content);
    }

    // Save metadata if enabled
    if (this.config.includeMetadata) {
      const metaPath = path.join(this.config.outputPath, `${finalFilename}.meta.json`);
      await fs.writeJSON(metaPath, output.metadata, { spaces: 2 });
    }

    return fullPath;
  }

  /**
   * Generate interactive HTML viewer
   */
  private generateInteractiveHTML(content: string, metadata: OutputMetadata): string {
    const isMermaid = content.includes('```mermaid') || content.includes('%%');
    const diagramContent = isMermaid ? this.extractMermaidContent(content) : content;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ArchMate - ${metadata.diagramType} Diagram</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: ${this.config.theme === 'dark' ? '#1e1e1e' : '#f5f5f5'};
            color: ${this.config.theme === 'dark' ? '#e0e0e0' : '#333'};
            min-height: 100vh;
        }
        
        .header {
            background: ${this.config.theme === 'dark' ? '#2d2d2d' : '#fff'};
            padding: 1rem 2rem;
            border-bottom: 1px solid ${this.config.theme === 'dark' ? '#444' : '#ddd'};
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .header h1 {
            font-size: 1.5rem;
            font-weight: 600;
        }
        
        .controls {
            display: flex;
            gap: 0.5rem;
        }
        
        .btn {
            padding: 0.5rem 1rem;
            border: 1px solid ${this.config.theme === 'dark' ? '#555' : '#ccc'};
            background: ${this.config.theme === 'dark' ? '#3d3d3d' : '#fff'};
            color: inherit;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.875rem;
            transition: all 0.2s;
        }
        
        .btn:hover {
            background: ${this.config.theme === 'dark' ? '#4d4d4d' : '#e0e0e0'};
        }
        
        .btn.active {
            background: #0066cc;
            color: #fff;
            border-color: #0066cc;
        }
        
        .container {
            display: flex;
            height: calc(100vh - 60px);
        }
        
        .sidebar {
            width: 300px;
            background: ${this.config.theme === 'dark' ? '#252525' : '#fff'};
            border-right: 1px solid ${this.config.theme === 'dark' ? '#444' : '#ddd'};
            padding: 1rem;
            overflow-y: auto;
        }
        
        .sidebar h2 {
            font-size: 1rem;
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 1px solid ${this.config.theme === 'dark' ? '#444' : '#ddd'};
        }
        
        .metadata-item {
            display: flex;
            justify-content: space-between;
            padding: 0.5rem 0;
            border-bottom: 1px solid ${this.config.theme === 'dark' ? '#333' : '#f0f0f0'};
        }
        
        .metadata-label {
            color: ${this.config.theme === 'dark' ? '#888' : '#666'};
            font-size: 0.875rem;
        }
        
        .metadata-value {
            font-weight: 500;
        }
        
        .main {
            flex: 1;
            padding: 1rem;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: auto;
        }
        
        .diagram-container {
            background: ${this.config.theme === 'dark' ? '#2d2d2d' : '#fff'};
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            padding: 1rem;
            max-width: 100%;
            max-height: 100%;
        }
        
        .diagram-container svg,
        .diagram-container img {
            max-width: 100%;
            max-height: calc(100vh - 100px);
        }
        
        .zoom-controls {
            position: fixed;
            bottom: 1rem;
            right: 1rem;
            display: flex;
            gap: 0.25rem;
            background: ${this.config.theme === 'dark' ? '#2d2d2d' : '#fff'};
            padding: 0.25rem;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }
        
        .zoom-btn {
            width: 36px;
            height: 36px;
            border: none;
            background: transparent;
            cursor: pointer;
            font-size: 1.25rem;
            border-radius: 4px;
        }
        
        .zoom-btn:hover {
            background: ${this.config.theme === 'dark' ? '#444' : '#e0e0e0'};
        }
        
        #diagram {
            transition: transform 0.2s;
        }
        
        .code-view {
            display: none;
        }
        
        .code-view.active {
            display: block;
        }
        
        pre {
            background: ${this.config.theme === 'dark' ? '#1e1e1e' : '#f8f8f8'};
            padding: 1rem;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 0.875rem;
            line-height: 1.5;
        }
        
        @media (max-width: 768px) {
            .sidebar {
                display: none;
            }
        }
    </style>
    ${isMermaid ? '<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>' : ''}
</head>
<body>
    <div class="header">
        <h1>📊 ${metadata.diagramType}</h1>
        <div class="controls">
            <button class="btn active" onclick="showView('diagram')">Diagram</button>
            <button class="btn" onclick="showView('code')">Code</button>
            <button class="btn" onclick="exportDiagram()">Export</button>
        </div>
    </div>
    
    <div class="container">
        <div class="sidebar">
            <h2>Diagram Information</h2>
            <div class="metadata-item">
                <span class="metadata-label">Type</span>
                <span class="metadata-value">${metadata.diagramType}</span>
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Entities</span>
                <span class="metadata-value">${metadata.entityCount}</span>
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Relationships</span>
                <span class="metadata-value">${metadata.relationshipCount}</span>
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Files</span>
                <span class="metadata-value">${metadata.fileCount}</span>
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Language</span>
                <span class="metadata-value">${metadata.language}</span>
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Generated</span>
                <span class="metadata-value">${metadata.generatedAt.toLocaleString()}</span>
            </div>
        </div>
        
        <div class="main">
            <div class="diagram-container">
                <div id="diagram" class="diagram-view active">
                    ${isMermaid ? '' : `<pre>${this.escapeHtml(content)}</pre>`}
                </div>
                <div id="code" class="code-view">
                    <pre>${this.escapeHtml(content)}</pre>
                </div>
            </div>
        </div>
    </div>
    
    <div class="zoom-controls">
        <button class="zoom-btn" onclick="zoomIn()">+</button>
        <button class="zoom-btn" onclick="zoomOut()">−</button>
        <button class="zoom-btn" onclick="resetZoom()">⟲</button>
    </div>
    
    <script>
        let zoom = 1;
        
        ${isMermaid ? `
        mermaid.initialize({
            startOnLoad: true,
            theme: '${this.config.theme === 'dark' ? 'dark' : 'default'}',
            securityLevel: 'loose'
        });
        ` : ''}
        
        function showView(view) {
            document.querySelectorAll('.controls .btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            document.querySelectorAll('.diagram-view, .code-view').forEach(el => el.classList.remove('active'));
            document.getElementById(view).classList.add('active');
        }
        
        function zoomIn() {
            zoom = Math.min(zoom + 0.1, 3);
            document.getElementById('diagram').style.transform = \`scale(\${zoom})\`;
        }
        
        function zoomOut() {
            zoom = Math.max(zoom - 0.1, 0.3);
            document.getElementById('diagram').style.transform = \`scale(\${zoom})\`;
        }
        
        function resetZoom() {
            zoom = 1;
            document.getElementById('diagram').style.transform = 'scale(1)';
        }
        
        function exportDiagram() {
            const content = \`${this.escapeForJS(content)}\`;
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '${metadata.diagramType}.txt';
            a.click();
            URL.revokeObjectURL(url);
        }
    </script>
</body>
</html>`;
  }

  /**
   * Encode PlantUML for URL
   */
  private encodePlantUML(content: string): string {
    // Use UTF-8 encoding then compress with standard compression
    const encoded = Buffer.from(content)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return encoded;
  }

  /**
   * Extract mermaid content from markdown
   */
  private extractMermaidContent(content: string): string {
    const match = content.match(/```mermaid\n([\s\S]*?)```/);
    return match ? match[1].trim() : content;
  }

  /**
   * Get file extension for format
   */
  private getExtension(format: ExportFormat): string {
    const extensions: Record<ExportFormat, string> = {
      'plantuml': '.puml',
      'mermaid': '.mmd',
      'png': '.png',
      'svg': '.svg',
      'html': '.html',
      'json': '.json',
    };
    return extensions[format];
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Escape for JavaScript string
   */
  private escapeForJS(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$')
      .replace(/\\/g, '\\\\');
  }
}

export default DiagramExporter;
