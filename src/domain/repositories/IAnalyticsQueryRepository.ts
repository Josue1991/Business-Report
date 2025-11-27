import { AnalyticsQuery } from '../entities/AnalyticsQuery';

export interface IAnalyticsQueryRepository {
  save(query: AnalyticsQuery): Promise<void>;
  findById(id: string): Promise<AnalyticsQuery | null>;
  findByUserId(userId: string): Promise<AnalyticsQuery[]>;
  findByName(name: string): Promise<AnalyticsQuery | null>;
  update(query: AnalyticsQuery): Promise<void>;
  delete(id: string): Promise<void>;
}
