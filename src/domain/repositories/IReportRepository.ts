import { Report, ReportStatus, ReportType, ReportFormat } from '../entities/Report';

export interface ReportFilters {
  userId?: string;
  type?: ReportType;
  status?: ReportStatus;
  format?: ReportFormat;
  startDate?: Date;
  endDate?: Date;
}

export interface IReportRepository {
  save(report: Report): Promise<void>;
  findById(id: string): Promise<Report | null>;
  findByUserId(userId: string, filters?: ReportFilters): Promise<Report[]>;
  update(report: Report): Promise<void>;
  delete(id: string): Promise<void>;
  deleteExpired(): Promise<number>;
  findPendingReports(): Promise<Report[]>;
  countByUser(userId: string): Promise<number>;
  getStorageUsage(userId: string): Promise<number>;
}
