import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool } from 'mysql2/promise';
import { DB_CONNECTION } from '../../database/constants';
import { MongoService } from '../mongo/mongo.service';

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly mysqlPool: Pool,
    private readonly mongoService: MongoService,
  ) {}

  private formatMysqlRow(row: any) {
    return {
      asset_id: row.ASSET_ID,
      user_cr_id: row.USER_CR_ID,
      comp_id: row.COMP_ID,
      last_upd: row.LAST_UPD,
    };
  }

  private async getMySQLAsset(asset_id: string): Promise<any | null> {
    const [rows] = await this.mysqlPool.query('SELECT * FROM ASSET_MGMT WHERE ASSET_ID = ?', [asset_id]);

    if (!Array.isArray(rows) || rows.length === 0) {
      return null;
    }

    // MySQL returns rows as plain objects with column names (often uppercased).
    return this.formatMysqlRow(rows[0]);
  }

  private async getMongoAsset(asset_id: string): Promise<any | null> {
    const parsedAssetId = Number.parseInt(asset_id, 10);
    if (Number.isNaN(parsedAssetId)) {
      return null;
    }

    return this.mongoService.getDb().collection('assets').findOne({ asset_id: parsedAssetId });
  }

  async getAsset(asset_id: string): Promise<any | null> {
    this.logger.debug(`[QUERY] asset(${asset_id})`);

    const mysqlData = await this.getMySQLAsset(asset_id);
    if (!mysqlData) {
      return null;
    }

    const mongoData = await this.getMongoAsset(asset_id);
    return {
      asset_id,
      mysql: mysqlData,
      mongo: mongoData,
    };
  }

  async getAssets(comp_id: number): Promise<any[]> {
    this.logger.debug(`[QUERY] assets(comp_id=${comp_id})`);

    const [rows] = await this.mysqlPool.query('SELECT * FROM ASSET_MGMT WHERE COMP_ID = ?', [comp_id]);
    if (!Array.isArray(rows) || rows.length === 0) {
      return [];
    }

    // Enrich each MySQL asset with its Mongo document (if present).
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
}

