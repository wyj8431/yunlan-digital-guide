import dotenv from 'dotenv';

dotenv.config();

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
};

export function readEnv(): ServerEnv {
  return {
    port: Number(process.env.PORT ?? 8787),
    llmBaseUrl: process.env.LLM_BASE_URL ?? '',
    llmApiKey: process.env.LLM_API_KEY ?? '',
    llmModel: process.env.LLM_MODEL ?? 'gpt-4o-mini',
    virtualHumanEnabled: process.env.XFYUN_VIRTUAL_HUMAN_ENABLED === 'true',
    xfyunVirtualHumanAppId: process.env.XFYUN_VIRTUAL_HUMAN_APP_ID ?? '',
    xfyunVirtualHumanApiKey: process.env.XFYUN_VIRTUAL_HUMAN_API_KEY ?? '',
    xfyunVirtualHumanApiSecret: process.env.XFYUN_VIRTUAL_HUMAN_API_SECRET ?? '',
    xfyunVirtualHumanServiceId: process.env.XFYUN_VIRTUAL_HUMAN_SERVICE_ID ?? '',
    xfyunVirtualHumanAvatarId: process.env.XFYUN_VIRTUAL_HUMAN_AVATAR_ID ?? '',
    xfyunVirtualHumanSdkScriptUrl:
      process.env.XFYUN_VIRTUAL_HUMAN_SDK_SCRIPT_URL ??
      '/libs/avatar-sdk-web_3.2.3.1002/esm/index.js',
    xfyunVirtualHumanTtsVoice: process.env.XFYUN_VIRTUAL_HUMAN_TTS_VOICE ?? 'x4_lingxiaoxuan_oral'
  };
}
