import { describe, expect, it } from 'vitest';
import nodeXlsx from 'node-xlsx';
import {
  GuideAttachmentError,
  hasOfficeImageNode,
  isReliableOcrText,
  normalizeGuideAttachment,
  prepareGuideAttachment
} from '../src/modules/guide/guide-attachment';

function textDataUrl(mimeType: string, value: string) {
  return `data:${mimeType};base64,${Buffer.from(value).toString('base64')}`;
}

describe('guide attachment', () => {
  it('detects nested Office image nodes without reading image contents', () => {
    expect(
      hasOfficeImageNode([
        { type: 'paragraph', children: [{ type: 'text', text: '说明' }] },
        { type: 'paragraph', children: [{ type: 'image', metadata: { altText: '示意图' } }] }
      ])
    ).toBe(true);
    expect(hasOfficeImageNode([{ type: 'paragraph', children: [{ type: 'text' }] }])).toBe(false);
  });

  it('rejects high-confidence OCR fragments that are still unreadable noise', () => {
    expect(isReliableOcrText('BN ;; PF; _>; - 的 a4; AE; so.; |4; 2.', 86)).toBe(false);
  });

  it('accepts readable OCR text with sufficient confidence', () => {
    expect(isReliableOcrText('乌镇西栅景区\n水上集市 开放时间 09:00-22:00', 78)).toBe(true);
    expect(isReliableOcrText('乌镇西栅景区', 30)).toBe(false);
  });

  it('normalizes and extracts Markdown text', async () => {
    const attachment = normalizeGuideAttachment({
      name: 'trip.md',
      mimeType: 'text/markdown',
      kind: 'markdown',
      dataUrl: textDataUrl('text/markdown', '# 东京行程\n浅草寺与晴空塔')
    });

    expect(attachment).toMatchObject({ name: 'trip.md', kind: 'markdown' });
    await expect(prepareGuideAttachment(attachment!)).resolves.toMatchObject({
      extractedText: expect.stringContaining('浅草寺与晴空塔')
    });
  });

  it('preserves complete Markdown structure including hard line breaks and local image markers', async () => {
    const markdown = [
      '# 行程标题',
      '',
      '- **重点景点**',
      '- [官方链接](https://example.com)',
      '',
      '| 日期 | 地点 |',
      '| --- | --- |',
      '| D1 | 西湖 |',
      '',
      '```ts',
      'const days = 2;',
      '```',
      '',
      '---',
      '',
      '保留硬换行  ',
      '下一行',
      '',
      '![本地地图](./map.png)'
    ].join('\n');
    const attachment = normalizeGuideAttachment({
      name: 'structured.md',
      mimeType: 'text/markdown',
      kind: 'markdown',
      dataUrl: textDataUrl('text/markdown', markdown)
    });

    const prepared = await prepareGuideAttachment(attachment!);

    expect(prepared.extractedText).toBe(markdown);
  });

  it('decodes UTF-16LE Markdown without mojibake', async () => {
    const markdown = '# 中文标题\n\n- 乌镇\n- 西湖';
    const encoded = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(markdown, 'utf16le')]);
    const attachment = normalizeGuideAttachment({
      name: 'utf16.md',
      mimeType: 'text/markdown',
      kind: 'markdown',
      dataUrl: `data:text/markdown;base64,${encoded.toString('base64')}`
    });

    const prepared = await prepareGuideAttachment(attachment!);

    expect(prepared.extractedText).toBe(markdown);
    expect(prepared.extractedText).not.toContain('�');
  });

  it('extracts every Excel sheet as a Markdown table', async () => {
    const workbook = nodeXlsx.build([
      {
        name: '路线',
        data: [
          ['景点', '天数'],
          ['乌镇', 1],
          ['西湖', 2]
        ],
        options: {}
      },
      {
        name: '预算',
        data: [
          ['项目', '金额'],
          ['门票', 500]
        ],
        options: {}
      }
    ]);
    const attachment = normalizeGuideAttachment({
      name: 'plan.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      kind: 'spreadsheet',
      dataUrl: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${workbook.toString('base64')}`
    });

    const prepared = await prepareGuideAttachment(attachment!);

    expect(prepared.extractedText).toContain('## 工作表：路线');
    expect(prepared.extractedText).toContain('| 景点 | 天数 |');
    expect(prepared.extractedText).toContain('| 乌镇 | 1 |');
    expect(prepared.extractedText).toContain('## 工作表：预算');
    expect(prepared.extractedText).toContain('| 门票 | 500 |');
  });

  it('extracts CSV rows as readable attachment text', async () => {
    const attachment = normalizeGuideAttachment({
      name: 'budget.csv',
      mimeType: 'text/csv',
      kind: 'spreadsheet',
      dataUrl: textDataUrl('text/csv', '项目,预算\n门票,500\n住宿,1200')
    });

    const prepared = await prepareGuideAttachment(attachment!);
    expect(prepared.extractedText).toContain('门票');
    expect(prepared.extractedText).toContain('1200');
  });

  it('rejects unsupported executable attachments', () => {
    expect(() =>
      normalizeGuideAttachment({
        name: 'unsafe.exe',
        mimeType: 'application/octet-stream',
        kind: 'document',
        dataUrl: 'data:application/octet-stream;base64,aaaa'
      })
    ).toThrowError(GuideAttachmentError);

    try {
      normalizeGuideAttachment({
        name: 'unsafe.exe',
        mimeType: 'application/octet-stream',
        kind: 'document',
        dataUrl: 'data:application/octet-stream;base64,aaaa'
      });
    } catch (caught) {
      expect(caught).toMatchObject({ code: 'INVALID_ATTACHMENT' });
    }
  });
});
