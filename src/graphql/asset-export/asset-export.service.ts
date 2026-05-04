import { Injectable, Logger } from '@nestjs/common';
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { AssetsService } from '../assets/assets.service';
import { Inject } from '@nestjs/common';
import { DB_CONNECTION } from '../../database/constants';
import type { Pool } from 'mysql2/promise';

@Injectable()
export class AssetExportService {
  private readonly logger = new Logger(AssetExportService.name);

  constructor(
    private readonly assetsService: AssetsService,
    @Inject(DB_CONNECTION) private readonly mysqlPool: Pool,
  ) {}

  async downloadAssetsAsDocx(comp_id: number): Promise<Buffer> {
    const assets = await this.assetsService.getAssets(comp_id);
    const companyName = await this.getCompanyName(comp_id);

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: `Asset Report - ${companyName}`,
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({
              text: `Total Assets: ${assets.length}`,
              spacing: { after: 200 },
            }),
            ...assets.flatMap((asset) => {
              const details = asset.mongo || {};
              return [
                new Paragraph({
                  text: details.name || `Asset ${asset.asset_id}`,
                  heading: HeadingLevel.HEADING_2,
                  spacing: { before: 400 },
                }),
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: [
                    new TableRow({
                      children: [
                        new TableCell({
                          children: [
                            new Paragraph({
                              children: [new TextRun({ text: 'Field', bold: true })],
                            }),
                          ],
                        }),
                        new TableCell({
                          children: [
                            new Paragraph({
                              children: [new TextRun({ text: 'Value', bold: true })],
                            }),
                          ],
                        }),
                      ],
                    }),
                    new TableRow({
                      children: [
                        new TableCell({ children: [new Paragraph('ID')] }),
                        new TableCell({ children: [new Paragraph(String(asset.asset_id))] }),
                      ],
                    }),
                    new TableRow({
                      children: [
                        new TableCell({ children: [new Paragraph('Type')] }),
                        new TableCell({ children: [new Paragraph(details.type || 'N/A')] }),
                      ],
                    }),
                    new TableRow({
                      children: [
                        new TableCell({ children: [new Paragraph('Description')] }),
                        new TableCell({ children: [new Paragraph(details.description || 'N/A')] }),
                      ],
                    }),
                    new TableRow({
                      children: [
                        new TableCell({ children: [new Paragraph('Classification')] }),
                        new TableCell({ children: [new Paragraph(details.classification || 'N/A')] }),
                      ],
                    }),
                    new TableRow({
                      children: [
                        new TableCell({ children: [new Paragraph('Location')] }),
                        new TableCell({ children: [new Paragraph(details.location || 'N/A')] }),
                      ],
                    }),
                    new TableRow({
                      children: [
                        new TableCell({ children: [new Paragraph('Owner')] }),
                        new TableCell({ children: [new Paragraph(details.owner || 'N/A')] }),
                      ],
                    }),
                    new TableRow({
                      children: [
                        new TableCell({ children: [new Paragraph('Status')] }),
                        new TableCell({ children: [new Paragraph(details.status || 'N/A')] }),
                      ],
                    }),
                  ],
                }),
                new Paragraph({
                  text: 'Risks',
                  heading: HeadingLevel.HEADING_3,
                  spacing: { before: 200 },
                }),
                ...(details.risks && details.risks.length > 0
                  ? details.risks.map(
                      (risk: any) =>
                        new Paragraph({
                          text: `• ${risk.description} (Impact: ${risk.impact}, Prob: ${risk.probability})`,
                          bullet: { level: 0 },
                        }),
                    )
                  : [
                      new Paragraph({
                        children: [
                          new TextRun({ text: 'No risks identified.', italics: true }),
                        ],
                      }),
                    ]),
                new Paragraph({
                  text: 'Controls',
                  heading: HeadingLevel.HEADING_3,
                  spacing: { before: 200 },
                }),
                ...(details.controls && details.controls.length > 0
                  ? details.controls.map(
                      (control: any) =>
                        new Paragraph({
                          text: `• ${control.description}`,
                          bullet: { level: 0 },
                        }),
                    )
                  : [
                      new Paragraph({
                        children: [
                          new TextRun({ text: 'No controls defined.', italics: true }),
                        ],
                      }),
                    ]),
              ];
            }),
          ],
        },
      ],
    });

    return Packer.toBuffer(doc);
  }

  private async getCompanyName(comp_id: number): Promise<string> {
    const [rows] = await this.mysqlPool.query('SELECT COMP_NAME FROM COMPANY WHERE COMP_ID = ?', [
      comp_id,
    ]);
    if (Array.isArray(rows) && rows.length > 0) {
      return (rows[0] as any).COMP_NAME;
    }
    return `Company ${comp_id}`;
  }
}
