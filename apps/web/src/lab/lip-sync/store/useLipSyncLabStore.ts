// 实验室状态仓库集中维护音频源、嘴型参数、画质和性能快照。
import { create } from 'zustand';
import {
  DEFAULT_MOUTH_SIGNAL_CONFIG,
  type MouthSignalConfig,
  type PerformanceSnapshot,
  type RenderQualityTier
} from '../types';

type SourceMode = 'preset' | 'file' | 'url' | 'microphone';
type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export type LipSyncLabSnapshot = {
  sourceMode: SourceMode;
  sourceUrl: string;
  sourceFile: File | null;
  playback: PlaybackState;
  error: string | null;
  config: MouthSignalConfig;
  qualityTier: RenderQualityTier;
  automaticQuality: boolean;
  metrics: PerformanceSnapshot;
};

type LipSyncLabState = LipSyncLabSnapshot & {
  setSourceMode(mode: SourceMode): void;
  setSourceUrl(url: string): void;
  setSourceFile(file: File | null): void;
  setPlayback(playback: PlaybackState, error?: string | null): void;
  updateConfig(patch: Partial<MouthSignalConfig>): void;
  setQualityTier(tier: RenderQualityTier): void;
  setAutomaticQuality(enabled: boolean): void;
  setMetrics(metrics: PerformanceSnapshot): void;
  reset(): void;
};

export const DEFAULT_PERFORMANCE_SNAPSHOT: PerformanceSnapshot = {
  averageFps: 0,
  p95FrameMs: 0,
  mouthResponseMs: null,
  drawCalls: 0,
  triangles: 0,
  heapMb: null,
  qualityTier: 'medium'
};

export const DEFAULT_LIP_SYNC_LAB_STATE: LipSyncLabSnapshot = {
  sourceMode: 'preset',
  sourceUrl: '',
  sourceFile: null,
  playback: 'idle',
  error: null,
  config: DEFAULT_MOUTH_SIGNAL_CONFIG,
  qualityTier: 'medium',
  automaticQuality: true,
  metrics: DEFAULT_PERFORMANCE_SNAPSHOT
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function createInitialState(): LipSyncLabSnapshot {
  return {
    ...DEFAULT_LIP_SYNC_LAB_STATE,
    config: { ...DEFAULT_MOUTH_SIGNAL_CONFIG },
    metrics: { ...DEFAULT_PERFORMANCE_SNAPSHOT }
  };
}

function clampConfig(config: MouthSignalConfig): MouthSignalConfig {
  return {
    threshold: clamp(config.threshold, 0, 1),
    sensitivity: clamp(config.sensitivity, 0.1, 5),
    maxOpen: clamp(config.maxOpen, 0, 1),
    attackMs: clamp(config.attackMs, 0, 1_000),
    releaseMs: clamp(config.releaseMs, 0, 1_000)
  };
}

export const useLipSyncLabStore = create<LipSyncLabState>((set) => ({
  ...createInitialState(),

  setSourceMode: (mode) =>
    set((state) => ({
      sourceMode: mode,
      sourceFile: mode === 'file' ? state.sourceFile : null,
      sourceUrl: mode === 'url' ? state.sourceUrl : ''
    })),

  setSourceUrl: (url) => set({ sourceUrl: url, sourceMode: 'url', sourceFile: null }),

  setSourceFile: (file) => set({ sourceFile: file, sourceMode: 'file' }),

  setPlayback: (playback, error = null) => set({ playback, error }),

  updateConfig: (patch) =>
    set((state) => ({
      config: clampConfig({ ...state.config, ...patch })
    })),

  setQualityTier: (tier) =>
    set((state) => ({
      qualityTier: tier,
      metrics: { ...state.metrics, qualityTier: tier }
    })),

  setAutomaticQuality: (enabled) => set({ automaticQuality: enabled }),

  setMetrics: (metrics) => set({ metrics }),

  reset: () => set(createInitialState())
}));
