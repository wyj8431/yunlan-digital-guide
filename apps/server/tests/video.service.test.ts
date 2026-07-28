import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VideoRepository } from '../src/modules/video/video.repository';
import { VideoService } from '../src/modules/video/video.service';
import type { CreateDanmakuInput } from '../src/modules/video/video.types';

describe('video service', () => {
  let directory: string;
  let databasePath: string;
  let repository: VideoRepository;
  let service: VideoService;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'yunlan-video-'));
    databasePath = join(directory, 'videos.sqlite');
    repository = new VideoRepository(databasePath);
    service = new VideoService(repository);
  });

  afterEach(async () => {
    repository.close();
    await rm(directory, { recursive: true, force: true });
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

  it('keeps danmaku after closing and reopening the same database file', () => {
    const video = service.listVideos()[0];
    const saved = service.createDanmaku(video.id, {
      content: '会保留下来',
      timestampMs: 2_400,
      position: 'scroll',
      color: '#aee7ff'
    });

    repository.close();
    repository = new VideoRepository(databasePath);
    service = new VideoService(repository);

    expect(service.listVideos()).toHaveLength(6);
    expect(service.listDanmaku(video.id, 0, video.durationMs)).toEqual([saved]);
  });
});
