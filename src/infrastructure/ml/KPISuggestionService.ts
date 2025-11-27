import OpenAI from 'openai';
import { KPISuggestion } from '@domain/entities/Report';
import { KPISuggestionRequestDTO } from '@application/dtos/ReportDTO';

export class KPISuggestionService {
  private openai: OpenAI;
  private cache: Map<string, { kpis: KPISuggestion[]; timestamp: number }>;
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.cache = new Map();
  }

  async suggestKPIs(request: KPISuggestionRequestDTO): Promise<KPISuggestion[]> {
    // Verificar cache
    const cacheKey = this.getCacheKey(request);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log('Retornando KPIs desde cache');
      return cached.kpis;
    }

    // Generar sugerencias con OpenAI
    const kpis = await this.generateKPIsWithAI(request);
    
    // Guardar en cache
    this.cache.set(cacheKey, { kpis, timestamp: Date.now() });
    
    return kpis;
  }

  private async generateKPIsWithAI(request: KPISuggestionRequestDTO): Promise<KPISuggestion[]> {
    const prompt = this.buildPrompt(request);
    
    try {
      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Eres un experto analista de Business Intelligence con más de 15 años de experiencia en análisis de datos y definición de KPIs empresariales.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('OpenAI no retornó contenido');
      }

      const result = JSON.parse(content);
      return this.parseKPIsResponse(result);
    } catch (error: any) {
      console.error('Error al generar KPIs con OpenAI:', error);
      
      // Fallback: KPIs genéricos
      return this.getFallbackKPIs(request);
    }
  }

  private buildPrompt(request: KPISuggestionRequestDTO): string {
    const maxSuggestions = request.maxSuggestions || 5;
    
    let prompt = `
Analiza la siguiente fuente de datos y sugiere ${maxSuggestions} KPIs (Indicadores Clave de Performance) relevantes y accionables.

**Fuente de Datos:**
${request.dataSource}

**Contexto Empresarial:**
${request.businessContext || 'Empresa que busca optimizar sus operaciones y tomar mejores decisiones basadas en datos.'}
`;

    if (request.existingKPIs && request.existingKPIs.length > 0) {
      prompt += `\n**KPIs Existentes (no sugerir estos):**\n${request.existingKPIs.join(', ')}`;
    }

    prompt += `

**Requisitos:**
1. Cada KPI debe ser SMART (Específico, Medible, Alcanzable, Relevante, Temporal)
2. Proporciona la fórmula exacta de cálculo
3. Indica la importancia (high/medium/low)
4. Clasifica por categoría (financiero, operacional, marketing, ventas, servicio_cliente, recursos_humanos)
5. Recomienda el mejor tipo de visualización (line, bar, gauge, number, trend, pie)

**Formato de respuesta JSON:**
{
  "kpis": [
    {
      "name": "Nombre del KPI",
      "description": "Descripción clara de qué mide y por qué es importante",
      "formula": "Fórmula matemática exacta",
      "importance": "high|medium|low",
      "category": "categoría",
      "visualizationType": "tipo",
      "currentValue": null,
      "targetValue": null
    }
  ]
}

Genera exactamente ${maxSuggestions} KPIs únicos y relevantes.
`;

    return prompt;
  }

  private parseKPIsResponse(response: any): KPISuggestion[] {
    const kpis: KPISuggestion[] = [];
    
    if (response.kpis && Array.isArray(response.kpis)) {
      response.kpis.forEach((kpi: any) => {
        kpis.push({
          name: kpi.name,
          description: kpi.description,
          formula: kpi.formula,
          importance: this.validateImportance(kpi.importance),
          category: kpi.category || 'general',
          visualizationType: this.validateVisualizationType(kpi.visualizationType),
          currentValue: kpi.currentValue,
          targetValue: kpi.targetValue
        });
      });
    }
    
    return kpis;
  }

  private getFallbackKPIs(request: KPISuggestionRequestDTO): KPISuggestion[] {
    // KPIs genéricos comunes
    const fallbackKPIs: KPISuggestion[] = [
      {
        name: 'Revenue Growth Rate',
        description: 'Tasa de crecimiento de ingresos período a período',
        formula: '((Ingresos Período Actual - Ingresos Período Anterior) / Ingresos Período Anterior) * 100',
        importance: 'high',
        category: 'financiero',
        visualizationType: 'line'
      },
      {
        name: 'Average Transaction Value',
        description: 'Valor promedio de cada transacción',
        formula: 'SUM(valor_transacciones) / COUNT(transacciones)',
        importance: 'high',
        category: 'ventas',
        visualizationType: 'gauge'
      },
      {
        name: 'Conversion Rate',
        description: 'Porcentaje de conversión de leads a clientes',
        formula: '(COUNT(clientes_nuevos) / COUNT(leads)) * 100',
        importance: 'high',
        category: 'marketing',
        visualizationType: 'gauge'
      },
      {
        name: 'Customer Retention Rate',
        description: 'Porcentaje de clientes que continúan comprando',
        formula: '((Clientes_Fin - Clientes_Nuevos) / Clientes_Inicio) * 100',
        importance: 'high',
        category: 'servicio_cliente',
        visualizationType: 'trend'
      },
      {
        name: 'Operational Efficiency',
        description: 'Ratio de productividad operacional',
        formula: 'Output / Input',
        importance: 'medium',
        category: 'operacional',
        visualizationType: 'bar'
      }
    ];

    const maxSuggestions = request.maxSuggestions || 5;
    return fallbackKPIs.slice(0, maxSuggestions);
  }

  private validateImportance(importance: string): 'high' | 'medium' | 'low' {
    const normalized = importance?.toLowerCase();
    if (normalized === 'high' || normalized === 'alta' || normalized === 'alto') return 'high';
    if (normalized === 'low' || normalized === 'baja' || normalized === 'bajo') return 'low';
    return 'medium';
  }

  private validateVisualizationType(type: string): 'line' | 'bar' | 'gauge' | 'number' | 'trend' {
    const normalized = type?.toLowerCase();
    const validTypes: Array<'line' | 'bar' | 'gauge' | 'number' | 'trend'> = 
      ['line', 'bar', 'gauge', 'number', 'trend'];
    
    if (validTypes.includes(normalized as any)) {
      return normalized as any;
    }
    
    return 'number'; // Default
  }

  private getCacheKey(request: KPISuggestionRequestDTO): string {
    return `${request.dataSource}-${request.businessContext || 'default'}`;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
