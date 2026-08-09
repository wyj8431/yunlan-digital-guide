import type { QualityLevel } from './quality/qualityProfile';

export type ExhibitionAssetSources = {
  bicycle: 'glb' | 'fallback';
  shuttle: 'glb' | 'fallback';
  teaSet: 'glb' | 'fallback';
  silkGarment: 'glb' | 'fallback';
};

export type ExhibitionAssetLoadState = {
  status: 'loading' | 'complete';
  completed: number;
  total: number;
  failedAssetIds: string[];
  failedAssetMessages: string[];
};

export type ExhibitionTelemetry = {
  scene: 'hall' | 'lake';
  cameraPose: {
    position: { x: number; y: number; z: number };
    yaw: number;
    pitch: number;
  };
  qualityLevel: QualityLevel;
  rollingFps: number;
  drawCalls: number;
  triangles: number;
  textures: number;
  activePasses: string[];
  assetSources: ExhibitionAssetSources;
  assetLoadState: ExhibitionAssetLoadState;
  visibleZones: string[];
  audioUnlocked: boolean;
  activeCanvasCount: number;
};

declare global {
  interface Window {
    __EXHIBITION_TELEMETRY__?: ExhibitionTelemetry;
  }
}

export const FALLBACK_ASSET_SOURCES: ExhibitionAssetSources = {
  bicycle: 'fallback',
  shuttle: 'fallback',
  teaSet: 'fallback',
  silkGarment: 'fallback'
};

export function publishExhibitionTelemetry(telemetry: ExhibitionTelemetry): void {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;
  window.__EXHIBITION_TELEMETRY__ = telemetry;
}
