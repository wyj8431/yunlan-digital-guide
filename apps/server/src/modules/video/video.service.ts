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

function isDanmakuPosition(value: unknown): value is DanmakuPosition {
  return typeof value === 'string' && DANMAKU_POSITIONS.includes(value as DanmakuPosition);
}

function isDanmakuColor(value: unknown): value is DanmakuColor {
  return typeof value === 'string' && DANMAKU_COLORS.includes(value as DanmakuColor);
}

export class VideoService {
  constructor(private readonly repository: VideoRepository) {}

  listVideos(): VideoSummary[] {
    return this.repository.listVideos();
  }

  getVideoDetail(videoId: string): VideoDetail {
    const video = this.getVideo(videoId);

    return {
      ...video,
      subtitleCues: this.repository.listSubtitleCues(videoId)
    };
  }

  createDanmaku(videoId: string, input: CreateDanmakuInput): Danmaku {
    const video = this.getVideo(videoId);
    const content = typeof input.content === 'string' ? input.content.trim() : '';
    const contentLength = Array.from(content).length;

    if (contentLength < 1 || contentLength > 80) {
      throw new Error('弹幕内容必须为 1-80 个字符。');
    }

    if (
      !Number.isSafeInteger(input.timestampMs) ||
      input.timestampMs < 0 ||
      input.timestampMs > video.durationMs
    ) {
      throw new Error('弹幕时间必须在视频时长内。');
    }

    if (!isDanmakuPosition(input.position)) {
      throw new Error('弹幕位置不受支持。');
    }

    if (!isDanmakuColor(input.color)) {
      throw new Error('弹幕颜色不受支持。');
    }

    return this.repository.createDanmaku({
      videoId,
      content: this.filterSensitiveKeywords(content),
      timestampMs: input.timestampMs,
      position: input.position,
      color: input.color
    });
  }

  listDanmaku(videoId: string, fromMs: number, toMs: number): Danmaku[] {
    const video = this.getVideo(videoId);

    if (
      !Number.isSafeInteger(fromMs) ||
      !Number.isSafeInteger(toMs) ||
      fromMs < 0 ||
      fromMs > toMs ||
      toMs > video.durationMs
    ) {
      throw new Error('弹幕查询时间窗口无效。');
    }

    return this.repository.listDanmaku(videoId, fromMs, toMs);
  }

  private getVideo(videoId: string): VideoSummary {
    const video = this.repository.findVideoById(videoId);

    if (!video) {
      throw new Error('视频不存在。');
    }

    return video;
  }

  private filterSensitiveKeywords(content: string): string {
    return this.repository
      .listSensitiveKeywords()
      .reduce((filtered, keyword) => filtered.split(keyword).join('****'), content);
  }
}
