import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoRepository } from '../src/modules/video/video.repository';
import {
  SENSITIVE_KEYWORD_SEEDS,
  SUBTITLE_CUE_SEEDS,
  VIDEO_SEEDS
} from '../src/modules/video/video.seed';
import { VideoService, VideoServiceError } from '../src/modules/video/video.service';
import type { CreateDanmakuInput } from '../src/modules/video/video.types';

describe('video service', () => {
  let directory: string | undefined;
  let databasePath: string;
  let repository: VideoRepository | undefined;
  let service: VideoService;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'yunlan-video-'));
    databasePath = join(directory, 'videos.sqlite');

    try {
      repository = new VideoRepository(databasePath);
      service = new VideoService(repository);
    } catch (caught) {
      await rm(directory, { recursive: true, force: true });
      directory = undefined;
      throw caught;
    }
  });

  afterEach(async () => {
    try {
      repository?.close();
    } finally {
      repository = undefined;

      if (directory) {
        await rm(directory, { recursive: true, force: true });
        directory = undefined;
      }
    }
  });

  it('seeds six playable videos with ordered subtitle timelines', () => {
    const videos = service.listVideos();

    expect(videos).toHaveLength(6);
    expect(new Set(videos.map((video) => video.id)).size).toBe(6);

    for (const video of videos) {
      expect(video).toMatchObject({
        id: expect.any(String),
        title: expect.any(String),
        description: expect.any(String),
        coverUrl: expect.stringMatching(/^\/media\/videos\//),
        videoUrl: expect.stringMatching(/^\/media\/videos\//),
        durationMs: expect.any(Number)
      });
      expect(video.durationMs).toBeGreaterThan(0);

      const detail = service.getVideoDetail(video.id);
      expect(detail.subtitleCues.length).toBeGreaterThan(0);
      expect(detail.subtitleCues[0].startMs).toBe(0);

      for (let index = 0; index < detail.subtitleCues.length; index += 1) {
        const cue = detail.subtitleCues[index];
        expect(cue.endMs).toBeGreaterThan(cue.startMs);
        expect(cue.endMs).toBeLessThanOrEqual(video.durationMs);

        if (index > 0) {
          expect(cue.startMs).toBeGreaterThanOrEqual(detail.subtitleCues[index - 1].endMs);
        }
      }
    }
  });

  it('replaces every sensitive keyword before saving danmaku', () => {
    const video = service.listVideos()[0];
    const saved = service.createDanmaku(video.id, {
      content: '这个笨蛋在发广告，别剧透',
      timestampMs: 1_500,
      position: 'scroll',
      color: '#ffffff'
    });

    expect(saved).toMatchObject({
      content: '这个****在发****，别****',
      nickname: '游客 0001',
      timestampMs: 1_500,
      position: 'scroll',
      color: '#ffffff'
    });
    expect(service.listDanmaku(video.id, 0, 2_000)).toEqual([saved]);
  });

  it('accepts 80-character input when filtering expands the stored content', () => {
    const video = service.listVideos()[0];
    const saved = service.createDanmaku(video.id, {
      content: '广告'.repeat(40),
      timestampMs: 2_000,
      position: 'scroll',
      color: '#ffffff'
    });

    expect(saved.content).toBe('****'.repeat(40));
  });

  it('queries danmaku inside an inclusive playback window in timestamp order', () => {
    const video = service.listVideos()[0];
    service.createDanmaku(video.id, {
      content: 'later',
      timestampMs: 8_000,
      position: 'bottom',
      color: '#ffc0cb'
    });
    const middle = service.createDanmaku(video.id, {
      content: 'middle',
      timestampMs: 5_000,
      position: 'top',
      color: '#f5d76e'
    });
    const boundary = service.createDanmaku(video.id, {
      content: 'boundary',
      timestampMs: 6_000,
      position: 'scroll',
      color: '#aee7ff'
    });

    expect(service.listDanmaku(video.id, 5_000, 6_000)).toEqual([middle, boundary]);
  });

  it('isolates danmaku between videos', () => {
    const [firstVideo, secondVideo] = service.listVideos();
    const firstDanmaku = service.createDanmaku(firstVideo.id, {
      content: 'first video only',
      timestampMs: 3_000,
      position: 'scroll',
      color: '#ffffff'
    });
    const secondDanmaku = service.createDanmaku(secondVideo.id, {
      content: 'second video only',
      timestampMs: 3_000,
      position: 'scroll',
      color: '#ffffff'
    });

    expect(service.listDanmaku(firstVideo.id, 0, 4_000)).toEqual([firstDanmaku]);
    expect(service.listDanmaku(secondVideo.id, 0, 4_000)).toEqual([secondDanmaku]);
  });

  it('orders equal-timestamp danmaku by insertion id', () => {
    const video = service.listVideos()[0];
    const first = service.createDanmaku(video.id, {
      content: 'first',
      timestampMs: 4_000,
      position: 'scroll',
      color: '#ffffff'
    });
    const second = service.createDanmaku(video.id, {
      content: 'second',
      timestampMs: 4_000,
      position: 'top',
      color: '#f5d76e'
    });

    expect(service.listDanmaku(video.id, 4_000, 4_000).map((item) => item.id)).toEqual([
      first.id,
      second.id
    ]);
  });

  it.each([
    ['empty content', { content: '   ', timestampMs: 1, position: 'scroll', color: '#ffffff' }],
    [
      'content longer than 80 characters',
      { content: 'a'.repeat(81), timestampMs: 1, position: 'scroll', color: '#ffffff' }
    ],
    [
      'negative timestamp',
      { content: 'hello', timestampMs: -1, position: 'scroll', color: '#ffffff' }
    ],
    [
      'timestamp after duration',
      {
        content: 'hello',
        timestampMs: Number.MAX_SAFE_INTEGER,
        position: 'scroll',
        color: '#ffffff'
      }
    ],
    [
      'unsupported position',
      { content: 'hello', timestampMs: 1, position: 'left', color: '#ffffff' }
    ],
    [
      'unsupported color',
      { content: 'hello', timestampMs: 1, position: 'scroll', color: '#000000' }
    ]
  ])('rejects %s', (_name, input) => {
    const video = service.listVideos()[0];

    expect(() => service.createDanmaku(video.id, input as CreateDanmakuInput)).toThrow(/弹幕/);
  });

  it('returns structured 400, 404, and 500 service errors without leaking TypeError', () => {
    const video = service.listVideos()[0];

    expect(captureError(() => service.createDanmaku(video.id, null))).toMatchObject({
      name: 'VideoServiceError',
      code: 'INVALID_DANMAKU_INPUT',
      status: 400
    });
    expect(captureError(() => service.getVideoDetail('missing-video'))).toMatchObject({
      name: 'VideoServiceError',
      code: 'VIDEO_NOT_FOUND',
      status: 404
    });

    repository?.close();
    const storageError = captureError(() => service.listVideos());
    expect(storageError).toBeInstanceOf(VideoServiceError);
    expect(storageError).toMatchObject({
      code: 'VIDEO_STORAGE_ERROR',
      status: 500
    });
    expect(storageError).not.toBeInstanceOf(TypeError);
  });

  it('keeps seed initialization idempotent and restores missing rows in every seed table', () => {
    repository?.close();
    repository = new VideoRepository(databasePath);
    service = new VideoService(repository);

    expect(service.listVideos()).toHaveLength(VIDEO_SEEDS.length);
    expect(repository.listSensitiveKeywords()).toHaveLength(SENSITIVE_KEYWORD_SEEDS.length);
    expect(countSubtitleCues(service)).toBe(SUBTITLE_CUE_SEEDS.length);

    repository.close();
    repository = undefined;

    const database = new Database(databasePath);
    try {
      database.pragma('foreign_keys = ON');
      database
        .prepare('DELETE FROM sensitive_keywords WHERE keyword = ?')
        .run(SENSITIVE_KEYWORD_SEEDS[0]);
      database
        .prepare(
          `DELETE FROM subtitle_cues
           WHERE video_id = ? AND start_ms = ? AND end_ms = ? AND content = ?`
        )
        .run(
          SUBTITLE_CUE_SEEDS[0].videoId,
          SUBTITLE_CUE_SEEDS[0].startMs,
          SUBTITLE_CUE_SEEDS[0].endMs,
          SUBTITLE_CUE_SEEDS[0].content
        );
      database.prepare('DELETE FROM videos WHERE id = ?').run(VIDEO_SEEDS.at(-1)?.id);
    } finally {
      database.close();
    }

    repository = new VideoRepository(databasePath);
    service = new VideoService(repository);

    expect(service.listVideos()).toHaveLength(VIDEO_SEEDS.length);
    expect(new Set(repository.listSensitiveKeywords())).toEqual(new Set(SENSITIVE_KEYWORD_SEEDS));
    expect(countSubtitleCues(service)).toBe(SUBTITLE_CUE_SEEDS.length);
  });

  it('restores the final seed order when existing video sort orders were swapped', () => {
    repository?.close();
    repository = undefined;

    const database = new Database(databasePath);
    try {
      database.transaction(() => {
        database
          .prepare('UPDATE videos SET sort_order = ? WHERE id = ?')
          .run(-1, VIDEO_SEEDS[0].id);
        database.prepare('UPDATE videos SET sort_order = ? WHERE id = ?').run(0, VIDEO_SEEDS[1].id);
        database.prepare('UPDATE videos SET sort_order = ? WHERE id = ?').run(1, VIDEO_SEEDS[0].id);
      })();
    } finally {
      database.close();
    }

    repository = new VideoRepository(databasePath);
    service = new VideoService(repository);

    expect(service.listVideos().map((video) => video.id)).toEqual(
      VIDEO_SEEDS.map((video) => video.id)
    );
  });

  it('closes the database when schema or seed initialization fails', () => {
    const brokenDatabasePath = join(directory!, 'broken.sqlite');
    const database = new Database(brokenDatabasePath);
    database.exec('CREATE TABLE videos (id TEXT PRIMARY KEY)');
    database.close();
    const closeSpy = vi.spyOn(Database.prototype, 'close');

    try {
      expect(() => new VideoRepository(brokenDatabasePath)).toThrow();
      expect(closeSpy).toHaveBeenCalledTimes(1);
    } finally {
      closeSpy.mockRestore();
    }
  });

  it('keeps danmaku after closing and reopening the same database file', () => {
    const video = service.listVideos()[0];
    const saved = service.createDanmaku(video.id, {
      content: '会保留下来',
      timestampMs: 2_400,
      position: 'scroll',
      color: '#aee7ff'
    });

    repository?.close();
    repository = new VideoRepository(databasePath);
    service = new VideoService(repository);

    expect(service.listVideos()).toHaveLength(6);
    expect(service.listDanmaku(video.id, 0, video.durationMs)).toEqual([saved]);
  });
});

function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (caught) {
    return caught;
  }

  throw new Error('Expected action to throw.');
}

function countSubtitleCues(service: VideoService): number {
  return service
    .listVideos()
    .reduce((total, video) => total + service.getVideoDetail(video.id).subtitleCues.length, 0);
}
