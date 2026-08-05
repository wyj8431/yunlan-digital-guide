import { describe, expect, it } from 'vitest';
import { PANORAMA_SOURCES } from '../src/modules/panorama/panorama-data.js';

describe('panorama sources', () => {
  it('contains fifteen unique Wuzhen/Jiaxing 360Cities sources', () => {
    const ids = Object.keys(PANORAMA_SOURCES);
    expect(ids).toHaveLength(15);
    expect(new Set(ids).size).toBe(15);
    expect(ids.every((id) => id.includes('wuzhen') || id.includes('jiaxing'))).toBe(true);
    expect(Object.values(PANORAMA_SOURCES).every((source) => source.sourceUrl.includes('360gigapixels.com'))).toBe(true);
    expect(Object.values(PANORAMA_SOURCES).every((source) => source.cubeTiles?.dimension && source.cubeTiles.dimension >= 1500)).toBe(true);
  });
});
