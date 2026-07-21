import { describe, expect, it, vi } from 'vitest';
import { createXfyunVirtualHumanClient, loadXfyunSdk } from '../src/lib/xfyunVirtualHumanClient';
import type { VirtualHumanConfig } from '../src/types/virtualHuman';

const config: Extract<VirtualHumanConfig, { enabled: true }> = {
  enabled: true,
  provider: 'xfyun-vms',
  serviceId: 'service-id',
  sdkScriptUrl: '/libs/avatar-sdk/index.js',
  startConfig: {
    appId: 'app-id',
    apiKey: 'api-key',
    apiSecret: 'api-secret',
    avatarId: 'avatar-id',
    width: 720,
    height: 1280,
    isSsl: true,
    transparent: true,
    moveH: 0,
    moveV: 0,
    scale: 1
  },
  tts: {
    vcn: 'voice-id',
    speed: 50,
    pitch: 50,
    volume: 50,
    rhy: 3
  }
};

describe('createXfyunVirtualHumanClient', () => {
  it('loads the public ESM package through an absolute runtime URL', async () => {
    const AvatarPlatform = class {};
    const runtimeImport = vi.fn().mockResolvedValue({ default: AvatarPlatform });

    const sdk = await loadXfyunSdk('/libs/avatar-sdk/esm/index.js', runtimeImport);

    expect(runtimeImport).toHaveBeenCalledWith(
      'http://localhost:3000/libs/avatar-sdk/esm/index.js'
    );
    expect('default' in sdk && sdk.default).toBe(AvatarPlatform);
  });

  it('starts the current ESM SDK with a full-body portrait stream', async () => {
    const wrapper = document.createElement('div');
    const setApiInfo = vi.fn();
    const setGlobalParams = vi.fn();
    const start = vi.fn().mockResolvedValue(undefined);

    class AvatarPlatform {
      setApiInfo = setApiInfo;
      setGlobalParams = setGlobalParams;
      start = start;
      writeText = vi.fn();
      stop = vi.fn();
      destroy = vi.fn();
      on() {
        return this;
      }
    }

    const client = createXfyunVirtualHumanClient(config, wrapper, async () => ({
      default: AvatarPlatform,
      SDKEvents: { connected: 'connected', error: 'error', disconnected: 'disconnected' }
    }));

    await client.start();

    expect(setApiInfo).toHaveBeenCalledWith({
      serverUrl: 'wss://avatar.cn-huadong-1.xf-yun.com/v1/interact',
      appId: 'app-id',
      apiKey: 'api-key',
      apiSecret: 'api-secret',
      sceneId: 'service-id'
    });
    expect(setGlobalParams).toHaveBeenCalledWith({
      stream: { protocol: 'xrtc', alpha: 1 },
      avatar: { avatar_id: 'avatar-id', width: 720, height: 1280 },
      tts: config.tts
    });
    expect(start).toHaveBeenCalledWith({ wrapper });
  });

  it('drives the avatar with plain text and releases the session', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const stop = vi.fn();
    const destroy = vi.fn();

    class AvatarPlatform {
      setApiInfo() {}
      setGlobalParams() {}
      start() {
        return Promise.resolve();
      }
      writeText = writeText;
      stop = stop;
      destroy = destroy;
      on() {
        return this;
      }
    }

    const client = createXfyunVirtualHumanClient(
      config,
      document.createElement('div'),
      async () => ({
        default: AvatarPlatform,
        SDKEvents: { connected: 'connected', error: 'error', disconnected: 'disconnected' }
      })
    );

    await client.start();
    await client.speak('欢迎来到云岚古镇');
    await client.stop();

    expect(writeText).toHaveBeenCalledWith('欢迎来到云岚古镇', {
      nlp: false,
      tts: config.tts,
      avatar_dispatch: { interactive_mode: 1, content_analysis: 1 }
    });
    expect(stop).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('resumes avatar audio after the next user interaction', async () => {
    const resume = vi.fn().mockResolvedValue(undefined);
    let playNotAllowedListener: ((...args: unknown[]) => void) | undefined;
    const player = {
      on: vi.fn((event: unknown, listener: (...args: unknown[]) => void) => {
        if (event === 'not-allowed') {
          playNotAllowedListener = listener;
        }
      }),
      resume
    };

    class AvatarPlatform {
      player = player;
      setApiInfo() {}
      setGlobalParams() {}
      start() {
        return Promise.resolve();
      }
      writeText() {
        return Promise.resolve();
      }
      stop() {}
      destroy() {}
      on() {
        return this;
      }
    }

    const client = createXfyunVirtualHumanClient(
      config,
      document.createElement('div'),
      async () => ({
        default: AvatarPlatform,
        SDKEvents: { connected: 'connected', error: 'error', disconnected: 'disconnected' },
        PlayerEvents: { playNotAllowed: 'not-allowed' }
      })
    );

    await client.start();
    document.dispatchEvent(new MouseEvent('click'));

    expect(player.on).toHaveBeenCalledWith('not-allowed', expect.any(Function));
    expect(resume).toHaveBeenCalledOnce();
    expect(playNotAllowedListener).toEqual(expect.any(Function));
  });
});
