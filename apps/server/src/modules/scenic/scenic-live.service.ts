import type { ScenicAreaSummary, ScenicOfficialInfo } from '../../types/scenic.js';

const DEFAULT_TTL_MS = 5 * 60 * 1_000;
const REQUEST_TIMEOUT_MS = 8_000;

type OfficialFeedPayload = {
  [key: string]: unknown;
  openingHours?: unknown;
  ticketInfo?: unknown;
  notices?: unknown;
  notice?: unknown;
  sourceName?: unknown;
  sourceUrl?: unknown;
  updatedAt?: unknown;
};

type OfficialApiRecord = Record<string, unknown>;

export type ScenicLiveServiceOptions = {
  feedUrl: string;
  fallback: () => ScenicAreaSummary;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  ttlMs?: number;
};

type CachedLiveSummary = {
  summary: ScenicAreaSummary;
  expiresAt: number;
};

function asText(value: unknown, maxLength = 500): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text.length > 0 && text.length <= maxLength ? text : undefined;
}

function asPlainText(value: unknown, maxLength = 500): string | undefined {
  if (typeof value !== 'string') return undefined;
  const plainText = value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
  if (plainText.length === 0) return undefined;
  return plainText.length > maxLength ? plainText.slice(0, maxLength) : plainText;
}

function asPrice(value: unknown): number | undefined {
  const price = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(price) && price > 0 ? price : undefined;
}

function formatPrice(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function asNotices(payload: OfficialFeedPayload): string[] {
  const values = Array.isArray(payload.notices)
    ? payload.notices
    : payload.notice
      ? [payload.notice]
      : [];
  return values
    .map((value) => asPlainText(value, 500))
    .filter((value): value is string => Boolean(value))
    .slice(0, 8);
}

function isHttpUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function isPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeFeedPayload(value: unknown): OfficialFeedPayload {
  if (!isPayload(value)) throw new Error('Official scenic feed must return a JSON object');

  const payload = value as OfficialFeedPayload;
  const data = isPayload(payload.data) ? payload.data : undefined;
  const records = Array.isArray(data?.records)
    ? data.records.filter((record): record is OfficialApiRecord => isPayload(record))
    : [];

  if (records.length === 0) return payload;

  const mainRecord =
    records.find((record) => asText(record.name, 100)?.includes('乌镇') && record.openTime) ??
    records.find((record) => record.openTime) ??
    records[0];
  const pricedRecords = records
    .map((record) => ({ name: asText(record.name, 100), price: asPrice(record.price) }))
    .filter((record): record is { name: string; price: number } =>
      Boolean(record.name && record.price)
    )
    .slice(0, 6);

  return {
    openingHours: asPlainText(mainRecord.openTime),
    ticketInfo:
      pricedRecords.length > 0
        ? `官方实时票价：${pricedRecords.map((record) => `${record.name} ${formatPrice(record.price)} 元`).join('；')}`
        : undefined,
    notices: [asPlainText(mainRecord.orderNotice)].filter((notice): notice is string =>
      Boolean(notice)
    ),
    sourceName: '乌镇景区官方预订网'
  };
}

export class ScenicLiveService {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly ttlMs: number;
  private cached: CachedLiveSummary | null = null;

  constructor(private readonly options: ScenicLiveServiceOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.ttlMs = Math.max(1_000, options.ttlMs ?? DEFAULT_TTL_MS);
  }

  async getSummary(): Promise<ScenicAreaSummary> {
    const fallback = this.options.fallback();
    const checkedAt = this.now().toISOString();
    const feedUrl = this.options.feedUrl.trim();

    if (!feedUrl) {
      return {
        ...fallback,
        officialInfo: { status: 'unconfigured', notices: [], checkedAt }
      };
    }

    if (this.cached && this.cached.expiresAt > Date.parse(checkedAt)) {
      return this.cached.summary;
    }

    try {
      const payload = await this.fetchFeed(feedUrl);
      const summary = this.mergeLivePayload(fallback, payload, feedUrl, checkedAt);
      this.cached = { summary, expiresAt: Date.parse(checkedAt) + this.ttlMs };
      return summary;
    } catch {
      if (this.cached) {
        const staleInfo: ScenicOfficialInfo = {
          ...this.cached.summary.officialInfo,
          status: 'stale',
          checkedAt,
          notices: this.cached.summary.officialInfo?.notices ?? []
        };
        return { ...this.cached.summary, officialInfo: staleInfo };
      }

      return {
        ...fallback,
        officialInfo: {
          status: 'fallback',
          sourceUrl: feedUrl,
          checkedAt,
          notices: []
        }
      };
    }
  }

  private async fetchFeed(feedUrl: string): Promise<OfficialFeedPayload> {
    if (!isHttpUrl(feedUrl)) throw new Error('Official scenic feed URL must be HTTP(S)');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(feedUrl, {
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Official scenic feed returned HTTP ${response.status}`);
      return normalizeFeedPayload(await response.json());
    } finally {
      clearTimeout(timer);
    }
  }

  private mergeLivePayload(
    fallback: ScenicAreaSummary,
    payload: OfficialFeedPayload,
    feedUrl: string,
    checkedAt: string
  ): ScenicAreaSummary {
    const sourceUrl = asText(payload.sourceUrl, 1_000);
    const updatedAt = asText(payload.updatedAt, 100);
    const info: ScenicOfficialInfo = {
      status: 'live',
      sourceName: asText(payload.sourceName, 200) ?? fallback.scenicArea.sourceName,
      sourceUrl: isHttpUrl(sourceUrl) ? sourceUrl : feedUrl,
      updatedAt,
      checkedAt,
      notices: asNotices(payload)
    };
    return {
      ...fallback,
      scenicArea: {
        ...fallback.scenicArea,
        openingHours: asText(payload.openingHours) ?? fallback.scenicArea.openingHours,
        ticketInfo: asText(payload.ticketInfo) ?? fallback.scenicArea.ticketInfo,
        sourceName: info.sourceName,
        sourceUrl: info.sourceUrl,
        sourceUpdatedAt: updatedAt ?? fallback.scenicArea.sourceUpdatedAt
      },
      officialInfo: info
    };
  }
}
