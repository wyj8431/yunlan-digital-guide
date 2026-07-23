import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, '../../.env') });
dotenv.config({ path: path.resolve(currentDir, '../../../.env') });

const DEFAULT_ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const DEFAULT_COZE_API_BASE = 'https://api.coze.cn';

function readFirstNonEmptyEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim().length > 0) {
      return value;
    }
  }

  return '';
}

function readOptionalEnv(key: string): string {
  return process.env[key]?.trim() ?? '';
}

function readConfiguredSecret(key: string): string {
  const value = process.env[key]?.trim() ?? '';
  const normalized = value.toLowerCase();

  if (
    !value ||
    normalized.startsWith('replace-with-') ||
    normalized.includes('your-api-key') ||
    normalized === 'changeme'
  ) {
    return '';
  }

  return value;
}

function readFirstConfiguredSecret(...keys: string[]): string {
  for (const key of keys) {
    const value = readConfiguredSecret(key);

    if (value) {
      return value;
    }
  }

  return '';
}

function hasArkLlmConfig(): boolean {
  return (
    isArkProvider() ||
    Boolean(
      readFirstConfiguredSecret('ARK_API_KEY', 'VOLCENGINE_API_KEY', 'ARK_ACCESS_TOKEN') ||
      readOptionalEnv('ARK_MODEL') ||
      readOptionalEnv('ARK_ENDPOINT_ID')
    )
  );
}

function isArkProvider(): boolean {
  const provider = readOptionalEnv('LLM_PROVIDER').toLowerCase();

  return provider === 'ark' || provider === 'volcengine';
}

function usesArkFallbackSettings(): boolean {
  const provider = readOptionalEnv('LLM_PROVIDER').toLowerCase();

  return isArkProvider() || provider === 'hybrid';
}

function readLlmBaseUrl(): string {
  if (usesArkFallbackSettings()) {
    return readOptionalEnv('ARK_BASE_URL') || DEFAULT_ARK_BASE_URL;
  }

  const genericBaseUrl = readOptionalEnv('LLM_BASE_URL');

  if (genericBaseUrl) {
    return genericBaseUrl;
  }

  if (hasArkLlmConfig()) {
    return readOptionalEnv('ARK_BASE_URL') || DEFAULT_ARK_BASE_URL;
  }

  return '';
}

function readLlmApiKey(): string {
  if (usesArkFallbackSettings()) {
    return readFirstConfiguredSecret(
      'ARK_API_KEY',
      'VOLCENGINE_API_KEY',
      'ARK_ACCESS_TOKEN',
      'LLM_API_KEY'
    );
  }

  return readFirstConfiguredSecret(
    'LLM_API_KEY',
    'ARK_API_KEY',
    'VOLCENGINE_API_KEY',
    'ARK_ACCESS_TOKEN'
  );
}

function readLlmModel(): string {
  if (usesArkFallbackSettings()) {
    return (
      readOptionalEnv('ARK_MODEL') ||
      readOptionalEnv('ARK_ENDPOINT_ID') ||
      readOptionalEnv('LLM_MODEL') ||
      'gpt-4o-mini'
    );
  }

  return (
    readOptionalEnv('LLM_MODEL') ||
    readOptionalEnv('ARK_MODEL') ||
    readOptionalEnv('ARK_ENDPOINT_ID') ||
    'gpt-4o-mini'
  );
}

export type ServerEnv = {
  port: number;
  llmProvider: string;
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
  cozeApiBase: string;
  cozeApiToken: string;
  cozeBotId: string;
  cozeUserId: string;
  virtualHumanEnabled: boolean;
  xfyunVirtualHumanAppId: string;
  xfyunVirtualHumanApiKey: string;
  xfyunVirtualHumanApiSecret: string;
  xfyunVirtualHumanServiceId: string;
  xfyunVirtualHumanAvatarId: string;
  xfyunVirtualHumanSdkScriptUrl: string;
  xfyunVirtualHumanTtsVoice: string;
  xfyunVirtualHumanActions: string;
  xfyunTtsAppId: string;
  xfyunTtsApiKey: string;
  xfyunTtsApiSecret: string;
  xfyunTtsVoice: string;
};

export function readEnv(): ServerEnv {
  return {
    port: Number(process.env.PORT ?? 8787),
    llmProvider: readOptionalEnv('LLM_PROVIDER').toLowerCase(),
    llmBaseUrl: readLlmBaseUrl(),
    llmApiKey: readLlmApiKey(),
    llmModel: readLlmModel(),
    cozeApiBase: readOptionalEnv('COZE_API_BASE') || DEFAULT_COZE_API_BASE,
    cozeApiToken: readFirstConfiguredSecret('COZE_API_TOKEN', 'COZE_ACCESS_TOKEN'),
    cozeBotId: readOptionalEnv('COZE_BOT_ID'),
    cozeUserId: readOptionalEnv('COZE_USER_ID') || 'wyj-guide-user',
    virtualHumanEnabled: process.env.XFYUN_VIRTUAL_HUMAN_ENABLED === 'true',
    xfyunVirtualHumanAppId: process.env.XFYUN_VIRTUAL_HUMAN_APP_ID ?? '',
    xfyunVirtualHumanApiKey: process.env.XFYUN_VIRTUAL_HUMAN_API_KEY ?? '',
    xfyunVirtualHumanApiSecret: readFirstNonEmptyEnv(
      'XFYUN_VIRTUAL_HUMAN_API_SECRET',
      'XFYUN_VIRTUAL_HUMAN_APP_SECRET'
    ),
    xfyunVirtualHumanServiceId: process.env.XFYUN_VIRTUAL_HUMAN_SERVICE_ID ?? '',
    xfyunVirtualHumanAvatarId: process.env.XFYUN_VIRTUAL_HUMAN_AVATAR_ID ?? '',
    xfyunVirtualHumanSdkScriptUrl:
      process.env.XFYUN_VIRTUAL_HUMAN_SDK_SCRIPT_URL ??
      '/libs/avatar-sdk-web_3.2.3.1002/esm/index.js',
    xfyunVirtualHumanTtsVoice: process.env.XFYUN_VIRTUAL_HUMAN_TTS_VOICE ?? 'x4_lingxiaoxuan_oral',
    xfyunVirtualHumanActions: process.env.XFYUN_VIRTUAL_HUMAN_ACTIONS ?? '',
    xfyunTtsAppId: process.env.XFYUN_TTS_APP_ID ?? process.env.XFYUN_VIRTUAL_HUMAN_APP_ID ?? '',
    xfyunTtsApiKey: process.env.XFYUN_TTS_API_KEY ?? process.env.XFYUN_VIRTUAL_HUMAN_API_KEY ?? '',
    xfyunTtsApiSecret: readFirstNonEmptyEnv(
      'XFYUN_TTS_API_SECRET',
      'XFYUN_VIRTUAL_HUMAN_API_SECRET',
      'XFYUN_VIRTUAL_HUMAN_APP_SECRET'
    ),
    xfyunTtsVoice: readFirstNonEmptyEnv('XFYUN_TTS_VOICE') || 'xiaoyan'
  };
}
