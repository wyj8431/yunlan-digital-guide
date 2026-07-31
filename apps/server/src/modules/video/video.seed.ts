import type { SubtitleCue, VideoSummary } from './video.types.js';

export type SeedSubtitleCue = Omit<SubtitleCue, 'id'>;

// The demo catalogue is intentionally self-contained at the data level, but the
// repository does not ship licensed media binaries. Keep the demo playable by
// using a stable, openly available MP4 until project-owned assets are supplied.
const DEMO_VIDEO_URLS = [
  'https://www.youtube.com/watch?v=zUC8s2Xo7TE',
  'https://www.youtube.com/watch?v=o61Ge2umyos',
  'https://www.youtube.com/watch?v=ROFmtJLCq1k',
  'https://www.youtube.com/watch?v=-NUkxiZmYx0',
  'https://www.youtube.com/watch?v=U4eLHeMETd0',
  'https://www.youtube.com/watch?v=kpEAl4p2n18'
] as const;

export const VIDEO_SEEDS: VideoSummary[] = [
  {
    id: 'wuzhen-water-town',
    title: '乌镇水巷慢游',
    description: '沿西栅水巷看石桥、临水民居与摇橹船。',
    coverUrl: 'https://i.ytimg.com/vi/zUC8s2Xo7TE/hqdefault.jpg',
    videoUrl: DEMO_VIDEO_URLS[0],
    durationMs: 180_000
  },
  {
    id: 'huangshan-cloud-sea',
    title: '黄山云海日出',
    description: '从光明顶远眺群峰、云海与清晨日光。',
    coverUrl: 'https://i.ytimg.com/vi/o61Ge2umyos/hqdefault.jpg',
    videoUrl: DEMO_VIDEO_URLS[1],
    durationMs: 210_000
  },
  {
    id: 'guilin-li-river',
    title: '桂林漓江山水',
    description: '乘船穿行漓江，欣赏喀斯特峰林与江畔村落。',
    coverUrl: 'https://i.ytimg.com/vi/ROFmtJLCq1k/hqdefault.jpg',
    videoUrl: DEMO_VIDEO_URLS[2],
    durationMs: 195_000
  },
  {
    id: 'dunhuang-mogao',
    title: '敦煌莫高窟',
    description: '走近丝路石窟艺术，了解壁画与彩塑的历史。',
    coverUrl: 'https://i.ytimg.com/vi/-NUkxiZmYx0/hqdefault.jpg',
    videoUrl: DEMO_VIDEO_URLS[3],
    durationMs: 240_000
  },
  {
    id: 'sanya-coastline',
    title: '三亚海岸风光',
    description: '从椰林步道到清澈海湾，感受热带海岸景观。',
    coverUrl: 'https://i.ytimg.com/vi/U4eLHeMETd0/hqdefault.jpg',
    videoUrl: DEMO_VIDEO_URLS[4],
    durationMs: 165_000
  },
  {
    id: 'harbin-ice-city',
    title: '哈尔滨冰雪之城',
    description: '夜游冰雪建筑群，记录北国冬季的灯光与街景。',
    coverUrl: 'https://i.ytimg.com/vi/kpEAl4p2n18/hqdefault.jpg',
    videoUrl: DEMO_VIDEO_URLS[5],
    durationMs: 225_000
  }
];

export const DANMAKU_SEEDS = VIDEO_SEEDS.flatMap((video, videoIndex) =>
  [
    ['沿途风景太舒服了', 4_000, 'scroll', '#ffffff'],
    ['这个角度拍得真好', 9_000, 'scroll', '#aee7ff'],
    ['收藏这段路线', 15_000, 'top', '#f5d76e'],
    ['想去现场看看', 22_000, 'scroll', '#ffc0cb'],
    ['字幕和画面同步得很好', 31_000, 'scroll', '#ffffff'],
    ['这段光影很漂亮', 42_000, 'bottom', '#aee7ff'],
    ['旅游攻略先记下了', 55_000, 'scroll', '#f5d76e'],
    ['下一站继续出发', 68_000, 'scroll', '#ffc0cb'],
    ['第一次看也不会迷路', 82_000, 'top', '#ffffff'],
    ['慢慢看，细节很多', 98_000, 'scroll', '#aee7ff']
  ].map(([content, timestampMs, position, color], index) => ({
    videoId: video.id,
    content,
    timestampMs: Number(timestampMs),
    position: position as 'scroll' | 'top' | 'bottom',
    color: color as '#ffffff' | '#f5d76e' | '#aee7ff' | '#ffc0cb',
    nickname: `游客 ${1000 + videoIndex * 10 + index}`
  }))
);

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
