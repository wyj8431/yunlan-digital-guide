import { describe, expect, it } from 'vitest';
import { FAST_FRAME_MS, getInitialRenderDprCap, getNextRenderDpr, MIN_RENDER_DPR, SLOW_FRAME_MS } from '../src/exhibition/renderQuality';

describe('exhibition render quality', () => {
  it('caps mobile and constrained devices before creating the canvas', () => {
    expect(getInitialRenderDprCap({ devicePixelRatio: 3, viewportWidth: 390, hardwareConcurrency: 8 })).toBe(1.25);
    expect(getInitialRenderDprCap({ devicePixelRatio: 2, viewportWidth: 1440, hardwareConcurrency: 4 })).toBe(1.25);
  });

  it('keeps a higher cap for desktop devices without exceeding the display density', () => {
    expect(getInitialRenderDprCap({ devicePixelRatio: 2, viewportWidth: 1440, hardwareConcurrency: 8 })).toBe(1.5);
    expect(getInitialRenderDprCap({ devicePixelRatio: 1, viewportWidth: 1440 })).toBe(1);
  });

  it('steps down after sustained slow frames and recovers conservatively after fast frames', () => {
    expect(getNextRenderDpr(1.5, SLOW_FRAME_MS, 1.5)).toBe(1.35);
    expect(getNextRenderDpr(MIN_RENDER_DPR, SLOW_FRAME_MS + 8, 1.5)).toBe(MIN_RENDER_DPR);
    expect(getNextRenderDpr(1.25, FAST_FRAME_MS, 1.5)).toBe(1.35);
    expect(getNextRenderDpr(1.5, FAST_FRAME_MS - 3, 1.5)).toBe(1.5);
  });
});
