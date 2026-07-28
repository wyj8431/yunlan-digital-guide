import { describe, expect, it, vi } from 'vitest';
import { createMofaVirtualHumanClient, loadMofaSdk } from '../src/lib/mofaVirtualHumanClient';
import type { VirtualHumanConfig } from '../src/types/virtualHuman';

type MofaAvatarOptions = {
  containerId: string;
  appId: string;
  appSecret: string;
  gatewayServer: string;
  hardwareAcceleration: 'prefer-hardware';
  enableLogger: boolean;
  onMessage?: (message: unknown) => void;
  onVoiceStateChange?: (status: string) => void;
};

const config: Extract<VirtualHumanConfig, { provider: 'mofa-xingyun' }> = {
  enabled: true,
  provider: 'mofa-xingyun',
  serviceId: 'service-id',
  sdkScriptUrl: 'https://media.xingyun3d.com/xingyun3d/general/litesdk/xmovAvatar@latest.js',
  appId: 'mofa-app',
  appSecret: 'mofa-secret',
  gatewayServer: 'https://nebula-agent.xingyun3d.com/user/v1/ttsa/session',
  actions: [
    { id: 'interactiveidle', label: 'idle' },
    { id: 'offlineMode', label: 'offline' }
  ],
  startConfig: {
    hardwareAcceleration: 'prefer-hardware',
    enableLogger: false
  }
};

describe('loadMofaSdk', () => {
  it('reuses the global XmovAvatar constructor when already loaded', async () => {
    class XmovAvatar {}
    Object.assign(window, { XmovAvatar });

    await expect(loadMofaSdk(config.sdkScriptUrl)).resolves.toBe(XmovAvatar);

    delete (window as Window & { XmovAvatar?: unknown }).XmovAvatar;
  });
});

describe('createMofaVirtualHumanClient', () => {
  it('starts the SDK with the configured container and credentials', async () => {
    const wrapper = document.createElement('div');
    wrapper.id = 'mofa-avatar';
    const constructorSpy = vi.fn();

    class XmovAvatar {
      constructor(options: MofaAvatarOptions) {
        constructorSpy(options);
      }

      speak = vi.fn();
      setVolume = vi.fn();
      destroy = vi.fn();
    }

    const client = createMofaVirtualHumanClient(config, wrapper, async () => XmovAvatar);

    await client.start();

    expect(constructorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        containerId: '#mofa-avatar',
        appId: 'mofa-app',
        appSecret: 'mofa-secret',
        gatewayServer: 'https://nebula-agent.xingyun3d.com/user/v1/ttsa/session',
        hardwareAcceleration: 'prefer-hardware',
        enableLogger: false,
        onVoiceStateChange: expect.any(Function)
      })
    );
  });

  it('drives speech through speak(text, true, true) and reports estimated duration', async () => {
    vi.useFakeTimers();
    const speak = vi.fn();
    const onSpeechDuration = vi.fn();

    class XmovAvatar {
      speak = speak;
      interactiveidle = vi.fn();
      destroy = vi.fn();
    }

    const client = createMofaVirtualHumanClient(
      config,
      Object.assign(document.createElement('div'), { id: 'mofa-avatar' }),
      async () => XmovAvatar,
      { onSpeechDuration }
    );

    await client.start();
    const speaking = client.speak('Welcome to Wuzhen');

    expect(speak).toHaveBeenCalledWith('Welcome to Wuzhen', true, true);
    expect(onSpeechDuration).toHaveBeenCalledWith(expect.any(Number), 'Welcome to Wuzhen');

    await vi.runAllTimersAsync();
    await speaking;
    vi.useRealTimers();
  });

  it('uses voice state events as the actual speech boundaries', async () => {
    vi.useFakeTimers();
    let capturedOptions: MofaAvatarOptions | null = null;
    const onSpeechStart = vi.fn();

    class XmovAvatar {
      constructor(options: MofaAvatarOptions) {
        capturedOptions = options;
      }

      speak = vi.fn();
      interactiveidle = vi.fn();
      destroy = vi.fn();
    }

    const client = createMofaVirtualHumanClient(
      config,
      Object.assign(document.createElement('div'), { id: 'mofa-avatar' }),
      async () => XmovAvatar,
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

    const liveOptions = capturedOptions as unknown as MofaAvatarOptions;
    liveOptions.onVoiceStateChange?.('voice_start');
    expect(onSpeechStart).toHaveBeenCalledWith('好');
    expect(finished).toBe(false);

    liveOptions.onVoiceStateChange?.('voice_end');
    await speaking;
    expect(finished).toBe(true);
    vi.useRealTimers();
  });

  it('maps action ids to native SDK methods and destroys the instance', async () => {
    const offlineMode = vi.fn();
    const destroy = vi.fn();

    class XmovAvatar {
      speak = vi.fn();
      offlineMode = offlineMode;
      destroy = destroy;
    }

    const wrapper = Object.assign(document.createElement('div'), { id: 'mofa-avatar' });
    const client = createMofaVirtualHumanClient(config, wrapper, async () => XmovAvatar);

    await client.start();
    await client.triggerAction('offlineMode');
    await client.stop();

    expect(offlineMode).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
    expect(wrapper.innerHTML).toBe('');
  });

  it('surfaces fatal SDK errors such as insufficient credits', async () => {
    const onFatalError = vi.fn();
    let capturedOptions: MofaAvatarOptions | null = null;

    class XmovAvatar {
      constructor(options: MofaAvatarOptions) {
        capturedOptions = options;
      }

      speak = vi.fn();
      destroy = vi.fn();
    }

    const client = createMofaVirtualHumanClient(
      config,
      Object.assign(document.createElement('div'), { id: 'mofa-avatar' }),
      async () => XmovAvatar,
      { onFatalError }
    );

    await client.start();
    const liveOptions = capturedOptions as unknown as MofaAvatarOptions;
    liveOptions.onMessage?.({ code: 10003, message: 'Error: 10003, insufficient credits' });

    expect(onFatalError).toHaveBeenCalledWith(expect.stringContaining('10003'));
  });
});
