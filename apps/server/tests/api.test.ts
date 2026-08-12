import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { getScenicAreaSummary } from '../src/modules/scenic/scenic-data';
import { ScenicLiveService } from '../src/modules/scenic/scenic-live.service';

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
        expect(body.scenicArea.name).toBe('乌镇景区');
        expect(body.spots).toHaveLength(5);
        expect(body.quickQuestions).toContain('帮我规划一条乌镇半日游路线');
        expect(body.officialInfo).toMatchObject({ status: 'unconfigured', notices: [] });
      });
  });

  it('serves a controlled official-notice response for the Coze plugin', async () => {
    const liveService = new ScenicLiveService({
      feedUrl: 'https://official.example/wuzhen/live.json',
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          notices: ['Temporary evening-entry guidance'],
          sourceUrl: 'https://official.example/wuzhen/notices',
          updatedAt: '2026-08-11T10:00:00+08:00'
        })
      } as Response),
      fallback: getScenicAreaSummary
    });
    const app = createApp({ scenicLiveService: liveService });

    await request(app.callback())
      .get('/api/coze/plugins/official-notices/wuzhen-scenic-area')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          title: '乌镇景区 official notices',
          content: 'Temporary evening-entry guidance',
          sourceUrl: 'https://official.example/wuzhen/notices',
          updatedAt: '2026-08-11T10:00:00+08:00',
          status: 'live'
        });
      });
  });

  it('rejects unknown Coze plugin spot identifiers', async () => {
    const app = createApp();

    await request(app.callback())
      .get('/api/coze/plugins/official-notices/unknown-spot')
      .expect(404)
      .expect(({ body }) => {
        expect(body).toEqual({
          code: 'OFFICIAL_NOTICE_SPOT_NOT_FOUND',
          message: 'Only the registered Wuzhen scenic-area identifier is available.'
        });
      });
  });

  it('uses the same live scenic snapshot for the panel, retrieval, and chat', async () => {
    vi.stubEnv('LLM_PROVIDER', '');
    vi.stubEnv('LLM_BASE_URL', '');
    vi.stubEnv('LLM_API_KEY', '');
    vi.stubEnv('LLM_MODEL', '');
    vi.stubEnv('ARK_API_KEY', '');
    vi.stubEnv('ARK_MODEL', '');
    vi.stubEnv('ARK_ENDPOINT_ID', '');

    const liveService = new ScenicLiveService({
      feedUrl: 'https://official.example/wuzhen/live.json',
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          openingHours: '今日 08:30-22:00',
          ticketInfo: '官方实时票价：成人 128 元'
        })
      } as Response),
      fallback: getScenicAreaSummary
    });
    const app = createApp({ scenicLiveService: liveService });

    const summary = await request(app.callback()).get('/api/scenic-area').expect(200);
    expect(summary.body.scenicArea).toMatchObject({
      openingHours: '今日 08:30-22:00',
      ticketInfo: '官方实时票价：成人 128 元'
    });

    await request(app.callback())
      .get('/api/guide/retrieval')
      .query({ query: '乌镇几点开放，门票多少钱？' })
      .expect(200)
      .expect(({ body }) => {
        const localScenicResult = body.results.find(
          (result: { source: string; title: string }) =>
            result.source === 'local-scenic' && result.title === '乌镇景区'
        );
        expect(localScenicResult?.content).toContain('今日 08:30-22:00');
        expect(localScenicResult?.content).toContain('官方实时票价：成人 128 元');
      });

    await request(app.callback())
      .post('/api/guide/chat')
      .send({ message: '乌镇几点开放，门票多少钱？' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.source).toBe('local-fallback');
        expect(body.answer).toContain('今日 08:30-22:00');
        expect(body.answer).toContain('官方实时票价：成人 128 元');
      });
  });

  it('serves online api documentation and openapi json', async () => {
    const app = createApp();

    await request(app.callback())
      .get('/api/docs')
      .expect(200)
      .expect('Content-Type', /html/)
      .expect((response) => {
        expect(response.text).toContain('乌镇景区 AI 数字导游 API 文档');
        expect(response.text).toContain('/api/docs/openapi.json');
      });

    await request(app.callback())
      .get('/api/docs/openapi.json')
      .expect(200)
      .expect(({ body }) => {
        expect(body.openapi).toBe('3.1.0');
        expect(body.paths).toHaveProperty('/api/guide/chat');
        expect(body.paths).toHaveProperty('/api/coze/plugins/official-notices/{spotId}');
        expect(body.paths).toHaveProperty('/api/destinations');
        expect(body.paths).toHaveProperty('/api/voice');
        expect(body.paths).toHaveProperty('/api/videos');
        expect(body.paths).toHaveProperty('/api/videos/{videoId}/danmaku');
        expect(body.tags).toEqual(
          expect.arrayContaining([expect.objectContaining({ name: 'Video' })])
        );
        expect(body.components.schemas).toHaveProperty('GuideChatResponse');
        expect(body.components.schemas).toHaveProperty('GuideAttachment');
        expect(body.components.schemas).toHaveProperty('VideoSummary');
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

  it('downloads guide answers as Markdown and Excel files', async () => {
    const app = createApp();

    await request(app.callback())
      .post('/api/guide/export')
      .send({ content: '# 行程\n\n- 西湖', format: 'markdown', title: '杭州行程' })
      .expect(200)
      .expect('Content-Type', /text\/markdown/)
      .expect('Content-Disposition', /attachment/)
      .expect((response) => {
        expect(response.headers['content-disposition']).toContain('filename*=UTF-8');
      });

    await request(app.callback())
      .post('/api/guide/export')
      .send({ content: '| 景点 | 天数 |\n| --- | --- |\n| 乌镇 | 1 |', format: 'excel' })
      .expect(200)
      .expect('Content-Type', /spreadsheetml.sheet/)
      .expect('Content-Disposition', /\.xlsx/);
  });

  it('validates uploaded guide images', async () => {
    const app = createApp();

    await request(app.callback())
      .post('/api/guide/chat')
      .send({
        message: '分析这张图片',
        image: { name: 'bad.txt', mimeType: 'text/plain', dataUrl: 'data:text/plain;base64,aaaa' }
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body).toEqual({ code: 'INVALID_IMAGE', message: '仅支持 PNG、JPG 或 WebP 图片。' });
      });
  });

  it('lists a broad destination catalog instead of only Wuzhen', async () => {
    const app = createApp();

    await request(app.callback())
      .get('/api/destinations')
      .expect(200)
      .expect(({ body }) => {
        expect(body.destinations.length).toBeGreaterThanOrEqual(20);
        expect(body.destinations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: '黄山' }),
            expect.objectContaining({ name: '兵马俑' }),
            expect.objectContaining({ name: '悉尼歌剧院' })
          ])
        );
      });

    await request(app.callback())
      .get(`/api/destinations/${encodeURIComponent('兵马俑')}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.destination).toBe('兵马俑');
        expect(body.sections).toHaveLength(5);
        expect(body.sections.join('\n')).toContain('秦始皇帝陵博物院');
      });
  });

  it('lists all province tourism catalogs and returns province details', async () => {
    const app = createApp();
    const list = await request(app.callback()).get('/api/provinces').expect(200);

    expect(list.body.provinces).toHaveLength(34);
    expect(
      list.body.provinces.find((item: { name: string }) => item.name === '山西')
    ).toMatchObject({
      spotCount: 15,
      featuredSpots: expect.arrayContaining(['平遥古城', '云冈石窟', '五台山'])
    });

    await request(app.callback())
      .get(`/api/provinces/${encodeURIComponent('山西省')}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.province).toBe('山西');
        expect(body.highlights).toHaveLength(15);
        expect(body.highlights).toEqual(
          expect.arrayContaining([expect.objectContaining({ name: '平遥古城', city: '晋中' })])
        );
      });

    await request(app.callback())
      .get(`/api/provinces/${encodeURIComponent('不存在')}`)
      .expect(404)
      .expect(({ body }) => {
        expect(body).toEqual({
          code: 'PROVINCE_NOT_FOUND',
          message: '没有找到这个省份的旅游资料。'
        });
      });
  });

  it('returns retrieved guide knowledge for debugging grounded answers', async () => {
    const app = createApp();

    await request(app.callback())
      .get('/api/guide/retrieval')
      .query({ query: '上海迪士尼亲子游怎么玩？' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.query).toBe('上海迪士尼亲子游怎么玩？');
        expect(body.results[0]).toMatchObject({
          source: 'destination-knowledge',
          title: '上海迪士尼度假区'
        });
        expect(body.results[0].content).toContain('飞跃地平线');
        expect(body.context).toContain('检索到的景区知识库上下文');
      });
  });

  it('validates empty guide retrieval query', async () => {
    const app = createApp();

    await request(app.callback())
      .get('/api/guide/retrieval')
      .query({ query: '   ' })
      .expect(400)
      .expect(({ body }) => {
        expect(body).toEqual({
          code: 'EMPTY_QUERY',
          message: '请输入要检索的景区旅游问题。'
        });
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
    vi.stubEnv('VIRTUAL_HUMAN_PROVIDER', 'xfyun');
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_ENABLED', 'true');
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_APP_ID', 'app-id');
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_API_KEY', 'api-key');
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_API_SECRET', 'api-secret');
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_SERVICE_ID', 'service-id');
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_AVATAR_ID', 'avatar-id');
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_AVATAR_NAME', '语熙-新');
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_AVATAR_ROLE', '乌镇文化导游');
    const app = createApp();

    await request(app.callback())
      .get('/api/virtual-human/config')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          enabled: true,
          provider: 'xfyun-vms',
          serviceId: 'service-id',
          displayName: '语熙-新',
          role: '乌镇文化导游',
          actions: expect.arrayContaining([
            expect.objectContaining({ id: 'A_LH_introduced_O', label: '介绍' })
          ]),
          signedUrl: '',
          startConfig: {
            appId: 'app-id',
            apiKey: 'api-key',
            apiSecret: 'api-secret',
            avatarId: 'avatar-id',
            width: 720,
            height: 1280,
            isSsl: true,
            transparent: true
          }
        });
      });
  });

  it('falls back to App Secret when API Secret is blank', async () => {
    vi.stubEnv('VIRTUAL_HUMAN_PROVIDER', 'xfyun');
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_ENABLED', 'true');
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_APP_ID', 'app-id');
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_API_KEY', 'api-key');
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_API_SECRET', '');
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_APP_SECRET', 'app-secret');
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_AVATAR_ID', 'avatar-id');
    const app = createApp();

    await request(app.callback())
      .get('/api/virtual-human/config')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          enabled: true,
          provider: 'xfyun-vms',
          actions: expect.arrayContaining([
            expect.objectContaining({ id: 'A_RH_bye_O', label: '再见' })
          ]),
          signedUrl: '',
          startConfig: {
            appId: 'app-id',
            apiKey: 'api-key',
            apiSecret: 'app-secret',
            avatarId: 'avatar-id'
          }
        });
      });
  });

  it('returns a Mofa Xingyun config when mofa is selected', async () => {
    vi.stubEnv('VIRTUAL_HUMAN_PROVIDER', 'mofa');
    vi.stubEnv('MOFA_VIRTUAL_HUMAN_ENABLED', 'true');
    vi.stubEnv('MOFA_VIRTUAL_HUMAN_SERVICE_ID', 'service-123');
    vi.stubEnv('MOFA_VIRTUAL_HUMAN_APP_ID', 'mofa-app');
    vi.stubEnv('MOFA_VIRTUAL_HUMAN_APP_SECRET', 'mofa-secret');
    vi.stubEnv('MOFA_VIRTUAL_HUMAN_ACTIONS', '自然待机:interactiveidle,离线休息:offlineMode');
    vi.stubEnv('MOFA_VIRTUAL_HUMAN_ENABLE_LOGGER', 'false');
    const app = createApp();

    await request(app.callback())
      .get('/api/virtual-human/config')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          enabled: true,
          provider: 'mofa-xingyun',
          serviceId: 'service-123',
          appId: 'mofa-app',
          appSecret: 'mofa-secret',
          gatewayServer: 'https://nebula-agent.xingyun3d.com/user/v1/ttsa/session',
          actions: [
            { id: 'interactiveidle', label: '自然待机' },
            { id: 'offlineMode', label: '离线休息' }
          ],
          startConfig: {
            hardwareAcceleration: 'prefer-hardware',
            enableLogger: false
          }
        });
        expect(body.sdkScriptUrl).toContain('xmovAvatar@latest.js');
      });
  });

  it('returns a speech synthesis validation error for empty text', async () => {
    const app = createApp();

    await request(app.callback())
      .post('/api/speech/synthesize')
      .send({ text: '   ' })
      .expect(400)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'EMPTY_TEXT' });
      });
  });

  it('returns a speech synthesis configuration error without tts credentials', async () => {
    vi.stubEnv('XFYUN_TTS_APP_ID', '');
    vi.stubEnv('XFYUN_TTS_API_KEY', '');
    vi.stubEnv('XFYUN_TTS_API_SECRET', '');
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_APP_ID', '');
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_API_KEY', '');
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_API_SECRET', '');
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_APP_SECRET', '');
    const app = createApp();

    await request(app.callback())
      .post('/api/speech/synthesize')
      .send({ text: '欢迎来到云岚古镇' })
      .expect(503)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'TTS_NOT_CONFIGURED' });
      });
  });
});
