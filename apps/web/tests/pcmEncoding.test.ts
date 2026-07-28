import { describe, expect, it } from 'vitest';
import { downsampleFloat32, floatToPcm16 } from '../src/voice/audio/pcmEncoding';

describe('PCM encoding', () => {
  it('downsamples 48 kHz audio to 16 kHz by averaging source windows', () => {
    const input = Float32Array.from([0, 0.3, 0.6, 0.6, 0.3, 0, -0.3, -0.6, -0.6]);

    expect(Array.from(downsampleFloat32(input, 48000, 16000))).toEqual([
      expect.closeTo(0.3, 6),
      expect.closeTo(0.3, 6),
      expect.closeTo(-0.5, 6)
    ]);
  });

  it('clamps float samples into signed PCM16', () => {
    expect(Array.from(floatToPcm16(Float32Array.from([-2, -1, 0, 1, 2])))).toEqual([
      -32768, -32768, 0, 32767, 32767
    ]);
  });
});
