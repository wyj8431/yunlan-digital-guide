import type { SubtitleCue, VideoSummary } from './video.types.js';

export type SeedSubtitleCue = Omit<SubtitleCue, 'id'>;

// These are six individually verified public pages matched to the project's scenic spots.
const WUZHEN_VIDEO_URLS = [
  'https://www.youtube.com/watch?v=aVFt_EA54-k',
  'https://www.youtube.com/watch?v=6Ru8Kgocu18',
  'https://www.youtube.com/watch?v=2nW87xKhqqE',
  'https://www.youtube.com/watch?v=2MZcNW9ooLs',
  'https://www.youtube.com/watch?v=rZ68lW8rFPQ',
  'https://www.youtube.com/watch?v=K8Og2x8tPkg'
] as const;

const WUZHEN_COVER_URLS = WUZHEN_VIDEO_URLS.map(
  (url) => `https://i.ytimg.com/vi/${new URL(url).searchParams.get('v')}/hqdefault.jpg`
) as readonly string[];

export const VIDEO_SEEDS: VideoSummary[] = [
  {
    id: 'wuzhen-water-town',
    title: '乌镇水乡整体导览',
    description: '从整体视角认识乌镇水乡空间、古镇建筑与水路环境。',
    coverUrl: WUZHEN_COVER_URLS[0],
    videoUrl: WUZHEN_VIDEO_URLS[0],
    durationMs: 439_000
  },
  {
    id: 'wuzhen-xizha-night',
    title: '乌镇西栅老街',
    description: '对应项目中的西栅老街景点，观看水巷、街巷建筑与夜游氛围。',
    coverUrl: WUZHEN_COVER_URLS[1],
    videoUrl: WUZHEN_VIDEO_URLS[1],
    durationMs: 506_000
  },
  {
    id: 'wuzhen-dongzha-old-street',
    title: '乌镇东栅古镇',
    description: '对应项目中的东栅景区，了解传统街巷、民居与生活化水乡肌理。',
    coverUrl: WUZHEN_COVER_URLS[2],
    videoUrl: WUZHEN_VIDEO_URLS[2],
    durationMs: 2_395_000
  },
  {
    id: 'wuzhen-muxin-art-museum',
    title: '木心美术馆',
    description: '对应项目中的木心美术馆，展示乌镇文化场馆与建筑空间。',
    coverUrl: WUZHEN_COVER_URLS[3],
    videoUrl: WUZHEN_VIDEO_URLS[3],
    durationMs: 1_557_000
  },
  {
    id: 'wuzhen-grand-theater',
    title: '乌镇大剧院夜景',
    description: '对应项目中的乌镇大剧院，观看剧院建筑与水岸夜景。',
    coverUrl: WUZHEN_COVER_URLS[4],
    videoUrl: WUZHEN_VIDEO_URLS[4],
    durationMs: 39_000
  },
  {
    id: 'wuzhen-water-market',
    title: '乌镇水上集市与摇橹船',
    description: '对应项目中的水上集市，包含早茶、市集、水巷和摇橹船内容。',
    coverUrl: WUZHEN_COVER_URLS[5],
    videoUrl: WUZHEN_VIDEO_URLS[5],
    durationMs: 1_662_000
  }
];

const DANMAKU_PROGRESS = [0.04, 0.12, 0.24, 0.36, 0.48, 0.6, 0.72, 0.82, 0.9, 0.97] as const;

export const DANMAKU_SEEDS = VIDEO_SEEDS.flatMap((video, videoIndex) =>
  [
    ['沿途风景太舒服了', 0, 'scroll', '#ffffff'],
    ['这个角度拍得真好', 1, 'scroll', '#aee7ff'],
    ['收藏这段路线', 2, 'top', '#f5d76e'],
    ['想去现场看看', 3, 'scroll', '#ffc0cb'],
    ['字幕和画面同步得很好', 4, 'scroll', '#ffffff'],
    ['这段光影很漂亮', 5, 'bottom', '#aee7ff'],
    ['旅游攻略先记下了', 6, 'scroll', '#f5d76e'],
    ['下一站继续出发', 7, 'scroll', '#ffc0cb'],
    ['第一次看也不会迷路', 8, 'top', '#ffffff'],
    ['慢慢看，细节很多', 9, 'scroll', '#aee7ff']
  ].map(([content, progressIndex, position, color], index) => ({
    videoId: video.id,
    content,
    timestampMs: Math.round(video.durationMs * DANMAKU_PROGRESS[Number(progressIndex)]),
    position: position as 'scroll' | 'top' | 'bottom',
    color: color as '#ffffff' | '#f5d76e' | '#aee7ff' | '#ffc0cb',
    nickname: `游客 ${1000 + videoIndex * 10 + index}`
  }))
);

export const SUBTITLE_CUE_SEEDS: SeedSubtitleCue[] = VIDEO_SEEDS.flatMap((video) => [
  {
    videoId: video.id,
    startMs: 0,
    endMs: Math.round(video.durationMs * 0.2),
    content: `欢迎观看《${video.title}》。`
  },
  {
    videoId: video.id,
    startMs: Math.round(video.durationMs * 0.25),
    endMs: Math.round(video.durationMs * 0.55),
    content: video.description
  },
  {
    videoId: video.id,
    startMs: Math.round(video.durationMs * 0.7),
    endMs: video.durationMs,
    content: '请跟随镜头继续探索沿途景观。'
  }
]);

export const SENSITIVE_KEYWORD_SEEDS = ['笨蛋', '广告', '剧透', '辱骂', '诈骗'];
