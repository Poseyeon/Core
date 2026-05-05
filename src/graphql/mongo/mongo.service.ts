import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Db, MongoClient } from 'mongodb';

@Injectable()
export class MongoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MongoService.name);

  private client: MongoClient | null = null;
  private db: Db | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const connectionString = this.configService.get<string>(
      'MONGO_CONNECTION_STRING',
    );
    const initDbName = this.configService.get<string>('MONGO_INITDB_DATABASE');

    if (!connectionString) {
      throw new Error('Missing env var: MONGO_CONNECTION_STRING');
    }
    if (!initDbName) {
      throw new Error('Missing env var: MONGO_INITDB_DATABASE');
    }

    const masked = connectionString.replace(/\/\/.*:.*@/, '//***:***@');
    this.logger.log(`[INIT] Connecting to MongoDB: ${masked}`);

    this.client = new MongoClient(connectionString);
    await this.client.connect();
    this.db = this.client.db(initDbName);

    this.logger.log(`[INIT] MongoDB connected. Database: ${initDbName}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.logger.log('[SHUTDOWN] MongoDB connection closed');
    }
  }

  getDb(): Db {
    if (!this.db) {
      throw new Error('MongoDB not initialized yet');
    }
    return this.db;
  }
}
