import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AssetsService } from './assets.service';

class CreateAssetBodyDto {
  name!: string;
  type!: string;
  description?: string;
  classification?: string;
  location?: string;
  owner?: string;
  value?: string;
  status?: string;
  username!: string;
  companyId!: number;
}

class UpdateAssetBodyDto {
  name?: string;
  type?: string;
  description?: string;
  classification?: string;
  location?: string;
  owner?: string;
  value?: string;
  status?: string;
}

@ApiTags('Assets')
@Controller('api/assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new asset' })
  @ApiBody({ type: CreateAssetBodyDto })
  @ApiResponse({ status: 201, description: 'Asset created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  async createAsset(@Body() body: CreateAssetBodyDto) {
    if (!body.name || !body.type || !body.username || !body.companyId) {
      throw new BadRequestException(
        'Missing required fields: name, type, username, companyId',
      );
    }

    const result = await this.assetsService.createAsset(body);
    if (!result.success) {
      if (result.message.includes('User not found')) {
        throw new NotFoundException(result.message);
      }
      throw new BadRequestException(result.message);
    }
    return result;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get asset details by asset_id' })
  @ApiParam({ name: 'id', type: Number, description: 'Numeric asset id' })
  @ApiResponse({ status: 200, description: 'Asset details returned' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  async getAsset(@Param('id', ParseIntPipe) id: number) {
    const asset = await this.assetsService.getAsset(String(id));
    if (!asset?.mongo) {
      throw new NotFoundException('Asset not found');
    }
    return { success: true, asset: asset.mongo };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update asset details by asset_id' })
  @ApiParam({ name: 'id', type: Number, description: 'Numeric asset id' })
  @ApiBody({ type: UpdateAssetBodyDto })
  @ApiResponse({ status: 200, description: 'Asset updated successfully' })
  async updateAsset(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAssetBodyDto,
  ) {
    const result = await this.assetsService.updateAsset(String(id), body);
    if (!result.success) {
      if (result.message.includes('not found')) {
        throw new NotFoundException(result.message);
      }
      throw new BadRequestException(result.message);
    }
    return result;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an asset by asset_id' })
  @ApiParam({ name: 'id', type: Number, description: 'Numeric asset id' })
  @ApiResponse({ status: 200, description: 'Asset deleted successfully' })
  async deleteAsset(@Param('id', ParseIntPipe) id: number) {
    const result = await this.assetsService.deleteAsset(String(id));
    if (!result.success) {
      if (result.message.includes('not found')) {
        throw new NotFoundException(result.message);
      }
      throw new BadRequestException(result.message);
    }
    return result;
  }

  @Get('analytics/by-type')
  @ApiOperation({ summary: 'Assets grouped by type' })
  @ApiQuery({ name: 'companyId', type: Number, required: true })
  async byType(@Query('companyId', ParseIntPipe) companyId: number) {
    const data = await this.assetsService.assetsByType(companyId);
    return { success: true, data };
  }

  @Get('analytics/by-status')
  @ApiOperation({ summary: 'Assets grouped by status' })
  @ApiQuery({ name: 'companyId', type: Number, required: true })
  async byStatus(@Query('companyId', ParseIntPipe) companyId: number) {
    const data = await this.assetsService.assetsByStatus(companyId);
    return { success: true, data };
  }

  @Get('analytics/by-value')
  @ApiOperation({ summary: 'Assets grouped by value' })
  @ApiQuery({ name: 'companyId', type: Number, required: true })
  async byValue(@Query('companyId', ParseIntPipe) companyId: number) {
    const data = await this.assetsService.assetsByValue(companyId);
    return { success: true, data };
  }

  @Get('analytics/by-classification')
  @ApiOperation({ summary: 'Assets grouped by classification' })
  @ApiQuery({ name: 'companyId', type: Number, required: true })
  async byClassification(@Query('companyId', ParseIntPipe) companyId: number) {
    const data = await this.assetsService.assetsByClassification(companyId);
    return { success: true, data };
  }

  @Get('analytics/by-month')
  @ApiOperation({ summary: 'Assets created over time (monthly)' })
  @ApiQuery({ name: 'companyId', type: Number, required: true })
  async byMonth(@Query('companyId', ParseIntPipe) companyId: number) {
    const data = await this.assetsService.assetsByMonth(companyId);
    return { success: true, data };
  }

  @Get('analytics/summary')
  @ApiOperation({ summary: 'Overall summary statistics' })
  @ApiQuery({ name: 'companyId', type: Number, required: true })
  async summary(@Query('companyId', ParseIntPipe) companyId: number) {
    const data = await this.assetsService.assetsSummary(companyId);
    return { success: true, data };
  }
}

