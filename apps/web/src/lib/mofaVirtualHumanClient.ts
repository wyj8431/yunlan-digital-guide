import type { VirtualHumanConfig } from '../types/virtualHuman';

// 魔珐适配器把厂商事件和方法转换为项目内部统一的数字人客户端协议。

type MofaVirtualHumanConfig = Extract<VirtualHumanConfig, { provider: 'mofa-xingyun' }>;

type MofaVoiceState = 'voice_start' | 'voice_end' | 'start' | 'end' | string;

type MofaAvatarInstance = {
  init?: (options: {
    initModel?: 'normal' | 'invisible';
    onDownloadProgress: (progress: number) => void;
  }) => Promise<void> | void;
  speak: (ssml: string, isStart: boolean, isEnd: boolean) => void;
  destroy?: () => void;
  offlineMode?: () => void;
  onlineMode?: () => void;
  idle?: () => void;
  interactiveidle?: () => void;
  setVolume?: (volume: number) => void;
  changeAvatarVisible?: (visible: boolean) => void;
};

type MofaAvatarConstructor = new (options: {
  containerId: string;
  appId: string;
  appSecret: string;
  gatewayServer: string;
  hardwareAcceleration: 'prefer-hardware';
  enableLogger: boolean;
  onMessage?: (message: unknown) => void;
  onStateChange?: (state: unknown) => void;
  onStatusChange?: (status: unknown) => void;
  onNetworkInfo?: (networkInfo: unknown) => void;
  onVoiceStateChange?: (status: MofaVoiceState) => void;
}) => MofaAvatarInstance;

type MofaWindow = Window & {
  XmovAvatar?: MofaAvatarConstructor;
};

export type MofaSdkLoader = (url: string) => Promise<MofaAvatarConstructor>;

export type MofaVirtualHumanClient = {
  start: () => Promise<void>;
  speak: (text: string) => Promise<void>;
  triggerAction: (actionId: string) => Promise<void>;
  stop: () => Promise<void>;
};

type MofaVirtualHumanClientOptions = {
  onSpeechDuration?: (durationMs: number, text: string) => void;
  onSpeechStart?: (text: string) => void;
  onFatalError?: (message: string) => void;
};

const MIN_SPEECH_DURATION_MS = 1000;
const MAX_SPEECH_DURATION_MS = 180_000;

function estimateSpeechDurationMs(text: string): number {
  const normalizedText = text.trim();
  const chineseLikeChars = Array.from(normalizedText).filter((char) => !/\s/u.test(char)).length;
  const punctuationPauses = (normalizedText.match(/[，。！？；、,.!?;]/gu) ?? []).length * 180;

  return Math.min(
    MAX_SPEECH_DURATION_MS,
    Math.max(MIN_SPEECH_DURATION_MS, chineseLikeChars * 230 + punctuationPauses)
  );
}

function stringifySdkPayload(payload: unknown): string {
  if (typeof payload === 'string') {
    return payload;
  }

  if (payload instanceof Error) {
    return payload.message;
  }

  if (typeof payload !== 'object' || payload === null) {
    return String(payload);
  }

  const plainPayload = payload as Record<string, unknown>;
  const usefulValues = Object.entries(plainPayload)
    .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
    .map(([key, value]) => `${key}: ${String(value)}`);

  return usefulValues.length > 0 ? usefulValues.join(', ') : JSON.stringify(plainPayload);
}

function resolveFatalSdkError(payload: unknown): string | null {
  // 仅把明确的失败状态视为致命错误，普通状态通知不会中断会话。
  const message = stringifySdkPayload(payload);
  const normalizedMessage = message.toLowerCase();

  if (message.includes('10003') || message.includes('积分不足')) {
    return '10003: 魔珐星云账户积分不足，请在魔珐星云后台充值或更换可用应用。';
  }

  if (normalizedMessage.includes('socket_io_url') || normalizedMessage.includes('token is empty')) {
    return '魔珐星云会话 token 为空，请确认数字人已发布、App ID/App Secret 可用且账户额度正常。';
  }

  return null;
}

