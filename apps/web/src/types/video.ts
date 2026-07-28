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

export type VideoDetailResponse = {
  video: VideoSummary;
};
