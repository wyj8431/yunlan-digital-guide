import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readEnv, resolveEnvFilePaths } from '../src/config/env';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('server env', () => {
  it('loads the server-local and workspace-root env files', () => {
    const configDir = path.join('workspace', 'apps', 'server', 'src', 'config');

    expect(resolveEnvFilePaths(configDir)).toEqual([
      path.resolve(configDir, '../../.env'),
      path.resolve(configDir, '../../../../.env')
    ]);
  });

  it('reads separate streaming ASR configuration', () => {
    vi.stubEnv('XFYUN_ASR_ENABLED', 'true');
    vi.stubEnv('XFYUN_ASR_APP_ID', 'asr-app');
    vi.stubEnv('XFYUN_ASR_API_KEY', 'asr-key');
    vi.stubEnv('XFYUN_ASR_API_SECRET', 'asr-secret');
    vi.stubEnv('XFYUN_ASR_URL', 'wss://example.com/iat');

    expect(readEnv()).toMatchObject({
      xfyunAsrEnabled: true,
      xfyunAsrAppId: 'asr-app',
      xfyunAsrApiKey: 'asr-key',
      xfyunAsrApiSecret: 'asr-secret',
      xfyunAsrUrl: 'wss://example.com/iat'
    });
  });

  it('does not reuse the virtual human voice as the default tts voice', () => {
    vi.stubEnv('XFYUN_TTS_VOICE', '');
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_TTS_VOICE', 'x4_lingxiaoxuan_oral');

    expect(readEnv().xfyunTtsVoice).toBe('xiaoyan');
  });

  it('falls back to a five-minute scenic feed ttl when configured ttl is invalid', () => {
    vi.stubEnv('SCENIC_OFFICIAL_FEED_TTL_MS', 'not-a-number');

    expect(readEnv().scenicLiveTtlMs).toBe(300_000);
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

  it('reads Mofa Xingyun virtual human settings', () => {
    vi.stubEnv('VIRTUAL_HUMAN_PROVIDER', 'mofa');
    vi.stubEnv('MOFA_VIRTUAL_HUMAN_ENABLED', 'true');
    vi.stubEnv('MOFA_VIRTUAL_HUMAN_SERVICE_ID', 'service-123');
    vi.stubEnv('MOFA_VIRTUAL_HUMAN_APP_ID', 'mofa-app');
    vi.stubEnv('MOFA_VIRTUAL_HUMAN_APP_SECRET', 'mofa-secret');

    const env = readEnv();

    expect(env.virtualHumanProvider).toBe('mofa');
    expect(env.mofaVirtualHumanEnabled).toBe(true);
    expect(env.mofaVirtualHumanServiceId).toBe('service-123');
    expect(env.mofaVirtualHumanAppId).toBe('mofa-app');
    expect(env.mofaVirtualHumanAppSecret).toBe('mofa-secret');
    expect(env.mofaVirtualHumanSdkScriptUrl).toContain('xmovAvatar@latest.js');
    expect(env.mofaVirtualHumanGatewayServer).toContain('/ttsa/session');
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
