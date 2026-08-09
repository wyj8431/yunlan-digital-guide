import { describe, expect, it } from 'vitest';
import { getPostProcessingPassNames } from '../src/exhibition/quality/PostProcessingPipeline';
import { QUALITY_PROFILES } from '../src/exhibition/quality/qualityProfile';

describe('exhibition quality profile', () => {
  it('keeps the fixed high-quality visitor mode sharp and shadow-free', () => {
    expect(QUALITY_PROFILES.high).toMatchObject({
      pixelRatio: 2,
      ssao: false,
      bloom: false,
      ssr: false,
      depthOfField: false,
      cascadedShadows: false
    });
    expect(getPostProcessingPassNames('high', false)).toEqual(['render', 'transition', 'output']);
  });
});
