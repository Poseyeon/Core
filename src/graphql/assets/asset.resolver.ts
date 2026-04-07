import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
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
    @Args('comp_id', { type: () => Int }) comp_id: number,
  ): Promise<any[]> {
    return this.assetsService.getAssets(comp_id);
  }

  @Mutation('createAsset')
  async createAsset(@Args('input') input: any): Promise<any> {
    return this.assetsService.createAsset(input);
  }

  @Mutation('updateAsset')
  async updateAsset(
    @Args('asset_id', { type: () => String }) asset_id: string,
    @Args('input') input: any,
  ): Promise<any> {
    return this.assetsService.updateAsset(asset_id, input);
  }

  @Mutation('deleteAsset')
  async deleteAsset(
    @Args('asset_id', { type: () => String }) asset_id: string,
  ): Promise<any> {
    return this.assetsService.deleteAsset(asset_id);
  }

  @Query('assetsByType')
  async assetsByType(
    @Args('companyId', { type: () => Int }) companyId: number,
  ): Promise<any[]> {
    return this.assetsService.assetsByType(companyId);
  }

  @Query('assetsByStatus')
  async assetsByStatus(
    @Args('companyId', { type: () => Int }) companyId: number,
  ): Promise<any[]> {
    return this.assetsService.assetsByStatus(companyId);
  }

  @Query('assetsByValue')
  async assetsByValue(
    @Args('companyId', { type: () => Int }) companyId: number,
  ): Promise<any[]> {
    return this.assetsService.assetsByValue(companyId);
  }

  @Query('assetsByClassification')
  async assetsByClassification(
    @Args('companyId', { type: () => Int }) companyId: number,
  ): Promise<any[]> {
    return this.assetsService.assetsByClassification(companyId);
  }

  @Query('assetsByMonth')
  async assetsByMonth(
    @Args('companyId', { type: () => Int }) companyId: number,
  ): Promise<any[]> {
    return this.assetsService.assetsByMonth(companyId);
  }

  @Query('assetsSummary')
  async assetsSummary(
    @Args('companyId', { type: () => Int }) companyId: number,
  ): Promise<any> {
    return this.assetsService.assetsSummary(companyId);
  }
}
