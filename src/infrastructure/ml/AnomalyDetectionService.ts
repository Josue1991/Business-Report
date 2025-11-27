import { mean, standardDeviation, quantile } from 'simple-statistics';
import { AnomalyResult } from '@application/use-cases/DetectAnomalies';

export class AnomalyDetectionService {
  /**
   * Detecta anomalías usando diferentes métodos estadísticos
   */
  async detectAnomalies(
    data: number[],
    threshold: number = 2.5,
    method: 'zscore' | 'iqr' | 'isolation_forest' = 'zscore'
  ): Promise<AnomalyResult> {
    switch (method) {
      case 'zscore':
        return this.detectWithZScore(data, threshold);
      case 'iqr':
        return this.detectWithIQR(data);
      case 'isolation_forest':
        return this.detectWithIsolationForest(data);
      default:
        return this.detectWithZScore(data, threshold);
    }
  }

  /**
   * Método Z-Score: detecta valores que están más allá de N desviaciones estándar
   */
  private detectWithZScore(data: number[], threshold: number): AnomalyResult {
    const avg = mean(data);
    const stdDev = standardDeviation(data);

    const anomalies = data.map((value, index) => {
      const zScore = Math.abs((value - avg) / stdDev);
      return {
        index,
        value,
        score: zScore,
        isAnomaly: zScore > threshold
      };
    });

    const anomalyCount = anomalies.filter(a => a.isAnomaly).length;

    return {
      anomalies,
      threshold,
      method: 'zscore',
      anomalyCount,
      anomalyPercentage: (anomalyCount / data.length) * 100
    };
  }

  /**
   * Método IQR (Interquartile Range): detecta outliers usando cuartiles
   */
  private detectWithIQR(data: number[]): AnomalyResult {
    const q1 = quantile(data, 0.25);
    const q3 = quantile(data, 0.75);
    const iqr = q3 - q1;

    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const anomalies = data.map((value, index) => {
      const isLower = value < lowerBound;
      const isUpper = value > upperBound;
      const isAnomaly = isLower || isUpper;

      // Score basado en qué tan lejos está del rango
      let score = 0;
      if (isLower) {
        score = (lowerBound - value) / iqr;
      } else if (isUpper) {
        score = (value - upperBound) / iqr;
      }

      return {
        index,
        value,
        score: Math.abs(score),
        isAnomaly
      };
    });

    const anomalyCount = anomalies.filter(a => a.isAnomaly).length;

    return {
      anomalies,
      threshold: 1.5, // Factor IQR estándar
      method: 'iqr',
      anomalyCount,
      anomalyPercentage: (anomalyCount / data.length) * 100
    };
  }

  /**
   * Método simplificado de Isolation Forest usando distancias
   */
  private detectWithIsolationForest(data: number[]): AnomalyResult {
    const sorted = [...data].sort((a, b) => a - b);
    const avg = mean(data);
    const stdDev = standardDeviation(data);

    const anomalies = data.map((value, index) => {
      // Calcular "isolation score" basado en:
      // 1. Distancia al promedio
      // 2. Densidad local (distancia a vecinos más cercanos)
      
      const zScore = Math.abs((value - avg) / stdDev);
      
      // Encontrar vecinos más cercanos
      const sortedIndex = sorted.indexOf(value);
      const leftNeighbor = sortedIndex > 0 ? sorted[sortedIndex - 1] : value;
      const rightNeighbor = sortedIndex < sorted.length - 1 ? sorted[sortedIndex + 1] : value;
      
      const leftDist = Math.abs(value - leftNeighbor);
      const rightDist = Math.abs(value - rightNeighbor);
      const avgNeighborDist = (leftDist + rightDist) / 2;
      
      // Score combinado: mayor = más anómalo
      const isolationScore = zScore * (1 + avgNeighborDist / stdDev);
      
      return {
        index,
        value,
        score: isolationScore,
        isAnomaly: isolationScore > 3.0 // Threshold para isolation
      };
    });

    const anomalyCount = anomalies.filter(a => a.isAnomaly).length;

    return {
      anomalies,
      threshold: 3.0,
      method: 'isolation_forest',
      anomalyCount,
      anomalyPercentage: (anomalyCount / data.length) * 100
    };
  }

  /**
   * Detecta anomalías en series temporales considerando tendencia y estacionalidad
   */
  async detectTimeSeriesAnomalies(
    data: number[],
    windowSize: number = 10,
    threshold: number = 2.5
  ): Promise<AnomalyResult> {
    if (data.length < windowSize) {
      return this.detectWithZScore(data, threshold);
    }

    const anomalies = data.map((value, index) => {
      // Calcular media y desviación estándar de la ventana local
      const start = Math.max(0, index - windowSize);
      const end = Math.min(data.length, index + windowSize + 1);
      const window = data.slice(start, end);
      
      const windowMean = mean(window);
      const windowStdDev = standardDeviation(window);
      
      const zScore = Math.abs((value - windowMean) / windowStdDev);
      
      return {
        index,
        value,
        score: zScore,
        isAnomaly: zScore > threshold
      };
    });

    const anomalyCount = anomalies.filter(a => a.isAnomaly).length;

    return {
      anomalies,
      threshold,
      method: 'time_series_zscore',
      anomalyCount,
      anomalyPercentage: (anomalyCount / data.length) * 100
    };
  }
}
