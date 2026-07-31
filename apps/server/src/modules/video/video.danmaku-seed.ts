import { VIDEO_SEEDS } from './video.seed.js';
import type { DanmakuColor, DanmakuPosition } from './video.types.js';

const COMMENTS = [
  '这个镜头太美了',
  '已经加入旅行清单',
  '实景比照片更震撼',
  '想和朋友一起来',
  '这段路线值得收藏',
  '慢慢看很治愈',
  '航拍视角很开阔',
  '当地风景很有特色',
  '下一站就选这里',
  '边看边做攻略',
  '画面细节很丰富',
  '现场一定更漂亮'
] as const;

const COLORS: DanmakuColor[] = ['#ffffff', '#f5d76e', '#aee7ff', '#ffc0cb'];
const POSITIONS: DanmakuPosition[] = ['scroll', 'scroll', 'scroll', 'top', 'bottom'];

export const DENSE_DANMAKU_SEEDS = VIDEO_SEEDS.flatMap((video, videoIndex) =>
  Array.from({ length: 84 }, (_, index) => ({
    videoId: video.id,
    content: `${COMMENTS[index % COMMENTS.length]} ${Math.floor(index / COMMENTS.length) + 1}`,
    timestampMs: 1_500 + Math.floor(index / 6) * 5_000 + (index % 6) * 280,
    position: POSITIONS[index % POSITIONS.length],
    color: COLORS[index % COLORS.length],
    nickname: `游客 ${2000 + videoIndex * 100 + index}`
  }))
);
