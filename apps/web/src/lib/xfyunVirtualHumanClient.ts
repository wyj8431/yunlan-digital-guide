import type { VirtualHumanConfig } from '../types/virtualHuman';

type EnabledVirtualHumanConfig = Extract<VirtualHumanConfig, { enabled: true }>;

type AvatarPlatformApi = {
  setApiInfo: (config: Record<string, unknown>) => void;
  setGlobalParams: (config: Record<string, unknown>) => void;
  start: (config: { wrapper: HTMLElement }) => Promise<unknown>;
  writeText: (text: string, config: Record<string, unknown>) => Promise<unknown>;
  writeCmd?: (type: 'action', value: string) => Promise<unknown>;
  stop?: () => unknown;
  destroy?: () => unknown;
  on?: (event: unknown, listener: (...args: unknown[]) => void) => AvatarPlatformApi;
  player?: AvatarPlayerApi;
  createPlayer?: () => AvatarPlayerApi;
};

type AvatarPlayerApi = {
  on: (event: unknown, listener: (...args: unknown[]) => void) => unknown;
  resume: () => unknown;
};

type AvatarPlatformConstructor = new () => AvatarPlatformApi;

type CurrentSdkModule = {
  default: AvatarPlatformConstructor;
  SDKEvents?: Record<string, unknown>;
  PlayerEvents?: Record<string, unknown>;
};

type LegacyVmsApi = {
  start: (config: Record<string, unknown>) => Promise<unknown>;
  stop: () => Promise<unknown>;
  textDriver: (config: Record<string, unknown>) => Promise<unknown>;
};

type LoadedSdk = CurrentSdkModule | { VMS: LegacyVmsApi };
export type XfyunSdkLoader = (url: string) => Promise<LoadedSdk>;
export type RuntimeModuleImporter = (url: string) => Promise<unknown>;

export type XfyunVirtualHumanClient = {
  start: () => Promise<void>;
  speak: (text: string) => Promise<void>;
  triggerAction: (actionId: string) => Promise<void>;
  stop: () => Promise<void>;
};

type XfyunWindow = Window & { VMS?: LegacyVmsApi };
type XfyunVirtualHumanClientOptions = {
  onSpeechDuration?: (durationMs: number, text: string) => void;
};

const AVATAR_SERVER_URL = 'wss://avatar.cn-huadong-1.xf-yun.com/v1/interact';
const MIN_SYNC_DURATION_MS = 600;
const MAX_SYNC_DURATION_MS = 180_000;

function isCurrentSdkModule(sdk: LoadedSdk): sdk is CurrentSdkModule {
  return 'default' in sdk && typeof sdk.default === 'function';
}

