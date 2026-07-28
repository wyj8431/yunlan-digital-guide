import WebSocket from 'ws';
import type { ServerEnv } from '../../config/env.js';
import { createXfyunSignedUrl } from './xfyun-auth.js';
import type { VoiceAsrCallbacks, VoiceAsrSession } from './voice.types.js';

type XfyunSocket = {
  readyState: number;
  on(event: string, listener: (...args: unknown[]) => void): void;
  send(payload: string): void;
  close(): void;
};

type XfyunSocketFactory = (url: string) => XfyunSocket;

type XfyunRecognitionResult = {
  sn?: number;
  pgs?: 'apd' | 'rpl';
  rg?: [number, number];
  ws?: Array<{ cw?: Array<{ w?: string }> }>;
};

type XfyunMessage = {
  code?: number;
  message?: string;
  data?: {
    status?: number;
    result?: XfyunRecognitionResult;
  };
};

const OPEN = 1;
const MAX_QUEUED_AUDIO_BYTES = 512 * 1024;

function readResultText(result: XfyunRecognitionResult | undefined): string {
  return (
    result?.ws
      ?.map((word) => word.cw?.[0]?.w ?? '')
      .join('')
      .trim() ?? ''
  );
}

export function createXfyunAsrSession(
  env: ServerEnv,
  callbacks: VoiceAsrCallbacks,
  socketFactory: XfyunSocketFactory = (url) => new WebSocket(url)
): VoiceAsrSession {
  let socket: XfyunSocket | null = null;
  let opened = false;
  let finished = false;
  let cancelled = false;
  let finalEmitted = false;
  let sentFirstFrame = false;
  let queuedBytes = 0;
  const queuedAudio: Buffer[] = [];
  const resultSegments = new Map<number, string>();
  let resolveOpen: (() => void) | null = null;
  let rejectOpen: ((error: Error) => void) | null = null;

  function currentText(): string {
    return [...resultSegments.entries()]
      .sort(([first], [second]) => first - second)
      .map(([, text]) => text)
      .join('');
  }

  function closeSocket() {
    if (socket && socket.readyState === OPEN) {
      socket.close();
    }
    socket = null;
  }

  function fail(error: Error) {
    if (cancelled || finalEmitted) {
      return;
    }

    rejectOpen?.(error);
    resolveOpen = null;
    rejectOpen = null;
    callbacks.onError(error);
    closeSocket();
  }

  function sendAudioFrame(status: 0 | 1 | 2, audio: Buffer) {
    if (!socket || socket.readyState !== OPEN) {
      return;
    }

    const payload =
      status === 0
        ? {
            common: { app_id: env.xfyunAsrAppId },
            business: {
              language: 'zh_cn',
              domain: 'iat',
              accent: 'mandarin',
              vad_eos: 1200
            },
            data: {
              status,
              format: 'audio/L16;rate=16000',
              encoding: 'raw',
              audio: audio.toString('base64')
            }
          }
        : {
            data: {
              status,
              format: 'audio/L16;rate=16000',
              encoding: 'raw',
              audio: audio.toString('base64')
            }
          };

    socket.send(JSON.stringify(payload));
    if (status === 0) {
      sentFirstFrame = true;
    }
  }

  function flushQueuedAudio() {
    while (queuedAudio.length > 0) {
      const audio = queuedAudio.shift();
      if (!audio) {
        continue;
      }

      queuedBytes -= audio.length;
      sendAudioFrame(sentFirstFrame ? 1 : 0, audio);
    }
  }

  function handleMessage(raw: WebSocket.RawData | Buffer | string) {
    let message: XfyunMessage;

    try {
      message = JSON.parse(raw.toString()) as XfyunMessage;
    } catch {
      fail(new Error('讯飞语音识别返回了无效数据。'));
      return;
    }

    if (message.code !== undefined && message.code !== 0) {
      fail(new Error(message.message || `讯飞语音识别失败：${message.code}`));
      return;
    }

    const result = message.data?.result;
    const text = readResultText(result);
    if (message.data?.status === 2) {
      if (!finalEmitted) {
        finalEmitted = true;
        callbacks.onFinal(currentText());
        closeSocket();
      }
      return;
    }

    if (!result || !text || typeof result.sn !== 'number') {
      return;
    }

    if (result.pgs === 'rpl' && result.rg) {
      for (let index = result.rg[0]; index <= result.rg[1]; index += 1) {
        resultSegments.delete(index);
      }
    }

    resultSegments.set(result.sn, text);
    callbacks.onPartial(currentText());
  }

  function attachSocket(nextSocket: XfyunSocket) {
    socket = nextSocket;
    socket.on('open', () => {
      if (cancelled) {
        return;
      }

      opened = true;
      flushQueuedAudio();
      if (finished) {
        if (!sentFirstFrame) {
          sendAudioFrame(0, Buffer.alloc(0));
        }
        sendAudioFrame(2, Buffer.alloc(0));
      }
      resolveOpen?.();
      resolveOpen = null;
      rejectOpen = null;
    });
    socket.on('message', (raw) => {
      if (
        typeof raw === 'string' ||
        Buffer.isBuffer(raw) ||
        raw instanceof ArrayBuffer ||
        (Array.isArray(raw) && raw.every((part) => Buffer.isBuffer(part)))
      ) {
        handleMessage(raw as WebSocket.RawData | Buffer | string);
        return;
      }

      fail(new Error('讯飞语音识别返回了无效数据。'));
    });
    socket.on('error', (error) => {
      fail(error instanceof Error ? error : new Error('讯飞语音识别连接失败。'));
    });
    socket.on('close', () => {
      if (!cancelled && !finalEmitted && !finished) {
        fail(new Error('讯飞语音识别连接已关闭。'));
      }
    });
  }

  return {
    open() {
      if (opened || socket) {
        return Promise.resolve();
      }

      if (
        !env.xfyunAsrEnabled ||
        !env.xfyunAsrAppId ||
        !env.xfyunAsrApiKey ||
        !env.xfyunAsrApiSecret
      ) {
        const error = new Error('讯飞流式语音识别配置缺失。');
        callbacks.onError(error);
        return Promise.reject(error);
      }

      return new Promise<void>((resolve, reject) => {
        resolveOpen = resolve;
        rejectOpen = reject;
        try {
          attachSocket(
            socketFactory(
              createXfyunSignedUrl({
                url: env.xfyunAsrUrl,
                apiKey: env.xfyunAsrApiKey,
                apiSecret: env.xfyunAsrApiSecret
              })
            )
          );
        } catch (caught) {
          fail(caught instanceof Error ? caught : new Error('讯飞语音识别启动失败。'));
        }
      });
    },

    pushAudio(pcm) {
      if (cancelled || finished || pcm.length === 0) {
        return;
      }

      if (!opened) {
        if (queuedBytes + pcm.length > MAX_QUEUED_AUDIO_BYTES) {
          fail(new Error('语音输入速度过快，请稍后重试。'));
          return;
        }
        queuedAudio.push(Buffer.from(pcm));
        queuedBytes += pcm.length;
        return;
      }

      sendAudioFrame(sentFirstFrame ? 1 : 0, pcm);
    },

    finish() {
      if (cancelled || finished) {
        return;
      }

      finished = true;
      if (opened) {
        if (!sentFirstFrame) {
          sendAudioFrame(0, Buffer.alloc(0));
        }
        sendAudioFrame(2, Buffer.alloc(0));
      }
    },

    cancel() {
      if (cancelled) {
        return;
      }

      cancelled = true;
      finished = true;
      resolveOpen = null;
      rejectOpen = null;
      queuedAudio.length = 0;
      queuedBytes = 0;
      closeSocket();
    }
  };
}
