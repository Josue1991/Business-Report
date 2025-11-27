import { ForecastDTO } from '../dtos/ReportDTO';

export interface ForecastResult {
  forecasts: number[];
  confidence: number;
  method: string;
  trend: 'upward' | 'downward' | 'stable';
  mape?: number;
}

export interface IForecastingService {
  forecast(data: number[], periods: number, confidence?: number): Promise<ForecastResult>;
}

export class ForecastTrendsUseCase {
  constructor(private readonly forecastingService: IForecastingService) {}

  async execute(dto: ForecastDTO): Promise<ForecastResult> {
    // Validar entrada
    if (!dto.data || dto.data.length < 3) {
      throw new Error('Se requieren al menos 3 puntos de datos para realizar pronósticos');
    }

    if (dto.periods <= 0 || dto.periods > 24) {
      throw new Error('El número de períodos debe estar entre 1 y 24');
    }

    // Verificar que los datos sean numéricos
    if (!dto.data.every(value => typeof value === 'number' && !isNaN(value))) {
      throw new Error('Todos los valores deben ser números válidos');
    }

    // Ejecutar pronóstico
    const result = await this.forecastingService.forecast(
      dto.data,
      dto.periods,
      dto.confidence || 0.95
    );

    return result;
  }
}
