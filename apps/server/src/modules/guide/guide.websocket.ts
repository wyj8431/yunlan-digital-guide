import type { Server as HttpServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { readEnv } from '../../config/env.js';
import {
  createGuideStreamResponse,
  GuideServiceError,
  normalizeGuideImage,
  type GuideChatResponse
} from './guide.service.js';
import type { GuideSpeechTimeline } from './speech-timeline.js';

const GUIDE_CHAT_STREAM_PATH = '/api/guide/chat/stream';

type GuideStreamRequest = {
  type?: unknown;
  message?: unknown;
  image?: unknown;
};

type GuideStreamEvent =
  | { type: 'start' }
  | { type: 'delta'; delta: string }
  | { type: 'speech-timeline'; timeline: GuideSpeechTimeline }
  | { type: 'result'; response: GuideChatResponse }
  | { type: 'error'; code: string; message: string }
  | { type: 'done' };

function sendEvent(socket: WebSocket, event: GuideStreamEvent) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(event));
  }
}

function parseRequest(raw: WebSocket.RawData): GuideStreamRequest {
  const text = Array.isArray(raw)
    ? Buffer.concat(raw).toString('utf8')
    : Buffer.isBuffer(raw)
      ? raw.toString('utf8')
      : raw.toString();

  return JSON.parse(text) as GuideStreamRequest;
}

export function attachGuideWebSocketServer(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server, path: GUIDE_CHAT_STREAM_PATH });

  wss.on('connection', (socket) => {
    let activeController: AbortController | null = null;

    socket.on('message', async (raw) => {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;

      try {
        const request = parseRequest(raw);

        if (request.type !== 'ask' || typeof request.message !== 'string') {
          sendEvent(socket, {
            type: 'error',
            code: 'INVALID_STREAM_REQUEST',
            message: 'Invalid guide stream request.'
          });
          sendEvent(socket, { type: 'done' });
          return;
        }

        sendEvent(socket, { type: 'start' });

        const response = await createGuideStreamResponse({
          message: request.message,
          image: normalizeGuideImage(request.image),
          env: readEnv(),
          onDelta: (delta) => sendEvent(socket, { type: 'delta', delta }),
          signal: controller.signal
        });

        sendEvent(socket, { type: 'speech-timeline', timeline: response.speechTimeline });
        sendEvent(socket, { type: 'result', response });
        sendEvent(socket, { type: 'done' });
      } catch (caught) {
        if (controller.signal.aborted || socket.readyState !== WebSocket.OPEN) {
          return;
        }

        if (caught instanceof GuideServiceError) {
          sendEvent(socket, { type: 'error', code: caught.code, message: caught.message });
        } else {
          sendEvent(socket, {
            type: 'error',
            code: 'GUIDE_STREAM_FAILED',
            message: 'Guide stream failed.'
          });
        }

        sendEvent(socket, { type: 'done' });
      } finally {
        if (activeController === controller) {
          activeController = null;
        }
      }
    });

    socket.on('close', () => {
      activeController?.abort();
    });
  });

  return wss;
}
