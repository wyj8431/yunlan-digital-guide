import type {
  GuideChatResponse,
  GuideImageAttachment,
  GuideSpeechTimeline,
  ScenicAreaSummary
} from '../types/guide';

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
  image?: GuideImageAttachment | null
): Promise<GuideChatResponse> {
  const response = await fetch('/api/guide/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, image })
  });

  return readJson<GuideChatResponse>(response);
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
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host =
    window.location.port === '5173' ? `${window.location.hostname}:8787` : window.location.host;

  return `${protocol}//${host}/api/guide/chat/stream`;
}

function parseGuideStreamEvent(raw: string): GuideChatStreamEvent {
  const parsed = JSON.parse(raw) as GuideChatStreamEvent;

  if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
    throw new Error('Invalid guide stream event.');
  }

  return parsed;
}

export function streamGuideAnswer(
  message: string,
  image: GuideImageAttachment | null | undefined,
  handlers: GuideChatStreamHandlers
): GuideChatStreamController {
  if (typeof WebSocket === 'undefined') {
    let closed = false;

    void askGuide(message, image)
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

  const socket = new WebSocket(createGuideStreamUrl());
  let closedByClient = false;
  let completed = false;

  socket.addEventListener('open', () => {
    socket.send(JSON.stringify({ type: 'ask', message, image }));
  });

  socket.addEventListener('message', (event) => {
    try {
      const streamEvent = parseGuideStreamEvent(String(event.data));

      if (streamEvent.type === 'start') {
        handlers.onStart?.();
      } else if (streamEvent.type === 'delta') {
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
        socket.close();
      }
    } catch (caught) {
      handlers.onError(caught instanceof Error ? caught : new Error('Guide stream parse failed.'));
      socket.close();
    }
  });

  socket.addEventListener('error', () => {
    if (!completed && !closedByClient) {
      handlers.onError(new Error('Guide stream connection failed.'));
    }
  });

  socket.addEventListener('close', () => {
    if (!completed && !closedByClient) {
      handlers.onError(new Error('Guide stream closed before completion.'));
    }
  });

  return {
    close: () => {
      closedByClient = true;
      socket.close();
    }
  };
}
