import type { VirtualHumanConfig } from '../types/virtualHuman';

type EnabledVirtualHumanConfig = Extract<VirtualHumanConfig, { enabled: true }>;

type AvatarPlatformApi = {
  setApiInfo: (config: Record<string, unknown>) => void;
  setGlobalParams: (config: Record<string, unknown>) => void;
  start: (config: { wrapper: HTMLElement }) => Promise<unknown>;
  writeText: (text: string, config: Record<string, unknown>) => Promise<unknown>;
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
  stop: () => Promise<void>;
};

type XfyunWindow = Window & { VMS?: LegacyVmsApi };

const AVATAR_SERVER_URL = 'wss://avatar.cn-huadong-1.xf-yun.com/v1/interact';

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

export function createXfyunVirtualHumanClient(
  config: EnabledVirtualHumanConfig,
  wrapper: HTMLElement,
  sdkLoader: XfyunSdkLoader = loadXfyunSdk
): XfyunVirtualHumanClient {
  let avatar: AvatarPlatformApi | null = null;
  let legacyVms: LegacyVmsApi | null = null;
  let disarmAudioResume: (() => void) | null = null;

  return {
    async start() {
      const sdk = await sdkLoader(config.sdkScriptUrl);

      if (!isCurrentSdkModule(sdk)) {
        legacyVms = sdk.VMS;
        await legacyVms.start({ ...config.startConfig, streamDomId: wrapper.id });
        return;
      }

      avatar = new sdk.default();
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
        serverUrl: AVATAR_SERVER_URL,
        appId: config.startConfig.appId,
        apiKey: config.startConfig.apiKey,
        apiSecret: config.startConfig.apiSecret,
        sceneId: config.serviceId
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
        await avatar.writeText(text, {
          nlp: false,
          tts: config.tts,
          avatar_dispatch: { interactive_mode: 1, content_analysis: 1 }
        });
        return;
      }

      if (legacyVms) {
        await legacyVms.textDriver(createLegacyTextPayload(text, config));
        return;
      }

      throw new Error('讯飞虚拟人尚未启动');
    },

    async stop() {
      disarmAudioResume?.();
      disarmAudioResume = null;
      await Promise.resolve(avatar?.stop?.()).catch(() => undefined);
      await Promise.resolve(avatar?.destroy?.()).catch(() => undefined);
      await legacyVms?.stop().catch(() => undefined);
      avatar = null;
      legacyVms = null;
    }
  };
}
