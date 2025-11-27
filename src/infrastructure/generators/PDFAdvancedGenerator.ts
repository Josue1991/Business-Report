import puppeteer, { Browser, Page } from 'puppeteer';
import { ChartConfiguration } from 'chart.js';
import fs from 'fs';
import Handlebars from 'handlebars';
import path from 'path';

export interface PDFAdvancedGeneratorOptions {
  title: string;
  subtitle?: string;
  author?: string;
  company?: string;
  logo?: string;
  data: any[];
  columns?: string[];
  chartConfigs?: ChartConfiguration[];
  template?: string;
  templateData?: Record<string, any>;
  customCSS?: string;
}

export class PDFAdvancedGenerator {
  private browser: Browser | null = null;

  async initialize(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async generate(options: PDFAdvancedGeneratorOptions, outputPath: string): Promise<void> {
    if (!this.browser) {
      await this.initialize();
    }

    const page = await this.browser!.newPage();
    
    try {
      const html = options.template
        ? this.renderTemplate(options.template, options.templateData || {})
        : this.generateDefaultHTML(options);

      await page.setContent(html, { waitUntil: 'networkidle0' });

      // Generar gráficos si existen
      if (options.chartConfigs && options.chartConfigs.length > 0) {
        await this.renderCharts(page, options.chartConfigs);
      }

      await page.pdf({
        path: outputPath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        displayHeaderFooter: true,
        headerTemplate: this.getHeaderTemplate(options),
        footerTemplate: this.getFooterTemplate(options)
      });
    } finally {
      await page.close();
    }
  }

  private generateDefaultHTML(options: PDFAdvancedGeneratorOptions): string {
    const columns = options.columns || (options.data[0] ? Object.keys(options.data[0]) : []);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      padding: 20px;
      color: #333;
    }

    .header {
      background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
      color: white;
      padding: 30px;
      border-radius: 10px;
      margin-bottom: 30px;
      text-align: center;
    }

    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
    }

    .header p {
      font-size: 14px;
      opacity: 0.9;
    }

    .metadata {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 8px;
      font-size: 12px;
      color: #6c757d;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    thead {
      background: #007bff;
      color: white;
    }

    th {
      padding: 12px;
      text-align: left;
      font-weight: 600;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    td {
      padding: 10px 12px;
      border-bottom: 1px solid #dee2e6;
      font-size: 12px;
    }

    tbody tr:nth-child(even) {
      background-color: #f8f9fa;
    }

    tbody tr:hover {
      background-color: #e9ecef;
    }

    .chart-container {
      margin: 30px 0;
      page-break-inside: avoid;
    }

    .chart-container h2 {
      margin-bottom: 15px;
      color: #007bff;
    }

    .chart-canvas {
      max-width: 100%;
      height: auto;
    }

    ${options.customCSS || ''}
  </style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head>
<body>
  <div class="header">
    ${options.logo ? `<img src="${options.logo}" style="height: 50px; margin-bottom: 15px;">` : ''}
    <h1>${options.title}</h1>
    ${options.subtitle ? `<p>${options.subtitle}</p>` : ''}
  </div>

  <div class="metadata">
    <div>
      <strong>Fecha:</strong> ${new Date().toLocaleString('es-ES')}
    </div>
    ${options.company ? `<div><strong>Empresa:</strong> ${options.company}</div>` : ''}
    ${options.author ? `<div><strong>Autor:</strong> ${options.author}</div>` : ''}
    <div>
      <strong>Registros:</strong> ${options.data.length.toLocaleString('es-ES')}
    </div>
  </div>

  ${options.chartConfigs && options.chartConfigs.length > 0 ? this.generateChartsHTML(options.chartConfigs) : ''}

  <table>
    <thead>
      <tr>
        ${columns.map(col => `<th>${this.formatHeader(col)}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${options.data.map(row => `
        <tr>
          ${columns.map(col => `<td>${this.formatCell(row[col])}</td>`).join('')}
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>
    `;
  }

  private generateChartsHTML(chartConfigs: ChartConfiguration[]): string {
    return chartConfigs.map((config, index) => `
      <div class="chart-container">
        <h2>Gráfico ${index + 1}</h2>
        <canvas id="chart-${index}" class="chart-canvas"></canvas>
      </div>
    `).join('');
  }

  private async renderCharts(page: Page, chartConfigs: ChartConfiguration[]): Promise<void> {
    for (let i = 0; i < chartConfigs.length; i++) {
      await page.evaluate((config: ChartConfiguration, chartId: string) => {
        const canvas = document.getElementById(chartId) as HTMLCanvasElement;
        if (canvas) {
          // @ts-ignore
          new Chart(canvas, config);
        }
      }, chartConfigs[i], `chart-${i}`);
    }

    // Esperar a que los gráficos se rendericen
    await page.waitForTimeout(1000);
  }

  private renderTemplate(templatePath: string, data: Record<string, any>): string {
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateContent);
    return template(data);
  }

  private getHeaderTemplate(options: PDFAdvancedGeneratorOptions): string {
    return `
      <div style="font-size: 10px; color: #6c757d; margin: 0 15mm; width: 100%; text-align: center;">
        ${options.company || 'BusinessApp'}
      </div>
    `;
  }

  private getFooterTemplate(options: PDFAdvancedGeneratorOptions): string {
    return `
      <div style="font-size: 9px; color: #6c757d; margin: 0 15mm; width: 100%; display: flex; justify-content: space-between;">
        <span>${options.title}</span>
        <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
      </div>
    `;
  }

  private formatHeader(columnName: string): string {
    return columnName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }

  private formatCell(value: any): string {
    if (value === null || value === undefined) {
      return '-';
    }

    if (typeof value === 'number') {
      return value.toLocaleString('es-ES', {
        minimumFractionDigits: value % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2
      });
    }

    if (value instanceof Date) {
      return value.toLocaleDateString('es-ES');
    }

    return String(value);
  }
}
