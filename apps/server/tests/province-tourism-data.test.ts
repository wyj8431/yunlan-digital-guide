import { describe, expect, it } from 'vitest';
import {
  findProvinceTourismRecord,
  provinceTourismRecords
} from '../src/modules/guide/province-tourism-data';

const expectedRegions = [
  '北京',
  '天津',
  '河北',
  '山西',
  '内蒙古',
  '辽宁',
  '吉林',
  '黑龙江',
  '上海',
  '江苏',
  '浙江',
  '安徽',
  '福建',
  '江西',
  '山东',
  '河南',
  '湖北',
  '湖南',
  '广东',
  '广西',
  '海南',
  '重庆',
  '四川',
  '贵州',
  '云南',
  '西藏',
  '陕西',
  '甘肃',
  '青海',
  '宁夏',
  '新疆',
  '香港',
  '澳门',
  '台湾'
];

describe('province tourism data', () => {
  it('covers every provincial-level region with 15 concrete attractions', () => {
    expect(provinceTourismRecords.map((record) => record.province).sort()).toEqual(
      [...expectedRegions].sort()
    );
    expect(provinceTourismRecords.flatMap((record) => record.highlights)).toHaveLength(510);

    for (const record of provinceTourismRecords) {
      expect(record.highlights).toHaveLength(15);
      expect(new Set(record.highlights.map((spot) => spot.name)).size).toBe(15);
      expect(record.routes.length).toBeGreaterThanOrEqual(2);
      expect(record.summary.trim()).not.toBe('');
      expect(record.transport.trim()).not.toBe('');
      expect(record.stay.trim()).not.toBe('');
      expect(record.season.trim()).not.toBe('');
      expect(record.tips.trim()).not.toBe('');

      for (const spot of record.highlights) {
        expect(spot.city.trim()).not.toBe('');
        expect(spot.categories.length).toBeGreaterThan(0);
        expect(spot.recommendation.length).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it('contains detailed Shanxi recommendations and resolves province aliases', () => {
    const shanxi = findProvinceTourismRecord('山西省');
    const names = shanxi?.highlights.map((spot) => spot.name) ?? [];

    expect(shanxi?.province).toBe('山西');
    expect(names).toEqual(
      expect.arrayContaining([
        '平遥古城',
        '云冈石窟',
        '五台山',
        '晋祠',
        '壶口瀑布',
        '悬空寺',
        '应县木塔',
        '王家大院',
        '乔家大院',
        '雁门关',
        '皇城相府',
        '太行山大峡谷',
        '芦芽山',
        '洪洞大槐树',
        '绵山'
      ])
    );
  });
});
