import { linearRegression, linearRegressionLine, mean, standardDeviation } from 'simple-statistics';
import { ForecastResult } from '@application/use-cases/ForecastTrends';

export class ForecastingService {
  /**
   * Realiza pronósticos usando regresión lineal
   */
  async forecast(
    data: number[],
    periods: number,
    confidence: number = 0.95
  ): Promise<ForecastResult> {
    // Método 1: Regresión Lineal Simple
    if (data.length < 10) {
      return this.simpleLinearForecast(data, periods, confidence);
    }

    // Método 2: Weighted Moving Average para tendencias más recientes
    return this.weightedMovingAverageForecast(data, periods, confidence);
  }

  /**
   * Pronóstico con regresión lineal simple
   */
  private simpleLinearForecast(
    data: number[],
    periods: number,
    confidence: number
  ): ForecastResult {
    // Convertir a puntos (x, y) para regresión
    const points: [number, number][] = data.map((value, index) => [index, value]);
    
    // Calcular regresión lineal
    const regression = linearRegression(points);
    const line = linearRegressionLine(regression);
    
    // Calcular R² (bondad de ajuste)
    const predictions = data.map((_, index) => line(index));
    const rSquared = this.calculateRSquared(data, predictions);
    
    // Generar pronósticos
    const lastIndex = data.length - 1;
    const forecasts: number[] = [];
    
    for (let i = 1; i <= periods; i++) {
      const forecast = line(lastIndex + i);
      forecasts.push(Math.max(0, forecast)); // No permitir valores negativos
    }
    
    // Determinar tendencia
    const slope = regression.m;
    let trend: 'upward' | 'downward' | 'stable';
    
    if (Math.abs(slope) < 0.01 * mean(data)) {
      trend = 'stable';
    } else {
      trend = slope > 0 ? 'upward' : 'downward';
    }
    
    // Calcular MAPE (Mean Absolute Percentage Error)
    const mape = this.calculateMAPE(data, predictions);
    
    return {
      forecasts,
      confidence: Math.max(0, 1 - mape / 100),
      method: 'linear_regression',
      trend,
      mape
    };
  }

  /**
   * Pronóstico con Weighted Moving Average
   */
  private weightedMovingAverageForecast(
    data: number[],
    periods: number,
    confidence: number
  ): ForecastResult {
    const windowSize = Math.min(10, data.length);
    const weights = this.generateWeights(windowSize);
    
    // Calcular tendencia usando los últimos datos
    const recentData = data.slice(-windowSize);
    const weightedAvg = recentData.reduce((sum, value, index) => 
      sum + value * weights[index], 0
    ) / weights.reduce((a, b) => a + b, 0);
    
    // Calcular cambio promedio por período
    const changes: number[] = [];
    for (let i = 1; i < data.length; i++) {
      changes.push(data[i] - data[i - 1]);
    }
    
    const avgChange = mean(changes);
    const stdChange = standardDeviation(changes);
    
    // Generar pronósticos
    const forecasts: number[] = [];
    let lastValue = data[data.length - 1];
    
    for (let i = 0; i < periods; i++) {
      // Pronóstico = último valor + cambio promedio
      const forecast = lastValue + avgChange;
      forecasts.push(Math.max(0, forecast));
      lastValue = forecast;
    }
    
    // Determinar tendencia
    let trend: 'upward' | 'downward' | 'stable';
    if (Math.abs(avgChange) < stdChange * 0.5) {
      trend = 'stable';
    } else {
      trend = avgChange > 0 ? 'upward' : 'downward';
    }
    
    // Estimar confianza basada en variabilidad
    const cv = stdChange / Math.abs(mean(data)); // Coeficiente de variación
    const estimatedConfidence = Math.max(0.5, Math.min(0.95, 1 - cv));
    
    return {
      forecasts,
      confidence: estimatedConfidence,
      method: 'weighted_moving_average',
      trend,
      mape: cv * 100
    };
  }

  /**
   * Pronóstico con descomposición de tendencia y estacionalidad
   */
  async forecastWithSeasonality(
    data: number[],
    periods: number,
    seasonalPeriod: number = 12
  ): Promise<ForecastResult> {
    if (data.length < seasonalPeriod * 2) {
      return this.simpleLinearForecast(data, periods, 0.95);
    }

    // Descomponer serie temporal
    const { trend, seasonal, residual } = this.decomposeTimeSeries(data, seasonalPeriod);
    
    // Pronosticar tendencia
    const trendForecast = await this.forecast(trend, periods, 0.95);
    
    // Repetir patrón estacional
    const forecasts: number[] = [];
    for (let i = 0; i < periods; i++) {
      const seasonalIndex = (data.length + i) % seasonalPeriod;
      const forecast = trendForecast.forecasts[i] + seasonal[seasonalIndex];
      forecasts.push(Math.max(0, forecast));
    }
    
    return {
      forecasts,
      confidence: trendForecast.confidence * 0.9, // Reducir un poco por complejidad
      method: 'seasonal_decomposition',
      trend: trendForecast.trend,
      mape: trendForecast.mape
    };
  }

  /**
   * Descomposición de serie temporal en tendencia + estacionalidad + residuo
   */
  private decomposeTimeSeries(
    data: number[],
    seasonalPeriod: number
  ): { trend: number[]; seasonal: number[]; residual: number[] } {
    // Calcular tendencia (media móvil)
    const trend: number[] = [];
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - Math.floor(seasonalPeriod / 2));
      const end = Math.min(data.length, i + Math.floor(seasonalPeriod / 2) + 1);
      const window = data.slice(start, end);
      trend.push(mean(window));
    }
    
    // Calcular componente estacional
    const detrended = data.map((value, index) => value - trend[index]);
    const seasonal: number[] = [];
    
    for (let i = 0; i < seasonalPeriod; i++) {
      const seasonalValues = detrended.filter((_, index) => index % seasonalPeriod === i);
      seasonal.push(mean(seasonalValues));
    }
    
    // Calcular residuo
    const residual = data.map((value, index) => 
      value - trend[index] - seasonal[index % seasonalPeriod]
    );
    
    return { trend, seasonal, residual };
  }

  /**
   * Genera pesos exponenciales (más peso a datos recientes)
   */
  private generateWeights(size: number): number[] {
    const alpha = 0.3; // Factor de suavizado
    const weights: number[] = [];
    
    for (let i = 0; i < size; i++) {
      weights.push(Math.pow(1 - alpha, size - i - 1));
    }
    
    return weights;
  }

  /**
   * Calcula R² (coeficiente de determinación)
   */
  private calculateRSquared(actual: number[], predicted: number[]): number {
    const actualMean = mean(actual);
    
    const ssTotal = actual.reduce((sum, value) => 
      sum + Math.pow(value - actualMean, 2), 0
    );
    
    const ssResidual = actual.reduce((sum, value, index) => 
      sum + Math.pow(value - predicted[index], 2), 0
    );
    
    return 1 - (ssResidual / ssTotal);
  }

  /**
   * Calcula MAPE (Mean Absolute Percentage Error)
   */
  private calculateMAPE(actual: number[], predicted: number[]): number {
    let sumPercentageError = 0;
    let count = 0;
    
    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== 0) {
        sumPercentageError += Math.abs((actual[i] - predicted[i]) / actual[i]);
        count++;
      }
    }
    
    return count > 0 ? (sumPercentageError / count) * 100 : 0;
  }
}
