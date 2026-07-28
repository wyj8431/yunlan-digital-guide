import type { SubtitleCue, VideoSummary } from './video.types.js';

export type SeedSubtitleCue = Omit<SubtitleCue, 'id'>;

export const VIDEO_SEEDS: VideoSummary[] = [
  {
    id: 'wuzhen-water-town',
    title: '乌镇水巷慢游',
    description: '沿西栅水巷看石桥、临水民居与摇橹船。',
    coverUrl: '/media/videos/wuzhen-water-town-cover.webp',
    videoUrl: '/media/videos/wuzhen-water-town.mp4',
    durationMs: 180_000
  },
  {
    id: 'huangshan-cloud-sea',
    title: '黄山云海日出',
    description: '从光明顶远眺群峰、云海与清晨日光。',
    coverUrl: '/media/videos/huangshan-cloud-sea-cover.webp',
    videoUrl: '/media/videos/huangshan-cloud-sea.mp4',
    durationMs: 210_000
  },
  {
    id: 'guilin-li-river',
    title: '桂林漓江山水',
    description: '乘船穿行漓江，欣赏喀斯特峰林与江畔村落。',
    coverUrl: '/media/videos/guilin-li-river-cover.webp',
    videoUrl: '/media/videos/guilin-li-river.mp4',
    durationMs: 195_000
  },
  {
    id: 'dunhuang-mogao',
    title: '敦煌莫高窟',
    description: '走近丝路石窟艺术，了解壁画与彩塑的历史。',
    coverUrl: '/media/videos/dunhuang-mogao-cover.webp',
    videoUrl: '/media/videos/dunhuang-mogao.mp4',
    durationMs: 240_000
  },
  {
    id: 'sanya-coastline',
    title: '三亚海岸风光',
    description: '从椰林步道到清澈海湾，感受热带海岸景观。',
    coverUrl: '/media/videos/sanya-coastline-cover.webp',
    videoUrl: '/media/videos/sanya-coastline.mp4',
    durationMs: 165_000
  },
  {
    id: 'harbin-ice-city',
    title: '哈尔滨冰雪之城',
    description: '夜游冰雪建筑群，记录北国冬季的灯光与街景。',
    coverUrl: '/media/videos/harbin-ice-city-cover.webp',
    videoUrl: '/media/videos/harbin-ice-city.mp4',
    durationMs: 225_000
  }
];

export const SUBTITLE_CUE_SEEDS: SeedSubtitleCue[] = VIDEO_SEEDS.flatMap((video) => [
  {
    videoId: video.id,
    startMs: 0,
    endMs: 8_000,
    content: `欢迎观看《${video.title}》。`
  },
  {
    videoId: video.id,
    startMs: 12_000,
    endMs: 24_000,
    content: video.description
  },
  {
    videoId: video.id,
    startMs: 30_000,
    endMs: 44_000,
    content: '请跟随镜头继续探索沿途景观。'
  }
]);

export const SENSITIVE_KEYWORD_SEEDS = ['笨蛋', '广告', '剧透', '辱骂', '诈骗'];
