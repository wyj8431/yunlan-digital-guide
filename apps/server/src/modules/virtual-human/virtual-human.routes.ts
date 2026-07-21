import Router from '@koa/router';
import { readEnv, type ServerEnv } from '../../config/env.js';

type VirtualHumanConfigResponse =
  | {
      enabled: false;
      provider: 'three-fallback';
      reason: string;
    }
  | {
      enabled: true;
      provider: 'xfyun-vms';
      serviceId: string;
      sdkScriptUrl: string;
      startConfig: {
        appId: string;
        apiKey: string;
        apiSecret: string;
        avatarId: string;
        width: 720;
        height: 1280;
        isSsl: boolean;
        transparent: boolean;
        moveH: number;
        moveV: number;
        scale: number;
      };
      tts: {
        vcn: string;
        speed: number;
        pitch: number;
        volume: number;
        rhy: number;
      };
    };

function createVirtualHumanConfig(env: ServerEnv): VirtualHumanConfigResponse {
  if (!env.virtualHumanEnabled) {
    return {
      enabled: false,
      provider: 'three-fallback',
      reason: '未启用讯飞虚拟人配置，当前使用本地 Three.js 数字人兜底。'
    };
  }

  const missingKeys = [
    ['XFYUN_VIRTUAL_HUMAN_APP_ID', env.xfyunVirtualHumanAppId],
    ['XFYUN_VIRTUAL_HUMAN_API_KEY', env.xfyunVirtualHumanApiKey],
    ['XFYUN_VIRTUAL_HUMAN_API_SECRET', env.xfyunVirtualHumanApiSecret],
    ['XFYUN_VIRTUAL_HUMAN_AVATAR_ID', env.xfyunVirtualHumanAvatarId]
  ].filter(([, value]) => !value);

  if (missingKeys.length > 0) {
    return {
      enabled: false,
      provider: 'three-fallback',
      reason: `讯飞虚拟人配置缺失：${missingKeys.map(([key]) => key).join(', ')}。`
    };
  }

  return {
    enabled: true,
    provider: 'xfyun-vms',
    serviceId: env.xfyunVirtualHumanServiceId,
    sdkScriptUrl: env.xfyunVirtualHumanSdkScriptUrl,
    startConfig: {
      appId: env.xfyunVirtualHumanAppId,
      apiKey: env.xfyunVirtualHumanApiKey,
      apiSecret: env.xfyunVirtualHumanApiSecret,
      avatarId: env.xfyunVirtualHumanAvatarId,
      width: 720,
      height: 1280,
      isSsl: true,
      transparent: true,
      moveH: 0,
      moveV: 0,
      scale: 1
    },
    tts: {
      vcn: env.xfyunVirtualHumanTtsVoice,
      speed: 50,
      pitch: 50,
      volume: 50,
      rhy: 3
    }
  };
}

export function createVirtualHumanRouter(): Router {
  const router = new Router();

  router.get('/api/virtual-human/config', (ctx) => {
    ctx.body = createVirtualHumanConfig(readEnv());
  });

  return router;
}
