import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { AssetExportService } from './asset-export.service';

@Resolver()
export class AssetExportResolver {
  constructor(private readonly assetExportService: AssetExportService) {}

  @Query('downloadAssets')
  async downloadAssets(
    @Args('comp_id', { type: () => Int }) comp_id: number,
  ): Promise<string> {
    const buffer = await this.assetExportService.downloadAssetsAsDocx(comp_id);
    return buffer.toString('base64');
  }
}
