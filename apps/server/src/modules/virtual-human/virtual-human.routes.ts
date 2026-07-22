import { createHmac } from 'node:crypto';
import Router from '@koa/router';
import { readEnv, type ServerEnv } from '../../config/env.js';

const XFYUN_AVATAR_SERVER_URL = 'wss://avatar.cn-huadong-1.xf-yun.com/v1/interact';
const DEFAULT_XFYUN_ACTIONS = [
  { id: 'A_LH_introduced_O', label: '介绍' },
  { id: 'A_RLH_introduced_O', label: '双手介绍' },
  { id: 'A_RH_introduced_O', label: '右手介绍' },
  { id: 'A_RH_introduced1_O', label: '右手介绍2' },
  { id: 'A_RLH_welcome_O', label: '欢迎' },
  { id: 'A_RLH_emphasize_O', label: '双手强调' },
  { id: 'A_RH_emphasize_O', label: '右手强调' },
  { id: 'A_RH_emphasize2_O', label: '右手强调2' },
  { id: 'A_RH_good_O', label: '夸奖' },
  { id: 'A_RH_encourage_O', label: '加油' },
  { id: 'A_RH_hello_O', label: '打招呼' },
  { id: 'A_RH_bye_O', label: '再见' },
  { id: 'A_H_listen_C', label: '倾听点头' }
];

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
        apiKey?: string;
        apiSecret?: string;
        avatarId: string;
        width: 720;
        height: 1280;
        isSsl: boolean;
        transparent: boolean;
        moveH: number;
        moveV: number;
        scale: number;
      };
      signedUrl: string;
      actions: Array<{
        id: string;
        label: string;
      }>;
      tts: {
        vcn: string;
        speed: number;
        pitch: number;
        volume: number;
        rhy: number;
      };
    };

function createSignedUrl(apiKey: string, apiSecret: string): string {
  const parsedUrl = new URL(XFYUN_AVATAR_SERVER_URL);
  const date = new Date().toUTCString();
  const requestLine = `GET ${parsedUrl.pathname} HTTP/1.1`;
  const signString = `host: ${parsedUrl.host}\ndate: ${date}\n${requestLine}`;
  const signature = createHmac('sha256', apiSecret).update(signString).digest('base64');
  const authorization = Buffer.from(
    `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
  ).toString('base64');

  return `${XFYUN_AVATAR_SERVER_URL}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${parsedUrl.host}`;
}

function readActionOptions(actionsConfig: string): Array<{ id: string; label: string }> {
  const customActions = actionsConfig
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [label, id = label] = item.split(':').map((part) => part.trim());
      return { id, label };
    })
    .filter((item) => item.id && item.label);

  return customActions.length > 0 ? customActions : DEFAULT_XFYUN_ACTIONS;
}

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
    [
      'XFYUN_VIRTUAL_HUMAN_API_SECRET/XFYUN_VIRTUAL_HUMAN_APP_SECRET',
      env.xfyunVirtualHumanApiSecret
    ],
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
    signedUrl: createSignedUrl(env.xfyunVirtualHumanApiKey, env.xfyunVirtualHumanApiSecret),
    actions: readActionOptions(env.xfyunVirtualHumanActions),
    startConfig: {
      appId: env.xfyunVirtualHumanAppId,
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
