import nodeXlsx from 'node-xlsx';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { OfficeParser, type SupportedFileType } from 'officeparser';
import PptToText from 'ppt-to-text';
import sharp from 'sharp';
import Tesseract from 'tesseract.js';
import WordExtractor from 'word-extractor';

// 附件模块统一完成格式校验、文本提取、OCR 和供模型使用的内容裁剪。

export type GuideAttachmentKind =
  'image' | 'document' | 'spreadsheet' | 'presentation' | 'markdown';

export type GuideAttachment = {
  name: string;
  mimeType: string;
  kind: GuideAttachmentKind;
  dataUrl: string;
  sizeBytes?: number;
};

export type PreparedGuideAttachment = GuideAttachment & {
  extractedText?: string;
};

type AttachmentRule = {
  kind: GuideAttachmentKind;
  mimeTypes: string[];
};

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_EXTRACTED_TEXT_LENGTH = 200_000;
const DATA_URL_PATTERN = /^data:([^;,]*);base64,([a-z0-9+/=\r\n]+)$/i;
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);
const ATTACHMENT_RULES: Record<string, AttachmentRule> = {
  png: { kind: 'image', mimeTypes: ['image/png'] },
  jpg: { kind: 'image', mimeTypes: ['image/jpeg', 'image/jpg'] },
  jpeg: { kind: 'image', mimeTypes: ['image/jpeg', 'image/jpg'] },
  webp: { kind: 'image', mimeTypes: ['image/webp'] },
  doc: { kind: 'document', mimeTypes: ['application/msword'] },
  docx: {
    kind: 'document',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  },
  ppt: { kind: 'presentation', mimeTypes: ['application/vnd.ms-powerpoint'] },
  pptx: {
    kind: 'presentation',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation']
  },
  xls: { kind: 'spreadsheet', mimeTypes: ['application/vnd.ms-excel'] },
  xlsx: {
    kind: 'spreadsheet',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
  },
  csv: { kind: 'spreadsheet', mimeTypes: ['text/csv', 'application/csv'] },
  md: { kind: 'markdown', mimeTypes: ['text/markdown', 'text/x-markdown', 'text/plain'] }
};

export class GuideAttachmentError extends Error {
  constructor(
    public readonly code: 'INVALID_ATTACHMENT' | 'ATTACHMENT_TOO_LARGE' | 'ATTACHMENT_PARSE_FAILED',
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

function extensionOf(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function decodeDataUrl(dataUrl: string): { buffer: Buffer; declaredMimeType: string } {
  // 严格解析 data URL，避免把任意字符串当作二进制附件处理。
  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) {
    throw new GuideAttachmentError('INVALID_ATTACHMENT', '附件内容无效，请重新选择文件。');
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new GuideAttachmentError(
      'ATTACHMENT_TOO_LARGE',
      '附件太大，请压缩到 10MB 以内再发送。',
      413
    );
  }

  return { buffer, declaredMimeType: match[1].trim().toLowerCase() };
}

function normalizeText(value: string, preserveFormatting = false): string {
  if (preserveFormatting) {
    return value
      .replace(/^\uFEFF/, '')
      .split('\u0000')
      .join('')
      .replace(/\r\n?/g, '\n')
      .slice(0, MAX_EXTRACTED_TEXT_LENGTH);
  }

  const normalized = value
    .replace(/^\uFEFF/, '')
    .split('\u0000')
    .join('')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();

  return normalized.slice(0, MAX_EXTRACTED_TEXT_LENGTH);
}

function decodeTextBuffer(buffer: Buffer): string {
  // 兼容带 BOM 的 UTF 文本，并在常见编码之间选择可读结果。
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString('utf16le');
  }

  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buffer.subarray(2));
  }

  const utf8Buffer =
    buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf
      ? buffer.subarray(3)
      : buffer;

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(utf8Buffer);
  } catch {
    return new TextDecoder('gb18030').decode(buffer);
  }
}

