import { KPISuggestion } from '@domain/entities/Report';
import { KPISuggestionRequestDTO } from '../dtos/ReportDTO';

export interface IKPISuggestionService {
  suggestKPIs(request: KPISuggestionRequestDTO): Promise<KPISuggestion[]>;
}

export class SuggestKPIsUseCase {
  constructor(private readonly kpiService: IKPISuggestionService) {}

  async execute(dto: KPISuggestionRequestDTO): Promise<KPISuggestion[]> {
    // Validar entrada
    if (!dto.dataSource || dto.dataSource.trim().length === 0) {
      throw new Error('El data source es requerido');
    }

    // Obtener sugerencias de KPIs
    const suggestions = await this.kpiService.suggestKPIs(dto);

    // Filtrar y ordenar por importancia
    const filteredSuggestions = suggestions
      .filter(kpi => !dto.existingKPIs?.includes(kpi.name))
      .sort((a, b) => {
        const importanceOrder = { high: 0, medium: 1, low: 2 };
        return importanceOrder[a.importance] - importanceOrder[b.importance];
      });

    // Limitar número de sugerencias
    const maxSuggestions = dto.maxSuggestions || 5;
    return filteredSuggestions.slice(0, maxSuggestions);
  }
}
