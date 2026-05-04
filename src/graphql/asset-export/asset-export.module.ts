import { Module } from '@nestjs/common';
import { AssetExportService } from './asset-export.service';
import { AssetExportController } from './asset-export.controller';
import { AssetExportResolver } from './asset-export.resolver';
import { AssetsModule } from '../assets/assets.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule, AssetsModule],
  controllers: [AssetExportController],
  providers: [AssetExportService, AssetExportResolver],
})
export class AssetExportModule {}
