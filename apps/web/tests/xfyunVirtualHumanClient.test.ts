import { describe, expect, it, vi } from 'vitest';
import { createXfyunVirtualHumanClient, loadXfyunSdk } from '../src/lib/xfyunVirtualHumanClient';
import type { VirtualHumanConfig } from '../src/types/virtualHuman';

const config: Extract<VirtualHumanConfig, { enabled: true }> = {
  enabled: true,
  provider: 'xfyun-vms',
  serviceId: 'service-id',
  sdkScriptUrl: '/libs/avatar-sdk/index.js',
  signedUrl: 'wss://avatar.cn-huadong-1.xf-yun.com/v1/interact?authorization=test',
  actions: [
    { id: 'A_LH_introduced_O', label: '介绍' },
    { id: 'A_RH_bye_O', label: '再见' }
  ],
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
      appId: 'app-id',
      sceneId: 'service-id',
      signedUrl: config.signedUrl
    });
    expect(setGlobalParams).toHaveBeenCalledWith({
      stream: { protocol: 'xrtc', alpha: 1 },
      avatar: { avatar_id: 'avatar-id', width: 720, height: 1280 },
      tts: config.tts
    });
    expect(start).toHaveBeenCalledWith({ wrapper });
  });

  it('starts the current ESM SDK with App Secret only credentials', async () => {
    const wrapper = document.createElement('div');
    const setApiInfo = vi.fn();
    const start = vi.fn().mockResolvedValue(undefined);
    const appSecretOnlyConfig: Extract<VirtualHumanConfig, { enabled: true }> = {
      ...config,
      serviceId: '',
      signedUrl: '',
      startConfig: {
        ...config.startConfig,
        apiKey: undefined,
        apiSecret: 'app-secret'
      }
    };

    class AvatarPlatform {
      setApiInfo = setApiInfo;
      setGlobalParams = vi.fn();
      start = start;
      writeText = vi.fn();
      stop = vi.fn();
      destroy = vi.fn();
      on() {
        return this;
      }
    }

    const client = createXfyunVirtualHumanClient(appSecretOnlyConfig, wrapper, async () => ({
      default: AvatarPlatform
    }));

    await client.start();

    expect(setApiInfo).toHaveBeenCalledWith({
      serverUrl: 'wss://avatar.cn-huadong-1.xf-yun.com/v1/interact',
      appId: 'app-id',
      apiSecret: 'app-secret'
    });
    expect(start).toHaveBeenCalledWith({ wrapper });
  });

  it('drives the avatar with plain text and releases the session', async () => {
    vi.useFakeTimers();
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
    const speaking = client.speak('欢迎来到云岚古镇');
    await vi.runAllTimersAsync();
    await speaking;
    await client.stop();

    expect(writeText).toHaveBeenCalledWith('欢迎来到云岚古镇', {
      nlp: false,
      tts: config.tts,
      avatar_dispatch: { interactive_mode: 1, content_analysis: 1 }
    });
    expect(stop).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('reports the SDK tts duration for the current spoken text', async () => {
    vi.useFakeTimers();
    const onSpeechDuration = vi.fn();
    const ttsDurationListenerRef = {
      current: null as ((payload: unknown) => void) | null
    };

    class AvatarPlatform {
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
      on(event: unknown, listener: (payload: unknown) => void) {
        if (event === 'tts_duration') {
          ttsDurationListenerRef.current = listener;
        }
        return this;
      }
    }

    const client = createXfyunVirtualHumanClient(
      config,
      document.createElement('div'),
      async () => ({
        default: AvatarPlatform,
        SDKEvents: { tts_duration: 'tts_duration' }
      }),
      { onSpeechDuration }
    );

    await client.start();
    const speaking = client.speak('欢迎来到云岚古镇');
    await Promise.resolve();
    ttsDurationListenerRef.current?.({ payload: { tts: { duration: 2.4 } } });

    expect(onSpeechDuration).toHaveBeenCalledWith(2400, '欢迎来到云岚古镇');
    await vi.runAllTimersAsync();
    await speaking;
    vi.useRealTimers();
  });

  it('keeps long SDK tts durations in seconds instead of treating them as milliseconds', async () => {
    vi.useFakeTimers();
    const onSpeechDuration = vi.fn();
    const ttsDurationListenerRef = {
      current: null as ((payload: unknown) => void) | null
    };

    class AvatarPlatform {
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
      on(event: unknown, listener: (payload: unknown) => void) {
        if (event === 'tts_duration') {
          ttsDurationListenerRef.current = listener;
        }
        return this;
      }
    }

    const client = createXfyunVirtualHumanClient(
      config,
      document.createElement('div'),
      async () => ({
        default: AvatarPlatform,
        SDKEvents: { tts_duration: 'tts_duration' }
      }),
      { onSpeechDuration }
    );

    await client.start();
    const speaking = client.speak('long document summary');
    await Promise.resolve();
    ttsDurationListenerRef.current?.({ payload: { tts: { duration: 240 } } });

    expect(onSpeechDuration).toHaveBeenLastCalledWith(240_000, 'long document summary');
    await vi.runAllTimersAsync();
    await speaking;
    vi.useRealTimers();
  });

  it('uses frame events as the actual speech start and end boundaries', async () => {
    const listeners = new Map<unknown, (...args: unknown[]) => void>();
    const onSpeechStart = vi.fn();
    const onSpeechDuration = vi.fn();

    class AvatarPlatform {
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
      on(event: unknown, listener: (...args: unknown[]) => void) {
        listeners.set(event, listener);
        return this;
      }
    }

    const client = createXfyunVirtualHumanClient(
      config,
      document.createElement('div'),
      async () => ({
        default: AvatarPlatform,
        SDKEvents: {
          frame_start: 'frame_start',
          frame_stop: 'frame_stop',
          tts_duration: 'tts_duration'
        }
      }),
      { onSpeechStart, onSpeechDuration }
    );

    await client.start();
    const speaking = client.speak('欢迎来到云岚古镇');
    await Promise.resolve();

    expect(onSpeechStart).not.toHaveBeenCalled();
    listeners.get('tts_duration')?.({ duration: 2.4 });
    listeners.get('frame_start')?.({});

    expect(onSpeechDuration).toHaveBeenLastCalledWith(2400, '欢迎来到云岚古镇');
    expect(onSpeechStart).toHaveBeenCalledWith('欢迎来到云岚古镇');

    let finished = false;
    void speaking.then(() => {
      finished = true;
    });
    await Promise.resolve();
    expect(finished).toBe(false);

    listeners.get('frame_stop')?.({});
    await speaking;
    expect(finished).toBe(true);
  });

  it('does not let the estimated duration finish speech before frame_stop', async () => {
    vi.useFakeTimers();
    const listeners = new Map<unknown, (...args: unknown[]) => void>();

    class AvatarPlatform {
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
      on(event: unknown, listener: (...args: unknown[]) => void) {
        listeners.set(event, listener);
        return this;
      }
    }

    const client = createXfyunVirtualHumanClient(
      config,
      document.createElement('div'),
      async () => ({
        default: AvatarPlatform,
        SDKEvents: {
          frame_start: 'frame_start',
          frame_stop: 'frame_stop'
        }
      })
    );

    await client.start();
    const speaking = client.speak('short speech');
    let finished = false;
    void speaking.then(() => {
      finished = true;
    });

    listeners.get('frame_start')?.({});
    await vi.advanceTimersByTimeAsync(60_000);

    expect(finished).toBe(false);

    listeners.get('frame_stop')?.({});
    await speaking;
    expect(finished).toBe(true);
    vi.useRealTimers();
  });

  it('does not finish a short speech before its frame start event', async () => {
    vi.useFakeTimers();
    const listeners = new Map<unknown, (...args: unknown[]) => void>();
    const onSpeechStart = vi.fn();

    class AvatarPlatform {
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
      on(event: unknown, listener: (...args: unknown[]) => void) {
        listeners.set(event, listener);
        return this;
      }
    }

    const client = createXfyunVirtualHumanClient(
      config,
      document.createElement('div'),
      async () => ({
        default: AvatarPlatform,
        SDKEvents: {
          frame_start: 'frame_start',
          frame_stop: 'frame_stop'
        }
      }),
      { onSpeechStart }
    );

    await client.start();
    const speaking = client.speak('好');
    let finished = false;
    void speaking.then(() => {
      finished = true;
    });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(onSpeechStart).not.toHaveBeenCalled();
    expect(finished).toBe(false);

    listeners.get('frame_start')?.({});
    listeners.get('frame_stop')?.({});
    await speaking;
    expect(finished).toBe(true);
    vi.useRealTimers();
  });

  it('triggers an avatar action through writeCmd', async () => {
    const writeCmd = vi.fn().mockResolvedValue(undefined);

    class AvatarPlatform {
      setApiInfo() {}
      setGlobalParams() {}
      start() {
        return Promise.resolve();
      }
      writeText() {
        return Promise.resolve();
      }
      writeCmd = writeCmd;
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
        SDKEvents: { connected: 'connected', error: 'error', disconnected: 'disconnected' }
      })
    );

    await client.start();
    await client.triggerAction('A_RH_bye_O');

    expect(writeCmd).toHaveBeenCalledWith('action', 'A_RH_bye_O');
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
