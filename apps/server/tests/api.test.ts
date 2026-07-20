import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

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
});
