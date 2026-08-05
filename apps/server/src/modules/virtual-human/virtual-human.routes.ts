// 向前端提供脱敏后的数字人供应商配置，不暴露服务端私密凭据。
import Router from '@koa/router';
import { readEnv, type ServerEnv } from '../../config/env.js';

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
const DEFAULT_MOFA_ACTIONS = [
  { id: 'onlineMode', label: '上线互动' },
  { id: 'interactiveidle', label: '自然待机' },
  { id: 'idle', label: '安静待机' },
  { id: 'offlineMode', label: '离线休息' }
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
      displayName?: string;
      role?: string;
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
    }
  | {
      enabled: true;
      provider: 'mofa-xingyun';
      serviceId: string;
      sdkScriptUrl: string;
      appId: string;
      appSecret: string;
      gatewayServer: string;
      actions: Array<{
        id: string;
        label: string;
      }>;
      startConfig: {
        hardwareAcceleration: 'prefer-hardware';
        enableLogger: boolean;
      };
    };

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

function readMofaActionOptions(actionsConfig: string): Array<{ id: string; label: string }> {
  const customActions = actionsConfig
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [label, id = label] = item.split(':').map((part) => part.trim());
      return { id, label };
    })
    .filter((item) => item.id && item.label);

  return customActions.length > 0 ? customActions : DEFAULT_MOFA_ACTIONS;
}

function shouldUseMofa(env: ServerEnv): boolean {
  return ['mofa', 'mofa-xingyun', 'xingyun'].includes(env.virtualHumanProvider);
}

function shouldUseXfyun(env: ServerEnv): boolean {
  return ['xfyun', 'xfyun-vms'].includes(env.virtualHumanProvider);
}

function createFallbackConfig(reason: string): VirtualHumanConfigResponse {
  return {
    enabled: false,
    provider: 'three-fallback',
    reason
  };
}

function createMofaConfig(env: ServerEnv): VirtualHumanConfigResponse {
  const missingKeys = [
    ['MOFA_VIRTUAL_HUMAN_APP_ID', env.mofaVirtualHumanAppId],
    ['MOFA_VIRTUAL_HUMAN_APP_SECRET/MOFA_VIRTUAL_HUMAN_API_SECRET', env.mofaVirtualHumanAppSecret]
  ].filter(([, value]) => !value);

  if (!env.mofaVirtualHumanEnabled || missingKeys.length > 0) {
    return createFallbackConfig(
      !env.mofaVirtualHumanEnabled
        ? '未启用魔珐星云数字人配置，当前使用本地 Three.js 数字人兜底。'
        : `魔珐星云数字人配置缺失：${missingKeys.map(([key]) => key).join(', ')}。`
    );
  }

  return {
    enabled: true,
    provider: 'mofa-xingyun',
    serviceId: env.mofaVirtualHumanServiceId,
    sdkScriptUrl: env.mofaVirtualHumanSdkScriptUrl,
    appId: env.mofaVirtualHumanAppId,
    appSecret: env.mofaVirtualHumanAppSecret,
    gatewayServer: env.mofaVirtualHumanGatewayServer,
    actions: readMofaActionOptions(env.mofaVirtualHumanActions),
    startConfig: {
      hardwareAcceleration: 'prefer-hardware',
      enableLogger: env.mofaVirtualHumanEnableLogger
    }
  };
}

function createXfyunConfig(env: ServerEnv): VirtualHumanConfigResponse {
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
    displayName: env.xfyunVirtualHumanAvatarName,
    role: env.xfyunVirtualHumanAvatarRole,
    sdkScriptUrl: env.xfyunVirtualHumanSdkScriptUrl,
    signedUrl: '',
    actions: readActionOptions(env.xfyunVirtualHumanActions),
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

function createVirtualHumanConfig(env: ServerEnv): VirtualHumanConfigResponse {
  if (env.virtualHumanProvider === 'local' || env.virtualHumanProvider === 'three-fallback') {
    return createFallbackConfig('已指定使用本地 Three.js 数字人。');
  }

  if (shouldUseMofa(env)) {
    return createMofaConfig(env);
  }

  if (shouldUseXfyun(env)) {
    return createXfyunConfig(env);
  }

  if (env.mofaVirtualHumanEnabled) {
    const mofaConfig = createMofaConfig(env);
    if (mofaConfig.enabled) {
      return mofaConfig;
    }
  }

  if (env.virtualHumanEnabled) {
    return createXfyunConfig(env);
  }

  return createFallbackConfig('未启用线上虚拟人配置，当前使用本地 Three.js 数字人兜底。');
}

export function createVirtualHumanRouter(): Router {
  const router = new Router();

  router.get('/api/virtual-human/config', (ctx) => {
    ctx.body = createVirtualHumanConfig(readEnv());
  });

  return router;
}
