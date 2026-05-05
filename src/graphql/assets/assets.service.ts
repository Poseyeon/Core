import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Pool } from 'mysql2/promise';
import { createClient, type RedisClientType } from 'redis';
import { DB_CONNECTION } from '../../database/constants';
import { MongoService } from '../mongo/mongo.service';

@Injectable()
export class AssetsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AssetsService.name);
  private redisClient: RedisClientType | null = null;
  private redisEnabled = false;
  private readonly cacheTtl = 3600;
  private readonly cacheTtlAggregations = 300;
  private readonly cacheKeyPrefix = 'asset:';
  private readonly cacheKeyPrefixAgg = 'agg:';

  constructor(
    @Inject(DB_CONNECTION) private readonly mysqlPool: Pool,
    private readonly mongoService: MongoService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') ||
      `redis://${this.configService.get<string>('REDIS_HOST', 'localhost')}:${this.configService.get<number>('REDIS_PORT', 6379)}`;
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    try {
      this.redisClient = createClient({
        url: redisUrl,
        password: redisPassword || undefined,
        socket: {
          reconnectStrategy: (retries: number) => {
            if (retries > 10) {
              this.logger.warn(
                '[REDIS] Max reconnect attempts reached. Disabling cache.',
              );
              this.redisEnabled = false;
              return new Error('Redis reconnect limit reached');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      this.redisClient.on('error', (err) => {
        this.logger.error('[REDIS] Client error', err as Error);
        this.redisEnabled = false;
      });
      this.redisClient.on('ready', () => {
        this.logger.log('[REDIS] Ready');
        this.redisEnabled = true;
      });

      await this.redisClient.connect();
      this.redisEnabled = true;
      this.logger.log('[REDIS] Connected');
    } catch (err) {
      this.redisEnabled = false;
      this.logger.warn('[REDIS] Connection failed. Continuing without cache.');
      this.logger.debug(err);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }

  private formatMysqlRow(row: any): any {
    return {
      asset_id: row.ASSET_ID,
      user_cr_id: row.USER_CR_ID,
      comp_id: row.COMP_ID,
      last_upd: row.LAST_UPD,
    };
  }

  private async getMySQLAsset(asset_id: string): Promise<any | null> {
    const [rows] = await this.mysqlPool.query(
      'SELECT * FROM ASSET_MGMT WHERE ASSET_ID = ?',
      [asset_id],
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return null;
    }

    return this.formatMysqlRow(rows[0]);
  }

  private async getMongoAsset(asset_id: string): Promise<any | null> {
    const parsedAssetId = Number.parseInt(asset_id, 10);
    if (Number.isNaN(parsedAssetId)) {
      return null;
    }

    return this.mongoService
      .getDb()
      .collection('assets')
      .findOne({ asset_id: parsedAssetId });
  }

  private async getCachedAsset(assetId: number): Promise<any | null> {
    if (!this.redisEnabled || !this.redisClient) {
      return null;
    }
    try {
      const cacheKey = `${this.cacheKeyPrefix}${assetId}`;
      const cached = await this.redisClient.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (err) {
      this.logger.error('[CACHE] Error reading asset cache', err as Error);
      return null;
    }
  }

  private async setCachedAsset(assetId: number, assetData: any): Promise<void> {
    if (!this.redisEnabled || !this.redisClient) {
      return;
    }
    try {
      const cacheKey = `${this.cacheKeyPrefix}${assetId}`;
      await this.redisClient.setEx(
        cacheKey,
        this.cacheTtl,
        JSON.stringify(assetData),
      );
    } catch (err) {
      this.logger.error('[CACHE] Error writing asset cache', err as Error);
    }
  }

  private async invalidateAssetCache(assetId: number): Promise<void> {
    if (!this.redisEnabled || !this.redisClient) {
      return;
    }
    try {
      const cacheKey = `${this.cacheKeyPrefix}${assetId}`;
      await this.redisClient.del(cacheKey);
    } catch (err) {
      this.logger.error('[CACHE] Error invalidating asset cache', err as Error);
    }
  }

  private async getCachedAggregation(
    aggType: string,
    companyId: number,
  ): Promise<any | null> {
    if (!this.redisEnabled || !this.redisClient) {
      return null;
    }
    try {
      const cacheKey = `${this.cacheKeyPrefixAgg}${aggType}:${companyId}`;
      const cached = await this.redisClient.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (err) {
      this.logger.error(
        '[CACHE] Error reading aggregation cache',
        err as Error,
      );
      return null;
    }
  }

  private async setCachedAggregation(
    aggType: string,
    companyId: number,
    data: any,
  ): Promise<void> {
    if (!this.redisEnabled || !this.redisClient) {
      return;
    }
    try {
      const cacheKey = `${this.cacheKeyPrefixAgg}${aggType}:${companyId}`;
      await this.redisClient.setEx(
        cacheKey,
        this.cacheTtlAggregations,
        JSON.stringify(data),
      );
    } catch (err) {
      this.logger.error(
        '[CACHE] Error writing aggregation cache',
        err as Error,
      );
    }
  }

  private async invalidateAllAggregations(companyId: number): Promise<void> {
    if (!this.redisEnabled || !this.redisClient) {
      return;
    }
    try {
      const keys = await this.redisClient.keys(
        `${this.cacheKeyPrefixAgg}*:${companyId}`,
      );
      if (keys.length > 0) {
        await this.redisClient.del(keys);
      }
    } catch (err) {
      this.logger.error(
        '[CACHE] Error invalidating aggregation cache',
        err as Error,
      );
    }
  }

  private async getCompanyAssetIds(companyId: number): Promise<number[]> {
    const [rows] = await this.mysqlPool.query(
      'SELECT ASSET_ID FROM ASSET_MGMT WHERE COMP_ID = ?',
      [companyId],
    );
    if (!Array.isArray(rows)) {
      return [];
    }
    return rows.map((row: any) => row.ASSET_ID);
  }

  private normalizeBucket(
    input: any,
    keyField: string,
  ): { key: string; count: number } {
    return {
      key: input?.[keyField] ?? null,
      count: input?.count ?? 0,
    };
  }

  async getAsset(asset_id: string): Promise<any | null> {
    this.logger.debug(`[QUERY] asset(${asset_id})`);

    const parsedAssetId = Number.parseInt(asset_id, 10);
    if (Number.isNaN(parsedAssetId)) {
      return null;
    }

    const mysqlData = await this.getMySQLAsset(asset_id);
    if (!mysqlData) {
      return null;
    }

    let mongoData = await this.getCachedAsset(parsedAssetId);
    if (!mongoData) {
      mongoData = await this.getMongoAsset(asset_id);
      if (mongoData) {
        await this.setCachedAsset(parsedAssetId, mongoData);
      }
    }

    return {
      asset_id,
      mysql: mysqlData,
      mongo: mongoData,
    };
  }

  async getAssets(comp_id: number): Promise<any[]> {
    this.logger.debug(`[QUERY] assets(comp_id=${comp_id})`);

    const [rows] = await this.mysqlPool.query(
      'SELECT * FROM ASSET_MGMT WHERE COMP_ID = ?',
      [comp_id],
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return [];
    }

    return Promise.all(
      rows.map(async (row: any) => {
        const mongoData = await this.getMongoAsset(String(row.ASSET_ID));
        return {
          asset_id: row.ASSET_ID,
          mysql: this.formatMysqlRow(row),
          mongo: mongoData,
        };
      }),
    );
  }

  async createAsset(
    input: any,
  ): Promise<{ success: boolean; message: string; assetId: number | null }> {
    const {
      name,
      type,
      description,
      classification,
      location,
      owner,
      value,
      status,
      username,
      companyId,
    } = input;

    let sqlConnection: any;
    try {
      sqlConnection = await this.mysqlPool.getConnection();
      const [users] = await sqlConnection.query(
        'SELECT USER_ID FROM USERS WHERE USER_ABBR = ? AND COMP_ID = ?',
        [username, companyId],
      );

      if (!Array.isArray(users) || users.length === 0) {
        return {
          success: false,
          message: 'User not found for the given company.',
          assetId: null,
        };
      }

      const userId = users[0].USER_ID as number;
      await sqlConnection.beginTransaction();

      const [sqlResult] = await sqlConnection.query(
        'INSERT INTO ASSET_MGMT (USER_CR_ID, COMP_ID) VALUES (?, ?)',
        [userId, companyId],
      );

      const assetId = sqlResult.insertId as number;
      const now = new Date();
      const assetDetails: any = {
        asset_id: assetId,
        name,
        type,
        status: status || 'active',
        risks: [],
        controls: [],
        created_at: now,
        updated_at: now,
      };

      if (description) assetDetails.description = description;
      if (classification) assetDetails.classification = classification;
      if (location) assetDetails.location = location;
      if (owner) assetDetails.owner = owner;
      if (value) assetDetails.value = value;

      await this.mongoService
        .getDb()
        .collection('assets')
        .insertOne(assetDetails);
      await sqlConnection.commit();

      await this.setCachedAsset(assetId, assetDetails);
      await this.invalidateAllAggregations(companyId);

      return { success: true, message: 'Asset created successfully', assetId };
    } catch (err) {
      if (sqlConnection) {
        await sqlConnection.rollback();
      }
      this.logger.error('Asset creation error', err as Error);
      return {
        success: false,
        message: 'Server error while creating asset',
        assetId: null,
      };
    } finally {
      if (sqlConnection) {
        sqlConnection.release();
      }
    }
  }

  async updateAsset(
    asset_id: string,
    input: any,
  ): Promise<{ success: boolean; message: string }> {
    const parsedAssetId = Number.parseInt(asset_id, 10);
    if (Number.isNaN(parsedAssetId)) {
      return { success: false, message: 'Invalid asset id' };
    }

    const updateFields: any = {};
    const allowedFields = [
      'name',
      'type',
      'description',
      'classification',
      'location',
      'owner',
      'value',
      'status',
    ];
    for (const field of allowedFields) {
      if (input[field] !== undefined) {
        updateFields[field] = input[field];
      }
    }
    updateFields.updated_at = new Date();

    const result = await this.mongoService
      .getDb()
      .collection('assets')
      .updateOne({ asset_id: parsedAssetId }, { $set: updateFields });

    if (result.matchedCount === 0) {
      return { success: false, message: 'Asset not found' };
    }

    await this.invalidateAssetCache(parsedAssetId);
    const [rows] = await this.mysqlPool.query(
      'SELECT COMP_ID FROM ASSET_MGMT WHERE ASSET_ID = ?',
      [parsedAssetId],
    );
    const typedRows = rows as any[];
    if (typedRows.length > 0) {
      await this.invalidateAllAggregations(typedRows[0].COMP_ID);
    }

    return { success: true, message: 'Asset updated successfully' };
  }

  async deleteAsset(
    asset_id: string,
  ): Promise<{ success: boolean; message: string }> {
    const parsedAssetId = Number.parseInt(asset_id, 10);
    if (Number.isNaN(parsedAssetId)) {
      return { success: false, message: 'Invalid asset id' };
    }

    let sqlConnection: any;
    try {
      sqlConnection = await this.mysqlPool.getConnection();
      const [companyRows] = await sqlConnection.query(
        'SELECT COMP_ID FROM ASSET_MGMT WHERE ASSET_ID = ?',
        [parsedAssetId],
      );
      const companyIdForCache =
        Array.isArray(companyRows) && companyRows.length > 0
          ? companyRows[0].COMP_ID
          : null;

      await sqlConnection.beginTransaction();
      const [sqlResult] = await sqlConnection.query(
        'DELETE FROM ASSET_MGMT WHERE ASSET_ID = ?',
        [parsedAssetId],
      );
      if (!sqlResult.affectedRows) {
        await sqlConnection.rollback();
        return { success: false, message: 'Asset not found in MySQL' };
      }

      const mongoResult = await this.mongoService
        .getDb()
        .collection('assets')
        .deleteOne({ asset_id: parsedAssetId });
      if (!mongoResult.deletedCount) {
        await sqlConnection.rollback();
        return { success: false, message: 'Asset not found in MongoDB' };
      }

      await sqlConnection.commit();
      await this.invalidateAssetCache(parsedAssetId);
      if (companyIdForCache) {
        await this.invalidateAllAggregations(companyIdForCache);
      }

      return { success: true, message: 'Asset deleted successfully' };
    } catch (err) {
      if (sqlConnection) {
        await sqlConnection.rollback();
      }
      this.logger.error('Error deleting asset', err as Error);
      return { success: false, message: 'Server error while deleting asset' };
    } finally {
      if (sqlConnection) {
        sqlConnection.release();
      }
    }
  }

  async assetsByType(
    companyId: number,
  ): Promise<Array<{ key: string; count: number }>> {
    const assetIds = await this.getCompanyAssetIds(companyId);
    if (assetIds.length === 0) {
      return [];
    }

    let result = await this.getCachedAggregation('by-type', companyId);
    if (!result) {
      result = await this.mongoService
        .getDb()
        .collection('assets')
        .aggregate([
          { $match: { asset_id: { $in: assetIds } } },
          { $group: { _id: '$type', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $project: { _id: 0, type: '$_id', count: 1 } },
        ])
        .toArray();
      await this.setCachedAggregation('by-type', companyId, result);
    }

    return result.map((item: any) => this.normalizeBucket(item, 'type'));
  }

  async assetsByStatus(
    companyId: number,
  ): Promise<Array<{ key: string; count: number }>> {
    const assetIds = await this.getCompanyAssetIds(companyId);
    if (assetIds.length === 0) {
      return [];
    }

    let result = await this.getCachedAggregation('by-status', companyId);
    if (!result) {
      result = await this.mongoService
        .getDb()
        .collection('assets')
        .aggregate([
          { $match: { asset_id: { $in: assetIds } } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $project: { _id: 0, status: '$_id', count: 1 } },
        ])
        .toArray();
      await this.setCachedAggregation('by-status', companyId, result);
    }

    return result.map((item: any) => this.normalizeBucket(item, 'status'));
  }

  async assetsByValue(
    companyId: number,
  ): Promise<Array<{ key: string; count: number }>> {
    const assetIds = await this.getCompanyAssetIds(companyId);
    if (assetIds.length === 0) {
      return [];
    }

    let result = await this.getCachedAggregation('by-value', companyId);
    if (!result) {
      result = await this.mongoService
        .getDb()
        .collection('assets')
        .aggregate([
          { $match: { asset_id: { $in: assetIds } } },
          { $group: { _id: '$value', count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, value: '$_id', count: 1 } },
        ])
        .toArray();
      await this.setCachedAggregation('by-value', companyId, result);
    }

    return result.map((item: any) => this.normalizeBucket(item, 'value'));
  }

  async assetsByClassification(
    companyId: number,
  ): Promise<Array<{ key: string; count: number }>> {
    const assetIds = await this.getCompanyAssetIds(companyId);
    if (assetIds.length === 0) {
      return [];
    }

    let result = await this.getCachedAggregation(
      'by-classification',
      companyId,
    );
    if (!result) {
      result = await this.mongoService
        .getDb()
        .collection('assets')
        .aggregate([
          { $match: { asset_id: { $in: assetIds } } },
          { $group: { _id: '$classification', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $project: { _id: 0, classification: '$_id', count: 1 } },
        ])
        .toArray();
      await this.setCachedAggregation('by-classification', companyId, result);
    }

    return result.map((item: any) =>
      this.normalizeBucket(item, 'classification'),
    );
  }

  async assetsByMonth(companyId: number): Promise<
    Array<{
      year: number;
      month: number;
      monthName: string;
      label: string;
      count: number;
    }>
  > {
    const assetIds = await this.getCompanyAssetIds(companyId);
    if (assetIds.length === 0) {
      return [];
    }

    let result = await this.getCachedAggregation('by-month', companyId);
    if (!result) {
      result = await this.mongoService
        .getDb()
        .collection('assets')
        .aggregate([
          {
            $match: {
              asset_id: { $in: assetIds },
              created_at: { $exists: true },
            },
          },
          {
            $group: {
              _id: {
                year: { $year: '$created_at' },
                month: { $month: '$created_at' },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.year': 1, '_id.month': 1 } },
          {
            $project: {
              _id: 0,
              year: '$_id.year',
              month: '$_id.month',
              monthName: {
                $arrayElemAt: [
                  [
                    'Jan',
                    'Feb',
                    'Mar',
                    'Apr',
                    'May',
                    'Jun',
                    'Jul',
                    'Aug',
                    'Sep',
                    'Oct',
                    'Nov',
                    'Dec',
                  ],
                  { $subtract: ['$_id.month', 1] },
                ],
              },
              label: {
                $concat: [
                  {
                    $arrayElemAt: [
                      [
                        'Jan',
                        'Feb',
                        'Mar',
                        'Apr',
                        'May',
                        'Jun',
                        'Jul',
                        'Aug',
                        'Sep',
                        'Oct',
                        'Nov',
                        'Dec',
                      ],
                      { $subtract: ['$_id.month', 1] },
                    ],
                  },
                  ' ',
                  { $toString: '$_id.year' },
                ],
              },
              count: 1,
            },
          },
        ])
        .toArray();
      await this.setCachedAggregation('by-month', companyId, result);
    }

    return result;
  }

  async assetsSummary(companyId: number): Promise<{
    totalAssets: number;
    highValueAssets: number;
    byType: Array<{ key: string; count: number }>;
    byStatus: Array<{ key: string; count: number }>;
    byValue: Array<{ key: string; count: number }>;
  }> {
    const assetIds = await this.getCompanyAssetIds(companyId);
    if (assetIds.length === 0) {
      return {
        totalAssets: 0,
        highValueAssets: 0,
        byType: [],
        byStatus: [],
        byValue: [],
      };
    }

    let result = await this.getCachedAggregation('summary', companyId);
    if (!result) {
      const aggregationResult = await this.mongoService
        .getDb()
        .collection('assets')
        .aggregate([
          { $match: { asset_id: { $in: assetIds } } },
          {
            $facet: {
              totalAssets: [{ $count: 'count' }],
              byType: [
                { $group: { _id: '$type', count: { $sum: 1 } } },
                { $project: { _id: 0, type: '$_id', count: 1 } },
              ],
              byStatus: [
                { $group: { _id: '$status', count: { $sum: 1 } } },
                { $project: { _id: 0, status: '$_id', count: 1 } },
              ],
              byValue: [
                { $group: { _id: '$value', count: { $sum: 1 } } },
                { $project: { _id: 0, value: '$_id', count: 1 } },
              ],
              highValueAssets: [
                { $match: { value: { $in: ['high', 'critical'] } } },
                { $count: 'count' },
              ],
            },
          },
        ])
        .toArray();
      const facetData = aggregationResult[0] ?? {};
      result = {
        totalAssets: facetData.totalAssets?.[0]?.count || 0,
        highValueAssets: facetData.highValueAssets?.[0]?.count || 0,
        byType: (facetData.byType || []).map((item: any) =>
          this.normalizeBucket(item, 'type'),
        ),
        byStatus: (facetData.byStatus || []).map((item: any) =>
          this.normalizeBucket(item, 'status'),
        ),
        byValue: (facetData.byValue || []).map((item: any) =>
          this.normalizeBucket(item, 'value'),
        ),
      };
      await this.setCachedAggregation('summary', companyId, result);
    }

    return result;
  }
}
