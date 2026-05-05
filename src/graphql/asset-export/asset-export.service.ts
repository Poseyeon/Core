import { Injectable, Logger } from '@nestjs/common';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  VerticalAlign,
} from 'docx';
import { AssetsService } from '../assets/assets.service';
import { Inject } from '@nestjs/common';
import { DB_CONNECTION } from '../../database/constants';
import type { Pool } from 'mysql2/promise';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const COLORS = {
  primary:    '1A3C5E', // Deep navy
  accent:     '2E86C1', // Steel blue
  light:      'EAF2F8', // Very light blue
  headerText: 'FFFFFF', // White
  bodyText:   '2C3E50', // Dark slate
  muted:      '7F8C8D', // Grey
  border:     'D5D8DC', // Light grey
  white:      'FFFFFF',
};

const FONT  = 'Calibri';
const TABLE_WIDTH_DXA = 9360; // US Letter - 1" margins each side
const COL1  = 2808; // ~30%
const COL2  = 6552; // ~70%

// ─── Helper: thin border ──────────────────────────────────────────────────────
const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: COLORS.border };
const noBorder   = { style: BorderStyle.NIL,    size: 0, color: COLORS.white  };
const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
const noBorders  = { top: noBorder,   bottom: noBorder,   left: noBorder,   right: noBorder   };

// ─── Helper: table row ────────────────────────────────────────────────────────
function assetRow(label: string, value: string, shade: boolean): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width:   { size: COL1, type: WidthType.DXA },
        borders: allBorders,
        margins: { top: 80, bottom: 80, left: 160, right: 120 },
        shading: { fill: COLORS.light, type: ShadingType.CLEAR },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: label, bold: true, size: 20, font: FONT, color: COLORS.bodyText }),
            ],
          }),
        ],
      }),
      new TableCell({
        width:   { size: COL2, type: WidthType.DXA },
        borders: allBorders,
        margins: { top: 80, bottom: 80, left: 160, right: 120 },
        shading: { fill: shade ? 'F4F6F7' : COLORS.white, type: ShadingType.CLEAR },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: value || 'N/A', size: 20, font: FONT, color: COLORS.bodyText }),
            ],
          }),
        ],
      }),
    ],
  });
}

// ─── Helper: table header row ─────────────────────────────────────────────────
function tableHeaderRow(): TableRow {
  const cell = (text: string, w: number) =>
    new TableCell({
      width:   { size: w, type: WidthType.DXA },
      borders: allBorders,
      margins: { top: 100, bottom: 100, left: 160, right: 120 },
      shading: { fill: COLORS.primary, type: ShadingType.CLEAR },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          children: [
            new TextRun({ text, bold: true, size: 20, font: FONT, color: COLORS.headerText }),
          ],
        }),
      ],
    });

  return new TableRow({ children: [cell('Field', COL1), cell('Value', COL2)] });
}

@Injectable()
export class AssetExportService {
  private readonly logger = new Logger(AssetExportService.name);

  constructor(
    private readonly assetsService: AssetsService,
    @Inject(DB_CONNECTION) private readonly mysqlPool: Pool,
  ) {}

  async downloadAssetsAsDocx(comp_id: number): Promise<Buffer> {
    const assets      = await this.assetsService.getAssets(comp_id);
    const companyName = await this.getCompanyName(comp_id);
    const today       = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    // ── Per-asset sections ────────────────────────────────────────────────────
    const assetChildren = assets.flatMap((asset) => {
      const d = asset.mongo || {};
      const rows: [string, string][] = [
        ['ID',             String(asset.asset_id)],
        ['Type',           d.type           || 'N/A'],
        ['Description',    d.description    || 'N/A'],
        ['Classification', d.classification || 'N/A'],
        ['Location',       d.location       || 'N/A'],
        ['Owner',          d.owner          || 'N/A'],
        ['Status',         d.status         || 'N/A'],
      ];

      return [
        // Asset name heading
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 440, after: 160 },
          children: [
            new TextRun({ text: d.name || `Asset ${asset.asset_id}`, font: FONT }),
          ],
        }),
        // Data table
        new Table({
          width:        { size: TABLE_WIDTH_DXA, type: WidthType.DXA },
          columnWidths: [COL1, COL2],
          rows: [
            tableHeaderRow(),
            ...rows.map(([label, value], i) => assetRow(label, value, i % 2 === 0)),
          ],
        }),
      ];
    });

    const doc = new Document({
      // ── Global styles ───────────────────────────────────────────────────────
      styles: {
        default: {
          document: { run: { font: FONT, size: 22, color: COLORS.bodyText } },
        },
        paragraphStyles: [
          {
            id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
            run: { size: 40, bold: true, font: FONT, color: COLORS.primary },
            paragraph: {
              spacing:      { before: 0, after: 200 },
              outlineLevel: 0,
              border:       { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.accent, space: 1 } },
            },
          },
          {
            id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
            run: { size: 28, bold: true, font: FONT, color: COLORS.accent },
            paragraph: { spacing: { before: 0, after: 120 }, outlineLevel: 1 },
          },
        ],
      },

      sections: [
        {
          properties: {
            page: {
              size:   { width: 12240, height: 15840 },
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
            },
          },

          // ── Header ─────────────────────────────────────────────────────────
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.accent, space: 1 } },
                  spacing: { after: 0 },
                  children: [
                    new TextRun({ text: `${companyName}  ·  Asset Report`, font: FONT, size: 18, color: COLORS.muted }),
                  ],
                }),
              ],
            }),
          },

          // ── Footer ─────────────────────────────────────────────────────────
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  border: { top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border, space: 1 } },
                  spacing: { before: 80 },
                  children: [
                    new TextRun({ text: 'Page ', font: FONT, size: 16, color: COLORS.muted }),
                    new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: COLORS.muted }),
                    new TextRun({ text: ' of ', font: FONT, size: 16, color: COLORS.muted }),
                    new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: COLORS.muted }),
                    new TextRun({ text: `   ·   Generated ${today}`, font: FONT, size: 16, color: COLORS.muted }),
                  ],
                }),
              ],
            }),
          },

          children: [
            // ── Cover block ──────────────────────────────────────────────────
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [new TextRun({ text: 'Asset Report', font: FONT })],
            }),
            new Paragraph({
              spacing: { after: 80 },
              children: [
                new TextRun({ text: 'Company:  ', bold: true, font: FONT, size: 22 }),
                new TextRun({ text: companyName, font: FONT, size: 22 }),
              ],
            }),
            new Paragraph({
              spacing: { after: 80 },
              children: [
                new TextRun({ text: 'Date:       ', bold: true, font: FONT, size: 22 }),
                new TextRun({ text: today, font: FONT, size: 22 }),
              ],
            }),
            new Paragraph({
              spacing: { after: 400 },
              children: [
                new TextRun({ text: 'Total Assets:  ', bold: true, font: FONT, size: 22 }),
                new TextRun({ text: String(assets.length), font: FONT, size: 22, color: COLORS.accent }),
              ],
            }),

            // ── Asset tables ─────────────────────────────────────────────────
            ...assetChildren,
          ],
        },
      ],
    });

    return Packer.toBuffer(doc);
  }

  private async getCompanyName(comp_id: number): Promise<string> {
    const [rows] = await this.mysqlPool.query(
      'SELECT COMP_NAME FROM COMPANY WHERE COMP_ID = ?',
      [comp_id],
    );
    if (Array.isArray(rows) && rows.length > 0) {
      return (rows[0] as any).COMP_NAME;
    }
    return `Company ${comp_id}`;
  }
}