export function isReliableOcrText(value: string, confidence: number): boolean {
  // OCR 结果同时满足置信度和有效字符比例后才用于回答。
  const text = normalizeText(value);
  if (!text || !Number.isFinite(confidence) || confidence < 55) {
    return false;
  }

  const compact = text.replace(/\s/g, '');
  const signalCharacters = compact.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
  const hasReadableSequence = /[\u4e00-\u9fff]{2,}|[a-z]{3,}/i.test(text);

  return hasReadableSequence && signalCharacters >= 6 && signalCharacters / compact.length >= 0.55;
}

function canonicalMimeType(rule: AttachmentRule, providedMimeType: string): string {
  const normalized = providedMimeType.trim().toLowerCase();
  return rule.mimeTypes.includes(normalized) ? normalized : rule.mimeTypes[0];
}

export function normalizeGuideAttachment(input: unknown): GuideAttachment | null {
  // 此处只做结构与大小校验，耗时的解析工作留给异步准备阶段。
  if (!input || typeof input !== 'object') {
    return null;
  }

  const candidate = input as Partial<GuideAttachment>;
  const dataUrl = typeof candidate.dataUrl === 'string' ? candidate.dataUrl.trim() : '';
  const rawName = typeof candidate.name === 'string' ? candidate.name.trim() : '';
  const providedMimeType =
    typeof candidate.mimeType === 'string' ? candidate.mimeType.trim().toLowerCase() : '';

  if (!dataUrl && !rawName && !providedMimeType) {
    return null;
  }

  const data = decodeDataUrl(dataUrl);
  let extension = extensionOf(rawName);
  if (!extension && providedMimeType.startsWith('image/')) {
    extension = providedMimeType.split('/')[1] === 'jpeg' ? 'jpg' : providedMimeType.split('/')[1];
  }

  const rule = ATTACHMENT_RULES[extension];
  const suppliedMimeType = providedMimeType || data.declaredMimeType;
  const dataMimeType = data.declaredMimeType;

  if (
    !rule ||
    (suppliedMimeType && !rule.mimeTypes.includes(suppliedMimeType)) ||
    (dataMimeType && !rule.mimeTypes.includes(dataMimeType))
  ) {
    throw new GuideAttachmentError(
      'INVALID_ATTACHMENT',
      '仅支持 PNG、JPG、WebP、Word、PowerPoint、Excel、CSV 和 Markdown 文件。'
    );
  }

  return {
    name: (rawName || `attachment.${extension}`).slice(0, 120),
    mimeType: canonicalMimeType(rule, suppliedMimeType),
    kind: rule.kind,
    dataUrl,
    sizeBytes: data.buffer.byteLength
  };
}

async function extractModernOfficeText(buffer: Buffer, fileType: SupportedFileType) {
  const ast = await OfficeParser.parseOffice(new Uint8Array(buffer), {
    fileType,
    ignoreComments: false,
    ignoreNotes: false,
    includeRawContent: false,
    extractAttachments: false
  });
  const result = await ast.to('md', {
    includeImages: false,
    ignoreInternalLinks: true
  });

  const text = typeof result.value === 'string' ? result.value : '';
  const imageNotice = hasOfficeImageNode(ast.content)
    ? '> 文档包含内嵌图片；当前只分析文字、段落和表格，未识别图片中的文字。'
    : '';

  return [text, imageNotice].filter(Boolean).join('\n\n');
}

export function hasOfficeImageNode(nodes: unknown[]): boolean {
  return nodes.some((node) => {
    if (!node || typeof node !== 'object') {
      return false;
    }

    const candidate = node as { type?: unknown; children?: unknown };
    if (candidate.type === 'image') {
      return true;
    }

    return Array.isArray(candidate.children) && hasOfficeImageNode(candidate.children);
  });
}

async function extractWordText(buffer: Buffer) {
  const document = await new WordExtractor().extract(buffer);
  return [
    document.getBody(),
    document.getTextboxes(),
    document.getFootnotes(),
    document.getEndnotes(),
    document.getAnnotations()
  ]
    .filter(Boolean)
    .join('\n\n');
}

