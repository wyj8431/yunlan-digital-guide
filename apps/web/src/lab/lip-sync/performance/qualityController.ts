import type { RenderQualityTier } from '../types';

export const QUALITY_PROFILES = {
  low: { pixelRatioCap: 1, shadows: false, stageEffects: false },
  medium: { pixelRatioCap: 1.5, shadows: true, stageEffects: false },
  high: { pixelRatioCap: 2, shadows: true, stageEffects: true }
} as const;

type QualityWindow = {
  averageFps: number;
  lowWindows: number;
  healthyWindows: number;
};

const QUALITY_ORDER: RenderQualityTier[] = ['low', 'medium', 'high'];
const DESKTOP_FPS_TARGET = 55;
const MOBILE_FPS_TARGET = 30;
const MOBILE_MAX_WIDTH = 860;
const LOW_WINDOWS_BEFORE_DEGRADE = 3;
const HEALTHY_WINDOWS_BEFORE_RECOVER = 6;

export function getFrameRateTarget(viewportWidth = window.innerWidth) {
  return viewportWidth <= MOBILE_MAX_WIDTH ? MOBILE_FPS_TARGET : DESKTOP_FPS_TARGET;
}

export function nextQualityTier(
  currentTier: RenderQualityTier,
  windowStats: QualityWindow,
  viewportWidth?: number
): RenderQualityTier {
  const currentIndex = QUALITY_ORDER.indexOf(currentTier);
  const targetFps = getFrameRateTarget(viewportWidth);

  if (windowStats.averageFps < targetFps && windowStats.lowWindows >= LOW_WINDOWS_BEFORE_DEGRADE) {
    return QUALITY_ORDER[Math.max(0, currentIndex - 1)];
  }

  if (
    windowStats.averageFps >= targetFps &&
    windowStats.healthyWindows >= HEALTHY_WINDOWS_BEFORE_RECOVER
  ) {
    return QUALITY_ORDER[Math.min(QUALITY_ORDER.length - 1, currentIndex + 1)];
  }

  return currentTier;
}
