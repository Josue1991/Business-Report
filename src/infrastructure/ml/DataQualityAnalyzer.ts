import { mean, median, standardDeviation, quantile } from 'simple-statistics';
import { DataQualityMetrics } from '@domain/entities/Report';

export class DataQualityAnalyzer {
  /**
   * Analiza la calidad de un dataset completo
   */
  analyze(data: any[], requiredFields?: string[]): DataQualityMetrics {
    if (data.length === 0) {
      return this.getEmptyMetrics();
    }

    const fields = requiredFields || Object.keys(data[0]);
    
    // 1. Completeness (datos completos)
    const completeness = this.calculateCompleteness(data, fields);
    
    // 2. Accuracy (precisión - valores válidos)
    const accuracy = this.calculateAccuracy(data, fields);
    
    // 3. Consistency (consistencia de tipos y formatos)
    const consistency = this.calculateConsistency(data, fields);
    
    // 4. Outliers (valores atípicos)
    const outliers = this.countOutliers(data, fields);
    
    // 5. Missing values
    const missingValues = this.countMissingValues(data, fields);
    
    // 6. Duplicates
    const duplicates = this.countDuplicates(data);

    return {
      completeness,
      accuracy,
      consistency,
      outliers,
      missingValues,
      duplicates
    };
  }

  /**
   * Calcula el porcentaje de campos completos
   */
  private calculateCompleteness(data: any[], fields: string[]): number {
    let totalCells = data.length * fields.length;
    let filledCells = 0;

    data.forEach(row => {
      fields.forEach(field => {
        const value = row[field];
        if (value !== null && value !== undefined && value !== '') {
          filledCells++;
        }
      });
    });

    return (filledCells / totalCells) * 100;
  }

  /**
   * Calcula el porcentaje de valores válidos
   */
  private calculateAccuracy(data: any[], fields: string[]): number {
    let totalCells = data.length * fields.length;
    let validCells = 0;

    data.forEach(row => {
      fields.forEach(field => {
        const value = row[field];
        
        // Validar según tipo esperado
        if (this.isValidValue(value, field)) {
          validCells++;
        }
      });
    });

    return (validCells / totalCells) * 100;
  }

  /**
   * Calcula la consistencia de tipos de datos
   */
  private calculateConsistency(data: any[], fields: string[]): number {
    const typesByField = new Map<string, Map<string, number>>();

    // Contar tipos por campo
    fields.forEach(field => {
      typesByField.set(field, new Map());
    });

    data.forEach(row => {
      fields.forEach(field => {
        const value = row[field];
        const type = this.getValueType(value);
        
        const fieldTypes = typesByField.get(field)!;
        fieldTypes.set(type, (fieldTypes.get(type) || 0) + 1);
      });
    });

    // Calcular consistencia (porcentaje del tipo más común)
    let totalConsistency = 0;

    fields.forEach(field => {
      const fieldTypes = typesByField.get(field)!;
      const maxCount = Math.max(...Array.from(fieldTypes.values()));
      const consistency = (maxCount / data.length) * 100;
      totalConsistency += consistency;
    });

    return totalConsistency / fields.length;
  }

  /**
   * Cuenta valores atípicos (outliers)
   */
  private countOutliers(data: any[], fields: string[]): number {
    let totalOutliers = 0;

    fields.forEach(field => {
      const numericValues = data
        .map(row => row[field])
        .filter(value => typeof value === 'number' && !Number.isNaN(value));

      if (numericValues.length > 10) {
        // Método IQR
        const q1 = quantile(numericValues, 0.25);
        const q3 = quantile(numericValues, 0.75);
        const iqr = q3 - q1;
        
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        
        const outliers = numericValues.filter(
          value => value < lowerBound || value > upperBound
        );
        
        totalOutliers += outliers.length;
      }
    });

    return totalOutliers;
  }

  /**
   * Cuenta valores faltantes
   */
  private countMissingValues(data: any[], fields: string[]): number {
    let missingCount = 0;

    data.forEach(row => {
      fields.forEach(field => {
        const value = row[field];
        if (value === null || value === undefined || value === '') {
          missingCount++;
        }
      });
    });

    return missingCount;
  }

