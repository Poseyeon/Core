import { Controller, Get, Param, ParseIntPipe, Res } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AssetExportService } from './asset-export.service';

@ApiTags('Asset Export')
@Controller('api/assets/export')
export class AssetExportController {
  constructor(private readonly assetExportService: AssetExportService) {}

  @Get('docx/:companyId')
  @ApiOperation({ summary: 'Download all assets for a company as a Word file' })
  @ApiParam({
    name: 'companyId',
    type: Number,
    description: 'Numeric company id',
  })
  @ApiResponse({
    status: 200,
    description: 'Word file downloaded successfully',
  })
  async downloadAssets(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Res() res: Response,
  ) {
    const buffer =
      await this.assetExportService.downloadAssetsAsDocx(companyId);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename=assets_company_${companyId}.docx`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}
