import { IReportRepository, ReportFilters } from '@domain/repositories/IReportRepository';
import { ReportResponseDTO } from '../dtos/ReportDTO';

export class GetUserReportsUseCase {
  constructor(private readonly reportRepository: IReportRepository) {}

  async execute(userId: string, filters?: ReportFilters): Promise<ReportResponseDTO[]> {
    const reports = await this.reportRepository.findByUserId(userId, filters);
    
    return reports.map(report => ({
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
    }));
  }
}
