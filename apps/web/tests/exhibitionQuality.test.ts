import { describe, expect, it } from 'vitest';
import {
  QUALITY_PROFILES,
  QualityDowngradeController,
  nextLowerQuality
} from '../src/exhibition/quality/qualityProfile';

describe('exhibition rendering quality', () => {
  it('defines explicit high and low rendering budgets', () => {
    expect(QUALITY_PROFILES.high).toMatchObject({
      pixelRatio: 2,
      ssao: true,
      ssr: true,
      godRays: true,
      cascadedShadows: true
    });
    expect(QUALITY_PROFILES.low).toMatchObject({
      pixelRatio: 1.25,
      ssr: false,
      depthOfField: false,
      godRays: false,
      volumetricFog: false
    });
  });

  it('only lowers quality and never leaves the low floor', () => {
    expect(nextLowerQuality('high')).toBe('medium');
    expect(nextLowerQuality('medium')).toBe('low');
    expect(nextLowerQuality('low')).toBe('low');
  });

  it('downgrades after three slow windows and respects cooldown', () => {
    const controller = new QualityDowngradeController('high', 50, 20_000);
    expect(controller.sample(45, 5_000)).toBe('high');
    expect(controller.sample(44, 6_000)).toBe('high');
    expect(controller.sample(43, 7_000)).toBe('medium');
    expect(controller.sample(30, 8_000)).toBe('medium');
    expect(controller.sample(30, 28_000)).toBe('medium');
    expect(controller.sample(30, 29_000)).toBe('medium');
    expect(controller.sample(30, 30_000)).toBe('low');
  });

  it('ignores samples during the five-second warm-up', () => {
    const controller = new QualityDowngradeController('high', 50, 20_000);
    controller.sample(10, 1_000);
    controller.sample(10, 2_000);
    controller.sample(10, 3_000);
    expect(controller.sample(10, 5_000)).toBe('high');
  });
});
