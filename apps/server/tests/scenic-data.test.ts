import { describe, expect, it } from 'vitest';
import { getScenicAreaSummary, loadScenicData } from '../src/modules/scenic/scenic-data';

describe('scenic data', () => {
  it('loads Yunlan town data with required content counts', () => {
    const data = loadScenicData();

    expect(data.scenicArea.name).toBe('云岚古镇');
    expect(data.spots).toHaveLength(5);
    expect(data.routes).toHaveLength(2);
    expect(data.services).toHaveLength(5);
    expect(data.faqs.length).toBeGreaterThanOrEqual(4);
  });

  it('returns a public summary without long story fields', () => {
    const summary = getScenicAreaSummary();

    expect(summary.scenicArea.id).toBe('yunlan-town');
    expect(summary.spots[0]).toEqual({
      id: 'south-gate',
      name: '南门牌坊',
      summary: '云岚古镇的入口地标，牌坊纹样记录着古镇水路商贸的起源。'
    });
    expect('story' in summary.spots[0]).toBe(false);
  });
});