export async function loadMofaSdk(url: string): Promise<MofaAvatarConstructor> {
  // SDK 脚本采用单例加载，避免重复注册全局构造函数和事件。
  const browserWindow = window as MofaWindow;

  if (browserWindow.XmovAvatar) {
    return browserWindow.XmovAvatar;
  }

  await new Promise<void>((resolve, reject) => {
    const absoluteUrl = new URL(url, window.location.origin).href;
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-mofa-xingyun-sdk="${absoluteUrl}"]`
    );

    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('魔珐星云 SDK 加载失败')), {
        once: true
      });
      return;
    }

    const script = document.createElement('script');
    script.src = absoluteUrl;
    script.async = true;
    script.dataset.mofaXingyunSdk = absoluteUrl;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('魔珐星云 SDK 加载失败'));
    document.head.appendChild(script);
  });

  if (!browserWindow.XmovAvatar) {
    throw new Error('魔珐星云 SDK 未提供 XmovAvatar 接口');
  }

  return browserWindow.XmovAvatar;
}

export function createMofaVirtualHumanClient(
  config: MofaVirtualHumanConfig,
  wrapper: HTMLElement,
  sdkLoader: MofaSdkLoader = loadMofaSdk,
  options: MofaVirtualHumanClientOptions = {}
): MofaVirtualHumanClient {
  let avatar: MofaAvatarInstance | null = null;
  let currentSpeech: {
    text: string;
    resolve: () => void;
    timerId: number | null;
    startTimerId: number;
    durationMs: number;
    started: boolean;
  } | null = null;
  const onlineRetryTimers: number[] = [];
  let disarmUserActivationWake: (() => void) | null = null;
  let fatalErrorReported = false;

  function finishCurrentSpeech() {
    if (!currentSpeech) {
      return;
    }

    if (currentSpeech.timerId !== null) {
      window.clearTimeout(currentSpeech.timerId);
    }
    window.clearTimeout(currentSpeech.startTimerId);
    currentSpeech.resolve();
    currentSpeech = null;
  }

  function markCurrentSpeechStarted() {
    if (!currentSpeech || currentSpeech.started) {
      return;
    }

    currentSpeech.started = true;
    window.clearTimeout(currentSpeech.startTimerId);
    options.onSpeechStart?.(currentSpeech.text);
    currentSpeech.timerId = window.setTimeout(
      finishCurrentSpeech,
      currentSpeech.durationMs + 3_000
    );
  }

  function handleVoiceStateChange(status: MofaVoiceState) {
    if (status === 'voice_start' || status === 'start') {
      markCurrentSpeechStarted();
    } else if (status === 'voice_end' || status === 'end') {
      finishCurrentSpeech();
    }
  }

  function handleSdkEvent(label: string, payload: unknown) {
    if (config.startConfig.enableLogger) {
      console.info(label, payload);
    }

    if (fatalErrorReported) {
      return;
    }

    const fatalMessage = resolveFatalSdkError(payload);

    if (fatalMessage) {
      fatalErrorReported = true;
      options.onFatalError?.(fatalMessage);
    }
  }

  function wakeAvatar() {
    avatar?.changeAvatarVisible?.(true);
    avatar?.onlineMode?.();
  }

  function armUserActivationWake() {
    if (disarmUserActivationWake) {
      return;
    }

    const wake = () => {
      disarmUserActivationWake = null;
      wakeAvatar();
    };

    document.addEventListener('pointerdown', wake, { capture: true, once: true });
    document.addEventListener('keydown', wake, { capture: true, once: true });
    disarmUserActivationWake = () => {
      document.removeEventListener('pointerdown', wake, { capture: true });
      document.removeEventListener('keydown', wake, { capture: true });
    };
  }

  return {
    async start() {
      const AvatarConstructor = await sdkLoader(config.sdkScriptUrl);
      wrapper.innerHTML = '';
      const startedAvatar = new AvatarConstructor({
        containerId: `#${wrapper.id}`,
        appId: config.appId,
        appSecret: config.appSecret,
        gatewayServer: config.gatewayServer,
        hardwareAcceleration: config.startConfig.hardwareAcceleration,
        enableLogger: config.startConfig.enableLogger,
        onMessage: (message) => handleSdkEvent('[MOFA Avatar message]', message),
        onStateChange: (state) => handleSdkEvent('[MOFA Avatar state]', state),
        onStatusChange: (status) => handleSdkEvent('[MOFA Avatar status]', status),
        onNetworkInfo: (networkInfo) => handleSdkEvent('[MOFA Avatar network]', networkInfo),
        onVoiceStateChange: handleVoiceStateChange
      });
      avatar = startedAvatar;
      await Promise.resolve(
        avatar.init?.({
          initModel: 'normal',
          onDownloadProgress: (progress) => {
            if (config.startConfig.enableLogger) {
              console.info('[MOFA Avatar download]', progress);
            }
          }
        })
      );
      if (!avatar || avatar !== startedAvatar) {
        return;
      }
      wakeAvatar();
      armUserActivationWake();
      if (!avatar || avatar !== startedAvatar) {
        return;
      }
      onlineRetryTimers.push(window.setTimeout(wakeAvatar, 1000));
      onlineRetryTimers.push(window.setTimeout(wakeAvatar, 4000));
      const liveAvatar = avatar;
      if (!liveAvatar || liveAvatar !== startedAvatar) {
        return;
      }
      liveAvatar.setVolume?.(1);
    },

    async speak(text: string) {
      if (!avatar) {
        throw new Error('魔珐星云数字人尚未启动');
      }

      finishCurrentSpeech();
      avatar.interactiveidle?.();
      const durationMs = estimateSpeechDurationMs(text);
      options.onSpeechDuration?.(durationMs, text);

      await new Promise<void>((resolve) => {
        const startTimerId = window.setTimeout(markCurrentSpeechStarted, 1_500);
        currentSpeech = {
          text,
          resolve,
          timerId: null,
          startTimerId,
          durationMs,
          started: false
        };
        avatar?.speak(text, true, true);
      }).finally(() => {
        finishCurrentSpeech();
      });
    },

    async triggerAction(actionId: string) {
      if (!avatar) {
        throw new Error('魔珐星云数字人尚未启动');
      }

      const actionMap: Record<string, (() => void) | undefined> = {
        idle: avatar.idle?.bind(avatar),
        interactiveidle: avatar.interactiveidle?.bind(avatar),
        interactive_idle: avatar.interactiveidle?.bind(avatar),
        onlineMode: avatar.onlineMode?.bind(avatar),
        offlineMode: avatar.offlineMode?.bind(avatar)
      };
      const action = actionMap[actionId];

      if (action) {
        action();
        return;
      }

      avatar.speak(
        `<speak><ue4event><type>ka</type><data><action_semantic>${actionId}</action_semantic></data></ue4event></speak>`,
        true,
        true
      );
    },

    async stop() {
      finishCurrentSpeech();
      while (onlineRetryTimers.length > 0) {
        window.clearTimeout(onlineRetryTimers.pop());
      }
      disarmUserActivationWake?.();
      disarmUserActivationWake = null;
      avatar?.destroy?.();
      avatar = null;
      wrapper.innerHTML = '';
    }
  };
}
