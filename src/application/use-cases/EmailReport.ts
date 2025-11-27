import { IReportRepository } from '@domain/repositories/IReportRepository';
import { ReportDomainService } from '@domain/services/ReportDomainService';
import { EmailReportDTO } from '../dtos/ReportDTO';
import axios from 'axios';
import fs from 'fs';

export class EmailReportUseCase {
  constructor(
    private readonly reportRepository: IReportRepository,
    private readonly reportService: ReportDomainService
  ) {}

  async execute(dto: EmailReportDTO): Promise<void> {
    // Buscar reporte
    const report = await this.reportRepository.findById(dto.reportId);
    
    if (!report) {
      throw new Error('Reporte no encontrado');
    }

    // Validar permisos
    if (report.userId !== dto.userId) {
      throw new Error('No tienes permisos para enviar este reporte');
    }

    // Validar que el reporte esté disponible
    if (!report.canBeDownloaded()) {
      throw new Error(`El reporte no está disponible. Estado: ${report.status}`);
    }

    // Validar que el archivo existe
    if (!report.filePath || !fs.existsSync(report.filePath)) {
      throw new Error('El archivo del reporte no existe');
    }

    // Leer archivo y convertir a base64
    const fileBuffer = fs.readFileSync(report.filePath);
    const fileBase64 = fileBuffer.toString('base64');

    // Preparar datos para el servicio de mensajería
    const emailData = {
      to: dto.emailTo,
      subject: dto.subject || `Reporte: ${report.metadata.title}`,
      templateName: 'report-email',
      variables: {
        reportTitle: report.metadata.title,
        reportType: report.type,
        recordCount: report.metadata.recordCount,
        createdAt: report.createdAt.toISOString(),
        message: dto.message || 'Tu reporte está listo',
        summary: this.reportService.generateReportSummary(report)
      },
      attachments: [
        {
          filename: report.getFileName(),
          content: fileBase64,
          encoding: 'base64',
          contentType: this.reportService.getMimeType(report.format)
        }
      ]
    };

    // Enviar email a través del servicio de mensajería
    const mensajeriaUrl = process.env.MENSAJERIA_SERVICE_URL || 'http://localhost:3005';
    
    try {
      await axios.post(`${mensajeriaUrl}/api/email/send`, emailData, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.API_KEY
        },
        timeout: 30000
      });
    } catch (error: any) {
      throw new Error(`Error al enviar email: ${error.message}`);
    }
  }
}