function spreadsheetCellText(cell: unknown): string {
  if (cell === null || cell === undefined) {
    return '';
  }

  if (cell instanceof Date) {
    return cell.toISOString();
  }

  if (typeof cell === 'object') {
    const value = cell as { v?: unknown; w?: unknown; f?: unknown };
    if (value.w !== undefined) {
      return String(value.w);
    }
    if (value.v !== undefined) {
      return String(value.v);
    }
    if (value.f !== undefined) {
      return `=${String(value.f).replace(/^=/, '')}`;
    }
  }

  return String(cell);
}

function markdownTableCell(value: string): string {
  return value.replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|').trim();
}

function spreadsheetRowsToMarkdown(rows: unknown[][]): string {
  // 转成 Markdown 表格可同时保留行列关系并方便模型阅读。
  if (rows.length === 0) {
    return '_空工作表_';
  }

  const width = Math.max(1, ...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) =>
    Array.from({ length: width }, (_, index) => markdownTableCell(spreadsheetCellText(row[index])))
  );
  const header = normalizedRows[0].map((cell, index) => cell || `列${index + 1}`);
  const separator = header.map(() => '---');

  return [header, separator, ...normalizedRows.slice(1)]
    .map((row) => `| ${row.join(' | ')} |`)
    .join('\n');
}

function extractSpreadsheetText(buffer: Buffer): string {
  return nodeXlsx
    .parse<unknown[]>(buffer)
    .map((sheet) => {
      return [`## 工作表：${sheet.name}`, '', spreadsheetRowsToMarkdown(sheet.data)].join('\n');
    })
    .join('\n\n');
}

export async function prepareGuideAttachment(
  attachment: GuideAttachment,
  options: { ocrImages?: boolean } = {}
): Promise<PreparedGuideAttachment> {
  if (attachment.kind === 'image') {
    if (!options.ocrImages) {
      return attachment;
    }

    try {
      const { buffer } = decodeDataUrl(attachment.dataUrl);
      const metadata = await sharp(buffer).metadata();
      const ocrWidth = Math.min(Math.max((metadata.width ?? 1_000) * 2, 1_600), 2_400);
      const ocrImage = await sharp(buffer)
        .resize({ width: ocrWidth })
        .grayscale()
        .normalize()
        .threshold(145)
        .png()
        .toBuffer();
      const result = await Tesseract.recognize(ocrImage, 'eng+chi_sim', {
        cachePath: path.join(tmpdir(), 'yunlan-tesseract-cache'),
        logger: () => undefined
      });
      const extractedText = normalizeText(result.data.text);
      return isReliableOcrText(extractedText, result.data.confidence)
        ? { ...attachment, extractedText }
        : attachment;
    } catch {
      return attachment;
    }
  }

  const { buffer } = decodeDataUrl(attachment.dataUrl);
  const extension = extensionOf(attachment.name);

  try {
    let extractedText = '';
    if (extension === 'md' || extension === 'csv') {
      extractedText = decodeTextBuffer(buffer);
    } else if (extension === 'doc') {
      extractedText = await extractWordText(buffer);
    } else if (extension === 'docx' || extension === 'pptx') {
      extractedText = await extractModernOfficeText(buffer, extension);
    } else if (extension === 'ppt') {
      extractedText = PptToText.extractText(buffer, { separator: '\n' });
    } else if (extension === 'xls' || extension === 'xlsx') {
      extractedText = extractSpreadsheetText(buffer);
    }

    const normalized = normalizeText(extractedText, extension === 'md');
    if (!normalized) {
      throw new Error('No readable text was found');
    }

    return { ...attachment, extractedText: normalized };
  } catch (caught) {
    if (caught instanceof GuideAttachmentError) {
      throw caught;
    }

    throw new GuideAttachmentError(
      'ATTACHMENT_PARSE_FAILED',
      '没有从附件中提取到可分析的文字，请确认文件未损坏或未加密。',
      422
    );
  }
}

export function isImageAttachment(
  attachment: GuideAttachment | PreparedGuideAttachment | null | undefined
): boolean {
  return attachment?.kind === 'image' && IMAGE_EXTENSIONS.has(extensionOf(attachment.name));
}
