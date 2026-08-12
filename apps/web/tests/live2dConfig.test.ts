import { describe, expect, it } from 'vitest';
import { resolveLive2DConfig } from '../src/lib/live2dConfig';

describe('resolveLive2DConfig', () => {
  it('requires HTTPS URLs for the model and Cubism Core', () => {
    expect(
      resolveLive2DConfig({
        VITE_LIVE2D_MODEL_URL: 'https://cdn.example.com/model.model3.json',
        VITE_LIVE2D_CORE_URL: 'https://cdn.example.com/live2dcubismcore.min.js'
      })
    ).toEqual({
      modelUrl: 'https://cdn.example.com/model.model3.json',
      coreUrl: 'https://cdn.example.com/live2dcubismcore.min.js'
    });
  });

  it('keeps Live2D disabled for incomplete or insecure configuration', () => {
    expect(
      resolveLive2DConfig({ VITE_LIVE2D_MODEL_URL: 'http://example.com/model.model3.json' })
    ).toBeNull();
    expect(
      resolveLive2DConfig({
        VITE_LIVE2D_MODEL_URL: 'https://cdn.example.com/model.model3.json',
        VITE_LIVE2D_CORE_URL: 'file:///local/core.js'
      })
    ).toBeNull();
  });
});
