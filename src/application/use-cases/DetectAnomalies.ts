import { AnomalyDTO } from '../dtos/ReportDTO';

export interface AnomalyResult {
  anomalies: {
    index: number;
    value: number;
    score: number;
    isAnomaly: boolean;
  }[];
  threshold: number;
  method: string;
  anomalyCount: number;
  anomalyPercentage: number;
}

export interface IAnomalyDetectionService {
  detectAnomalies(data: number[], threshold?: number, method?: string): Promise<AnomalyResult>;
}

export class DetectAnomaliesUseCase {
  constructor(private readonly anomalyService: IAnomalyDetectionService) {}

  async execute(dto: AnomalyDTO): Promise<AnomalyResult> {
    // Validar entrada
    if (!dto.data || dto.data.length < 10) {
      throw new Error('Se requieren al menos 10 puntos de datos para detectar anomalías');
    }

    // Verificar que los datos sean numéricos
    if (!dto.data.every(value => typeof value === 'number' && !isNaN(value))) {
      throw new Error('Todos los valores deben ser números válidos');
    }

    // Ejecutar detección de anomalías
    const threshold = dto.threshold || parseFloat(process.env.ANOMALY_THRESHOLD || '2.5');
    const method = dto.method || 'zscore';

    const result = await this.anomalyService.detectAnomalies(dto.data, threshold, method);

    return result;
  }
}
