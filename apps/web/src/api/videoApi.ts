import type { VideoDetailResponse, VideoListResponse } from '../types/video';

export class VideoApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(`${message}（HTTP ${status}）`);
    this.name = 'VideoApiError';
  }
}

async function readVideoResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : '视频服务请求失败';
    throw new VideoApiError(message, response.status);
  }

  return body as T;
}

export async function fetchVideos(): Promise<VideoListResponse> {
  return readVideoResponse<VideoListResponse>(await fetch('/api/videos'));
}

export async function fetchVideo(videoId: string): Promise<VideoDetailResponse> {
  return readVideoResponse<VideoDetailResponse>(
    await fetch(`/api/videos/${encodeURIComponent(videoId)}`)
  );
}
