import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { Report, ReportFormat } from '@domain/entities/Report';
import { MongoReportRepository } from '@infrastructure/database/MongoReportRepository';
import { ExcelGenerator } from '@infrastructure/generators/ExcelGenerator';
import { PDFGenerator } from '@infrastructure/generators/PDFGenerator';
import { PDFAdvancedGenerator } from '@infrastructure/generators/PDFAdvancedGenerator';
import { CSVGenerator } from '@infrastructure/generators/CSVGenerator';
import path from 'path';
import fs from 'fs';

export interface ReportJobData {
  reportId: string;
  data: any[];
  userId: string;
  format: ReportFormat;
  metadata: any;
  emailTo?: string;
}

export class ReportWorker {
  private worker: Worker;
  private repository: MongoReportRepository;
  private excelGenerator: ExcelGenerator;
  private pdfGenerator: PDFGenerator;
  private pdfAdvancedGenerator: PDFAdvancedGenerator;
  private csvGenerator: CSVGenerator;
  private storagePath: string;

  constructor() {
    const connection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null
    });

    this.repository = new MongoReportRepository();
    this.excelGenerator = new ExcelGenerator();
    this.pdfGenerator = new PDFGenerator();
    this.pdfAdvancedGenerator = new PDFAdvancedGenerator();
    this.csvGenerator = new CSVGenerator();
    this.storagePath = process.env.STORAGE_PATH || './storage/reports';

    // Crear directorio de almacenamiento
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }

    this.worker = new Worker(
      process.env.QUEUE_REPORT_NAME || 'reports',
      async (job: Job<ReportJobData>) => this.processReport(job),
      {
        connection,
        concurrency: parseInt(process.env.QUEUE_REPORT_CONCURRENCY || '5'),
        limiter: {
          max: 10,
          duration: 1000
        }
      }
    );

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.worker.on('completed', (job: Job) => {
      console.log(`✓ Job ${job.id} completado`);
    });

    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      console.error(`✗ Job ${job?.id} falló:`, error.message);
    });

    this.worker.on('progress', (job: Job, progress: number | object) => {
      console.log(`Job ${job.id}: ${JSON.stringify(progress)}`);
    });

    this.worker.on('error', (error: Error) => {
      console.error('Worker error:', error);
    });
  }

  async start(): Promise<void> {
    await this.repository.connect();
    await this.pdfAdvancedGenerator.initialize();
    console.log('✓ ReportWorker iniciado');
  }

  async stop(): Promise<void> {
    await this.worker.close();
    await this.pdfAdvancedGenerator.close();
    await this.repository.disconnect();
    console.log('✓ ReportWorker detenido');
  }

  private async processReport(job: Job<ReportJobData>): Promise<void> {
    const { reportId, data, format, metadata, emailTo } = job.data;

    // Buscar reporte
    const report = await this.repository.findById(reportId);
    
    if (!report) {
      throw new Error(`Reporte ${reportId} no encontrado`);
    }

    try {
      // Actualizar estado
      report.markAsProcessing();
      await this.repository.update(report);
      await job.updateProgress({ status: 'processing', progress: 10 });

      // Generar archivo
      const fileName = `${reportId}.${this.getFileExtension(format)}`;
      const filePath = path.join(this.storagePath, fileName);

      await job.updateProgress({ status: 'generating', progress: 30 });

      switch (format) {
        case ReportFormat.EXCEL:
          await this.generateExcel(data, metadata, filePath);
          break;
        case ReportFormat.PDF:
          await this.generatePDF(data, metadata, filePath);
          break;
        case ReportFormat.CSV:
          await this.generateCSV(data, metadata, filePath);
          break;
        case ReportFormat.HTML:
        case ReportFormat.JSON:
          await this.generateJSON(data, filePath);
          break;
        default:
          throw new Error(`Formato no soportado: ${format}`);
      }

      await job.updateProgress({ status: 'uploading', progress: 80 });

      // Obtener tamaño del archivo
      const fileSize = fs.statSync(filePath).size;

      // Generar URL de descarga
      const downloadUrl = `${process.env.API_BASE_URL || 'http://localhost:3008'}/api/reports/${reportId}/download`;

      // Marcar como completado
      report.markAsCompleted(filePath, fileSize, downloadUrl);
      await this.repository.update(report);

      await job.updateProgress({ status: 'completed', progress: 90 });

      // Enviar email si se solicitó
      if (emailTo) {
        await this.sendEmail(report, emailTo);
      }

      await job.updateProgress({ status: 'done', progress: 100 });

      // Publicar evento en Kafka
      await this.publishEvent(report);

    } catch (error: any) {
      report.markAsFailed(error.message);
      await this.repository.update(report);
      throw error;
    }
  }

  private async generateExcel(data: any[], metadata: any, filePath: string): Promise<void> {
    await this.excelGenerator.generate({
      title: metadata.title,
      subtitle: metadata.description,
      company: metadata.company,
      data,
      columns: metadata.columns,
      chartConfig: metadata.chartConfig,
      includeFormulas: true,
      includeFilters: true
    }, filePath);
  }

  private async generatePDF(data: any[], metadata: any, filePath: string): Promise<void> {
    // Usar generador avanzado si hay charts
    if (metadata.chartConfig) {
      await this.pdfAdvancedGenerator.generate({
        title: metadata.title,
        subtitle: metadata.description,
        company: metadata.company,
        data,
        columns: metadata.columns,
        chartConfigs: [metadata.chartConfig]
      }, filePath);
    } else {
      await this.pdfGenerator.generate({
        title: metadata.title,
        subtitle: metadata.description,
        company: metadata.company,
        data,
        columns: metadata.columns
      }, filePath);
    }
  }

  private async generateCSV(data: any[], metadata: any, filePath: string): Promise<void> {
    await this.csvGenerator.generate({
      data,
      columns: metadata.columns,
      streaming: data.length > 10000
    }, filePath);
  }

  private async generateJSON(data: any[], filePath: string): Promise<void> {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  private async sendEmail(report: Report, emailTo: string): Promise<void> {
    try {
      const axios = await import('axios');
      
      const fileBuffer = fs.readFileSync(report.filePath!);
      const fileBase64 = fileBuffer.toString('base64');

      await axios.default.post(
        `${process.env.MENSAJERIA_SERVICE_URL}/api/email/send`,
        {
          to: emailTo,
          subject: `Reporte: ${report.metadata.title}`,
          templateName: 'report-email',
          variables: {
            reportTitle: report.metadata.title,
            reportType: report.type,
            createdAt: report.createdAt.toISOString()
          },
          attachments: [{
            filename: report.getFileName(),
            content: fileBase64,
            encoding: 'base64'
          }]
        },
        {
          headers: { 'x-api-key': process.env.API_KEY },
          timeout: 30000
        }
      );
    } catch (error: any) {
      console.error('Error enviando email:', error.message);
    }
  }

  private async publishEvent(report: Report): Promise<void> {
    // TODO: Implementar Kafka producer
    console.log(`📡 Evento publicado: report.completed para ${report.id}`);
  }

  private getFileExtension(format: ReportFormat): string {
    const extensions = {
      [ReportFormat.EXCEL]: 'xlsx',
      [ReportFormat.PDF]: 'pdf',
      [ReportFormat.CSV]: 'csv',
      [ReportFormat.HTML]: 'html',
      [ReportFormat.JSON]: 'json'
    };
    return extensions[format];
  }
}

// Entry point para el worker
if (require.main === module) {
  const worker = new ReportWorker();
  
  worker.start().then(() => {
    console.log('ReportWorker running...');
  }).catch(error => {
    console.error('Failed to start ReportWorker:', error);
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
