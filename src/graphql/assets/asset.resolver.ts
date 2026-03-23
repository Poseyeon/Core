import { Args, Query, Resolver } from '@nestjs/graphql';
import { AssetsService } from './assets.service';

@Resolver()
export class AssetResolver {
  constructor(private readonly assetsService: AssetsService) {}

  @Query('asset')
  async asset(
    @Args('asset_id', { type: () => String }) asset_id: string,
  ): Promise<any | null> {
    return this.assetsService.getAsset(asset_id);
  }

  @Query('assets')
  async assets(
    @Args('comp_id', { type: () => Number }) comp_id: number,
  ): Promise<any[]> {
    return this.assetsService.getAssets(comp_id);
  }
}

