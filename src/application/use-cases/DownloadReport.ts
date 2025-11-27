import { IReportRepository } from '@domain/repositories/IReportRepository';
import { DownloadReportDTO } from '../dtos/ReportDTO';
import fs from 'fs';
import path from 'path';

export interface DownloadResult {
  filePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export class DownloadReportUseCase {
  constructor(private readonly reportRepository: IReportRepository) {}

  async execute(dto: DownloadReportDTO): Promise<DownloadResult> {
    // Buscar reporte
    const report = await this.reportRepository.findById(dto.reportId);
    
    if (!report) {
      throw new Error('Reporte no encontrado');
    }

    // Validar permisos
    if (report.userId !== dto.userId) {
      throw new Error('No tienes permisos para descargar este reporte');
    }

    // Validar que el reporte esté disponible
    if (!report.canBeDownloaded()) {
      if (report.isExpired()) {
        throw new Error('El reporte ha expirado');
      }
      throw new Error(`El reporte no está disponible para descarga. Estado: ${report.status}`);
    }

    // Validar que el archivo existe
    if (!report.filePath || !fs.existsSync(report.filePath)) {
      throw new Error('El archivo del reporte no existe');
    }

    // Incrementar contador de descargas
    report.incrementDownloadCount();
    await this.reportRepository.update(report);

    // Retornar información del archivo
    return {
      filePath: report.filePath,
      fileName: report.getFileName(),
      mimeType: this.getMimeType(report.format),
      fileSize: report.fileSize || fs.statSync(report.filePath).size
    };
  }

  private getMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      PDF: 'application/pdf',
      EXCEL: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      CSV: 'text/csv',
      HTML: 'text/html',
      JSON: 'application/json'
    };
    return mimeTypes[format] || 'application/octet-stream';
  }
}
