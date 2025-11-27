import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3008'),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3008',

  // MongoDB
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    dbName: process.env.MONGODB_DB_NAME || 'business_report'
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  },

  // ClickHouse
  clickhouse: {
    host: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USERNAME || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DATABASE || 'default'
  },

  // TimescaleDB
  timescale: {
    host: process.env.TIMESCALE_HOST || 'localhost',
    port: parseInt(process.env.TIMESCALE_PORT || '5432'),
    user: process.env.TIMESCALE_USER || 'postgres',
    password: process.env.TIMESCALE_PASSWORD || 'password',
    database: process.env.TIMESCALE_DATABASE || 'tsdb'
  },

  // Storage
  storage: {
    path: process.env.STORAGE_PATH || './storage/reports',
    retentionDays: parseInt(process.env.FILE_RETENTION_DAYS || '7')
  },

  // Report Limits
  limits: {
    maxRowsExcel: parseInt(process.env.MAX_ROWS_EXCEL || '100000'),
    maxRowsCsv: parseInt(process.env.MAX_ROWS_CSV || '1000000'),
    maxRowsPdf: parseInt(process.env.MAX_ROWS_PDF || '10000'),
    pdfTimeoutMs: parseInt(process.env.PDF_TIMEOUT_MS || '30000')
  },

  // Queues
  queues: {
    reportName: process.env.QUEUE_REPORT_NAME || 'reports',
    mlName: process.env.QUEUE_ML_NAME || 'ml-analysis',
    maxRetries: parseInt(process.env.QUEUE_MAX_RETRIES || '3'),
    reportConcurrency: parseInt(process.env.QUEUE_REPORT_CONCURRENCY || '5'),
    mlConcurrency: parseInt(process.env.QUEUE_ML_CONCURRENCY || '2')
  },

  // Kafka
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'business-report',
    topics: {
      reports: process.env.KAFKA_TOPIC_REPORTS || 'report.completed',
      analytics: process.env.KAFKA_TOPIC_ANALYTICS || 'analytics.generated',
      logs: process.env.KAFKA_TOPIC_LOGS || 'system.logs'
    }
  },

  // AI/ML
  ml: {
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4',
    modelsPath: process.env.ML_MODELS_PATH || './ml_models',
    trainingEnabled: process.env.ML_TRAINING_ENABLED === 'true',
    minDataPoints: parseInt(process.env.ML_MIN_DATA_POINTS || '100')
  },

  // Analytics Features
  analytics: {
    enableAnomalyDetection: process.env.ENABLE_ANOMALY_DETECTION === 'true',
    enableForecasting: process.env.ENABLE_FORECASTING === 'true',
    enableKpiSuggestions: process.env.ENABLE_KPI_SUGGESTIONS === 'true',
    enableNlpQueries: process.env.ENABLE_NLP_QUERIES === 'true',
    anomalyThreshold: parseFloat(process.env.ANOMALY_THRESHOLD || '2.5'),
    forecastPeriods: parseInt(process.env.FORECAST_PERIODS || '12')
  },

  // External Services
  services: {
    mensajeriaUrl: process.env.MENSAJERIA_SERVICE_URL || 'http://localhost:3005',
    logUrl: process.env.LOG_SERVICE_URL || 'http://localhost:3003'
  },

  // Security
  security: {
    apiKey: process.env.API_KEY || 'dev-api-key',
    jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret',
    corsOrigin: process.env.CORS_ORIGIN || '*'
  }
};

// Validar configuración crítica
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.mongodb.uri) {
    errors.push('MONGODB_URI is required');
  }

  if (config.analytics.enableKpiSuggestions && !config.ml.openaiApiKey) {
    console.warn('⚠ OPENAI_API_KEY not set. KPI suggestions will use fallback mode.');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}
