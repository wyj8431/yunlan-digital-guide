import { describe, expect, it } from 'vitest';
import {
  getDistrict,
  getTour,
  WUZHEN_DISTRICTS,
  WUZHEN_EXHIBITION,
  WUZHEN_TOURS,
  WUZHEN_WEATHER
} from '../src/exhibition/wuzhenConfig';

describe('Wuzhen exhibition configuration', () => {
  it('defines the four navigation scenes in the supplied design brief', () => {
    expect(WUZHEN_DISTRICTS.map((district) => district.id)).toEqual([
      'overview',
      'xizha',
      'dyeworks',
      'night-river'
    ]);
    expect(getDistrict('dyeworks').title).toContain('蓝印花布');
    expect(WUZHEN_EXHIBITION.tour.order).toHaveLength(4);
  });

  it('keeps sun, night, and rain lighting configurable outside the renderer', () => {
    expect(Object.keys(WUZHEN_WEATHER)).toEqual(['sun', 'night', 'rain']);
    expect(WUZHEN_WEATHER.rain.rain).toBe(true);
    expect(WUZHEN_WEATHER.night.lanternIntensity).toBeGreaterThan(
      WUZHEN_WEATHER.sun.lanternIntensity
    );
  });

  it('offers three configurable, interruptible tour routes', () => {
    expect(WUZHEN_TOURS).toHaveLength(3);
    expect(getTour('indigo-craft').order).toContain('dyeworks');
    expect(getTour('lantern-night').order.at(-1)).toBe('night-river');
  });
});
