import { VideoRepository } from './video.repository.js';
import {
  DANMAKU_COLORS,
  DANMAKU_POSITIONS,
  type CreateDanmakuInput,
  type Danmaku,
  type DanmakuColor,
  type DanmakuPosition,
  type VideoDetail,
  type VideoSummary
} from './video.types.js';

export type VideoServiceErrorCode =
  | 'INVALID_VIDEO_ID'
  | 'INVALID_DANMAKU_INPUT'
  | 'INVALID_DANMAKU_CONTENT'
  | 'INVALID_DANMAKU_TIMESTAMP'
  | 'INVALID_DANMAKU_POSITION'
  | 'INVALID_DANMAKU_COLOR'
  | 'INVALID_DANMAKU_WINDOW'
  | 'VIDEO_NOT_FOUND'
  | 'VIDEO_STORAGE_ERROR';

export class VideoServiceError extends Error {
  readonly code: VideoServiceErrorCode;
  readonly status: 400 | 404 | 500;

  constructor(
    code: VideoServiceErrorCode,
    status: 400 | 404 | 500,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'VideoServiceError';
    this.code = code;
    this.status = status;
  }
}

function isDanmakuPosition(value: unknown): value is DanmakuPosition {
  return typeof value === 'string' && DANMAKU_POSITIONS.includes(value as DanmakuPosition);
}

function isDanmakuColor(value: unknown): value is DanmakuColor {
  return typeof value === 'string' && DANMAKU_COLORS.includes(value as DanmakuColor);
}

function parseVideoId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new VideoServiceError('INVALID_VIDEO_ID', 400, '视频 ID 无效。');
  }

  return value.trim();
}

export function parseCreateDanmakuInput(input: unknown): CreateDanmakuInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new VideoServiceError('INVALID_DANMAKU_INPUT', 400, '弹幕输入无效。');
  }

  const record = input as Record<string, unknown>;
  const content = typeof record.content === 'string' ? record.content.trim() : '';
  const contentLength = Array.from(content).length;

  if (contentLength < 1 || contentLength > 80) {
    throw new VideoServiceError('INVALID_DANMAKU_CONTENT', 400, '弹幕内容必须为 1-80 个字符。');
  }

  if (!Number.isSafeInteger(record.timestampMs) || (record.timestampMs as number) < 0) {
    throw new VideoServiceError('INVALID_DANMAKU_TIMESTAMP', 400, '弹幕时间无效。');
  }

  if (!isDanmakuPosition(record.position)) {
    throw new VideoServiceError('INVALID_DANMAKU_POSITION', 400, '弹幕位置不受支持。');
  }

  if (!isDanmakuColor(record.color)) {
    throw new VideoServiceError('INVALID_DANMAKU_COLOR', 400, '弹幕颜色不受支持。');
  }

  return {
    content,
    timestampMs: record.timestampMs as number,
    position: record.position,
    color: record.color
  };
}

function parseDanmakuWindow(fromMs: unknown, toMs: unknown): { fromMs: number; toMs: number } {
  if (
    !Number.isSafeInteger(fromMs) ||
    !Number.isSafeInteger(toMs) ||
    (fromMs as number) < 0 ||
    (fromMs as number) > (toMs as number)
  ) {
    throw new VideoServiceError('INVALID_DANMAKU_WINDOW', 400, '弹幕查询时间窗口无效。');
  }

  return { fromMs: fromMs as number, toMs: toMs as number };
}

export class VideoService {
  constructor(private readonly repository: VideoRepository) {}

  listVideos(): VideoSummary[] {
    return this.execute(() => this.repository.listVideos());
  }

  getVideoDetail(videoId: unknown): VideoDetail {
    return this.execute(() => {
      const parsedVideoId = parseVideoId(videoId);
      const video = this.getVideo(parsedVideoId);

      return {
        ...video,
        subtitleCues: this.repository.listSubtitleCues(parsedVideoId)
      };
    });
  }

  createDanmaku(videoId: unknown, input: unknown): Danmaku {
    return this.execute(() => {
      const parsedVideoId = parseVideoId(videoId);
      const parsedInput = parseCreateDanmakuInput(input);
      const video = this.getVideo(parsedVideoId);

      if (parsedInput.timestampMs > video.durationMs) {
        throw new VideoServiceError('INVALID_DANMAKU_TIMESTAMP', 400, '弹幕时间必须在视频时长内。');
      }

      return this.repository.createDanmaku({
        videoId: parsedVideoId,
        content: this.filterSensitiveKeywords(parsedInput.content),
        timestampMs: parsedInput.timestampMs,
        position: parsedInput.position,
        color: parsedInput.color
      });
    });
  }

  listDanmaku(videoId: unknown, fromMs: unknown, toMs: unknown): Danmaku[] {
    return this.execute(() => {
      const parsedVideoId = parseVideoId(videoId);
      const window = parseDanmakuWindow(fromMs, toMs);
      const video = this.getVideo(parsedVideoId);

      if (window.toMs > video.durationMs) {
        throw new VideoServiceError('INVALID_DANMAKU_WINDOW', 400, '弹幕查询时间窗口无效。');
      }

      return this.repository.listDanmaku(parsedVideoId, window.fromMs, window.toMs);
    });
  }

  private getVideo(videoId: string): VideoSummary {
    const video = this.repository.findVideoById(videoId);

    if (!video) {
      throw new VideoServiceError('VIDEO_NOT_FOUND', 404, '视频不存在。');
    }

    return video;
  }

  private filterSensitiveKeywords(content: string): string {
    return this.repository
      .listSensitiveKeywords()
      .reduce((filtered, keyword) => filtered.split(keyword).join('****'), content);
  }

  private execute<Result>(operation: () => Result): Result {
    try {
      return operation();
    } catch (caught) {
      if (caught instanceof VideoServiceError) {
        throw caught;
      }

      throw new VideoServiceError('VIDEO_STORAGE_ERROR', 500, '视频数据服务暂时不可用。', {
        cause: caught
      });
    }
  }
}
