import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { MongoClient } from 'mongodb';
import { Queue, Worker } from 'bullmq';
import { config, validateConfig } from '@shared/config';
import { logger, log } from '@shared/logger';
import { AppError, ValidationError } from '@shared/errors';
import {
  CreateReportSchema,
  GenerateReportSchema,
  EmailReportSchema,
  AnalyzeDataSchema,
  NLQuerySchema,
  KPISuggestionSchema,
  PaginationSchema,
  ReportFiltersSchema,
  validate,
  formatZodErrors
} from '@shared/validators';

// Repositories
import { MongoReportRepository } from '@infrastructure/database/repositories/MongoReportRepository';

// Use Cases
import { GenerateReport } from '@application/use-cases/GenerateReport';
import { DownloadReport } from '@application/use-cases/DownloadReport';
import { EmailReport } from '@application/use-cases/EmailReport';
import { GetUserReports } from '@application/use-cases/GetUserReports';
import { AnalyzeData } from '@application/use-cases/AnalyzeData';
import { SuggestKPIs } from '@application/use-cases/SuggestKPIs';
import { ParseNLQuery } from '@application/use-cases/ParseNLQuery';

// Services
import { ReportDomainService } from '@domain/services/ReportDomainService';
import { KPISuggestionService } from '@infrastructure/ai/services/KPISuggestionService';
import { NLPQueryParser } from '@infrastructure/ai/services/NLPQueryParser';
import { AnomalyDetectionService } from '@infrastructure/ai/services/AnomalyDetectionService';
import { ForecastingService } from '@infrastructure/ai/services/ForecastingService';
import { DataQualityAnalyzer } from '@infrastructure/ai/services/DataQualityAnalyzer';

// Generators
import { ExcelGenerator } from '@infrastructure/generators/ExcelGenerator';
import { PDFGenerator } from '@infrastructure/generators/PDFGenerator';
import { PDFAdvancedGenerator } from '@infrastructure/generators/PDFAdvancedGenerator';
import { CSVGenerator } from '@infrastructure/generators/CSVGenerator';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: config.security.corsOrigin }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  log.http(`${req.method} ${req.path}`, {
    query: req.query,
    body: req.method !== 'GET' ? req.body : undefined
  });
  next();
});

// Global state
let mongoClient: MongoClient;
let reportRepository: MongoReportRepository;
let reportQueue: Queue;
let mlQueue: Queue;

// Initialize dependencies
async function initializeApp() {
  try {
    validateConfig();
    log.info('Configuration validated successfully');

    // Connect to MongoDB
    mongoClient = new MongoClient(config.mongodb.uri);
    await mongoClient.connect();
    const db = mongoClient.db(config.mongodb.dbName);
    log.info('Connected to MongoDB');

    // Initialize repository
    reportRepository = new MongoReportRepository(db);
    
    // Initialize queues
    reportQueue = new Queue(config.queues.reportName, {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password
      }
    });
    
    mlQueue = new Queue(config.queues.mlName, {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password
      }
    });
    
    log.info('Queues initialized');

  } catch (error) {
    log.error('Failed to initialize application', error);
    throw error;
  }
}

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    service: 'business-report',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Generate report
app.post('/api/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = validate(GenerateReportSchema, req.body);
    
    const useCase = new GenerateReport(
      reportRepository,
      reportQueue,
      mlQueue,
      new ReportDomainService()
    );
    
    const report = await useCase.execute(dto);
    
    res.status(201).json({
      success: true,
      data: report,
      message: 'Report generation started'
    });
  } catch (error) {
    next(error);
  }
});

