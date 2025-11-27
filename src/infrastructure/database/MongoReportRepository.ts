import { MongoClient, Db, Collection } from 'mongodb';
import { Report, ReportStatus, ReportType, ReportFormat } from '@domain/entities/Report';
import { IReportRepository, ReportFilters } from '@domain/repositories/IReportRepository';

export class MongoReportRepository implements IReportRepository {
  private client: MongoClient;
  private db: Db | null = null;
  private collection: Collection<any> | null = null;

  constructor() {
    this.client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  }

  async connect(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db(process.env.MONGODB_DB_NAME || 'business_report');
    this.collection = this.db.collection('reports');

    // Crear índices
    await this.createIndexes();
  }

  private async createIndexes(): Promise<void> {
    if (!this.collection) return;

    await this.collection.createIndex({ userId: 1 });
    await this.collection.createIndex({ status: 1 });
    await this.collection.createIndex({ createdAt: -1 });
    await this.collection.createIndex({ expiresAt: 1 });
    await this.collection.createIndex({ userId: 1, status: 1 });
  }

  async save(report: Report): Promise<void> {
    if (!this.collection) throw new Error('Database not connected');

    await this.collection.insertOne({
      _id: report.id,
      ...report.toJSON()
    });
  }

  async findById(id: string): Promise<Report | null> {
    if (!this.collection) throw new Error('Database not connected');

    const doc = await this.collection.findOne({ _id: id });
    
    if (!doc) return null;

    return this.docToReport(doc);
  }

  async findByUserId(userId: string, filters?: ReportFilters): Promise<Report[]> {
    if (!this.collection) throw new Error('Database not connected');

    const query: any = { userId };

    if (filters) {
      if (filters.type) query.type = filters.type;
      if (filters.status) query.status = filters.status;
      if (filters.format) query.format = filters.format;
      if (filters.startDate) {
        query.createdAt = { ...query.createdAt, $gte: filters.startDate };
      }
      if (filters.endDate) {
        query.createdAt = { ...query.createdAt, $lte: filters.endDate };
      }
    }

    const docs = await this.collection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return docs.map(doc => this.docToReport(doc));
  }

  async update(report: Report): Promise<void> {
    if (!this.collection) throw new Error('Database not connected');

    await this.collection.updateOne(
      { _id: report.id },
      { $set: report.toJSON() }
    );
  }

  async delete(id: string): Promise<void> {
    if (!this.collection) throw new Error('Database not connected');

    await this.collection.deleteOne({ _id: id });
  }

  async deleteExpired(): Promise<number> {
    if (!this.collection) throw new Error('Database not connected');

    const result = await this.collection.deleteMany({
      expiresAt: { $lte: new Date() }
    });

    return result.deletedCount;
  }

  async findPendingReports(): Promise<Report[]> {
    if (!this.collection) throw new Error('Database not connected');

    const docs = await this.collection
      .find({ status: ReportStatus.PENDING })
      .sort({ createdAt: 1 })
      .toArray();

    return docs.map(doc => this.docToReport(doc));
  }

  async countByUser(userId: string): Promise<number> {
    if (!this.collection) throw new Error('Database not connected');

    return this.collection.countDocuments({ userId });
  }

  async getStorageUsage(userId: string): Promise<number> {
    if (!this.collection) throw new Error('Database not connected');

    const result = await this.collection.aggregate([
      { $match: { userId, fileSize: { $exists: true } } },
      { $group: { _id: null, total: { $sum: '$fileSize' } } }
    ]).toArray();

    return result[0]?.total || 0;
  }

  private docToReport(doc: any): Report {
    return new Report(
      doc._id,
      doc.userId,
      doc.type as ReportType,
      doc.format as ReportFormat,
      doc.metadata,
      doc.status as ReportStatus,
      doc.filePath,
      doc.fileSize,
      doc.downloadUrl,
      doc.error,
      new Date(doc.createdAt),
      doc.completedAt ? new Date(doc.completedAt) : undefined,
      doc.expiresAt ? new Date(doc.expiresAt) : undefined,
      doc.emailTo,
      doc.downloadCount,
      doc.aiAnalysisEnabled,
      doc.processingTime
    );
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }
}
