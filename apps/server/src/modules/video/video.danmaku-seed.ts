import { VIDEO_SEEDS } from './video.seed.js';
import type { DanmakuColor, DanmakuPosition } from './video.types.js';

const COMMENTS = [
  '乌镇水巷太有江南味了',
  '已经加入乌镇旅行清单',
  '实景比照片更有氛围',
  '想和朋友一起来乌镇',
  '这段路线值得收藏',
  '乌镇夜游很治愈',
  '摇橹船视角很开阔',
  '西栅街巷细节很丰富',
  '下一站就去水上集市',
  '边看边做乌镇攻略',
  '木心美术馆值得安排',
  '现场一定更漂亮'
] as const;

const COLORS: DanmakuColor[] = ['#ffffff', '#f5d76e', '#aee7ff', '#ffc0cb'];
const POSITIONS: DanmakuPosition[] = ['scroll', 'scroll', 'scroll', 'top', 'bottom'];

export const DENSE_DANMAKU_SEEDS = VIDEO_SEEDS.flatMap((video, videoIndex) =>
  Array.from({ length: 84 }, (_, index) => ({
    videoId: video.id,
    content: `${COMMENTS[index % COMMENTS.length]} ${Math.floor(index / COMMENTS.length) + 1}`,
    timestampMs: Math.round(video.durationMs * (0.03 + (index / 83) * 0.94)),
    position: POSITIONS[index % POSITIONS.length],
    color: COLORS[index % COLORS.length],
    nickname: `游客 ${2000 + videoIndex * 100 + index}`
  }))
);
