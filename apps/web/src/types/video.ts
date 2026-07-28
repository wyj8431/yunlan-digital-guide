export type VideoSummary = {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  videoUrl: string;
  durationMs: number;
};

export type VideoListResponse = {
  videos: VideoSummary[];
};

export type SubtitleCue = {
  id: number;
  videoId: string;
  startMs: number;
  endMs: number;
  content: string;
};

export type DanmakuPosition = 'scroll' | 'top' | 'bottom';
export type DanmakuColor = '#ffffff' | '#f5d76e' | '#aee7ff' | '#ffc0cb';

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

export type CreateDanmakuInput = Pick<Danmaku, 'content' | 'timestampMs' | 'position' | 'color'>;

export type VideoDetail = VideoSummary & {
  subtitleCues: SubtitleCue[];
};

export type VideoDetailResponse = {
  video: VideoDetail;
};

export type SubtitleResponse = { subtitles: SubtitleCue[] };
export type DanmakuListResponse = { danmaku: Danmaku[] };
export type DanmakuResponse = { danmaku: Danmaku };
