import { afterEach, describe, expect, it, vi } from 'vitest';
import { readEnv } from '../src/config/env';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('server env', () => {
  it('does not reuse the virtual human voice as the default tts voice', () => {
    vi.stubEnv('XFYUN_TTS_VOICE', '');
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_TTS_VOICE', 'x4_lingxiaoxuan_oral');

    expect(readEnv().xfyunTtsVoice).toBe('xiaoyan');
  });

  it('uses Volcengine Ark aliases for OpenAI-compatible LLM settings', () => {
    vi.stubEnv('LLM_BASE_URL', '');
    vi.stubEnv('LLM_API_KEY', '');
    vi.stubEnv('LLM_MODEL', '');
    vi.stubEnv('ARK_API_KEY', 'ark-test-key');
    vi.stubEnv('ARK_MODEL', 'doubao-seed-test');

    const env = readEnv();

    expect(env.llmBaseUrl).toBe('https://ark.cn-beijing.volces.com/api/v3');
    expect(env.llmApiKey).toBe('ark-test-key');
    expect(env.llmModel).toBe('doubao-seed-test');
  });

  it('keeps explicit generic LLM settings ahead of Ark aliases', () => {
    vi.stubEnv('LLM_PROVIDER', '');
    vi.stubEnv('LLM_BASE_URL', 'https://example.com/v1');
    vi.stubEnv('LLM_API_KEY', 'generic-key');
    vi.stubEnv('LLM_MODEL', 'generic-model');
    vi.stubEnv('ARK_API_KEY', 'ark-test-key');
    vi.stubEnv('ARK_MODEL', 'doubao-seed-test');

    const env = readEnv();

    expect(env.llmBaseUrl).toBe('https://example.com/v1');
    expect(env.llmApiKey).toBe('generic-key');
    expect(env.llmModel).toBe('generic-model');
  });

  it('prefers Ark settings when LLM_PROVIDER is ark', () => {
    vi.stubEnv('LLM_PROVIDER', 'ark');
    vi.stubEnv('LLM_BASE_URL', 'https://example.com/v1');
    vi.stubEnv('LLM_API_KEY', 'generic-key');
    vi.stubEnv('LLM_MODEL', 'generic-model');
    vi.stubEnv('ARK_API_KEY', 'ark-test-key');
    vi.stubEnv('ARK_MODEL', 'glm-5-2-260617');

    const env = readEnv();

    expect(env.llmBaseUrl).toBe('https://ark.cn-beijing.volces.com/api/v3');
    expect(env.llmApiKey).toBe('ark-test-key');
    expect(env.llmModel).toBe('glm-5-2-260617');
  });

  it('reads Coze agent settings when LLM_PROVIDER is coze', () => {
    vi.stubEnv('LLM_PROVIDER', 'coze');
    vi.stubEnv('COZE_API_BASE', 'https://api.coze.cn');
    vi.stubEnv('COZE_API_TOKEN', 'coze-test-token');
    vi.stubEnv('COZE_BOT_ID', 'bot-123');
    vi.stubEnv('COZE_USER_ID', 'wyj-test-user');

    const env = readEnv();

    expect(env.llmProvider).toBe('coze');
    expect(env.cozeApiBase).toBe('https://api.coze.cn');
    expect(env.cozeApiToken).toBe('coze-test-token');
    expect(env.cozeBotId).toBe('bot-123');
    expect(env.cozeUserId).toBe('wyj-test-user');
  });

  it('uses Ark settings for the fallback LLM when LLM_PROVIDER is hybrid', () => {
    vi.stubEnv('LLM_PROVIDER', 'hybrid');
    vi.stubEnv('LLM_BASE_URL', 'https://generic.example.com/v1');
    vi.stubEnv('LLM_API_KEY', 'generic-key');
    vi.stubEnv('LLM_MODEL', 'generic-model');
    vi.stubEnv('ARK_BASE_URL', 'https://ark.example.com/api/v3');
    vi.stubEnv('ARK_API_KEY', 'ark-test-key');
    vi.stubEnv('ARK_MODEL', 'glm-5-2-260617');

    const env = readEnv();

    expect(env.llmProvider).toBe('hybrid');
    expect(env.llmBaseUrl).toBe('https://ark.example.com/api/v3');
    expect(env.llmApiKey).toBe('ark-test-key');
    expect(env.llmModel).toBe('glm-5-2-260617');
  });
});
