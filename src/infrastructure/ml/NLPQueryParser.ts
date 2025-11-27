import OpenAI from 'openai';
import natural from 'natural';
import { v4 as uuidv4 } from 'uuid';
import { AnalyticsQuery, DataSource, Filter, Aggregation, GroupBy } from '@domain/entities/AnalyticsQuery';

export class NLPQueryParser {
  private openai: OpenAI;
  private tokenizer: natural.WordTokenizer;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.tokenizer = new natural.WordTokenizer();
  }

  async parse(
    query: string,
    dataSourceName: string,
    context?: Record<string, any>
  ): Promise<AnalyticsQuery> {
    // Intentar primero con pattern matching simple (más rápido y gratis)
    const simpleResult = this.trySimpleParsing(query, dataSourceName, context);
    
    if (simpleResult) {
      return simpleResult;
    }

    // Si falla, usar OpenAI (más preciso pero con costo)
    return this.parseWithOpenAI(query, dataSourceName, context);
  }

  /**
   * Intenta parsear consultas simples sin usar OpenAI
   */
  private trySimpleParsing(
    query: string,
    dataSourceName: string,
    context?: Record<string, any>
  ): AnalyticsQuery | null {
    const normalizedQuery = query.toLowerCase();
    const tokens = this.tokenizer.tokenize(normalizedQuery);

    // Detectar agregaciones
    const aggregations: Aggregation[] = [];
    
    if (tokens.some(t => ['total', 'suma', 'sum'].includes(t))) {
      const field = this.extractFieldFromQuery(tokens, ['total', 'suma', 'de', 'sum']);
      if (field) {
        aggregations.push({ field, operation: 'sum', alias: `total_${field}` });
      }
    }
    
    if (tokens.some(t => ['promedio', 'media', 'average', 'avg'].includes(t))) {
      const field = this.extractFieldFromQuery(tokens, ['promedio', 'media', 'de', 'average']);
      if (field) {
        aggregations.push({ field, operation: 'avg', alias: `avg_${field}` });
      }
    }

    if (tokens.some(t => ['contar', 'cuenta', 'count', 'cantidad'].includes(t))) {
      aggregations.push({ field: '*', operation: 'count', alias: 'count' });
    }

    // Detectar agrupaciones
    const groupBy: GroupBy[] = [];
    
    if (tokens.some(t => ['por', 'by', 'agrupado', 'grupo'].includes(t))) {
      const groupFields = this.extractGroupByFields(tokens);
      groupBy.push(...groupFields.map(field => ({ field })));
    }

    // Detectar filtros temporales
    const filters: Filter[] = [];
    
    if (tokens.includes('último') || tokens.includes('últimos') || tokens.includes('last')) {
      const period = this.extractTimePeriod(tokens);
      if (period) {
        filters.push({
          field: 'date',
          operator: '>=',
          value: period
        });
      }
    }

    // Si detectamos algo útil, crear query
    if (aggregations.length > 0 || groupBy.length > 0) {
      const dataSource: DataSource = {
        type: this.inferDataSourceType(dataSourceName),
        table: dataSourceName,
        collection: dataSourceName
      };

      return new AnalyticsQuery(
        uuidv4(),
        'Query from NL',
        query,
        dataSource,
        filters,
        aggregations,
        groupBy.length > 0 ? groupBy : undefined,
        undefined,
        undefined,
        undefined,
        false,
        undefined,
        query
      );
    }

    return null;
  }

  /**
   * Parsea usando OpenAI GPT-4
   */
  private async parseWithOpenAI(
    query: string,
    dataSourceName: string,
    context?: Record<string, any>
  ): Promise<AnalyticsQuery> {
    const prompt = this.buildOpenAIPrompt(query, dataSourceName, context);

    try {
      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en convertir consultas en lenguaje natural a queries estructurados de bases de datos.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1, // Baja temperatura para respuestas precisas
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('OpenAI no retornó contenido');
      }

      const parsed = JSON.parse(content);
      return this.buildAnalyticsQuery(parsed, query, dataSourceName);
    } catch (error: any) {
      console.error('Error al parsear con OpenAI:', error);
      
      // Fallback: query básica
      return this.buildFallbackQuery(query, dataSourceName);
    }
  }

  private buildOpenAIPrompt(
    query: string,
    dataSourceName: string,
    context?: Record<string, any>
  ): string {
    let prompt = `
Convierte la siguiente consulta en lenguaje natural a un query estructurado.

**Consulta del usuario:**
"${query}"

**Fuente de datos:** ${dataSourceName}
`;

    if (context) {
      prompt += `\n**Contexto adicional:**\n${JSON.stringify(context, null, 2)}\n`;
    }

    prompt += `
**Responde en formato JSON con esta estructura:**
{
  "filters": [
    { "field": "nombre_campo", "operator": "=|!=|>|<|>=|<=|IN|LIKE|BETWEEN", "value": "valor" }
  ],
  "aggregations": [
    { "field": "nombre_campo", "operation": "sum|avg|count|min|max|stddev|median", "alias": "alias_opcional" }
  ],
  "groupBy": [
    { "field": "nombre_campo", "interval": "hour|day|week|month|quarter|year" }
  ],
  "orderBy": [
    { "field": "nombre_campo", "direction": "asc|desc" }
  ],
  "limit": number_opcional
}

**Importante:**
- Si no hay filtros, aggregations, etc., devuelve array vacío []
- Los operadores deben ser exactos: =, !=, >, <, >=, <=, IN, LIKE, BETWEEN
- Para fechas, usa formato ISO 8601
- Para operadores temporales como "último mes", calcula la fecha correspondiente
`;

    return prompt;
  }

  private buildAnalyticsQuery(parsed: any, originalQuery: string, dataSourceName: string): AnalyticsQuery {
    const dataSource: DataSource = {
      type: this.inferDataSourceType(dataSourceName),
      table: dataSourceName,
      collection: dataSourceName
    };

    const filters: Filter[] = (parsed.filters || []).map((f: any) => ({
      field: f.field,
      operator: f.operator,
      value: f.value
    }));

    const aggregations: Aggregation[] = (parsed.aggregations || []).map((a: any) => ({
      field: a.field,
      operation: a.operation,
      alias: a.alias
    }));

    const groupBy: GroupBy[] | undefined = parsed.groupBy && parsed.groupBy.length > 0
      ? parsed.groupBy.map((g: any) => ({
          field: g.field,
          interval: g.interval
        }))
      : undefined;

    const orderBy: Array<{ field: string; direction: 'asc' | 'desc' }> | undefined = 
      parsed.orderBy && parsed.orderBy.length > 0 ? parsed.orderBy : undefined;

    return new AnalyticsQuery(
      uuidv4(),
      'Query from Natural Language',
      originalQuery,
      dataSource,
      filters,
      aggregations,
      groupBy,
      orderBy,
      parsed.limit,
      undefined,
      true, // ML habilitado
      ['nlp_parsing'],
      originalQuery
    );
  }

  private buildFallbackQuery(query: string, dataSourceName: string): AnalyticsQuery {
    const dataSource: DataSource = {
      type: this.inferDataSourceType(dataSourceName),
      table: dataSourceName,
      collection: dataSourceName
    };

    return new AnalyticsQuery(
      uuidv4(),
      'Fallback Query',
      query,
      dataSource,
      [],
      [],
      undefined,
      undefined,
      100, // Límite por defecto
      undefined,
      false,
      undefined,
      query
    );
  }

  private extractFieldFromQuery(tokens: string[], skipWords: string[]): string | null {
    for (let i = 0; i < tokens.length; i++) {
      if (!skipWords.includes(tokens[i])) {
        // Posible nombre de campo
        return tokens[i];
      }
    }
    return null;
  }

  private extractGroupByFields(tokens: string[]): string[] {
    const groupByIndex = tokens.findIndex(t => ['por', 'by'].includes(t));
    
    if (groupByIndex === -1 || groupByIndex === tokens.length - 1) {
      return [];
    }

    // Campos después de "por"
    const fields: string[] = [];
    const commonFields = ['region', 'producto', 'category', 'mes', 'año', 'month', 'year'];
    
    for (let i = groupByIndex + 1; i < tokens.length; i++) {
      if (commonFields.includes(tokens[i]) || tokens[i].endsWith('_id')) {
        fields.push(tokens[i]);
      }
    }

    return fields;
  }

  private extractTimePeriod(tokens: string[]): string | null {
    const now = new Date();
    
    if (tokens.includes('día') || tokens.includes('day')) {
      now.setDate(now.getDate() - 1);
      return now.toISOString();
    }
    
    if (tokens.includes('semana') || tokens.includes('week')) {
      now.setDate(now.getDate() - 7);
      return now.toISOString();
    }
    
    if (tokens.includes('mes') || tokens.includes('month')) {
      now.setMonth(now.getMonth() - 1);
      return now.toISOString();
    }
    
    if (tokens.includes('año') || tokens.includes('year')) {
      now.setFullYear(now.getFullYear() - 1);
      return now.toISOString();
    }

    return null;
  }

  private inferDataSourceType(dataSourceName: string): DataSource['type'] {
    const lowerName = dataSourceName.toLowerCase();
    
    if (lowerName.includes('clickhouse') || lowerName.includes('analytics')) {
      return 'clickhouse';
    }
    
    if (lowerName.includes('timescale') || lowerName.includes('ts_') || lowerName.includes('metrics')) {
      return 'timescale';
    }
    
    if (lowerName.includes('http') || lowerName.includes('api')) {
      return 'api';
    }

    return 'mongodb'; // Default
  }
}
