import { describe, expect, it } from 'vitest';
import { calculateRms, nextMouthSignal } from '../src/lab/lip-sync/audio/mouthSignal';
import { DEFAULT_MOUTH_SIGNAL_CONFIG } from '../src/lab/lip-sync/types';

describe('calculateRms', () => {
  it('returns zero for an empty sample buffer', () => {
    expect(calculateRms(new Float32Array())).toBe(0);
  });

  it('calculates the root mean square of samples', () => {
    expect(calculateRms(Float32Array.from([1, -1]))).toBe(1);
  });
});

describe('nextMouthSignal', () => {
  it('suppresses noise below the threshold', () => {
    expect(nextMouthSignal(0, 0.05, 16, DEFAULT_MOUTH_SIGNAL_CONFIG)).toBe(0);
  });

  it('clamps loud input to maxOpen over a long delta', () => {
    expect(nextMouthSignal(0, 1, 10_000, DEFAULT_MOUTH_SIGNAL_CONFIG)).toBe(0.86);
  });

  it('opens on attack and releases gradually', () => {
    const opened = nextMouthSignal(0, 0.5, 16, DEFAULT_MOUTH_SIGNAL_CONFIG);
    const released = nextMouthSignal(opened, 0, 16, DEFAULT_MOUTH_SIGNAL_CONFIG);

    expect(opened).toBeGreaterThan(0);
    expect(released).toBeGreaterThan(0);
    expect(released).toBeLessThan(opened);
  });

  it('normalizes a released signal exactly to zero', () => {
    let value = 0.8;

    for (let index = 0; index < 120; index += 1) {
      value = nextMouthSignal(value, 0, 16, DEFAULT_MOUTH_SIGNAL_CONFIG);
    }

    expect(value).toBeLessThan(0.001);
    expect(value).toBe(0);
  });
});
