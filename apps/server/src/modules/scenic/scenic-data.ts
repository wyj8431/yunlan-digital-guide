import scenicData from '../../data/yunlan-town.json' with { type: 'json' };
import type { ScenicAreaSummary, ScenicData } from '../../types/scenic.js';

const quickQuestions = [
  '帮我规划一条半日游路线',
  '云岚古镇有哪些适合拍照的地方？',
  '带孩子游览怎么安排？',
  '古镇几点开放，门票多少钱？'
];

export function loadScenicData(): ScenicData {
  return scenicData as ScenicData;
}

export function getScenicAreaSummary(): ScenicAreaSummary {
  const data = loadScenicData();

  return {
    scenicArea: data.scenicArea,
    spots: data.spots.map(({ id, name, summary }) => ({ id, name, summary })),
    routes: data.routes.map(({ id, name, duration, description }) => ({
      id,
      name,
      duration,
      description
    })),
    services: data.services,
    quickQuestions
  };
}
