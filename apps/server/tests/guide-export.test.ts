import { describe, expect, it } from 'vitest';
import nodeXlsx from 'node-xlsx';
import { createGuideExport, GuideExportError } from '../src/modules/guide/guide-export';

describe('guide answer export', () => {
  it('preserves the complete answer in Markdown exports', async () => {
    const content = '# 行程\n\n- 西湖\n- 灵隐寺\n\n| 天数 | 预算 |\n| --- | --- |\n| 2 | 800 |';

    const exported = await createGuideExport({ content, format: 'markdown', title: '杭州行程' });

    expect(exported.extension).toBe('md');
    expect(exported.contentType).toContain('text/markdown');
    expect(exported.buffer.subarray(3).toString('utf8')).toBe(content);
  });

  it('creates a valid RTF document that Word can open', async () => {
    const exported = await createGuideExport({
      content: '# 杭州行程\n\n- 西湖\n- 灵隐寺',
      format: 'word',
      title: '杭州行程'
    });

    expect(exported.extension).toBe('rtf');
    expect(exported.contentType).toBe('application/rtf');
    expect(exported.buffer.toString('utf8')).toMatch(/^\{\\rtf1/);
  });

  it('creates a real multi-sheet workbook from Markdown tables and blocks formulas', async () => {
    const exported = await createGuideExport({
      content: [
        '## 路线',
        '',
        '| 景点 | 天数 |',
        '| --- | --- |',
        '| 乌镇 | 1 |',
        '',
        '## 预算',
        '',
        '| 项目 | 金额 |',
        '| --- | --- |',
        '| 住宿 | =1+1 |'
      ].join('\n'),
      format: 'excel',
      title: '旅行方案'
    });
    const workbook = nodeXlsx.parse(exported.buffer);

    expect(exported.extension).toBe('xlsx');
    expect(exported.contentType).toContain('spreadsheetml.sheet');
    expect(workbook.map((sheet) => sheet.name)).toEqual(['路线', '预算']);
    expect(workbook[0].data).toEqual([
      ['景点', '天数'],
      ['乌镇', '1']
    ]);
    expect(workbook[1].data[1]).toEqual(['住宿', "'=1+1"]);
  });

  it('rejects unsupported formats and oversized content', async () => {
    await expect(
      createGuideExport({ content: '内容', format: 'pdf' as 'txt', title: '回答' })
    ).rejects.toBeInstanceOf(GuideExportError);
    await expect(
      createGuideExport({ content: 'a'.repeat(200_001), format: 'txt', title: '回答' })
    ).rejects.toMatchObject({ code: 'EXPORT_TOO_LARGE' });
  });
});
