import { describe, expect, it } from 'vitest';
import {
  EXHIBITION_ASSETS,
  type ExhibitionAsset,
  validateAssetRegistry
} from '../src/exhibition/assets/exhibitionAssets';

const REQUIRED_IDS = [
  'bicycle',
  'shuttle',
  'tea-set',
  'silk-garment',
  'hall-hdri',
  'stone-pbr',
  'walnut-pbr',
  'display-ies',
  'hall-ambience',
  'lake-ambience',
  'footstep-stone',
  'narration-bicycle',
  'narration-shuttle',
  'narration-tea-set',
  'narration-silk-garment'
] as const;

describe('exhibition asset registry', () => {
  it('contains every required exhibition asset ID', () => {
    expect(EXHIBITION_ASSETS.map((asset) => asset.id)).toEqual(
      expect.arrayContaining([...REQUIRED_IDS])
    );
  });

  it('uses local exhibition paths and approved licenses', () => {
    expect(EXHIBITION_ASSETS.every((asset) => asset.localPath.startsWith('/exhibition/'))).toBe(
      true
    );
    expect(
      EXHIBITION_ASSETS.every((asset) =>
        ['CC0-1.0', 'CC-BY-4.0', 'project-owned'].includes(asset.license)
      )
    ).toBe(true);
    expect(validateAssetRegistry(EXHIBITION_ASSETS)).toEqual([]);
  });

  it('reports duplicate IDs', () => {
    const duplicate = { ...EXHIBITION_ASSETS[0] } as ExhibitionAsset;
    expect(validateAssetRegistry([duplicate, duplicate])).toContain(`duplicate:${duplicate.id}`);
  });

  it('reports invalid source URLs and local paths', () => {
    const invalid = {
      ...EXHIBITION_ASSETS[0],
      id: 'invalid',
      sourceUrl: 'http://example.test/asset.glb',
      localPath: '/outside/asset.glb'
    } as unknown as ExhibitionAsset;

    expect(validateAssetRegistry([invalid])).toEqual(['source:invalid', 'path:invalid']);
  });
});
