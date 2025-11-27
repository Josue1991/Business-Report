import { IReportRepository } from '@domain/repositories/IReportRepository';
import { AIInsight, KPISuggestion, DataQualityMetrics } from '@domain/entities/Report';
import { AnalyzeDataDTO } from '../dtos/ReportDTO';

export interface AnalysisResult {
  reportId: string;
  insights: AIInsight[];
  suggestedKPIs: KPISuggestion[];
  dataQuality: DataQualityMetrics;
  processingTime: number;
}

export interface IMLService {
  analyzeData(data: any[], options: AnalyzeDataDTO): Promise<AnalysisResult>;
}

export class AnalyzeDataUseCase {
  constructor(
    private readonly reportRepository: IReportRepository,
    private readonly mlService: IMLService
  ) {}

  async execute(dto: AnalyzeDataDTO): Promise<AnalysisResult> {
    const startTime = Date.now();

    // Buscar reporte
    const report = await this.reportRepository.findById(dto.reportId);
    
    if (!report) {
      throw new Error('Reporte no encontrado');
    }

    // Validar que el análisis de IA está habilitado
    if (!report.aiAnalysisEnabled) {
      throw new Error('El análisis de IA no está habilitado para este reporte');
    }

    // Actualizar estado del reporte
    report.markAsAnalyzing();
    await this.reportRepository.update(report);

    try {
      // Ejecutar análisis ML
      const result = await this.mlService.analyzeData(dto.data, dto);

      // Actualizar reporte con insights
      result.insights.forEach(insight => report.addAIInsight(insight));
      
      if (result.suggestedKPIs.length > 0) {
        report.addKPISuggestions(result.suggestedKPIs);
      }
      
      if (result.dataQuality) {
        report.setDataQuality(result.dataQuality);
      }

      await this.reportRepository.update(report);

      const processingTime = Date.now() - startTime;

      return {
        ...result,
        processingTime
      };
    } catch (error: any) {
      report.markAsFailed(`Error en análisis de IA: ${error.message}`);
      await this.reportRepository.update(report);
      throw error;
    }
  }
}
