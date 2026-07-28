import { centralSouthProvinceTourismRecords } from './province-tourism-central-south.js';
import { eastProvinceTourismRecords } from './province-tourism-east.js';
import { northEastProvinceTourismRecords } from './province-tourism-north-east.js';
import type { ProvinceTourismRecord } from './province-tourism.types.js';
import { westProvinceTourismRecords } from './province-tourism-west.js';

export type { ProvinceTourismHighlight, ProvinceTourismRecord } from './province-tourism.types.js';

export const provinceTourismRecords: ProvinceTourismRecord[] = [
  ...northEastProvinceTourismRecords,
  ...eastProvinceTourismRecords,
  ...centralSouthProvinceTourismRecords,
  ...westProvinceTourismRecords
];

export function findProvinceTourismRecord(name: string): ProvinceTourismRecord | null {
  const normalized = name.trim();
  return (
    provinceTourismRecords.find(
      (record) => record.province === normalized || record.aliases.includes(normalized)
    ) ?? null
  );
}

export function formatProvinceTourismRecord(record: ProvinceTourismRecord): string {
  return [
    record.summary,
    '具体景点推荐：',
    ...record.highlights.map(
      (spot, index) =>
        `${index + 1}. ${spot.name}（${spot.city}）：${spot.recommendation} 类型：${spot.categories.join('、')}。`
    ),
    '省内路线：',
    ...record.routes.map((route) => `- ${route}`),
    `交通方式：${record.transport}`,
    `住宿建议：${record.stay}`,
    `适合季节：${record.season}`,
    `注意事项：${record.tips}`
  ].join('\n');
}
