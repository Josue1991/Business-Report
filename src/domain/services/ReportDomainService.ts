import { Report, ReportFormat, AIInsight, KPISuggestion } from '../entities/Report';

export class ReportDomainService {
  validateReport(report: Report): void {
    if (!report.userId || report.userId.trim().length === 0) {
      throw new Error('User ID is required');
    }

    if (!report.metadata.title || report.metadata.title.trim().length === 0) {
      throw new Error('Report title is required');
    }

    if (report.metadata.title.length > 200) {
      throw new Error('Report title must be less than 200 characters');
    }

    if (!Object.values(ReportFormat).includes(report.format)) {
      throw new Error(`Invalid report format: ${report.format}`);
    }
  }

  getMaxRows(format: ReportFormat): number {
    const limits = {
      [ReportFormat.EXCEL]: parseInt(process.env.MAX_ROWS_EXCEL || '100000'),
      [ReportFormat.CSV]: parseInt(process.env.MAX_ROWS_CSV || '1000000'),
      [ReportFormat.PDF]: 10000,
      [ReportFormat.HTML]: 50000,
      [ReportFormat.JSON]: 1000000
    };
    return limits[format];
  }

  getFileExtension(format: ReportFormat): string {
    const extensions = {
      [ReportFormat.PDF]: 'pdf',
      [ReportFormat.EXCEL]: 'xlsx',
      [ReportFormat.CSV]: 'csv',
      [ReportFormat.HTML]: 'html',
      [ReportFormat.JSON]: 'json'
    };
    return extensions[format];
  }

  getMimeType(format: ReportFormat): string {
    const mimeTypes = {
      [ReportFormat.PDF]: 'application/pdf',
      [ReportFormat.EXCEL]: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      [ReportFormat.CSV]: 'text/csv',
      [ReportFormat.HTML]: 'text/html',
      [ReportFormat.JSON]: 'application/json'
    };
    return mimeTypes[format];
  }

  calculateEstimatedSize(rowCount: number, columnCount: number, format: ReportFormat): number {
    const baseSize = {
      [ReportFormat.EXCEL]: 50000,
      [ReportFormat.CSV]: 1000,
      [ReportFormat.PDF]: 100000,
      [ReportFormat.HTML]: 5000,
      [ReportFormat.JSON]: 2000
    };

    const bytesPerCell = {
      [ReportFormat.EXCEL]: 50,
      [ReportFormat.CSV]: 20,
      [ReportFormat.PDF]: 100,
      [ReportFormat.HTML]: 30,
      [ReportFormat.JSON]: 40
    };

    return baseSize[format] + (rowCount * columnCount * bytesPerCell[format]);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  prioritizeInsights(insights: AIInsight[]): AIInsight[] {
    return insights.sort((a, b) => {
      // Priorizar por tipo
      const typeOrder = { anomaly: 0, forecast: 1, correlation: 2, trend: 3, suggestion: 4 };
      const typeDiff = typeOrder[a.type] - typeOrder[b.type];
      if (typeDiff !== 0) return typeDiff;

      // Luego por confianza
      return b.confidence - a.confidence;
    });
  }

  filterLowConfidenceInsights(insights: AIInsight[], threshold: number = 0.6): AIInsight[] {
    return insights.filter(insight => insight.confidence >= threshold);
  }

  categorizeKPIs(kpis: KPISuggestion[]): Record<string, KPISuggestion[]> {
    return kpis.reduce((acc, kpi) => {
      if (!acc[kpi.category]) {
        acc[kpi.category] = [];
      }
      acc[kpi.category].push(kpi);
      return acc;
    }, {} as Record<string, KPISuggestion[]>);
  }

  shouldEnableMLAnalysis(rowCount: number): boolean {
    const minDataPoints = parseInt(process.env.ML_MIN_DATA_POINTS || '100');
    return rowCount >= minDataPoints;
  }

  generateReportSummary(report: Report): string {
    let summary = `Reporte: ${report.metadata.title}\n`;
    summary += `Tipo: ${report.type}, Formato: ${report.format}\n`;
    
    if (report.metadata.recordCount) {
      summary += `Registros: ${report.metadata.recordCount.toLocaleString()}\n`;
    }
    
    if (report.metadata.aiInsights && report.metadata.aiInsights.length > 0) {
      summary += `\nInsights de IA (${report.metadata.aiInsights.length}):\n`;
      report.metadata.aiInsights.slice(0, 3).forEach(insight => {
        summary += `- ${insight.title} (Confianza: ${(insight.confidence * 100).toFixed(1)}%)\n`;
      });
    }
    
    if (report.metadata.suggestedKPIs && report.metadata.suggestedKPIs.length > 0) {
      summary += `\nKPIs Sugeridos (${report.metadata.suggestedKPIs.length}):\n`;
      report.metadata.suggestedKPIs.slice(0, 3).forEach(kpi => {
        summary += `- ${kpi.name} (${kpi.importance})\n`;
      });
    }
    
    return summary;
  }
}
