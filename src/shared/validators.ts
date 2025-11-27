import { z } from 'zod';
import { ReportType, ReportFormat } from '@domain/entities/Report';

// Enums como Zod schemas
export const ReportTypeSchema = z.enum([
  'SALES', 'INVENTORY', 'FINANCIAL', 'USERS', 'LOGS', 'ANALYTICS', 'PREDICTIVE', 'CUSTOM'
]);

export const ReportFormatSchema = z.enum([
  'PDF', 'EXCEL', 'CSV', 'HTML', 'JSON'
]);

// Validation schemas
export const CreateReportSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  type: ReportTypeSchema,
  format: ReportFormatSchema,
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(500, 'Description too long').optional(),
  filters: z.record(z.any()).optional(),
  columns: z.array(z.string()).optional(),
  chartConfig: z.any().optional(),
  emailTo: z.string().email('Invalid email').optional(),
  aiAnalysisEnabled: z.boolean().optional(),
  dataSource: z.string().optional()
});

export const GenerateReportSchema = CreateReportSchema.extend({
  data: z.array(z.record(z.any())).min(1, 'Data is required')
});

export const DownloadReportSchema = z.object({
  reportId: z.string().min(1, 'Report ID is required'),
  userId: z.string().min(1, 'User ID is required')
});

export const EmailReportSchema = z.object({
  reportId: z.string().min(1, 'Report ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  emailTo: z.string().email('Invalid email'),
  subject: z.string().max(200).optional(),
  message: z.string().max(1000).optional()
});

export const AnalyzeDataSchema = z.object({
  reportId: z.string().min(1, 'Report ID is required'),
  data: z.array(z.record(z.any())).min(1, 'Data is required'),
  enableAnomalyDetection: z.boolean().optional(),
  enableForecasting: z.boolean().optional(),
  enableKPISuggestions: z.boolean().optional()
});

export const ForecastSchema = z.object({
  data: z.array(z.number()).min(3, 'At least 3 data points required'),
  periods: z.number().min(1).max(24, 'Periods must be between 1 and 24'),
  confidence: z.number().min(0).max(1).optional()
});

export const AnomalySchema = z.object({
  data: z.array(z.number()).min(10, 'At least 10 data points required'),
  threshold: z.number().positive().optional(),
  method: z.enum(['zscore', 'iqr', 'isolation_forest']).optional()
});

export const KPISuggestionSchema = z.object({
  dataSource: z.string().min(1, 'Data source is required'),
  businessContext: z.string().max(1000).optional(),
  existingKPIs: z.array(z.string()).optional(),
  maxSuggestions: z.number().min(1).max(10).optional()
});

export const NLQuerySchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  query: z.string().min(1, 'Query is required').max(500, 'Query too long'),
  dataSource: z.string().min(1, 'Data source is required'),
  context: z.record(z.any()).optional()
});

export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20)
});

export const ReportFiltersSchema = z.object({
  type: ReportTypeSchema.optional(),
  status: z.enum(['PENDING', 'PROCESSING', 'ANALYZING', 'COMPLETED', 'FAILED']).optional(),
  format: ReportFormatSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

// Helper function to validate
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

// Async validation with error handling
export async function validateAsync<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Promise<{ success: true; data: T } | { success: false; errors: z.ZodError }> {
  try {
    const validated = await schema.parseAsync(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error };
    }
    throw error;
  }
}

// Format Zod errors for API response
export function formatZodErrors(error: z.ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};
  
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(err.message);
  });
  
  return formatted;
}
