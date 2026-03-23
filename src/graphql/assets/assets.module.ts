import { Module } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { AssetResolver } from './asset.resolver';
import { MongoModule } from '../mongo/mongo.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule, MongoModule],
  providers: [AssetsService, AssetResolver],
})
export class AssetsModule {}