// Get user reports
app.get('/api/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      throw new ValidationError('userId is required in query params');
    }
    
    const pagination = validate(PaginationSchema, {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20
    });
    
    const filters = validate(ReportFiltersSchema, req.query);
    
    const useCase = new GetUserReports(reportRepository);
    const result = await useCase.execute({
      userId,
      filters,
      page: pagination.page,
      limit: pagination.limit
    });
    
    res.json({
      success: true,
      data: result.reports,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get single report
app.get('/api/reports/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const report = await reportRepository.findById(id);
    
    if (!report) {
      throw new AppError('Report not found', 404);
    }
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

// Download report
app.get('/api/reports/:id/download', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId as string;
    
    if (!userId) {
      throw new ValidationError('userId is required in query params');
    }
    
    const useCase = new DownloadReport(reportRepository);
    const report = await useCase.execute({ reportId: id, userId });
    
    if (!report.downloadUrl) {
      throw new AppError('Report file not available', 404);
    }
    
    // In production, this should serve from S3 or similar
    res.download(report.downloadUrl);
  } catch (error) {
    next(error);
  }
});

// Email report
app.post('/api/reports/:id/email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const dto = validate(EmailReportSchema, {
      ...req.body,
      reportId: id
    });
    
    const useCase = new EmailReport(reportRepository);
    await useCase.execute(dto);
    
    res.json({
      success: true,
      message: 'Report email sent successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Analyze data (trigger ML analysis)
app.post('/api/analytics/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = validate(AnalyzeDataSchema, req.body);
    
    const useCase = new AnalyzeData(
      reportRepository,
      new AnomalyDetectionService(),
      new ForecastingService(),
      new KPISuggestionService(),
      new DataQualityAnalyzer()
    );
    
    const insights = await useCase.execute(dto);
    
    res.json({
      success: true,
      data: insights,
      message: 'Analysis completed'
    });
  } catch (error) {
    next(error);
  }
});

// Suggest KPIs
app.post('/api/kpis/suggest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = validate(KPISuggestionSchema, req.body);
    
    const useCase = new SuggestKPIs(
      new KPISuggestionService(),
      new ReportDomainService()
    );
    
    const kpis = await useCase.execute(dto);
    
    res.json({
      success: true,
      data: kpis
    });
  } catch (error) {
    next(error);
  }
});

// Natural Language Query
app.post('/api/analytics/nl-query', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = validate(NLQuerySchema, req.body);
    
    const useCase = new ParseNLQuery(new NLPQueryParser());
    const query = await useCase.execute(dto);
    
    res.json({
      success: true,
      data: query
    });
  } catch (error) {
    next(error);
  }
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    log.error(`Application error: ${err.message}`, err);
    
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.code,
        ...(err instanceof ValidationError && err.details ? { details: err.details } : {})
      }
    });
  }
  
  // Zod validation errors
  if (err.name === 'ZodError') {
    const zodError = err as any;
    log.error('Validation error', zodError);
    
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: formatZodErrors(zodError)
      }
    });
  }
  
  // Unknown errors
  log.error('Unexpected error', err);
  
  res.status(500).json({
    success: false,
    error: {
      message: config.nodeEnv === 'production' 
        ? 'Internal server error' 
        : err.message,
      code: 'INTERNAL_ERROR'
    }
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      code: 'NOT_FOUND'
    }
  });
});

// Graceful shutdown
async function shutdown() {
  log.info('Shutting down gracefully...');
  
  try {
    // Close queues
    if (reportQueue) await reportQueue.close();
    if (mlQueue) await mlQueue.close();
    
    // Close MongoDB
    if (mongoClient) await mongoClient.close();
    
    log.info('All connections closed');
    process.exit(0);
  } catch (error) {
    log.error('Error during shutdown', error);
    process.exit(1);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
async function start() {
  try {
    await initializeApp();
    
    app.listen(config.port, () => {
      log.info(`🚀 Business-Report service running on port ${config.port}`);
      log.info(`📊 Environment: ${config.nodeEnv}`);
      log.info(`🤖 AI/ML Features: ${config.analytics.enableKpiSuggestions ? 'Enabled' : 'Disabled'}`);
    });
  } catch (error) {
    log.error('Failed to start server', error);
    process.exit(1);
  }
}

start();
