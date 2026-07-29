import { describe, expect, it } from 'vitest';
import { EXHIBITION_LAYOUT } from '../src/exhibition/exhibitionLayout';
import { createHallMaterials } from '../src/exhibition/exhibitionMaterials';
import { QUALITY_PROFILES } from '../src/exhibition/quality/qualityProfile';
import { createMuseumCases } from '../src/exhibition/scene/createMuseumCases';

describe('museum display cases', () => {
  it('creates four professional case systems and stable labels', () => {
    const result = createMuseumCases(
      EXHIBITION_LAYOUT,
      createHallMaterials(),
      QUALITY_PROFILES.high
    );
    expect(result.root.children.map((child) => child.name)).toEqual(
      expect.arrayContaining([
        'bicycle-plinth',
        'shuttle-plinth',
        'tea-glass-case',
        'silk-glass-case'
      ])
    );
    expect(result.areaLights).toHaveLength(8);
    expect(result.labels.map((label) => label.userData.exhibitId)).toEqual(
      expect.arrayContaining([
        'west-lake-bicycle',
        'green-mobility-car',
        'silk-and-tea',
        'silk-garment'
      ])
    );
  });

  it('budgets lights and keeps glass physically transparent', () => {
    const medium = createMuseumCases(
      EXHIBITION_LAYOUT,
      createHallMaterials(),
      QUALITY_PROFILES.medium
    );
    const low = createMuseumCases(EXHIBITION_LAYOUT, createHallMaterials(), QUALITY_PROFILES.low);
    expect(medium.areaLights).toHaveLength(4);
    expect(low.areaLights).toHaveLength(2);
    expect(
      medium.glassMaterials.every(
        (material) => material.transparent && material.opacity < 1 && material.transmission > 0
      )
    ).toBe(true);
  });
});
