// 导游 API 客户端统一处理 HTTP、WebSocket 流式事件和文件导出。
import type {
  GuideChatResponse,
  GuideAttachment,
  GuideSpeechTimeline,
  ScenicAreaSummary
} from '../types/guide';
import { createBackendWebSocketUrl } from './backendSocketUrl';

export type GuideConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type GuideExportFormat = 'txt' | 'word' | 'markdown' | 'excel';

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as unknown;

  if (!response.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : '请求失败';
    throw new Error(message);
  }

  return body as T;
}

export async function fetchScenicArea(): Promise<ScenicAreaSummary> {
  const response = await fetch('/api/scenic-area');
  return readJson<ScenicAreaSummary>(response);
}

export async function askGuide(
  message: string,
  attachment?: GuideAttachment | null,
  history?: GuideConversationMessage[]
): Promise<GuideChatResponse> {
  const response = await fetch('/api/guide/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, attachment, history })
  });

  return readJson<GuideChatResponse>(response);
}

function exportFilename(response: Response, format: GuideExportFormat): string {
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      // Fall through to the safe local filename.
    }
  }

  const extension = { txt: 'txt', word: 'rtf', markdown: 'md', excel: 'xlsx' }[format];
  return `数字导游回答.${extension}`;
}

export async function downloadGuideAnswer(
  content: string,
  format: GuideExportFormat
): Promise<void> {
  const response = await fetch('/api/guide/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, format })
  });

  if (!response.ok) {
    let message = '文件导出失败，请稍后重试。';
    try {
      const body = (await response.json()) as { message?: unknown };
      if (typeof body.message === 'string') {
        message = body.message;
      }
    } catch {
      // Keep the stable fallback message for non-JSON errors.
    }
    throw new Error(message);
  }

  const objectUrl = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = exportFilename(response, format);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export type GuideChatStreamEvent =
  | { type: 'start' }
  | { type: 'delta'; delta: string }
  | { type: 'speech-timeline'; timeline: GuideSpeechTimeline }
  | { type: 'result'; response: GuideChatResponse }
  | { type: 'error'; code: string; message: string }
  | { type: 'done' };

export type GuideChatStreamHandlers = {
  onStart?: () => void;
  onDelta: (delta: string) => void;
  onSpeechTimeline?: (timeline: GuideSpeechTimeline) => void;
  onResult: (response: GuideChatResponse) => void;
  onError: (error: Error) => void;
  onDone?: () => void;
};

export type GuideChatStreamController = {
  close: () => void;
};

function createGuideStreamUrl(): string {
  return createBackendWebSocketUrl('/api/guide/chat/stream');
}

const GUIDE_STREAM_RECONNECT_DELAY_MS = 250;
const GUIDE_STREAM_MAX_RECONNECTS = 1;

function parseGuideStreamEvent(raw: string): GuideChatStreamEvent {
  const parsed = JSON.parse(raw) as GuideChatStreamEvent;

  if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
    throw new Error('Invalid guide stream event.');
  }

  return parsed;
}

export function streamGuideAnswer(
  message: string,
  attachment: GuideAttachment | null | undefined,
  handlers: GuideChatStreamHandlers,
  history?: GuideConversationMessage[]
): GuideChatStreamController {
  if (typeof WebSocket === 'undefined') {
    let closed = false;

    void askGuide(message, attachment, history)
      .then((response) => {
        if (closed) {
          return;
        }

        handlers.onResult(response);
        handlers.onDone?.();
      })
      .catch((caught) => {
        if (!closed) {
          handlers.onError(caught instanceof Error ? caught : new Error('Guide request failed.'));
        }
      });

    return {
      close: () => {
        closed = true;
      }
    };
  }

  let socket: WebSocket | null = null;
  let closedByClient = false;
  let completed = false;
  let receivedDelta = false;
  let reconnectCount = 0;
  let reconnectTimer: number | null = null;

  const reportConnectionFailure = (message: string) => {
    if (completed || closedByClient || reconnectTimer !== null) {
      return;
    }

    if (!receivedDelta && reconnectCount < GUIDE_STREAM_MAX_RECONNECTS) {
      reconnectCount += 1;
      reconnectTimer = window.setTimeout(connect, GUIDE_STREAM_RECONNECT_DELAY_MS);
      return;
    }

    handlers.onError(new Error(message));
  };

  const connect = () => {
    if (closedByClient || completed) {
      return;
    }

    const nextSocket = new WebSocket(createGuideStreamUrl());
    socket = nextSocket;
    let connectionFailureReported = false;
    const reportCurrentConnectionFailure = (message: string) => {
      if (connectionFailureReported) {
        return;
      }
      connectionFailureReported = true;
      reportConnectionFailure(message);
    };

    nextSocket.addEventListener('open', () => {
      nextSocket.send(JSON.stringify({ type: 'ask', message, attachment, history }));
    });

    nextSocket.addEventListener('message', (event) => {
      try {
        const streamEvent = parseGuideStreamEvent(String(event.data));

        if (streamEvent.type === 'start') {
          handlers.onStart?.();
        } else if (streamEvent.type === 'delta') {
          receivedDelta = true;
          handlers.onDelta(streamEvent.delta);
        } else if (streamEvent.type === 'speech-timeline') {
          handlers.onSpeechTimeline?.(streamEvent.timeline);
        } else if (streamEvent.type === 'result') {
          handlers.onResult(streamEvent.response);
        } else if (streamEvent.type === 'error') {
          handlers.onError(new Error(streamEvent.message));
        } else if (streamEvent.type === 'done') {
          completed = true;
          handlers.onDone?.();
          nextSocket.close();
        }
      } catch (caught) {
        handlers.onError(
          caught instanceof Error ? caught : new Error('Guide stream parse failed.')
        );
        nextSocket.close();
      }
    });

    nextSocket.addEventListener('error', () => {
      reportCurrentConnectionFailure('Guide stream connection failed.');
    });

    nextSocket.addEventListener('close', () => {
      reportCurrentConnectionFailure('Guide stream closed before completion.');
    });
  };

  connect();

  return {
    close: () => {
      closedByClient = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      socket?.close();
    }
  };
}
