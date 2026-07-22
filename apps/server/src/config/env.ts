import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, '../../.env') });
dotenv.config({ path: path.resolve(currentDir, '../../../.env') });

function readFirstNonEmptyEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim().length > 0) {
      return value;
    }
  }

  return '';
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

export type ServerEnv = {
  port: number;
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
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
    llmBaseUrl: process.env.LLM_BASE_URL ?? '',
    llmApiKey: readConfiguredSecret('LLM_API_KEY'),
    llmModel: process.env.LLM_MODEL ?? 'gpt-4o-mini',
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
