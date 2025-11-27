import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { MongoReportRepository } from '@infrastructure/database/MongoReportRepository';
import { AnomalyDetectionService } from '@infrastructure/ml/AnomalyDetectionService';
import { ForecastingService } from '@infrastructure/ml/ForecastingService';
import { KPISuggestionService } from '@infrastructure/ml/KPISuggestionService';
import { DataQualityAnalyzer } from '@infrastructure/ml/DataQualityAnalyzer';
import { AIInsight, KPISuggestion } from '@domain/entities/Report';

export interface MLJobData {
  reportId: string;
  data: any[];
  enableAnomalyDetection?: boolean;
  enableForecasting?: boolean;
  enableKPISuggestions?: boolean;
}

export class MLAnalysisWorker {
  private worker: Worker;
  private repository: MongoReportRepository;
  private anomalyService: AnomalyDetectionService;
  private forecastingService: ForecastingService;
  private kpiService: KPISuggestionService;
  private qualityAnalyzer: DataQualityAnalyzer;

  constructor() {
    const connection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null
    });

    this.repository = new MongoReportRepository();
    this.anomalyService = new AnomalyDetectionService();
    this.forecastingService = new ForecastingService();
    this.kpiService = new KPISuggestionService();
    this.qualityAnalyzer = new DataQualityAnalyzer();

    this.worker = new Worker(
      process.env.QUEUE_ML_NAME || 'ml-analysis',
      async (job: Job<MLJobData>) => this.processAnalysis(job),
      {
        connection,
        concurrency: parseInt(process.env.QUEUE_ML_CONCURRENCY || '2'), // Menos concurrencia (ML intensivo)
        limiter: {
          max: 5,
          duration: 1000
        }
      }
    );

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.worker.on('completed', (job: Job) => {
      console.log(`✓ ML Job ${job.id} completado`);
    });

    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      console.error(`✗ ML Job ${job?.id} falló:`, error.message);
    });

    this.worker.on('progress', (job: Job, progress: number | object) => {
      console.log(`ML Job ${job.id}: ${JSON.stringify(progress)}`);
    });
  }

  async start(): Promise<void> {
    await this.repository.connect();
    console.log('✓ MLAnalysisWorker iniciado');
  }

  async stop(): Promise<void> {
    await this.worker.close();
    await this.repository.disconnect();
    console.log('✓ MLAnalysisWorker detenido');
  }

  private async processAnalysis(job: Job<MLJobData>): Promise<void> {
    const { reportId, data, enableAnomalyDetection, enableForecasting, enableKPISuggestions } = job.data;

    // Buscar reporte
    const report = await this.repository.findById(reportId);
    
    if (!report) {
      throw new Error(`Reporte ${reportId} no encontrado`);
    }

    try {
      report.markAsAnalyzing();
      await this.repository.update(report);

      const insights: AIInsight[] = [];

      // 1. Análisis de calidad de datos (siempre)
      await job.updateProgress({ status: 'quality_analysis', progress: 10 });
      const dataQuality = this.qualityAnalyzer.analyze(data);
      report.setDataQuality(dataQuality);

      // Insight sobre calidad
      if (dataQuality.completeness < 90) {
        insights.push({
          type: 'suggestion',
          title: 'Calidad de Datos Baja',
          description: `Solo ${dataQuality.completeness.toFixed(1)}% de los datos están completos. Considera limpiar los datos antes de generar análisis.`,
          confidence: 0.95,
          actionable: true,
          timestamp: new Date()
        });
      }

      // 2. Detección de anomalías
      if (enableAnomalyDetection) {
        await job.updateProgress({ status: 'anomaly_detection', progress: 30 });
        const numericFields = this.extractNumericFields(data);

        for (const field of numericFields) {
          const values = data.map(d => d[field]).filter(v => typeof v === 'number');
          
          if (values.length > 10) {
            const result = await this.anomalyService.detectAnomalies(values, 2.5, 'zscore');
            
            if (result.anomalyCount > 0) {
              insights.push({
                type: 'anomaly',
                title: `Anomalías Detectadas en ${field}`,
                description: `Se detectaron ${result.anomalyCount} valores atípicos (${result.anomalyPercentage.toFixed(1)}% del total) en el campo ${field}`,
                confidence: 0.85,
                data: {
                  field,
                  anomalies: result.anomalies.filter(a => a.isAnomaly).slice(0, 5)
                },
                actionable: true,
                timestamp: new Date()
              });
            }
          }
        }
      }

      // 3. Forecasting (pronósticos)
      if (enableForecasting) {
        await job.updateProgress({ status: 'forecasting', progress: 50 });
        const numericFields = this.extractNumericFields(data);

        for (const field of numericFields) {
          const values = data.map(d => d[field]).filter(v => typeof v === 'number');
          
          if (values.length >= 5) {
            const forecast = await this.forecastingService.forecast(values, 3, 0.95);
            
            insights.push({
              type: 'forecast',
              title: `Pronóstico para ${field}`,
              description: `Basado en tendencia ${forecast.trend === 'upward' ? 'creciente' : forecast.trend === 'downward' ? 'decreciente' : 'estable'}, se proyectan los siguientes valores`,
              confidence: forecast.confidence,
              data: {
                field,
                forecasts: forecast.forecasts,
                trend: forecast.trend,
                method: forecast.method
              },
              actionable: true,
              timestamp: new Date()
            });
          }
        }
      }

      // 4. Sugerencias de KPIs
      if (enableKPISuggestions) {
        await job.updateProgress({ status: 'kpi_suggestions', progress: 70 });
        
        try {
          const kpis = await this.kpiService.suggestKPIs({
            dataSource: report.metadata.dataSource || 'unknown',
            businessContext: report.metadata.description,
            maxSuggestions: 3
          });

          if (kpis.length > 0) {
            report.addKPISuggestions(kpis);

            insights.push({
              type: 'suggestion',
              title: 'KPIs Sugeridos',
              description: `Se sugieren ${kpis.length} indicadores clave de performance relevantes para tus datos`,
              confidence: 0.80,
              data: { kpis },
              actionable: true,
              timestamp: new Date()
            });
          }
        } catch (error: any) {
          console.error('Error generando sugerencias de KPIs:', error.message);
        }
      }

      // 5. Análisis de correlaciones
      await job.updateProgress({ status: 'correlation_analysis', progress: 85 });
      const correlations = this.findCorrelations(data);
      
      correlations.forEach(corr => {
        insights.push({
          type: 'correlation',
          title: `Correlación: ${corr.field1} ↔ ${corr.field2}`,
          description: `Existe una correlación ${corr.strength} (${(corr.coefficient * 100).toFixed(1)}%) entre ${corr.field1} y ${corr.field2}`,
          confidence: Math.abs(corr.coefficient),
          data: corr,
          actionable: true,
          timestamp: new Date()
        });
      });

      // Agregar insights al reporte
      insights.forEach(insight => report.addAIInsight(insight));

      await job.updateProgress({ status: 'saving', progress: 95 });
      await this.repository.update(report);

      await job.updateProgress({ status: 'completed', progress: 100 });

    } catch (error: any) {
      console.error('Error en análisis ML:', error);
      // No fallar el reporte por error en ML
      await this.repository.update(report);
    }
  }

  private extractNumericFields(data: any[]): string[] {
    if (data.length === 0) return [];

    const firstRow = data[0];
    const numericFields: string[] = [];

    for (const key in firstRow) {
      const values = data.map(d => d[key]);
      const numericValues = values.filter(v => typeof v === 'number' && !Number.isNaN(v));
      
      // Si >50% de los valores son numéricos, considerarlo campo numérico
      if (numericValues.length > data.length * 0.5) {
        numericFields.push(key);
      }
    }

    return numericFields;
  }

  private findCorrelations(data: any[]): Array<{
    field1: string;
    field2: string;
    coefficient: number;
    strength: string;
  }> {
    const numericFields = this.extractNumericFields(data);
    const correlations: Array<any> = [];

    // Calcular correlaciones entre pares de campos
    for (let i = 0; i < numericFields.length; i++) {
      for (let j = i + 1; j < numericFields.length; j++) {
        const field1 = numericFields[i];
        const field2 = numericFields[j];

        const values1 = data.map(d => d[field1]).filter(v => typeof v === 'number');
        const values2 = data.map(d => d[field2]).filter(v => typeof v === 'number');

        if (values1.length > 3 && values2.length > 3) {
          const coef = this.calculateCorrelation(values1, values2);
          
          if (Math.abs(coef) > 0.5) { // Solo correlaciones significativas
            correlations.push({
              field1,
              field2,
              coefficient: coef,
              strength: Math.abs(coef) > 0.8 ? 'fuerte' : Math.abs(coef) > 0.6 ? 'moderada' : 'débil'
            });
          }
        }
      }
    }

    return correlations.slice(0, 3); // Top 3 correlaciones
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    return numerator / Math.sqrt(denomX * denomY);
  }
}

// Entry point para el worker
if (require.main === module) {
  const worker = new MLAnalysisWorker();
  
  worker.start().then(() => {
    console.log('MLAnalysisWorker running...');
  }).catch(error => {
    console.error('Failed to start MLAnalysisWorker:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down...');
    await worker.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down...');
    await worker.stop();
    process.exit(0);
  });
}
