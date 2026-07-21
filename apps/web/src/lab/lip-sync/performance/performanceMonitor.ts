import type { PerformanceSnapshot, RenderQualityTier } from '../types';

type RendererInfoLike = {
  render?: {
    calls?: number;
    triangles?: number;
  };
};

type PerformanceWithMemory = Performance & {
  memory?: {
    usedJSHeapSize?: number;
  };
};

type PerformanceMonitorOptions = {
  qualityTier?: RenderQualityTier;
  maxFrames?: number;
};

const DEFAULT_MAX_FRAMES = 600;

// Work order: 3D digital-human rendering performance optimization.
export class PerformanceMonitor {
  private readonly frameDurations: number[] = [];
  private readonly maxFrames: number;
  private lastFrameTimestamp: number | null = null;
  private audioStartTimestamp: number | null = null;
  private mouthResponseMs: number | null = null;
  private drawCalls = 0;
  private triangles = 0;
  private qualityTier: RenderQualityTier;

  constructor(options: PerformanceMonitorOptions = {}) {
    this.qualityTier = options.qualityTier ?? 'medium';
    this.maxFrames = options.maxFrames ?? DEFAULT_MAX_FRAMES;
  }

  get frameCount() {
    return this.frameDurations.length;
  }

  recordFrame(timestampMs: number) {
    if (this.lastFrameTimestamp !== null) {
      const duration = Math.max(0, timestampMs - this.lastFrameTimestamp);
      this.frameDurations.push(duration);

      if (this.frameDurations.length > this.maxFrames) {
        this.frameDurations.splice(0, this.frameDurations.length - this.maxFrames);
      }
    }

    this.lastFrameTimestamp = timestampMs;
  }

  markAudioStart(timestampMs: number) {
    this.audioStartTimestamp = timestampMs;
    this.mouthResponseMs = null;
  }

  markMouthResponse(timestampMs: number) {
    if (this.audioStartTimestamp === null || this.mouthResponseMs !== null) {
      return;
    }

    this.mouthResponseMs = Math.max(0, timestampMs - this.audioStartTimestamp);
  }

  setRendererInfo(info: RendererInfoLike) {
    this.drawCalls = info.render?.calls ?? 0;
    this.triangles = info.render?.triangles ?? 0;
  }

  setQualityTier(tier: RenderQualityTier) {
    this.qualityTier = tier;
  }

  snapshot(): PerformanceSnapshot {
    return {
      averageFps: this.calculateAverageFps(),
      p95FrameMs: this.calculateP95FrameMs(),
      mouthResponseMs: this.mouthResponseMs,
      drawCalls: this.drawCalls,
      triangles: this.triangles,
      heapMb: this.readHeapMb(),
      qualityTier: this.qualityTier
    };
  }

  private calculateAverageFps() {
    if (this.frameDurations.length === 0) {
      return 0;
    }

    const totalFrameMs = this.frameDurations.reduce((sum, duration) => sum + duration, 0);
    const averageFrameMs = totalFrameMs / this.frameDurations.length;
    return averageFrameMs > 0 ? 1000 / averageFrameMs : 0;
  }

  private calculateP95FrameMs() {
    if (this.frameDurations.length === 0) {
      return 0;
    }

    const sorted = [...this.frameDurations].sort((first, second) => first - second);
    const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
    return sorted[index];
  }

  private readHeapMb() {
    const memory = (globalThis.performance as PerformanceWithMemory | undefined)?.memory;

    if (!memory?.usedJSHeapSize) {
      return null;
    }

    return Math.round((memory.usedJSHeapSize / 1024 / 1024) * 10) / 10;
  }
}
