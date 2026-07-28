export const DANMAKU_POSITIONS = ['scroll', 'top', 'bottom'] as const;
export const DANMAKU_COLORS = ['#ffffff', '#f5d76e', '#aee7ff', '#ffc0cb'] as const;

export type DanmakuPosition = (typeof DANMAKU_POSITIONS)[number];
export type DanmakuColor = (typeof DANMAKU_COLORS)[number];

export type VideoSummary = {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  videoUrl: string;
  durationMs: number;
};

export type SubtitleCue = {
  id: number;
  videoId: string;
  startMs: number;
  endMs: number;
  content: string;
};

export type VideoDetail = VideoSummary & {
  subtitleCues: SubtitleCue[];
};

export type Danmaku = {
  id: number;
  videoId: string;
  content: string;
  timestampMs: number;
  position: DanmakuPosition;
  color: DanmakuColor;
  nickname: string;
  createdAt: string;
};

export type CreateDanmakuInput = {
  content: string;
  timestampMs: number;
  position: DanmakuPosition;
  color: DanmakuColor;
};
