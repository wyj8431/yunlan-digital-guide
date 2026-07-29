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

  it('creates IES track spots and contact shadow receivers without shadowing glass or labels', () => {
    const result = createMuseumCases(
      EXHIBITION_LAYOUT,
      createHallMaterials(),
      QUALITY_PROFILES.high
    );
    const iesTexture = { isTexture: true } as never;

    result.setIesTexture(iesTexture);

    expect(result.iesLights).toHaveLength(4);
    expect(result.iesLights.every((light) => light.iesMap === iesTexture)).toBe(true);
    expect(result.contactShadows).toHaveLength(4);
    expect(result.contactShadows.every((shadow) => shadow.receiveShadow)).toBe(true);
    expect(result.glassMeshes.every((glass) => glass.castShadow === false)).toBe(true);
    expect(result.labels.every((label) => label.castShadow === false)).toBe(true);
  });

  it('eases proximity lighting without replacing materials or lights', () => {
    const result = createMuseumCases(
      EXHIBITION_LAYOUT,
      createHallMaterials(),
      QUALITY_PROFILES.high
    );
    const exhibitId = 'west-lake-bicycle';
    const label = result.labels.find((candidate) => candidate.userData.exhibitId === exhibitId)!;
    const material = label.material;
    const light = result.focusLights.get(exhibitId)![0];

    result.setProximity(exhibitId, 1);
    result.update(0.16);

    expect(label.material).toBe(material);
    expect(result.focusLights.get(exhibitId)![0]).toBe(light);
    expect(light.intensity).toBeGreaterThan(2.6);
    expect(light.intensity).toBeLessThan(5);

    result.update(0.16);
    expect(light.intensity).toBeCloseTo(5, 5);
  });

  it('keeps every display system outside the 2.4 metre central aisle', () => {
    const result = createMuseumCases(
      EXHIBITION_LAYOUT,
      createHallMaterials(),
      QUALITY_PROFILES.high
    );
    const cases = result.root.children.filter(
      (child) => child.name.endsWith('plinth') || child.name.endsWith('case')
    );

    expect(cases.every((display) => Math.abs(display.position.x) - 1.4 >= 1.2)).toBe(true);
  });
});