async function loadLegacyScript(url: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-xfyun-vms-sdk="${url}"]`
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('讯飞虚拟人 SDK 加载失败')), {
        once: true
      });
      return;
    }

    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.dataset.xfyunVmsSdk = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('讯飞虚拟人 SDK 加载失败'));
    document.head.appendChild(script);
  });
}

const importAtRuntime = new Function('url', 'return import(url)') as RuntimeModuleImporter;

export async function loadXfyunSdk(
  url: string,
  runtimeImport: RuntimeModuleImporter = importAtRuntime
): Promise<LoadedSdk> {
  const browserWindow = window as XfyunWindow;
  const absoluteUrl = new URL(url, window.location.origin).href;
  let importError: unknown;

  try {
    const sdk = (await runtimeImport(absoluteUrl)) as Partial<CurrentSdkModule>;
    if (typeof sdk.default === 'function') {
      return sdk as CurrentSdkModule;
    }
  } catch (error) {
    importError = error;
  }

  if (browserWindow.VMS) {
    return { VMS: browserWindow.VMS };
  }

  if (/vms-web-sdk/i.test(url)) {
    await loadLegacyScript(url);
    if (browserWindow.VMS) {
      return { VMS: browserWindow.VMS };
    }
  }

  if (importError instanceof Error) {
    throw importError;
  }

  throw new Error('讯飞虚拟人 SDK 未提供可用接口');
}

function createLegacyTextPayload(text: string, config: EnabledVirtualHumanConfig) {
  return {
    parameter: { tts: config.tts },
    payload: {
      text: { encoding: 'utf8', compress: 'raw', format: 'json', text },
      ctrl_t: { encoding: 'utf8', compress: 'raw', format: 'json', text: '' },
      ctrl_postproc: { encoding: 'utf8', compress: 'raw', format: 'json', text: '' }
    }
  };
}

function findDurationValue(payload: unknown): number | null {
  if (typeof payload === 'number' && Number.isFinite(payload)) {
    return payload;
  }

  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const entries = Object.entries(payload);

  for (const [key, value] of entries) {
    if (/duration|time/i.test(key) && typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  for (const [, value] of entries) {
    const duration = findDurationValue(value);
    if (duration !== null) {
      return duration;
    }
  }

  return null;
}

function normalizeDurationMs(payload: unknown): number | null {
  const duration = findDurationValue(payload);

  if (duration === null || duration <= 0) {
    return null;
  }

  const durationMs = duration < 120 ? duration * 1000 : duration;

  return Math.min(MAX_SYNC_DURATION_MS, Math.max(MIN_SYNC_DURATION_MS, durationMs));
}

export function createXfyunVirtualHumanClient(
  config: EnabledVirtualHumanConfig,
  wrapper: HTMLElement,
  sdkLoader: XfyunSdkLoader = loadXfyunSdk,
  options: XfyunVirtualHumanClientOptions = {}
): XfyunVirtualHumanClient {
  let avatar: AvatarPlatformApi | null = null;
  let legacyVms: LegacyVmsApi | null = null;
  let disarmAudioResume: (() => void) | null = null;
  let currentSpeechText = '';

  return {
    async start() {
      const sdk = await sdkLoader(config.sdkScriptUrl);

      if (!isCurrentSdkModule(sdk)) {
        legacyVms = sdk.VMS;
        await legacyVms.start({ ...config.startConfig, streamDomId: wrapper.id });
        return;
      }

      avatar = new sdk.default();
      const ttsDurationEvent = sdk.SDKEvents?.tts_duration;
      if (ttsDurationEvent) {
        avatar.on?.(ttsDurationEvent, (payload) => {
          const durationMs = normalizeDurationMs(payload);
          if (durationMs !== null && currentSpeechText) {
            options.onSpeechDuration?.(durationMs, currentSpeechText);
          }
        });
      }

      const player = avatar.player ?? avatar.createPlayer?.();
      const playNotAllowedEvent = sdk.PlayerEvents?.playNotAllowed;
      if (player && playNotAllowedEvent) {
        const armAudioResume = () => {
          if (disarmAudioResume) {
            return;
          }

          const resume = () => {
            disarmAudioResume = null;
            Promise.resolve(player.resume()).catch(() => undefined);
          };
          document.addEventListener('click', resume, { once: true });
          disarmAudioResume = () => document.removeEventListener('click', resume);
        };

        armAudioResume();
        player.on(playNotAllowedEvent, armAudioResume);
      }

      avatar.setApiInfo({
        appId: config.startConfig.appId,
        ...(config.serviceId ? { sceneId: config.serviceId } : {}),
        ...(config.signedUrl ? { signedUrl: config.signedUrl } : { serverUrl: AVATAR_SERVER_URL }),
        ...(config.signedUrl
          ? {}
          : {
              ...(config.startConfig.apiKey ? { apiKey: config.startConfig.apiKey } : {}),
              apiSecret: config.startConfig.apiSecret ?? ''
            })
      });
      avatar.setGlobalParams({
        stream: { protocol: 'xrtc', alpha: config.startConfig.transparent ? 1 : 0 },
        avatar: {
          avatar_id: config.startConfig.avatarId,
          width: config.startConfig.width,
          height: config.startConfig.height
        },
        tts: config.tts
      });
      await avatar.start({ wrapper });
    },

    async speak(text: string) {
      if (avatar) {
        currentSpeechText = text;
        await avatar.writeText(text, {
          nlp: false,
          tts: config.tts,
          avatar_dispatch: { interactive_mode: 1, content_analysis: 1 }
        });
        return;
      }

      if (legacyVms) {
        currentSpeechText = text;
        await legacyVms.textDriver(createLegacyTextPayload(text, config));
        return;
      }

      throw new Error('讯飞虚拟人尚未启动');
    },

    async triggerAction(actionId: string) {
      if (avatar?.writeCmd) {
        await avatar.writeCmd('action', actionId);
        return;
      }

      throw new Error('讯飞虚拟人动作指令不可用');
    },

    async stop() {
      disarmAudioResume?.();
      disarmAudioResume = null;
      await Promise.resolve(avatar?.stop?.()).catch(() => undefined);
      await Promise.resolve(avatar?.destroy?.()).catch(() => undefined);
      await legacyVms?.stop().catch(() => undefined);
      avatar = null;
      legacyVms = null;
      currentSpeechText = '';
    }
  };
}
