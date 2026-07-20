import { describe, expect, it, vi } from 'vitest';
import { createGuideResponse } from '../src/modules/guide/guide.service';

describe('guide service', () => {
  it('requires LLM configuration before answering', async () => {
    await expect(
      createGuideResponse({
        message: '帮我规划一条半日游路线',
        env: { port: 8787, llmBaseUrl: '', llmApiKey: '', llmModel: 'gpt-4o-mini' }
      })
    ).rejects.toMatchObject({ code: 'LLM_CONFIG_MISSING' });
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
});
