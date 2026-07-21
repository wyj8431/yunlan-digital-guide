import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('server api', () => {
  it('returns health status', async () => {
    const app = createApp();

    await request(app.callback())
      .get('/api/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ ok: true, service: 'yunlan-guide-api' });
      });
  });

  it('returns scenic area summary', async () => {
    const app = createApp();

    await request(app.callback())
      .get('/api/scenic-area')
      .expect(200)
      .expect(({ body }) => {
        expect(body.scenicArea.name).toBe('云岚古镇');
        expect(body.spots).toHaveLength(5);
        expect(body.quickQuestions).toContain('帮我规划一条半日游路线');
      });
  });

  it('returns a clear guide chat validation error', async () => {
    const app = createApp();

    await request(app.callback())
      .post('/api/guide/chat')
      .send({ message: '' })
      .expect(400)
      .expect(({ body }) => {
        expect(body).toEqual({ code: 'EMPTY_MESSAGE', message: '请输入想咨询的导游问题。' });
      });
  });

  it('returns virtual human fallback config when xfyun is not enabled', async () => {
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_ENABLED', 'false');
    const app = createApp();

    await request(app.callback())
      .get('/api/virtual-human/config')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          enabled: false,
          provider: 'three-fallback'
        });
      });
  });

  it('returns a portrait full-body config when xfyun is enabled', async () => {
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_ENABLED', 'true');
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_APP_ID', 'app-id');
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_API_KEY', 'api-key');
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_API_SECRET', 'api-secret');
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_SERVICE_ID', 'service-id');
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_AVATAR_ID', 'avatar-id');
    const app = createApp();

    await request(app.callback())
      .get('/api/virtual-human/config')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          enabled: true,
          provider: 'xfyun-vms',
          serviceId: 'service-id',
          startConfig: {
            avatarId: 'avatar-id',
            width: 720,
            height: 1280,
            isSsl: true
          }
        });
      });
  });
});
