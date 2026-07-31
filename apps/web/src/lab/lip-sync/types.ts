// 嘴型实验室跨渲染器、状态仓库和控制面板共享的数据结构。
export type MouthSignalConfig = {
  threshold: number;
  sensitivity: number;
  maxOpen: number;
  attackMs: number;
  releaseMs: number;
};

export type LabAudioSource =
  { kind: 'preset' } | { kind: 'file'; file: File } | { kind: 'url'; url: string };

export type RenderQualityTier = 'low' | 'medium' | 'high';

export type PerformanceSnapshot = {
  averageFps: number;
  p95FrameMs: number;
  mouthResponseMs: number | null;
  drawCalls: number;
  triangles: number;
  heapMb: number | null;
  qualityTier: RenderQualityTier;
};

export const DEFAULT_MOUTH_SIGNAL_CONFIG: MouthSignalConfig = {
  threshold: 0.08,
  sensitivity: 2,
  maxOpen: 0.86,
  attackMs: 70,
  releaseMs: 140
};
