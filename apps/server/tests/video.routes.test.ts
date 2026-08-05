import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, type ServerApp } from '../src/app';

describe('video routes', () => {
  let directory: string;
  let app: ServerApp;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'yunlan-video-routes-'));
    app = createApp({ videoDatabasePath: join(directory, 'videos.sqlite') });
  });

  afterEach(async () => {
    try {
      app?.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('lists video summaries and exposes details with a subtitle timeline', async () => {
    const list = await request(app.callback()).get('/api/videos').expect(200);

    expect(list.body.videos).toHaveLength(6);
    expect(list.body.videos[0]).toMatchObject({ id: 'wuzhen-water-town' });
    expect(list.body.videos[0].subtitleCues).toBeUndefined();

    await request(app.callback())
      .get('/api/videos/wuzhen-water-town')
      .expect(200)
      .expect(({ body }) => {
        expect(body.video.id).toBe('wuzhen-water-town');
        expect(body.video.subtitleCues).toHaveLength(3);
      });

    await request(app.callback())
      .get('/api/videos/wuzhen-water-town/subtitles')
      .expect(200)
      .expect(({ body }) => {
        expect(body.subtitles).toHaveLength(3);
        expect(body.subtitles[0]).toMatchObject({ videoId: 'wuzhen-water-town', startMs: 0 });
      });
  });

  it('filters, persists, and lists danmaku only for the requested video', async () => {
    const created = await request(app.callback())
      .post('/api/videos/wuzhen-water-town/danmaku')
      .send({ content: '广告别剧透', timestampMs: 12000, color: '#ffffff', position: 'scroll' })
      .expect(201);

    expect(created.body.danmaku).toMatchObject({
      videoId: 'wuzhen-water-town',
      content: '****别****',
      timestampMs: 12000
    });

    await request(app.callback())
      .get('/api/videos/wuzhen-water-town/danmaku?from=12000&to=12000')
      .expect(200)
      .expect(({ body }) => expect(body.danmaku).toEqual([created.body.danmaku]));

    await request(app.callback())
      .get('/api/videos/wuzhen-xizha-night/danmaku?from=0&to=20000')
      .expect(200)
      .expect(({ body }) => expect(body.danmaku).toEqual([]));
  });

  it('returns the service error contract for invalid input and missing videos', async () => {
    await request(app.callback())
      .get('/api/videos/wuzhen-water-town/danmaku?from=bad&to=1000')
      .expect(400)
      .expect(({ body }) => {
        expect(body).toEqual({ code: 'INVALID_DANMAKU_WINDOW', message: '弹幕查询时间窗口无效。' });
      });

    await request(app.callback())
      .post('/api/videos/wuzhen-water-town/danmaku')
      .send([])
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('INVALID_DANMAKU_INPUT'));

    await request(app.callback())
      .post('/api/videos/wuzhen-water-town/danmaku')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400)
      .expect('Content-Type', /json/)
      .expect(({ body }) => {
        expect(body).toEqual({ code: 'INVALID_JSON', message: '请求 JSON 格式无效。' });
      });

    await request(app.callback())
      .post('/api/videos/wuzhen-water-town/danmaku/')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400)
      .expect('Content-Type', /json/)
      .expect(({ body }) => {
        expect(body).toEqual({ code: 'INVALID_JSON', message: '请求 JSON 格式无效。' });
      });

    await request(app.callback())
      .post('/api/videos/wuzhen-water-town/danmaku')
      .send({})
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('INVALID_DANMAKU_CONTENT'));

    for (const query of [
      'from=1&from=2&to=3',
      'from=9007199254740992&to=9007199254740992',
      'from=001&to=3'
    ]) {
      await request(app.callback())
        .get(`/api/videos/wuzhen-water-town/danmaku?${query}`)
        .expect(400)
        .expect(({ body }) => expect(body.code).toBe('INVALID_DANMAKU_WINDOW'));
    }

    await request(app.callback())
      .get('/api/videos/missing-video')
      .expect(404)
      .expect(({ body }) =>
        expect(body).toEqual({ code: 'VIDEO_NOT_FOUND', message: '视频不存在。' })
      );
  });
});
