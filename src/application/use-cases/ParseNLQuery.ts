import { NLQueryDTO } from '../dtos/ReportDTO';
import { AnalyticsQuery } from '@domain/entities/AnalyticsQuery';

export interface INLPQueryParser {
  parse(query: string, dataSource: string, context?: Record<string, any>): Promise<AnalyticsQuery>;
}

export class ParseNLQueryUseCase {
  constructor(private readonly nlpParser: INLPQueryParser) {}

  async execute(dto: NLQueryDTO): Promise<AnalyticsQuery> {
    // Validar entrada
    if (!dto.query || dto.query.trim().length === 0) {
      throw new Error('La consulta es requerida');
    }

    if (dto.query.length > 500) {
      throw new Error('La consulta no puede exceder 500 caracteres');
    }

    if (!dto.dataSource) {
      throw new Error('El data source es requerido');
    }

    // Parsear consulta en lenguaje natural
    const analyticsQuery = await this.nlpParser.parse(dto.query, dto.dataSource, dto.context);

    return analyticsQuery;
  }
}
