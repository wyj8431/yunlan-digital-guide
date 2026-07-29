import { describe, expect, it } from 'vitest';
import {
  QUALITY_PROFILES,
  QualityDowngradeController,
  nextLowerQuality
} from '../src/exhibition/quality/qualityProfile';
import {
  getPostProcessingFeatures,
  getPostProcessingPassNames
} from '../src/exhibition/quality/PostProcessingPipeline';

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

  it('gates rays and animated fog by quality and reduced motion', () => {
    expect(getPostProcessingFeatures('high', false)).toMatchObject({ godRays: true, fog: true });
    expect(getPostProcessingFeatures('medium', false)).toMatchObject({ godRays: false, fog: true });
    expect(getPostProcessingFeatures('low', false)).toMatchObject({ godRays: false, fog: false });
    expect(getPostProcessingFeatures('high', true)).toMatchObject({ godRays: false, fog: false });
  });

  it('omits every expensive pass from the low profile', () => {
    expect(getPostProcessingPassNames('low', false)).toEqual([
      'render',
      'bloom',
      'transition',
      'output'
    ]);
    expect(getPostProcessingPassNames('high', true)).not.toEqual(
      expect.arrayContaining(['depthOfField', 'godRays', 'fog'])
    );
  });
});
