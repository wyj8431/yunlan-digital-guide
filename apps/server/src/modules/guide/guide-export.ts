// 将导游回答导出为文本、Markdown、Word 或 Excel 文件。
import nodeXlsx from 'node-xlsx';
import { OfficeParser } from 'officeparser';

export type GuideExportFormat = 'txt' | 'word' | 'markdown' | 'excel';

export type GuideExportFile = {
  buffer: Buffer;
  contentType: string;
  extension: 'txt' | 'rtf' | 'md' | 'xlsx';
  filename: string;
};

export class GuideExportError extends Error {
  constructor(
    public readonly code: 'INVALID_EXPORT' | 'EXPORT_TOO_LARGE' | 'EXPORT_FAILED',
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

const MAX_EXPORT_CONTENT_LENGTH = 200_000;
const EXPORT_FORMATS = new Set<GuideExportFormat>(['txt', 'word', 'markdown', 'excel']);

function normalizeExportInput(input: { content?: unknown; format?: unknown; title?: unknown }): {
  content: string;
  format: GuideExportFormat;
  title: string;
} {
  const content = typeof input.content === 'string' ? input.content.trim() : '';
  const format = typeof input.format === 'string' ? input.format : '';
  const rawTitle = typeof input.title === 'string' ? input.title.trim() : '';

  if (!content || !EXPORT_FORMATS.has(format as GuideExportFormat)) {
    throw new GuideExportError('INVALID_EXPORT', '请选择有效的回答内容和导出格式。');
  }

  if (content.length > MAX_EXPORT_CONTENT_LENGTH) {
    throw new GuideExportError(
      'EXPORT_TOO_LARGE',
      '回答内容过长，请缩短到 20 万字以内再导出。',
      413
    );
  }

  const title = Array.from(rawTitle || '数字导游回答', (character) =>
    character.charCodeAt(0) <= 0x1f || '<>:"/\\|?*'.includes(character) ? '-' : character
  )
    .join('')
    .replace(/[. ]+$/g, '')
    .slice(0, 80);

  return { content, format: format as GuideExportFormat, title: title || '数字导游回答' };
}

function utf8File(value: string): Buffer {
  return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(value, 'utf8')]);
}

function splitMarkdownRow(line: string): string[] {
  let value = line.trim();
  if (value.startsWith('|')) {
    value = value.slice(1);
  }
  if (value.endsWith('|') && !value.endsWith('\\|')) {
    value = value.slice(0, -1);
  }

  const cells: string[] = [];
  let cell = '';
  let escaped = false;
  for (const character of value) {
    if (escaped) {
      cell += character;
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if (character === '|') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function isMarkdownTableRow(line: string): boolean {
  return /^\s*\|?.+\|.+\|?\s*$/.test(line);
}

function isMarkdownSeparator(line: string): boolean {
  const cells = splitMarkdownRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function safeSpreadsheetCell(value: string): string {
  const normalized = value.replace(/<br\s*\/?>/gi, '\n').trim();
  return /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
}

function uniqueSheetName(title: string, usedNames: Set<string>): string {
  const base =
    title
      .replace(/[\\/?*[\]:]/g, '-')
      .trim()
      .slice(0, 31) || '回答数据';
  let candidate = base;
  let suffix = 2;

  while (usedNames.has(candidate)) {
    const label = `-${suffix}`;
    candidate = `${base.slice(0, 31 - label.length)}${label}`;
    suffix += 1;
  }
  usedNames.add(candidate);
  return candidate;
}

function extractMarkdownTables(content: string) {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const usedNames = new Set<string>();
  const sheets: Array<{ name: string; data: string[][]; options: Record<string, never> }> = [];
  let latestHeading = '';

  for (let index = 0; index < lines.length; index += 1) {
    const heading = /^#{1,6}\s+(.+)$/.exec(lines[index].trim());
    if (heading) {
      latestHeading = heading[1].replace(/[*_`]/g, '').trim();
      continue;
    }

    if (
      !isMarkdownTableRow(lines[index]) ||
      index + 1 >= lines.length ||
      !isMarkdownSeparator(lines[index + 1])
    ) {
      continue;
    }

    const rows = [splitMarkdownRow(lines[index]).map(safeSpreadsheetCell)];
    index += 2;
    while (index < lines.length && isMarkdownTableRow(lines[index])) {
      rows.push(splitMarkdownRow(lines[index]).map(safeSpreadsheetCell));
      index += 1;
    }
    index -= 1;

    sheets.push({
      name: uniqueSheetName(latestHeading || `表格${sheets.length + 1}`, usedNames),
      data: rows,
      options: {}
    });
  }

  if (sheets.length > 0) {
    return sheets;
  }

  const rows = content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => [safeSpreadsheetCell(line)]);

  return [
    {
      name: '回答内容',
      data: [['内容'], ...rows],
      options: {}
    }
  ];
}

async function createWordRtf(content: string): Promise<Buffer> {
  const ast = await OfficeParser.parseOffice(new Uint8Array(Buffer.from(content, 'utf8')), {
    fileType: 'md',
    extractAttachments: false,
    includeRawContent: false
  });
  const result = await ast.to('rtf', { includeImages: false });
  if (typeof result.value !== 'string' || !result.value.startsWith('{\\rtf1')) {
    throw new Error('RTF generator returned invalid content');
  }
  return Buffer.from(result.value, 'utf8');
}

export async function createGuideExport(input: {
  content?: unknown;
  format?: unknown;
  title?: unknown;
}): Promise<GuideExportFile> {
  const { content, format, title } = normalizeExportInput(input);

  try {
    if (format === 'txt') {
      return {
        buffer: utf8File(content),
        contentType: 'text/plain; charset=utf-8',
        extension: 'txt',
        filename: `${title}.txt`
      };
    }

    if (format === 'markdown') {
      return {
        buffer: utf8File(content),
        contentType: 'text/markdown; charset=utf-8',
        extension: 'md',
        filename: `${title}.md`
      };
    }

    if (format === 'word') {
      return {
        buffer: await createWordRtf(content),
        contentType: 'application/rtf',
        extension: 'rtf',
        filename: `${title}.rtf`
      };
    }

    return {
      buffer: nodeXlsx.build(extractMarkdownTables(content)),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
      filename: `${title}.xlsx`
    };
  } catch (caught) {
    if (caught instanceof GuideExportError) {
      throw caught;
    }
    throw new GuideExportError('EXPORT_FAILED', '文件生成失败，请稍后重试。', 500);
  }
}
