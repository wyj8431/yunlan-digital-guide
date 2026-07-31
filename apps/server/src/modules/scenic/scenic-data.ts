// 加载并导出经过类型约束的本地景区静态数据。
import scenicData from '../../data/yunlan-town.json' with { type: 'json' };
import type { ScenicAreaSummary, ScenicData } from '../../types/scenic.js';

const quickQuestions = [
  '先介绍一下你自己',
  '推荐几个国内热门地区的景区和路线',
  '帮我规划一条乌镇半日游路线',
  '乌镇有哪些适合拍照的地方？',
  '带孩子游览乌镇怎么安排？',
  '乌镇几点开放，门票多少钱？'
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
