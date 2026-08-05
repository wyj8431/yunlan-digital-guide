import { describe, expect, it } from 'vitest';
import { WATER_FRAGMENT_SHADER, WATER_VERTEX_SHADER } from '../src/exhibition/waterShader';

describe('exhibition water shader', () => {
  it('animates vertex displacement with a time uniform', () => {
    expect(WATER_VERTEX_SHADER).toContain('uniform float uTime');
    expect(WATER_VERTEX_SHADER).toContain('transformed.z +=');
    expect(WATER_VERTEX_SHADER).toContain('vWave');
  });

  it('combines ripple and weather color in the fragment output', () => {
    expect(WATER_FRAGMENT_SHADER).toContain('uniform vec3 uColor');
    expect(WATER_FRAGMENT_SHADER).toContain('length(centered)');
    expect(WATER_FRAGMENT_SHADER).toContain('gl_FragColor');
  });
});
