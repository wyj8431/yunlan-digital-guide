import { describe, expect, it } from 'vitest';
import {
  getFrameRateTarget,
  nextQualityTier,
  QUALITY_PROFILES
} from '../src/lab/lip-sync/performance/qualityController';

describe('qualityController', () => {
  it('exposes concrete quality profiles for the renderer', () => {
    expect(QUALITY_PROFILES).toEqual({
      low: { pixelRatioCap: 1, shadows: false, stageEffects: false },
      medium: { pixelRatioCap: 1.5, shadows: true, stageEffects: false },
      high: { pixelRatioCap: 2, shadows: true, stageEffects: true }
    });
  });

  it('degrades after sustained low fps and recovers only after hysteresis', () => {
    expect(nextQualityTier('high', { averageFps: 42, lowWindows: 3, healthyWindows: 0 })).toBe(
      'medium'
    );
    expect(nextQualityTier('medium', { averageFps: 58, lowWindows: 0, healthyWindows: 6 })).toBe(
      'high'
    );
    expect(nextQualityTier('medium', { averageFps: 58, lowWindows: 0, healthyWindows: 2 })).toBe(
      'medium'
    );
  });

  it('uses a lower frame-rate target for mobile viewports', () => {
    expect(getFrameRateTarget(1440)).toBe(55);
    expect(getFrameRateTarget(860)).toBe(30);
    expect(
      nextQualityTier('medium', { averageFps: 35, lowWindows: 0, healthyWindows: 6 }, 390)
    ).toBe('high');
  });
});
