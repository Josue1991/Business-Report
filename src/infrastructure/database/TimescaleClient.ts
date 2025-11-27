import { Client, QueryResult } from 'pg';
import { AnalyticsQuery } from '@domain/entities/AnalyticsQuery';

export class TimescaleClient {
  private client: Client;
  private isConnected: boolean = false;

  constructor() {
    this.client = new Client({
      host: process.env.TIMESCALE_HOST || 'localhost',
      port: parseInt(process.env.TIMESCALE_PORT || '5432'),
      user: process.env.TIMESCALE_USER || 'postgres',
      password: process.env.TIMESCALE_PASSWORD || 'password',
      database: process.env.TIMESCALE_DATABASE || 'tsdb',
      connectionTimeoutMillis: 5000
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.isConnected = true;
      console.log('✓ Conectado a TimescaleDB');
    } catch (error) {
      console.error('Error conectando a TimescaleDB:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.end();
    this.isConnected = false;
  }

  /**
   * Ejecuta una query SQL
   */
  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const result: QueryResult<T> = await this.client.query(sql, params);
      return result.rows;
    } catch (error: any) {
      console.error('Error ejecutando query TimescaleDB:', error);
      throw new Error(`TimescaleDB query error: ${error.message}`);
    }
  }

  /**
   * Ejecuta una AnalyticsQuery
   */
  async executeAnalyticsQuery(analyticsQuery: AnalyticsQuery): Promise<any[]> {
    const sql = this.convertToPostgresSQL(analyticsQuery.toSQL());
    return this.query(sql);
  }

  /**
   * Time bucketing con time_bucket
   */
  async timeBucket(
    table: string,
    timeColumn: string,
    interval: string,
    aggregations: Array<{ field: string; operation: string }>,
    filters?: string,
    groupBy?: string[]
  ): Promise<any[]> {
    const aggClauses = aggregations.map(agg => 
      `${agg.operation.toUpperCase()}(${agg.field}) as ${agg.operation}_${agg.field}`
    );

    let sql = `
      SELECT 
        time_bucket('${interval}', ${timeColumn}) as bucket,
        ${aggClauses.join(',\n        ')}
    `;

    if (groupBy && groupBy.length > 0) {
      sql += `,\n        ${groupBy.join(', ')}`;
    }

    sql += `\n      FROM ${table}`;

    if (filters) {
      sql += `\n      WHERE ${filters}`;
    }

    sql += `\n      GROUP BY bucket`;

    if (groupBy && groupBy.length > 0) {
      sql += `, ${groupBy.join(', ')}`;
    }

    sql += `\n      ORDER BY bucket DESC`;

    return this.query(sql);
  }

  /**
   * Time bucket con interpolación (llenar gaps)
   */
  async timeBucketGapFill(
    table: string,
    timeColumn: string,
    interval: string,
    field: string,
    operation: string = 'AVG',
    startTime: Date,
    endTime: Date
  ): Promise<any[]> {
    const sql = `
      SELECT 
        time_bucket_gapfill('${interval}', ${timeColumn}) as bucket,
        locf(${operation}(${field})) as value
      FROM ${table}
      WHERE ${timeColumn} >= $1 AND ${timeColumn} <= $2
      GROUP BY bucket
      ORDER BY bucket
    `;

    return this.query(sql, [startTime, endTime]);
  }

  /**
   * Continuous aggregates (vistas materializadas)
   */
  async createContinuousAggregate(
    viewName: string,
    table: string,
    timeColumn: string,
    interval: string,
    aggregations: Array<{ field: string; operation: string }>,
    groupBy?: string[]
  ): Promise<void> {
    const aggClauses = aggregations.map(agg => 
      `${agg.operation.toUpperCase()}(${agg.field}) as ${agg.operation}_${agg.field}`
    );

    let sql = `
      CREATE MATERIALIZED VIEW ${viewName}
      WITH (timescaledb.continuous) AS
      SELECT 
        time_bucket('${interval}', ${timeColumn}) as bucket,
        ${aggClauses.join(',\n        ')}
    `;

    if (groupBy && groupBy.length > 0) {
      sql += `,\n        ${groupBy.join(', ')}`;
    }

    sql += `\n      FROM ${table}`;
    sql += `\n      GROUP BY bucket`;

    if (groupBy && groupBy.length > 0) {
      sql += `, ${groupBy.join(', ')}`;
    }

    await this.query(sql);

    // Añadir política de refresh
    await this.addRefreshPolicy(viewName, interval);
  }

  /**
   * Añade política de refresh automático
   */
  async addRefreshPolicy(
    viewName: string,
    interval: string
  ): Promise<void> {
    const sql = `
      SELECT add_continuous_aggregate_policy('${viewName}',
        start_offset => INTERVAL '${interval}' * 20,
        end_offset => INTERVAL '${interval}',
        schedule_interval => INTERVAL '${interval}'
      )
    `;

    await this.query(sql);
  }

  /**
   * Comprime chunks antiguos
   */
  async compressChunks(
    hypertable: string,
    olderThan: string
  ): Promise<void> {
    const sql = `
      SELECT compress_chunk(i)
      FROM show_chunks('${hypertable}', older_than => INTERVAL '${olderThan}') i
    `;

    await this.query(sql);
  }

  /**
   * Series temporales con ventana deslizante
   */
  async rollingWindow(
    table: string,
    timeColumn: string,
    field: string,
    windowSize: string,
    operation: string = 'AVG'
  ): Promise<any[]> {
    const sql = `
      SELECT 
        ${timeColumn} as time,
        ${field},
        ${operation}(${field}) OVER (
          ORDER BY ${timeColumn}
          RANGE BETWEEN INTERVAL '${windowSize}' PRECEDING AND CURRENT ROW
        ) as rolling_${operation.toLowerCase()}
      FROM ${table}
      ORDER BY ${timeColumn}
    `;

    return this.query(sql);
  }

  /**
   * Detecta gaps en series temporales
   */
  async detectGaps(
    table: string,
    timeColumn: string,
    expectedInterval: string
  ): Promise<Array<{ gap_start: Date; gap_end: Date; duration: string }>> {
    const sql = `
      WITH time_diffs AS (
        SELECT 
          ${timeColumn} as current_time,
          LAG(${timeColumn}) OVER (ORDER BY ${timeColumn}) as prev_time,
          ${timeColumn} - LAG(${timeColumn}) OVER (ORDER BY ${timeColumn}) as diff
        FROM ${table}
      )
      SELECT 
        prev_time as gap_start,
        current_time as gap_end,
        diff as duration
      FROM time_diffs
      WHERE diff > INTERVAL '${expectedInterval}' * 1.5
      ORDER BY gap_start
    `;

    return this.query(sql);
  }

  /**
   * Downsampling (reducción de resolución)
   */
  async downsample(
    sourceTable: string,
    targetTable: string,
    timeColumn: string,
    interval: string,
    aggregations: Array<{ field: string; operation: string }>
  ): Promise<void> {
    const aggClauses = aggregations.map(agg => 
      `${agg.operation.toUpperCase()}(${agg.field}) as ${agg.field}`
    );

    const sql = `
      INSERT INTO ${targetTable}
      SELECT 
        time_bucket('${interval}', ${timeColumn}) as time,
        ${aggClauses.join(',\n        ')}
      FROM ${sourceTable}
      GROUP BY time
      ON CONFLICT (time) DO UPDATE SET
        ${aggregations.map(agg => `${agg.field} = EXCLUDED.${agg.field}`).join(', ')}
    `;

    await this.query(sql);
  }

  /**
   * Estadísticas de hypertable
   */
  async getHypertableStats(tableName: string): Promise<{
    totalChunks: number;
    compressedChunks: number;
    uncompressedSize: string;
    compressedSize: string;
  }> {
    const sql = `
      SELECT 
        COUNT(*) as total_chunks,
        COUNT(*) FILTER (WHERE is_compressed) as compressed_chunks,
        pg_size_pretty(SUM(before_compression_total_bytes)) as uncompressed_size,
        pg_size_pretty(SUM(after_compression_total_bytes)) as compressed_size
      FROM chunk_compression_stats('${tableName}')
    `;

    const results = await this.query<{
      total_chunks: number;
      compressed_chunks: number;
      uncompressed_size: string;
      compressed_size: string;
    }>(sql);

    return results[0] || {
      totalChunks: 0,
      compressedChunks: 0,
      uncompressedSize: '0 bytes',
      compressedSize: '0 bytes'
    };
  }

  /**
   * Crea hypertable
   */
  async createHypertable(
    tableName: string,
    timeColumn: string,
    chunkTimeInterval: string = '1 day'
  ): Promise<void> {
    const sql = `
      SELECT create_hypertable('${tableName}', '${timeColumn}', 
        chunk_time_interval => INTERVAL '${chunkTimeInterval}',
        if_not_exists => TRUE
      )
    `;

    await this.query(sql);
  }

  /**
   * Añade política de compresión
   */
  async addCompressionPolicy(
    hypertable: string,
    compressAfter: string
  ): Promise<void> {
    // Habilitar compresión
    await this.query(`ALTER TABLE ${hypertable} SET (timescaledb.compress)`);

    // Añadir política
    const sql = `
      SELECT add_compression_policy('${hypertable}', 
        INTERVAL '${compressAfter}'
      )
    `;

    await this.query(sql);
  }

  /**
   * Convierte SQL genérico a PostgreSQL/TimescaleDB
   */
  private convertToPostgresSQL(sql: string): string {
    // Convertir funciones de ClickHouse a PostgreSQL
    return sql
      .replace(/toStartOfHour\(/g, 'date_trunc(\'hour\', ')
      .replace(/toStartOfDay\(/g, 'date_trunc(\'day\', ')
      .replace(/toStartOfWeek\(/g, 'date_trunc(\'week\', ')
      .replace(/toStartOfMonth\(/g, 'date_trunc(\'month\', ')
      .replace(/quantile\(/g, 'percentile_cont(') // Aproximación
      .replace(/LIMIT (\d+) OFFSET (\d+)/g, 'OFFSET $2 LIMIT $1');
  }
}