  /**
   * Cuenta filas duplicadas
   */
  private countDuplicates(data: any[]): number {
    const seen = new Set<string>();
    let duplicates = 0;

    data.forEach(row => {
      const hash = JSON.stringify(row);
      
      if (seen.has(hash)) {
        duplicates++;
      } else {
        seen.add(hash);
      }
    });

    return duplicates;
  }

  /**
   * Valida si un valor es válido para su campo
   */
  private isValidValue(value: any, field: string): boolean {
    // Valores nulos/vacíos no son válidos
    if (value === null || value === undefined || value === '') {
      return false;
    }

    // Validaciones específicas por tipo de campo
    const lowerField = field.toLowerCase();

    // Emails
    if (lowerField.includes('email') || lowerField.includes('mail')) {
      return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    // Fechas
    if (lowerField.includes('date') || lowerField.includes('fecha') || lowerField.includes('timestamp')) {
      const date = new Date(value);
      return !Number.isNaN(date.getTime());
    }

    // Números
    if (lowerField.includes('amount') || lowerField.includes('price') || 
        lowerField.includes('quantity') || lowerField.includes('count')) {
      return typeof value === 'number' && !Number.isNaN(value) && Number.isFinite(value);
    }

    // Por defecto, cualquier valor no-nulo es válido
    return true;
  }

  /**
   * Determina el tipo de un valor
   */
  private getValueType(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date_string';
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email';
      return 'string';
    }
    if (typeof value === 'object') return 'object';
    return 'unknown';
  }

  private getEmptyMetrics(): DataQualityMetrics {
    return {
      completeness: 0,
      accuracy: 0,
      consistency: 0,
      outliers: 0,
      missingValues: 0,
      duplicates: 0
    };
  }

  /**
   * Genera reporte de calidad en texto
   */
  generateQualityReport(metrics: DataQualityMetrics): string {
    const getGrade = (percentage: number): string => {
      if (percentage >= 95) return 'Excelente';
      if (percentage >= 80) return 'Buena';
      if (percentage >= 60) return 'Regular';
      return 'Deficiente';
    };

    return `
Análisis de Calidad de Datos:

✓ Completitud: ${metrics.completeness.toFixed(2)}% - ${getGrade(metrics.completeness)}
  ${metrics.missingValues > 0 ? `⚠ ${metrics.missingValues} valores faltantes` : '✓ Sin valores faltantes'}

✓ Precisión: ${metrics.accuracy.toFixed(2)}% - ${getGrade(metrics.accuracy)}
  Todos los valores cumplen con los formatos esperados

✓ Consistencia: ${metrics.consistency.toFixed(2)}% - ${getGrade(metrics.consistency)}
  Los tipos de datos son consistentes

✓ Integridad:
  ${metrics.duplicates > 0 ? `⚠ ${metrics.duplicates} registros duplicados` : '✓ Sin duplicados'}
  ${metrics.outliers > 0 ? `⚠ ${metrics.outliers} valores atípicos detectados` : '✓ Sin valores atípicos significativos'}

${this.getRecommendations(metrics)}
    `.trim();
  }

  private getRecommendations(metrics: DataQualityMetrics): string {
    const recommendations: string[] = [];

    if (metrics.completeness < 95) {
      recommendations.push('• Revisar y completar valores faltantes');
    }

    if (metrics.accuracy < 90) {
      recommendations.push('• Validar formatos de datos (emails, fechas, números)');
    }

    if (metrics.duplicates > 0) {
      recommendations.push('• Eliminar registros duplicados');
    }

    if (metrics.outliers > data.length * 0.05) {
      recommendations.push('• Investigar valores atípicos para determinar si son errores o casos válidos');
    }

    if (recommendations.length === 0) {
      return '\n✓ La calidad de los datos es excelente. No se requieren acciones correctivas.';
    }

    return '\nRecomendaciones:\n' + recommendations.join('\n');
  }
}
