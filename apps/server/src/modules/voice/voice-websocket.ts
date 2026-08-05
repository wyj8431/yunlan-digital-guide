// 管理浏览器语音导游 WebSocket 的连接、消息校验和会话清理。
import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import { readEnv } from '../../config/env.js';
import { createGuideResponse } from '../guide/guide.service.js';
import { loadScenicData, mergeScenicDataWithSummary } from '../scenic/scenic-data.js';
import { ScenicLiveService } from '../scenic/scenic-live.service.js';
import { createXfyunAsrSession } from './xfyun-asr.js';
import { VoiceSession } from './voice-session.js';
import type {
  VoiceAsrCallbacks,
  VoiceAsrSession,
  VoiceClientEvent,
  VoiceOutputMode,
  VoiceServerEvent
} from './voice.types.js';

const VOICE_PATH = '/api/voice';
const MAX_VOICE_PAYLOAD = 128 * 1024;
const MAX_AUDIO_CHUNK_BYTES = 64 * 1024;

function requestPath(req: IncomingMessage): string {
  return req.url?.split('?')[0] ?? '';
}

export type VoiceWebSocketDependencies = {
  createAsr?: (callbacks: VoiceAsrCallbacks) => VoiceAsrSession;
  createGuideResponse?: (message: string) => ReturnType<typeof createGuideResponse>;
  scenicLiveService?: ScenicLiveService;
};

function sendEvent(socket: WebSocket, event: VoiceServerEvent) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(event));
  }
}

function parseClientEvent(raw: WebSocket.RawData): VoiceClientEvent | null {
  try {
    return JSON.parse(rawToBuffer(raw).toString('utf8')) as VoiceClientEvent;
  } catch {
    return null;
  }
}

function rawToBuffer(raw: WebSocket.RawData): Buffer {
  if (Buffer.isBuffer(raw)) {
    return raw;
  }

  if (Array.isArray(raw)) {
    return Buffer.concat(raw);
  }

  return Buffer.from(raw);
}

function isOutputMode(value: unknown): value is VoiceOutputMode {
  return value === 'xfyun-avatar' || value === 'local-avatar';
}

function isSessionStart(
  event: VoiceClientEvent | null
): event is Extract<VoiceClientEvent, { type: 'session.start' }> {
  return Boolean(
    event &&
    event.type === 'session.start' &&
    typeof event.sessionId === 'string' &&
    event.sessionId.length > 0 &&
    typeof event.sequence === 'number' &&
    isOutputMode(event.outputMode) &&
    event.sampleRate === 16000
  );
}

function isSessionCancel(
  event: VoiceClientEvent | null
): event is Extract<VoiceClientEvent, { type: 'session.cancel' }> {
  return Boolean(
    event &&
    event.type === 'session.cancel' &&
    typeof event.sessionId === 'string' &&
    typeof event.sequence === 'number'
  );
}

export function attachVoiceWebSocketServer(
  server: HttpServer,
  dependencies: VoiceWebSocketDependencies = {}
): WebSocketServer {
  const env = readEnv();
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_VOICE_PAYLOAD });

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (requestPath(req) !== VOICE_PATH) {
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (socket) => {
    let session: VoiceSession | null = null;

    const emitError = (sessionId: string, code: string, message: string, recoverable = true) => {
      sendEvent(socket, {
        type: 'error',
        sessionId,
        sequence: Date.now(),
        code,
        message,
        recoverable
      });
    };

    socket.on('message', (raw, isBinary) => {
      if (isBinary) {
        const audio = rawToBuffer(raw);

        if (audio.length > MAX_AUDIO_CHUNK_BYTES) {
          emitError(session?.id ?? '', 'AUDIO_CHUNK_TOO_LARGE', '语音数据块过大。');
          return;
        }

        if (!session) {
          emitError('', 'SESSION_NOT_STARTED', '请先创建语音会话。');
          return;
        }

        session.pushAudio(audio);
        return;
      }

      const event = parseClientEvent(raw);

      if (isSessionStart(event)) {
        if (session) {
          emitError(event.sessionId, 'SESSION_ALREADY_STARTED', '当前连接已经存在语音会话。');
          return;
        }

        session = new VoiceSession({
          sessionId: event.sessionId,
          outputMode: event.outputMode,
          createAsr:
            dependencies.createAsr ?? ((callbacks) => createXfyunAsrSession(env, callbacks)),
          createGuideResponse:
            dependencies.createGuideResponse ??
            (async (message) =>
              createGuideResponse({
                message,
                env,
                scenicData: dependencies.scenicLiveService
                  ? mergeScenicDataWithSummary(
                      loadScenicData(),
                      await dependencies.scenicLiveService.getSummary()
                    )
                  : undefined
              })),
          emit: (serverEvent) => sendEvent(socket, serverEvent)
        });
        void session.start();
        return;
      }

      if (isSessionCancel(event)) {
        if (session && event.sessionId === session.id) {
          session.cancel();
        }
        return;
      }

      emitError('', 'INVALID_VOICE_EVENT', '无效的语音会话事件。');
    });

    socket.on('close', () => {
      session?.cancel();
      session = null;
    });
  });

  return wss;
}
