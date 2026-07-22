import { describe, expect, it, vi } from 'vitest';
import { createGuideResponse, createGuideStreamResponse } from '../src/modules/guide/guide.service';

describe('guide service', () => {
  it('falls back to scenic data when LLM configuration is missing', async () => {
    const response = await createGuideResponse({
      message: '帮我规划一条半日游路线',
      env: { port: 8787, llmBaseUrl: '', llmApiKey: '', llmModel: 'gpt-4o-mini' }
    });

    expect(response.answer).toContain('半日经典路线');
    expect(response.cards).toHaveLength(5);
    expect(response.source).toBe('local-fallback');
  });

  it('returns LLM answer with route cards from scenic data', async () => {
    const chat = vi.fn().mockResolvedValue('推荐你从南门牌坊进入，最后在听雨戏台收尾。');

    const response = await createGuideResponse({
      message: '帮我规划一条半日游路线',
      env: {
        port: 8787,
        llmBaseUrl: 'https://example.com/v1',
        llmApiKey: 'test-key',
        llmModel: 'test-model'
      },
      chat
    });

    expect(response.answer).toContain('南门牌坊');
    expect(response.cards).toHaveLength(5);
    expect(response.cards[0]).toMatchObject({
      type: 'route-step',
      title: '从南门牌坊进入',
      duration: '20 分钟'
    });
    expect(response.source).toBe('llm');
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it('falls back to family route cards when the question is about children', async () => {
    const response = await createGuideResponse({
      message: '带孩子游览怎么安排？',
      env: { port: 8787, llmBaseUrl: '', llmApiKey: '', llmModel: 'gpt-4o-mini' }
    });

    expect(response.answer).toContain('亲子轻松路线');
    expect(response.cards[0]).toMatchObject({
      title: '南门牌坊集合',
      duration: '15 分钟'
    });
    expect(response.source).toBe('local-fallback');
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
      env: {
        port: 8787,
        llmBaseUrl: 'https://example.com/v1',
        llmApiKey: 'test-key',
        llmModel: 'test-model'
      },
      streamChat,
      onDelta: (delta) => deltas.push(delta)
    });

    expect(response.answer).toBe('streamed guide answer');
    expect(deltas.join('')).toBe('streamed guide answer');
    expect(streamChat).toHaveBeenCalledTimes(1);
  });
});
