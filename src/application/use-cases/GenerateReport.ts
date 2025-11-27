import { v4 as uuidv4 } from 'uuid';
import { Report, ReportStatus } from '@domain/entities/Report';
import { IReportRepository } from '@domain/repositories/IReportRepository';
import { ReportDomainService } from '@domain/services/ReportDomainService';
import { GenerateReportDTO, ReportResponseDTO } from '../dtos/ReportDTO';
import { Queue } from 'bullmq';

export class GenerateReportUseCase {
  constructor(
    private readonly reportRepository: IReportRepository,
    private readonly reportService: ReportDomainService,
    private readonly reportQueue: Queue,
    private readonly mlQueue: Queue
  ) {}

  async execute(dto: GenerateReportDTO): Promise<ReportResponseDTO> {
    // Validar tamaño de datos
    const maxRows = this.reportService.getMaxRows(dto.format);
    if (dto.data.length > maxRows) {
      throw new Error(
        `El número de registros (${dto.data.length}) excede el límite para formato ${dto.format} (${maxRows})`
      );
    }

    // Crear entidad Report
    const report = new Report(
      uuidv4(),
      dto.userId,
      dto.type,
      dto.format,
      {
        title: dto.title,
        description: dto.description,
        filters: dto.filters,
        columns: dto.columns,
        chartConfig: dto.chartConfig,
        recordCount: dto.data.length,
        dataSource: dto.dataSource
      },
      ReportStatus.PENDING,
      undefined,
      undefined,
      undefined,
      undefined,
      new Date(),
      undefined,
      undefined,
      dto.emailTo,
      0,
      dto.aiAnalysisEnabled ?? true
    );

    // Validar
    this.reportService.validateReport(report);

    // Guardar en repositorio
    await this.reportRepository.save(report);

    // Encolar trabajo de generación de reporte
    await this.reportQueue.add(
      'generate-report',
      {
        reportId: report.id,
        data: dto.data,
        userId: dto.userId,
        format: dto.format,
        metadata: report.metadata,
        emailTo: dto.emailTo
      },
      {
        jobId: report.id,
        attempts: parseInt(process.env.QUEUE_MAX_RETRIES || '3'),
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      }
    );

    // Si AI está habilitado y hay suficientes datos, encolar análisis ML
    if (report.aiAnalysisEnabled && this.reportService.shouldEnableMLAnalysis(dto.data.length)) {
      await this.mlQueue.add(
        'analyze-data',
        {
          reportId: report.id,
          data: dto.data,
          enableAnomalyDetection: process.env.ENABLE_ANOMALY_DETECTION === 'true',
          enableForecasting: process.env.ENABLE_FORECASTING === 'true',
          enableKPISuggestions: process.env.ENABLE_KPI_SUGGESTIONS === 'true'
        },
        {
          jobId: `ml-${report.id}`,
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 10000
          }
        }
      );
    }

    return this.toDTO(report);
  }

  private toDTO(report: Report): ReportResponseDTO {
    return {
      id: report.id,
      userId: report.userId,
      type: report.type,
      format: report.format,
      status: report.status,
      metadata: {
        title: report.metadata.title,
        description: report.metadata.description,
        recordCount: report.metadata.recordCount,
        dataQuality: report.metadata.dataQuality,
        aiInsights: report.metadata.aiInsights,
        suggestedKPIs: report.metadata.suggestedKPIs
      },
      downloadUrl: report.downloadUrl,
      fileSize: report.fileSize,
      createdAt: report.createdAt,
      completedAt: report.completedAt,
      expiresAt: report.expiresAt,
      downloadCount: report.downloadCount,
      processingTime: report.processingTime,
      error: report.error
    };
  }
}
