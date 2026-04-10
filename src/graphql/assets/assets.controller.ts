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
  ApiProperty,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AssetsService } from './assets.service';

class CreateAssetBodyDto {
  @ApiProperty({ example: 'CRM Database' })
  name!: string;
  @ApiProperty({ example: 'database' })
  type!: string;
  @ApiProperty({ required: false, example: 'Stores customer records' })
  description?: string;
  @ApiProperty({ required: false, example: 'confidential' })
  classification?: string;
  @ApiProperty({ required: false, example: 'eu-central-1' })
  location?: string;
  @ApiProperty({ required: false, example: 'IT Security' })
  owner?: string;
  @ApiProperty({ required: false, example: 'high' })
  value?: string;
  @ApiProperty({ required: false, example: 'active' })
  status?: string;
  @ApiProperty({ example: 'NSCHMID' })
  username!: string;
  @ApiProperty({ example: 7 })
  companyId!: number;
}

class UpdateAssetBodyDto {
  @ApiProperty({ required: false, example: 'CRM Database v2' })
  name?: string;
  @ApiProperty({ required: false, example: 'database' })
  type?: string;
  @ApiProperty({ required: false, example: 'Updated description' })
  description?: string;
  @ApiProperty({ required: false, example: 'strictly-confidential' })
  classification?: string;
  @ApiProperty({ required: false, example: 'eu-west-1' })
  location?: string;
  @ApiProperty({ required: false, example: 'Security Team' })
  owner?: string;
  @ApiProperty({ required: false, example: 'critical' })
  value?: string;
  @ApiProperty({ required: false, example: 'inactive' })
  status?: string;
}

class AssetListQueryDto {
  @ApiProperty({
    example: 7,
    description: 'Company identifier used to filter all returned assets',
  })
  companyId!: number;
}

@ApiTags('Assets')
@Controller('api/assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all assets for a company',
    description:
      'Returns all assets associated with the provided companyId. If companyId is missing, the API responds with 400.',
  })
  @ApiQuery({
    name: 'companyId',
    required: true,
    type: Number,
    example: 7,
    description: 'Company ID used to filter assets',
  })
  @ApiResponse({
    status: 200,
    description: 'Filtered assets returned successfully',
    schema: {
      example: [
        {
          asset_id: 123,
          mysql: {
            asset_id: 123,
            user_cr_id: 11,
            comp_id: 7,
            last_upd: null,
          },
          mongo: {
            asset_id: 123,
            name: 'CRM Database',
            type: 'database',
            classification: 'confidential',
            value: 'high',
            status: 'active',
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Missing or invalid companyId',
    schema: {
      example: {
        statusCode: 400,
        message: 'Missing or invalid companyId query parameter',
        error: 'Bad Request',
      },
    },
  })
  async getAssetsByCompany(@Query() query: AssetListQueryDto) {
    const parsedCompanyId = Number.parseInt(String(query.companyId), 10);
    if (!Number.isInteger(parsedCompanyId)) {
      throw new BadRequestException('Missing or invalid companyId query parameter');
    }

    return this.assetsService.getAssets(parsedCompanyId);
  }

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

