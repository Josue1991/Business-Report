import { ReportType, ReportFormat, ChartConfig } from '@domain/entities/Report';

export interface CreateReportDTO {
  userId: string;
  type: ReportType;
  format: ReportFormat;
  title: string;
  description?: string;
  filters?: Record<string, any>;
  columns?: string[];
  chartConfig?: ChartConfig;
  emailTo?: string;
  aiAnalysisEnabled?: boolean;
  dataSource?: string;
}

export interface GenerateReportDTO extends CreateReportDTO {
  data: any[];
}

export interface AnalyzeDataDTO {
  reportId: string;
  data: any[];
  enableAnomalyDetection?: boolean;
  enableForecasting?: boolean;
  enableKPISuggestions?: boolean;
}

export interface NLQueryDTO {
  userId: string;
  query: string;
  dataSource: string;
  context?: Record<string, any>;
}

export interface ReportResponseDTO {
  id: string;
  userId: string;
  type: ReportType;
  format: ReportFormat;
  status: string;
  metadata: {
    title: string;
    description?: string;
    recordCount?: number;
    dataQuality?: any;
    aiInsights?: any[];
    suggestedKPIs?: any[];
  };
  downloadUrl?: string;
  fileSize?: number;
  createdAt: Date;
  completedAt?: Date;
  expiresAt?: Date;
  downloadCount: number;
  processingTime?: number;
  error?: string;
}

export interface DownloadReportDTO {
  reportId: string;
  userId: string;
}

export interface EmailReportDTO {
  reportId: string;
  userId: string;
  emailTo: string;
  subject?: string;
  message?: string;
}

export interface ForecastDTO {
  data: number[];
  periods: number;
  confidence?: number;
}

export interface AnomalyDTO {
  data: number[];
  threshold?: number;
  method?: 'zscore' | 'iqr' | 'isolation_forest';
}

export interface KPISuggestionRequestDTO {
  dataSource: string;
  businessContext?: string;
  existingKPIs?: string[];
  maxSuggestions?: number;
}
