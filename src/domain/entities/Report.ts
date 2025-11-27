export enum ReportFormat {
  PDF = 'PDF',
  EXCEL = 'EXCEL',
  CSV = 'CSV',
  HTML = 'HTML',
  JSON = 'JSON'
}

export enum ReportStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export enum ReportType {
  SALES = 'SALES',
  INVENTORY = 'INVENTORY',
  FINANCIAL = 'FINANCIAL',
  USERS = 'USERS',
  LOGS = 'LOGS',
  ANALYTICS = 'ANALYTICS',
  PREDICTIVE = 'PREDICTIVE',
  CUSTOM = 'CUSTOM'
}

export interface AIInsight {
  type: 'anomaly' | 'trend' | 'suggestion' | 'forecast' | 'correlation';
  title: string;
  description: string;
  confidence: number;
  data?: any;
  actionable: boolean;
  timestamp: Date;
}

export interface KPISuggestion {
  name: string;
  description: string;
  formula: string;
  importance: 'high' | 'medium' | 'low';
  category: string;
  visualizationType: 'line' | 'bar' | 'gauge' | 'number' | 'trend';
  currentValue?: number;
  targetValue?: number;
}

export interface DataQualityMetrics {
  completeness: number;
  accuracy: number;
  consistency: number;
  outliers: number;
  missingValues: number;
  duplicates: number;
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'heatmap' | 'scatter' | 'bubble';
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    trendline?: boolean;
    forecast?: number[];
    anomalies?: number[];
  }[];
  options?: {
    responsive?: boolean;
    maintainAspectRatio?: boolean;
    plugins?: any;
  };
}

export interface ReportMetadata {
  title: string;
  description?: string;
  author?: string;
  company?: string;
  logo?: string;
  filters?: Record<string, any>;
  columns?: string[];
  chartConfig?: ChartConfig;
  aiInsights?: AIInsight[];
  suggestedKPIs?: KPISuggestion[];
  dataQuality?: DataQualityMetrics;
  dataSource?: string;
  recordCount?: number;
}

export class Report {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly type: ReportType,
    public readonly format: ReportFormat,
    public readonly metadata: ReportMetadata,
    public status: ReportStatus = ReportStatus.PENDING,
    public filePath?: string,
    public fileSize?: number,
    public downloadUrl?: string,
    public error?: string,
    public readonly createdAt: Date = new Date(),
    public completedAt?: Date,
    public expiresAt?: Date,
    public emailTo?: string,
    public downloadCount: number = 0,
    public aiAnalysisEnabled: boolean = true,
    public processingTime?: number
  ) {}

  markAsProcessing(): void {
    this.status = ReportStatus.PROCESSING;
  }

  markAsAnalyzing(): void {
    this.status = ReportStatus.ANALYZING;
  }

  markAsCompleted(filePath: string, fileSize: number, downloadUrl: string): void {
    this.status = ReportStatus.COMPLETED;
    this.filePath = filePath;
    this.fileSize = fileSize;
    this.downloadUrl = downloadUrl;
    this.completedAt = new Date();
    this.processingTime = this.completedAt.getTime() - this.createdAt.getTime();
    this.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  markAsFailed(error: string): void {
    this.status = ReportStatus.FAILED;
    this.error = error;
    this.completedAt = new Date();
  }

  addAIInsight(insight: AIInsight): void {
    if (!this.metadata.aiInsights) {
      this.metadata.aiInsights = [];
    }
    this.metadata.aiInsights.push(insight);
  }

  addKPISuggestions(kpis: KPISuggestion[]): void {
    this.metadata.suggestedKPIs = kpis;
  }

  setDataQuality(quality: DataQualityMetrics): void {
    this.metadata.dataQuality = quality;
  }

  incrementDownloadCount(): void {
    this.downloadCount++;
  }

  isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }

  canBeDownloaded(): boolean {
    return this.status === ReportStatus.COMPLETED && !this.isExpired();
  }

  getFileName(): string {
    const timestamp = this.createdAt.getTime();
    const extension = this.format.toLowerCase();
    return `${this.type.toLowerCase()}_${timestamp}.${extension}`;
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      type: this.type,
      format: this.format,
      metadata: this.metadata,
      status: this.status,
      filePath: this.filePath,
      fileSize: this.fileSize,
      downloadUrl: this.downloadUrl,
      error: this.error,
      createdAt: this.createdAt,
      completedAt: this.completedAt,
      expiresAt: this.expiresAt,
      emailTo: this.emailTo,
      downloadCount: this.downloadCount,
      aiAnalysisEnabled: this.aiAnalysisEnabled,
      processingTime: this.processingTime
    };
  }
}
