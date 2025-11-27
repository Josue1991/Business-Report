import ExcelJS from 'exceljs';
import { ChartConfig } from '@domain/entities/Report';
import fs from 'fs';
import path from 'path';

export interface ExcelGeneratorOptions {
  title: string;
  subtitle?: string;
  author?: string;
  company?: string;
  data: any[];
  columns?: string[];
  chartConfig?: ChartConfig;
  includeFormulas?: boolean;
  includeFilters?: boolean;
}

export class ExcelGenerator {
  async generate(options: ExcelGeneratorOptions, outputPath: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    
    // Metadata
    workbook.creator = options.author || 'BusinessApp';
    workbook.created = new Date();
    workbook.company = options.company || 'BusinessApp';

    // Hoja principal con datos
    const worksheet = workbook.addWorksheet('Datos', {
      properties: { tabColor: { argb: '007bff' } }
    });

    // Header principal
    worksheet.mergeCells('A1:' + this.getColumnLetter(options.data[0] ? Object.keys(options.data[0]).length : 5) + '1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = options.title;
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '007bff' }
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 30;

    // Subtitle
    if (options.subtitle) {
      worksheet.mergeCells('A2:' + this.getColumnLetter(Object.keys(options.data[0]).length) + '2');
      const subtitleCell = worksheet.getCell('A2');
      subtitleCell.value = options.subtitle;
      subtitleCell.font = { size: 12, italic: true };
      subtitleCell.alignment = { horizontal: 'center' };
    }

    const dataStartRow = options.subtitle ? 4 : 3;

    // Configurar columnas
    const columns = options.columns || (options.data[0] ? Object.keys(options.data[0]) : []);
    worksheet.columns = columns.map(col => ({
      header: this.formatHeader(col),
      key: col,
      width: this.calculateColumnWidth(col, options.data)
    }));

    // Estilo de encabezados
    const headerRow = worksheet.getRow(dataStartRow);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '0056b3' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    // Aplicar bordes a encabezados
    columns.forEach((_, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Agregar datos
    options.data.forEach((row, index) => {
      const excelRow = worksheet.addRow(row);
      
      // Alternar colores de filas
      if (index % 2 === 0) {
        excelRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F8F9FA' }
        };
      }

      // Bordes
      excelRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'CCCCCC' } },
          left: { style: 'thin', color: { argb: 'CCCCCC' } },
          bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
          right: { style: 'thin', color: { argb: 'CCCCCC' } }
        };
      });

      // Formato para números
      excelRow.eachCell((cell, colNumber) => {
        const value = cell.value;
        if (typeof value === 'number') {
          if (value % 1 === 0) {
            cell.numFmt = '#,##0';
          } else {
            cell.numFmt = '#,##0.00';
          }
        }
      });
    });

    // Filtros
    if (options.includeFilters) {
      worksheet.autoFilter = {
        from: { row: dataStartRow, column: 1 },
        to: { row: dataStartRow, column: columns.length }
      };
    }

    // Fórmulas (hoja de resumen)
    if (options.includeFormulas) {
      this.addSummarySheet(workbook, options.data, columns);
    }

    // Gráficos (hoja separada)
    if (options.chartConfig) {
      this.addChartSheet(workbook, options.chartConfig);
    }

    // Guardar
    await workbook.xlsx.writeFile(outputPath);
  }

  private addSummarySheet(workbook: ExcelJS.Workbook, data: any[], columns: string[]): void {
    const summarySheet = workbook.addWorksheet('Resumen', {
      properties: { tabColor: { argb: '28a745' } }
    });

    summarySheet.getCell('A1').value = 'Resumen Estadístico';
    summarySheet.getCell('A1').font = { size: 14, bold: true };

    let row = 3;
    columns.forEach(col => {
      const values = data.map(d => d[col]).filter(v => typeof v === 'number');
      
      if (values.length > 0) {
        summarySheet.getCell(`A${row}`).value = this.formatHeader(col);
        summarySheet.getCell(`A${row}`).font = { bold: true };
        
        // Total
        summarySheet.getCell(`B${row}`).value = 'Total';
        summarySheet.getCell(`C${row}`).value = { formula: `SUM(Datos!${col}${4}:${col}${data.length + 3})` };
        
        row++;
        
        // Promedio
        summarySheet.getCell(`B${row}`).value = 'Promedio';
        summarySheet.getCell(`C${row}`).value = { formula: `AVERAGE(Datos!${col}${4}:${col}${data.length + 3})` };
        
        row++;
        
        // Min
        summarySheet.getCell(`B${row}`).value = 'Mínimo';
        summarySheet.getCell(`C${row}`).value = { formula: `MIN(Datos!${col}${4}:${col}${data.length + 3})` };
        
        row++;
        
        // Max
        summarySheet.getCell(`B${row}`).value = 'Máximo';
        summarySheet.getCell(`C${row}`).value = { formula: `MAX(Datos!${col}${4}:${col}${data.length + 3})` };
        
        row += 2;
      }
    });

    summarySheet.getColumn('A').width = 25;
    summarySheet.getColumn('B').width = 15;
    summarySheet.getColumn('C').width = 15;
  }

  private addChartSheet(workbook: ExcelJS.Workbook, chartConfig: ChartConfig): void {
    const chartSheet = workbook.addWorksheet('Gráficos', {
      properties: { tabColor: { argb: 'ffc107' } }
    });

    chartSheet.getCell('A1').value = 'Visualización de Datos';
    chartSheet.getCell('A1').font = { size: 14, bold: true };

    chartSheet.getCell('A3').value = 'Nota: Los gráficos se pueden generar importando estos datos en herramientas de visualización.';
    chartSheet.getCell('A3').font = { italic: true, color: { argb: '666666' } };

    // Agregar datos del chart
    let row = 5;
    chartSheet.getCell(`A${row}`).value = 'Labels';
    chartConfig.labels.forEach((label, index) => {
      chartSheet.getCell(`${this.getColumnLetter(index + 2)}${row}`).value = label;
    });

    row++;
    chartConfig.datasets.forEach(dataset => {
      chartSheet.getCell(`A${row}`).value = dataset.label;
      dataset.data.forEach((value, index) => {
        chartSheet.getCell(`${this.getColumnLetter(index + 2)}${row}`).value = value;
      });
      row++;
    });
  }

  private formatHeader(columnName: string): string {
    return columnName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }

  private calculateColumnWidth(columnName: string, data: any[]): number {
    const headerLength = this.formatHeader(columnName).length;
    const maxDataLength = Math.max(
      ...data.map(row => String(row[columnName] || '').length),
      0
    );
    return Math.min(Math.max(headerLength, maxDataLength) + 2, 50);
  }

  private getColumnLetter(columnNumber: number): string {
    let letter = '';
    while (columnNumber > 0) {
      const remainder = (columnNumber - 1) % 26;
      letter = String.fromCharCode(65 + remainder) + letter;
      columnNumber = Math.floor((columnNumber - 1) / 26);
    }
    return letter;
  }
}
