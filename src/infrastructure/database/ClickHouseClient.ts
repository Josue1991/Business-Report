import { createClient, ClickHouseClient as CHClient, ResultSet } from '@clickhouse/client';
import { AnalyticsQuery } from '@domain/entities/AnalyticsQuery';

export class ClickHouseClient {
  private client: CHClient;
  private isConnected: boolean = false;

  constructor() {
    this.client = createClient({
      host: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
      username: process.env.CLICKHOUSE_USERNAME || 'default',
      password: process.env.CLICKHOUSE_PASSWORD || '',
      database: process.env.CLICKHOUSE_DATABASE || 'default',
      request_timeout: 30000,
      max_open_connections: 10
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.ping();
      this.isConnected = true;
      console.log('✓ Conectado a ClickHouse');
    } catch (error) {
      console.error('Error conectando a ClickHouse:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.close();
    this.isConnected = false;
  }

  /**
   * Ejecuta una query ClickHouse y retorna resultados
   */
  async query<T = any>(sql: string): Promise<T[]> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const resultSet = await this.client.query({
        query: sql,
        format: 'JSONEachRow'
      });

      const data = await resultSet.json<T>();
      return data;
    } catch (error: any) {
      console.error('Error ejecutando query ClickHouse:', error);
      throw new Error(`ClickHouse query error: ${error.message}`);
    }
  }

  /**
   * Ejecuta una AnalyticsQuery y retorna resultados
   */
  async executeAnalyticsQuery(analyticsQuery: AnalyticsQuery): Promise<any[]> {
    const sql = analyticsQuery.toSQL();
    return this.query(sql);
  }

  /**
   * Stream de datos para queries grandes
   */
  async* queryStream<T = any>(sql: string): AsyncGenerator<T, void, unknown> {
    if (!this.isConnected) {
      await this.connect();
    }

    const resultSet = await this.client.query({
      query: sql,
      format: 'JSONEachRow'
    });

    const stream = resultSet.stream();

    for await (const rows of stream) {
      for (const row of rows) {
        yield row.json<T>();
      }
    }
  }

  /**
   * Inserta datos en batch
   */
  async insert(table: string, data: any[]): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    if (data.length === 0) return;

    try {
      await this.client.insert({
        table,
        values: data,
        format: 'JSONEachRow'
      });
    } catch (error: any) {
      console.error('Error insertando en ClickHouse:', error);
      throw new Error(`ClickHouse insert error: ${error.message}`);
    }
  }

  /**
   * Ejecuta agregaciones optimizadas
   */
  async aggregate(
    table: string,
    aggregations: Array<{ field: string; operation: string }>,
    filters?: Array<{ field: string; operator: string; value: any }>,
    groupBy?: string[]
  ): Promise<any[]> {
    // Construir SELECT
    const selectClauses = aggregations.map(agg => {
      const op = agg.operation.toUpperCase();
      return `${op}(${agg.field}) as ${agg.operation}_${agg.field}`;
    });

    let sql = `SELECT ${selectClauses.join(', ')}`;

    // Agregar GROUP BY si existe
    if (groupBy && groupBy.length > 0) {
      sql = `SELECT ${groupBy.join(', ')}, ${selectClauses.join(', ')}`;
    }

    sql += ` FROM ${table}`;

    // Agregar filtros
    if (filters && filters.length > 0) {
      const whereClauses = filters.map(f => {
        if (f.operator === 'IN') {
          const values = Array.isArray(f.value) ? f.value : [f.value];
          return `${f.field} IN (${values.map(v => `'${v}'`).join(',')})`;
        }
        return `${f.field} ${f.operator} '${f.value}'`;
      });
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    // Agregar GROUP BY
    if (groupBy && groupBy.length > 0) {
      sql += ` GROUP BY ${groupBy.join(', ')}`;
    }

    return this.query(sql);
  }

  /**
   * Consultas con time bucketing (agrupación por tiempo)
   */
  async timeSeries(
    table: string,
    timeField: string,
    interval: 'hour' | 'day' | 'week' | 'month',
    aggregations: Array<{ field: string; operation: string }>,
    startDate?: Date,
    endDate?: Date
  ): Promise<any[]> {
    const intervalFunctions = {
      hour: 'toStartOfHour',
      day: 'toStartOfDay',
      week: 'toStartOfWeek',
      month: 'toStartOfMonth'
    };

    const intervalFunc = intervalFunctions[interval];
    const aggClauses = aggregations.map(agg => 
      `${agg.operation.toUpperCase()}(${agg.field}) as ${agg.operation}_${agg.field}`
    );

    let sql = `
      SELECT 
        ${intervalFunc}(${timeField}) as time_bucket,
        ${aggClauses.join(',\n        ')}
      FROM ${table}
    `;

    const conditions: string[] = [];
    if (startDate) {
      conditions.push(`${timeField} >= '${startDate.toISOString()}'`);
    }
    if (endDate) {
      conditions.push(`${timeField} <= '${endDate.toISOString()}'`);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` GROUP BY time_bucket ORDER BY time_bucket DESC`;

    return this.query(sql);
  }

  /**
   * Top N queries (ej: top 10 productos más vendidos)
   */
  async topN(
    table: string,
    field: string,
    aggregation: string,
    limit: number = 10,
    filters?: Array<{ field: string; operator: string; value: any }>
  ): Promise<any[]> {
    let sql = `
      SELECT 
        ${field},
        ${aggregation.toUpperCase()}(*) as value
      FROM ${table}
    `;

    if (filters && filters.length > 0) {
      const whereClauses = filters.map(f => `${f.field} ${f.operator} '${f.value}'`);
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    sql += ` GROUP BY ${field} ORDER BY value DESC LIMIT ${limit}`;

    return this.query(sql);
  }

  /**
   * Calcula percentiles
   */
  async percentiles(
    table: string,
    field: string,
    percentiles: number[] = [0.50, 0.95, 0.99]
  ): Promise<any> {
    const quantileClauses = percentiles.map(p => 
      `quantile(${p})(${field}) as p${Math.round(p * 100)}`
    );

    const sql = `SELECT ${quantileClauses.join(', ')} FROM ${table}`;
    const results = await this.query(sql);

    return results[0] || {};
  }

  /**
   * Verifica si una tabla existe
   */
  async tableExists(tableName: string): Promise<boolean> {
    const sql = `
      SELECT count() as count 
      FROM system.tables 
      WHERE database = '${process.env.CLICKHOUSE_DATABASE || 'default'}' 
      AND name = '${tableName}'
    `;

    const results = await this.query<{ count: number }>(sql);
    return results[0]?.count > 0;
  }

  /**
   * Obtiene estadísticas de una tabla
   */
  async getTableStats(tableName: string): Promise<{
    rows: number;
    bytes: number;
    columns: number;
  }> {
    const sql = `
      SELECT 
        sum(rows) as rows,
        sum(bytes) as bytes
      FROM system.parts
      WHERE database = '${process.env.CLICKHOUSE_DATABASE || 'default'}'
      AND table = '${tableName}'
      AND active = 1
    `;

    const results = await this.query<{ rows: number; bytes: number }>(sql);
    const stats = results[0] || { rows: 0, bytes: 0 };

    // Obtener número de columnas
    const columnsSQL = `
      SELECT count() as columns
      FROM system.columns
      WHERE database = '${process.env.CLICKHOUSE_DATABASE || 'default'}'
      AND table = '${tableName}'
    `;

    const columnResults = await this.query<{ columns: number }>(columnsSQL);

    return {
      rows: stats.rows,
      bytes: stats.bytes,
      columns: columnResults[0]?.columns || 0
    };
  }
}
