import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
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
        ['CC0-1.0', 'CC-BY-4.0', 'MIT', 'project-owned'].includes(asset.license)
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

    expect(validateAssetRegistry([invalid])).toEqual([
      'source:invalid',
      'path:invalid',
      'primary:invalid'
    ]);
  });

  it('reports a primary path that is absent from the physical files', () => {
    const invalid = {
      ...EXHIBITION_ASSETS[0],
      id: 'mismatch',
      localPath: '/exhibition/models/mismatch.glb'
    } as ExhibitionAsset;
    expect(validateAssetRegistry([invalid])).toContain('primary:mismatch');
  });

  it('reports incomplete PBR material slots', () => {
    const stone = EXHIBITION_ASSETS.find((asset) => asset.id === 'stone-pbr')!;
    expect(validateAssetRegistry([{ ...stone, files: stone.files.slice(0, 3) }])).toContain(
      'material:stone-pbr'
    );
  });

  it('declares complete PBR map bundles for stone and walnut', () => {
    for (const id of ['stone-pbr', 'walnut-pbr']) {
      const entry = EXHIBITION_ASSETS.find((asset) => asset.id === id);
      expect(entry?.files.map((file) => file.materialSlot)).toEqual([
        'baseColor',
        'normal',
        'roughness',
        'ao'
      ]);
    }
  });

  it('matches every registered local file size and SHA-256', () => {
    for (const entry of EXHIBITION_ASSETS) {
      for (const file of entry.files) {
        const diskPath = resolve(process.cwd(), 'public', file.localPath.slice(1));
        const bytes = readFileSync(diskPath);
        expect(statSync(diskPath).size, file.localPath).toBe(file.byteSize);
        expect(createHash('sha256').update(bytes).digest('hex'), file.localPath).toBe(file.sha256);
        expect(
          file.directUrl?.startsWith('https://') ?? entry.license === 'project-owned',
          file.localPath
        ).toBe(true);
      }
    }
  });

  it('registers every physical exhibition file and ships the Basis transcoder', () => {
    const exhibitionRoot = resolve(process.cwd(), 'public', 'exhibition');
    const physicalPaths = readdirSync(exhibitionRoot, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) =>
        `/exhibition/${resolve(entry.parentPath, entry.name)
          .slice(exhibitionRoot.length + 1)
          .replaceAll('\\', '/')}`
      )
      .sort();
    const registeredPaths = EXHIBITION_ASSETS.flatMap((entry) =>
      entry.files.map((file) => file.localPath)
    ).sort();
    expect(physicalPaths).toEqual(registeredPaths);
    expect(statSync(resolve(process.cwd(), 'public/basis/basis_transcoder.js')).size).toBeGreaterThan(0);
    expect(statSync(resolve(process.cwd(), 'public/basis/basis_transcoder.wasm')).size).toBeGreaterThan(0);
  });
});
