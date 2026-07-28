import { describe, expect, it } from 'vitest';
import type { ServerEnv } from '../src/config/env';
import { createXfyunAsrSession } from '../src/modules/voice/xfyun-asr';

class FakeSocket {
  readyState = 0;
  sent: string[] = [];
  private readonly listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  on(event: string, listener: (...args: unknown[]) => void) {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
  }

  send(payload: string) {
    this.sent.push(payload);
  }

  close() {
    this.readyState = 3;
  }

  open() {
    this.readyState = 1;
    this.emit('open');
  }

  message(payload: unknown) {
    this.emit('message', Buffer.from(JSON.stringify(payload)));
  }

  private emit(event: string, ...args: unknown[]) {
    this.listeners.get(event)?.forEach((listener) => listener(...args));
  }
}

const env: ServerEnv = {
  port: 8787,
  llmProvider: '',
  llmBaseUrl: '',
  llmApiKey: '',
  llmModel: '',
  cozeApiBase: 'https://api.coze.cn',
  cozeApiToken: '',
  cozeBotId: '',
  cozeUserId: 'test-user',
  virtualHumanEnabled: false,
  xfyunVirtualHumanAppId: '',
  xfyunVirtualHumanApiKey: '',
  xfyunVirtualHumanApiSecret: '',
  xfyunVirtualHumanServiceId: '',
  xfyunVirtualHumanAvatarId: '',
  xfyunVirtualHumanSdkScriptUrl: '',
  xfyunVirtualHumanTtsVoice: '',
  xfyunVirtualHumanActions: '',
  xfyunAsrEnabled: true,
  xfyunAsrAppId: 'asr-app',
  xfyunAsrApiKey: 'asr-key',
  xfyunAsrApiSecret: 'asr-secret',
  xfyunAsrUrl: 'wss://iat-api.xfyun.cn/v2/iat',
  xfyunTtsAppId: '',
  xfyunTtsApiKey: '',
  xfyunTtsApiSecret: '',
  xfyunTtsUrl: 'wss://tts-api.xfyun.cn/v2/tts',
  xfyunTtsVoice: 'xiaoyan'
};

describe('xfyun streaming asr', () => {
  it('sends streaming PCM frames and assembles replacement results once', async () => {
    const socket = new FakeSocket();
    const partials: string[] = [];
    const finals: string[] = [];
    const session = createXfyunAsrSession(
      env,
      {
        onPartial: (text) => partials.push(text),
        onFinal: (text) => finals.push(text),
        onError: (error) => {
          throw error;
        }
      },
      () => socket
    );

    const opened = session.open();
    socket.open();
    await opened;

    session.pushAudio(Buffer.from([1, 2, 3]));
    expect(JSON.parse(socket.sent[0])).toMatchObject({
      common: { app_id: 'asr-app' },
      business: { language: 'zh_cn', vad_eos: 1200 },
      data: { status: 0, format: 'audio/L16;rate=16000', encoding: 'raw' }
    });

    session.pushAudio(Buffer.from([4, 5, 6]));
    expect(JSON.parse(socket.sent[1])).toMatchObject({ data: { status: 1 } });

    socket.message({
      code: 0,
      data: { status: 1, result: { sn: 0, pgs: 'apd', ws: [{ cw: [{ w: '黄山' }] }] } }
    });
    socket.message({
      code: 0,
      data: { status: 1, result: { sn: 1, pgs: 'apd', ws: [{ cw: [{ w: '路线' }] }] } }
    });
    socket.message({
      code: 0,
      data: {
        status: 1,
        result: { sn: 1, pgs: 'rpl', rg: [1, 1], ws: [{ cw: [{ w: '交通' }] }] }
      }
    });

    expect(partials.at(-1)).toBe('黄山交通');

    session.finish();
    expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toMatchObject({ data: { status: 2 } });
    socket.message({
      code: 0,
      data: { status: 2, result: { sn: 1, pgs: 'apd', ws: [{ cw: [{ w: '交通' }] }] } }
    });

    expect(finals).toEqual(['黄山交通']);
  });

  it('completes with an empty final transcript when the provider sends status 2 without text', async () => {
    const socket = new FakeSocket();
    const finals: string[] = [];
    const session = createXfyunAsrSession(
      env,
      {
        onPartial: () => undefined,
        onFinal: (text) => finals.push(text),
        onError: (error) => {
          throw error;
        }
      },
      () => socket
    );

    const opened = session.open();
    socket.open();
    await opened;
    session.finish();

    socket.message({ code: 0, data: { status: 2 } });

    expect(finals).toEqual(['']);
    expect(socket.readyState).toBe(3);
  });
});
