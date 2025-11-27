export interface DataSource {
  type: 'mongodb' | 'clickhouse' | 'timescale' | 'api' | 'file';
  collection?: string;
  table?: string;
  endpoint?: string;
  query?: string;
  filePath?: string;
}

export interface Aggregation {
  field: string;
  operation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'stddev' | 'median' | 'percentile';
  alias?: string;
  percentile?: number;
}

export interface GroupBy {
  field: string;
  interval?: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
}

export interface Filter {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'IN' | 'LIKE' | 'BETWEEN';
  value: any;
}

export class AnalyticsQuery {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    public readonly dataSource: DataSource,
    public readonly filters: Filter[],
    public readonly aggregations: Aggregation[],
    public readonly groupBy?: GroupBy[],
    public readonly orderBy?: { field: string; direction: 'asc' | 'desc' }[],
    public readonly limit?: number,
    public readonly offset?: number,
    public readonly enableML: boolean = false,
    public readonly mlTasks?: string[],
    public readonly nlQuery?: string,
    public readonly createdAt: Date = new Date()
  ) {}

  toSQL(): string {
    let sql = 'SELECT ';
    
    if (this.aggregations.length > 0) {
      sql += this.aggregations
        .map(agg => {
          const alias = agg.alias || `${agg.operation}_${agg.field}`;
          return `${agg.operation}(${agg.field}) as ${alias}`;
        })
        .join(', ');
    } else {
      sql += '*';
    }
    
    sql += ` FROM ${this.dataSource.table}`;
    
    if (this.filters.length > 0) {
      const whereConditions = this.filters
        .map(f => {
          if (f.operator === 'IN') {
            return `${f.field} IN (${Array.isArray(f.value) ? f.value.map(v => `'${v}'`).join(',') : f.value})`;
          } else if (f.operator === 'BETWEEN') {
            return `${f.field} BETWEEN ${f.value[0]} AND ${f.value[1]}`;
          } else if (f.operator === 'LIKE') {
            return `${f.field} LIKE '%${f.value}%'`;
          }
          return `${f.field} ${f.operator} '${f.value}'`;
        })
        .join(' AND ');
      sql += ` WHERE ${whereConditions}`;
    }
    
    if (this.groupBy && this.groupBy.length > 0) {
      sql += ` GROUP BY ${this.groupBy.map(g => g.field).join(', ')}`;
    }
    
    if (this.orderBy && this.orderBy.length > 0) {
      sql += ` ORDER BY ${this.orderBy
        .map(o => `${o.field} ${o.direction.toUpperCase()}`)
        .join(', ')}`;
    }
    
    if (this.limit) {
      sql += ` LIMIT ${this.limit}`;
    }
    
    if (this.offset) {
      sql += ` OFFSET ${this.offset}`;
    }
    
    return sql;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      dataSource: this.dataSource,
      filters: this.filters,
      aggregations: this.aggregations,
      groupBy: this.groupBy,
      orderBy: this.orderBy,
      limit: this.limit,
      offset: this.offset,
      enableML: this.enableML,
      mlTasks: this.mlTasks,
      nlQuery: this.nlQuery,
      createdAt: this.createdAt
    };
  }
}
