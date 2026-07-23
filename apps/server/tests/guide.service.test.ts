import { describe, expect, it, vi } from 'vitest';
import { createGuideResponse, createGuideStreamResponse } from '../src/modules/guide/guide.service';

const env = { port: 8787, llmBaseUrl: '', llmApiKey: '', llmModel: 'gpt-4o-mini' };
const llmEnv = {
  port: 8787,
  llmBaseUrl: 'https://example.com/v1',
  llmApiKey: 'test-key',
  llmModel: 'test-model'
};

describe('guide service', () => {
  it('falls back to real scenic data when LLM configuration is missing', async () => {
    const response = await createGuideResponse({
      message: '帮我规划一条乌镇半日游路线',
      env
    });

    expect(response.answer).toContain('乌镇半日经典路线');
    expect(response.cards).toHaveLength(5);
    expect(response.source).toBe('local-fallback');
  });

  it('returns LLM answer with route cards from scenic data', async () => {
    const chat = vi.fn().mockResolvedValue('推荐你从西栅游客服务中心进入，最后在西栅夜景收尾。');

    const response = await createGuideResponse({
      message: '帮我规划一条乌镇半日游路线',
      env: llmEnv,
      chat
    });

    expect(response.answer).toContain('西栅游客服务中心');
    expect(response.cards).toHaveLength(5);
    expect(response.cards[0]).toMatchObject({
      type: 'route-step',
      title: '从西栅游客服务中心入园',
      duration: '40 分钟'
    });
    expect(response.source).toBe('llm');
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it('falls back to family route cards when the question is about children', async () => {
    const response = await createGuideResponse({
      message: '带孩子游览乌镇怎么安排？',
      env
    });

    expect(response.answer).toContain('亲子轻松路线');
    expect(response.cards[0]).toMatchObject({
      title: '西栅入口集合',
      duration: '30 分钟'
    });
    expect(response.source).toBe('local-fallback');
  });

  it('passes uploaded images to the backend guide agent prompt', async () => {
    const chat = vi
      .fn()
      .mockResolvedValue('图片里能看到水乡街巷和桥边建筑，适合结合西栅路线游览。');

    await createGuideResponse({
      message: '分析这张图适合怎么玩',
      image: {
        name: 'street.webp',
        mimeType: 'image/webp',
        dataUrl: 'data:image/webp;base64,aaaa'
      },
      env: llmEnv,
      chat
    });

    const messages = chat.mock.calls[0][0];
    const imageText = messages[1].content.find((part: { type: string }) => part.type === 'text');
    expect(messages[0].content).toContain('后台智能体');
    expect(messages[0].content).toContain('全球范围识别');
    expect(messages[0].content).toContain('不要把图片地点限定为乌镇');
    expect(messages[0].content).toContain('图片类回答必须包含可玩的项目和一条半日或一日路线');
    expect(messages[0].content).toContain('必须先给“最可能位置”');
    expect(imageText.text).toContain('最可能位置');
    expect(imageText.text).toContain('推荐游玩项目');
    expect(imageText.text).not.toContain('结合当前项目内置景区资料');
    expect(messages[1].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'text' }),
        expect.objectContaining({
          type: 'image_url',
          image_url: expect.objectContaining({ url: 'data:image/webp;base64,aaaa' })
        })
      ])
    );
  });

  it('introduces itself when the visitor says hello', async () => {
    const chat = vi
      .fn()
      .mockResolvedValue('你好，我是你的全球景区旅游数字导游，可以推荐景区、路线和拍照点。');

    const response = await createGuideResponse({
      message: '你好',
      env: llmEnv,
      chat
    });

    const messages = chat.mock.calls[0][0];
    expect(response.answer).toContain('全球景区旅游数字导游');
    expect(response.source).toBe('llm');
    expect(messages[0].content).toContain('寒暄或让你介绍自己');
  });

  it('recommends scenic destinations and routes by region without LLM configuration', async () => {
    const response = await createGuideResponse({
      message: '推荐几个各个地区好玩的景区和旅游路线',
      env
    });

    expect(response.answer).toContain('华北');
    expect(response.answer).toContain('华东');
    expect(response.answer).toContain('西南');
    expect(response.answer).toContain('路线');
    expect(response.cards).toEqual([]);
    expect(response.source).toBe('local-fallback');
  });

  it('allows scenic tourism questions about destinations outside Wuzhen', async () => {
    const chat = vi.fn().mockResolvedValue('黄山一日游建议优先云谷索道上山，串联始信峰和排云亭。');

    const response = await createGuideResponse({
      message: '黄山一日游怎么安排？',
      env: llmEnv,
      chat
    });

    const messages = chat.mock.calls[0][0];
    expect(response.answer).toContain('黄山一日游');
    expect(response.source).toBe('llm');
    expect(messages[0].content).toContain('全球景区旅游智能体');
    expect(messages[0].content).toContain('世界范围内');
  });

  it('allows province travel intent phrased as going somewhere to play', async () => {
    const chat = vi.fn().mockResolvedValue('山西推荐先走太原-平遥古城-五台山路线。');

    const response = await createGuideResponse({
      message: '去山西玩',
      env: llmEnv,
      chat
    });

    expect(response.answer).toContain('山西');
    expect(response.source).toBe('llm');
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it('refuses non scenic-tourism questions before calling the LLM', async () => {
    const chat = vi.fn().mockResolvedValue('不应该调用模型');

    const response = await createGuideResponse({
      message: '帮我写一个股票交易策略',
      env: llmEnv,
      chat
    });

    expect(response.answer).toContain('我只能回答景区旅游相关问题');
    expect(response.cards).toEqual([]);
    expect(response.source).toBe('local-fallback');
    expect(chat).not.toHaveBeenCalled();
  });

  it('emits answer deltas for guide stream responses', async () => {
    const deltas: string[] = [];
    const streamChat = vi.fn().mockImplementation(async (_messages, _env, onDelta) => {
      onDelta('streamed ');
      onDelta('guide answer');
      return 'streamed guide answer';
    });

    const response = await createGuideStreamResponse({
      message: 'route',
      env: llmEnv,
      streamChat,
      onDelta: (delta) => deltas.push(delta)
    });

    expect(response.answer).toBe('streamed guide answer');
    expect(deltas.join('')).toBe('streamed guide answer');
    expect(streamChat).toHaveBeenCalledTimes(1);
  });
});
