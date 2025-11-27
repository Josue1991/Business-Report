import PDFDocument from 'pdfkit';
import fs from 'fs';
import { ChartConfig } from '@domain/entities/Report';

export interface PDFGeneratorOptions {
  title: string;
  subtitle?: string;
  author?: string;
  company?: string;
  logo?: string;
  data: any[];
  columns?: string[];
  chartConfig?: ChartConfig;
  includeFooter?: boolean;
}

export class PDFGenerator {
  async generate(options: PDFGeneratorOptions, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: options.title,
          Author: options.author || 'BusinessApp',
          Subject: options.subtitle || '',
          Creator: 'Business-Report Service'
        }
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Header
      this.addHeader(doc, options);

      // Tabla de datos
      this.addTable(doc, options.data, options.columns);

      // Footer
      if (options.includeFooter !== false) {
        this.addFooter(doc, options);
      }

      doc.end();

      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  }

  private addHeader(doc: PDFKit.PDFDocument, options: PDFGeneratorOptions): void {
    // Logo (si existe)
    if (options.logo && fs.existsSync(options.logo)) {
      doc.image(options.logo, 50, 45, { width: 50 });
      doc.moveDown();
    }

    // Título
    doc.fontSize(20)
      .fillColor('#007bff')
      .text(options.title, { align: 'center' });

    // Subtitle
    if (options.subtitle) {
      doc.fontSize(12)
        .fillColor('#6c757d')
        .text(options.subtitle, { align: 'center' });
    }

    // Metadata
    doc.fontSize(10)
      .fillColor('#000000')
      .text(`Generado: ${new Date().toLocaleString('es-ES')}`, { align: 'right' });

    if (options.company) {
      doc.text(`Empresa: ${options.company}`, { align: 'right' });
    }

    doc.moveDown(2);

    // Línea separadora
    doc.moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke('#007bff');

    doc.moveDown();
  }

  private addTable(doc: PDFKit.PDFDocument, data: any[], columns?: string[]): void {
    if (data.length === 0) {
      doc.fontSize(12).text('No hay datos disponibles', { align: 'center' });
      return;
    }

    const cols = columns || Object.keys(data[0]);
    const tableTop = doc.y;
    const columnWidth = (545 - 50) / cols.length;

    // Headers
    doc.fontSize(10).fillColor('#ffffff');
    
    cols.forEach((col, index) => {
      const x = 50 + index * columnWidth;
      
      // Fondo del header
      doc.rect(x, tableTop, columnWidth, 25)
        .fill('#007bff');
      
      // Texto del header
      doc.fillColor('#ffffff')
        .text(
          this.formatHeader(col),
          x + 5,
          tableTop + 7,
          {
            width: columnWidth - 10,
            align: 'center'
          }
        );
    });

    doc.moveDown();
    let currentY = tableTop + 25;

    // Filas de datos
    doc.fontSize(9).fillColor('#000000');

    data.forEach((row, rowIndex) => {
      // Verificar si necesitamos nueva página
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
        
        // Re-dibujar headers en nueva página
        cols.forEach((col, index) => {
          const x = 50 + index * columnWidth;
          doc.rect(x, currentY, columnWidth, 25).fill('#007bff');
          doc.fillColor('#ffffff').text(
            this.formatHeader(col),
            x + 5,
            currentY + 7,
            { width: columnWidth - 10, align: 'center' }
          );
        });
        currentY += 25;
      }

      // Fondo alternado
      if (rowIndex % 2 === 0) {
        doc.rect(50, currentY, 545 - 50, 20).fill('#f8f9fa');
      }

      // Datos de la fila
      cols.forEach((col, colIndex) => {
        const x = 50 + colIndex * columnWidth;
        let value = row[col];

        // Formatear valores
        if (typeof value === 'number') {
          value = value.toLocaleString('es-ES', {
            minimumFractionDigits: value % 1 === 0 ? 0 : 2,
            maximumFractionDigits: 2
          });
        } else if (value instanceof Date) {
          value = value.toLocaleDateString('es-ES');
        } else if (value === null || value === undefined) {
          value = '-';
        }

        doc.fillColor('#000000')
          .text(
            String(value),
            x + 5,
            currentY + 5,
            {
              width: columnWidth - 10,
              align: typeof row[col] === 'number' ? 'right' : 'left',
              ellipsis: true
            }
          );

        // Borde
        doc.rect(x, currentY, columnWidth, 20).stroke('#dee2e6');
      });

      currentY += 20;
    });

    doc.y = currentY + 10;
  }

  private addFooter(doc: PDFKit.PDFDocument, options: PDFGeneratorOptions): void {
    const pageCount = doc.bufferedPageRange().count;

    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);

      // Línea superior
      doc.moveTo(50, 770)
        .lineTo(545, 770)
        .stroke('#cccccc');

      // Texto del footer
      doc.fontSize(8)
        .fillColor('#6c757d')
        .text(
          `${options.company || 'BusinessApp'} - ${options.title}`,
          50,
          780,
          { align: 'left' }
        );

      doc.text(
        `Página ${i + 1} de ${pageCount}`,
        50,
        780,
        { align: 'right' }
      );
    }
  }

  private formatHeader(columnName: string): string {
    return columnName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }
}
