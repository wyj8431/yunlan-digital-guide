// 集中读取和校验环境变量，避免业务模块直接依赖未验证的字符串。
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export function resolveEnvFilePaths(configDir: string): [string, string] {
  return [path.resolve(configDir, '../../.env'), path.resolve(configDir, '../../../../.env')];
}

for (const envPath of resolveEnvFilePaths(currentDir)) {
  dotenv.config({ path: envPath });
}

const DEFAULT_ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const DEFAULT_COZE_API_BASE = 'https://api.coze.cn';
const DEFAULT_XFYUN_ASR_URL = 'wss://iat-api.xfyun.cn/v2/iat';
const DEFAULT_XFYUN_TTS_URL = 'wss://tts-api.xfyun.cn/v2/tts';
const DEFAULT_MOFA_SDK_SCRIPT_URL =
  'https://media.xingyun3d.com/xingyun3d/general/litesdk/xmovAvatar@latest.js';
const DEFAULT_MOFA_GATEWAY_SERVER = 'https://nebula-agent.xingyun3d.com/user/v1/ttsa/session';

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
  virtualHumanProvider: string;
  virtualHumanEnabled: boolean;
  xfyunVirtualHumanAppId: string;
  xfyunVirtualHumanApiKey: string;
  xfyunVirtualHumanApiSecret: string;
  xfyunVirtualHumanServiceId: string;
  xfyunVirtualHumanAvatarId: string;
  xfyunVirtualHumanSdkScriptUrl: string;
  xfyunVirtualHumanTtsVoice: string;
  xfyunVirtualHumanActions: string;
  mofaVirtualHumanEnabled: boolean;
  mofaVirtualHumanServiceId: string;
  mofaVirtualHumanAppId: string;
  mofaVirtualHumanAppSecret: string;
  mofaVirtualHumanSdkScriptUrl: string;
  mofaVirtualHumanGatewayServer: string;
  mofaVirtualHumanActions: string;
  mofaVirtualHumanEnableLogger: boolean;
  xfyunAsrEnabled: boolean;
  xfyunAsrAppId: string;
  xfyunAsrApiKey: string;
  xfyunAsrApiSecret: string;
  xfyunAsrUrl: string;
  xfyunTtsAppId: string;
  xfyunTtsApiKey: string;
  xfyunTtsApiSecret: string;
  xfyunTtsUrl: string;
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
    virtualHumanProvider: readOptionalEnv('VIRTUAL_HUMAN_PROVIDER').toLowerCase() || 'auto',
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
    mofaVirtualHumanEnabled: process.env.MOFA_VIRTUAL_HUMAN_ENABLED === 'true',
    mofaVirtualHumanServiceId: readOptionalEnv('MOFA_VIRTUAL_HUMAN_SERVICE_ID'),
    mofaVirtualHumanAppId: readOptionalEnv('MOFA_VIRTUAL_HUMAN_APP_ID'),
    mofaVirtualHumanAppSecret: readFirstConfiguredSecret(
      'MOFA_VIRTUAL_HUMAN_APP_SECRET',
      'MOFA_VIRTUAL_HUMAN_API_SECRET'
    ),
    mofaVirtualHumanSdkScriptUrl:
      readOptionalEnv('MOFA_VIRTUAL_HUMAN_SDK_SCRIPT_URL') || DEFAULT_MOFA_SDK_SCRIPT_URL,
    mofaVirtualHumanGatewayServer:
      readOptionalEnv('MOFA_VIRTUAL_HUMAN_GATEWAY_SERVER') || DEFAULT_MOFA_GATEWAY_SERVER,
    mofaVirtualHumanActions: readOptionalEnv('MOFA_VIRTUAL_HUMAN_ACTIONS'),
    mofaVirtualHumanEnableLogger: process.env.MOFA_VIRTUAL_HUMAN_ENABLE_LOGGER === 'true',
    xfyunAsrEnabled: process.env.XFYUN_ASR_ENABLED === 'true',
    xfyunAsrAppId: readFirstNonEmptyEnv('XFYUN_ASR_APP_ID', 'XFYUN_VIRTUAL_HUMAN_APP_ID'),
    xfyunAsrApiKey: readFirstConfiguredSecret('XFYUN_ASR_API_KEY', 'XFYUN_VIRTUAL_HUMAN_API_KEY'),
    xfyunAsrApiSecret: readFirstConfiguredSecret(
      'XFYUN_ASR_API_SECRET',
      'XFYUN_VIRTUAL_HUMAN_API_SECRET',
      'XFYUN_VIRTUAL_HUMAN_APP_SECRET'
    ),
    xfyunAsrUrl: readOptionalEnv('XFYUN_ASR_URL') || DEFAULT_XFYUN_ASR_URL,
    xfyunTtsAppId: process.env.XFYUN_TTS_APP_ID ?? process.env.XFYUN_VIRTUAL_HUMAN_APP_ID ?? '',
    xfyunTtsApiKey: process.env.XFYUN_TTS_API_KEY ?? process.env.XFYUN_VIRTUAL_HUMAN_API_KEY ?? '',
    xfyunTtsApiSecret: readFirstNonEmptyEnv(
      'XFYUN_TTS_API_SECRET',
      'XFYUN_VIRTUAL_HUMAN_API_SECRET',
      'XFYUN_VIRTUAL_HUMAN_APP_SECRET'
    ),
    xfyunTtsUrl: readOptionalEnv('XFYUN_TTS_URL') || DEFAULT_XFYUN_TTS_URL,
    xfyunTtsVoice: readFirstNonEmptyEnv('XFYUN_TTS_VOICE') || 'xiaoyan'
  };
}
