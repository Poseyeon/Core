import { Module } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { AssetResolver } from './asset.resolver';
import { MongoModule } from '../mongo/mongo.module';
import { DatabaseModule } from '../../database/database.module';
import { AssetsController } from './assets.controller';

@Module({
  imports: [DatabaseModule, MongoModule],
  controllers: [AssetsController],
  providers: [AssetsService, AssetResolver],
  exports: [AssetsService],
})
export class AssetsModule {}
