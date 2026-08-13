import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamGuideAnswer } from '../src/api/guideApi';

class FakeWebSocket extends EventTarget {
  static instances: FakeWebSocket[] = [];
  sent: string[] = [];

  constructor(public readonly url: string) {
    super();
    FakeWebSocket.instances.push(this);
  }

  send(payload: string) {
    this.sent.push(payload);
  }

  close() {
    this.dispatchEvent(new Event('close'));
  }

  open() {
    this.dispatchEvent(new Event('open'));
  }

  failBeforeFirstDelta() {
    this.dispatchEvent(new Event('error'));
    this.dispatchEvent(new Event('close'));
  }

  emit(event: unknown) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(event) }));
  }
}

describe('streamGuideAnswer', () => {
  afterEach(() => {
    FakeWebSocket.instances = [];
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reconnects once when the socket fails before the first answer delta', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const onError = vi.fn();
    const onResult = vi.fn();
    const onDone = vi.fn();

    streamGuideAnswer('route', undefined, {
      onDelta: vi.fn(),
      onError,
      onResult,
      onDone
    });

    const first = FakeWebSocket.instances[0]!;
    first.open();
    expect(first.sent).toHaveLength(1);
    first.failBeforeFirstDelta();

    vi.advanceTimersByTime(250);
    const second = FakeWebSocket.instances[1]!;
    expect(second).toBeDefined();
    second.open();
    second.emit({
      type: 'result',
      response: {
        answer: 'Recovered answer',
        cards: [],
        source: 'llm',
        speechTimeline: {
          text: 'Recovered answer',
          durationMs: 900,
          visemes: [],
          source: 'estimated'
        },
        retrievedKnowledge: []
      }
    });
    second.emit({ type: 'done' });

    expect(onError).not.toHaveBeenCalled();
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('reports the error when the reconnect attempt also fails', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const onError = vi.fn();

    streamGuideAnswer('route', undefined, {
      onDelta: vi.fn(),
      onError,
      onResult: vi.fn(),
      onDone: vi.fn()
    });

    FakeWebSocket.instances[0]!.open();
    FakeWebSocket.instances[0]!.failBeforeFirstDelta();

    vi.advanceTimersByTime(250);
    const second = FakeWebSocket.instances[1]!;
    expect(second).toBeDefined();
    second.open();
    second.failBeforeFirstDelta();

    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('settles the waiting handlers when the client closes an unfinished stream', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const onError = vi.fn();
    const onDone = vi.fn();

    const stream = streamGuideAnswer('route', undefined, {
      onDelta: vi.fn(),
      onError,
      onResult: vi.fn(),
      onDone
    });

    FakeWebSocket.instances[0]!.open();
    stream.close();

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports an idle stream timeout and closes the socket', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const onError = vi.fn();
    const onDone = vi.fn();

    streamGuideAnswer('route', undefined, {
      onDelta: vi.fn(),
      onError,
      onResult: vi.fn(),
      onDone
    });

    vi.advanceTimersByTime(20_000);

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Guide stream timed out.' })
    );
    expect(onDone).not.toHaveBeenCalled();
  });

  it('reports a terminal stream error once even when the socket later closes', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const onError = vi.fn();

    streamGuideAnswer('route', undefined, {
      onDelta: vi.fn(),
      onError,
      onResult: vi.fn(),
      onDone: vi.fn()
    });

    const socket = FakeWebSocket.instances[0]!;
    socket.open();
    socket.emit({ type: 'error', code: 'GUIDE_STREAM_FAILED', message: 'Guide stream failed.' });
    vi.advanceTimersByTime(20_000);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Guide stream failed.' })
    );
  });

  it('ignores duplicate final result events before the stream completes', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const onResult = vi.fn();
    const onDone = vi.fn();
    const response = {
      answer: 'One final answer',
      cards: [],
      source: 'llm' as const,
      speechTimeline: {
        text: 'One final answer',
        durationMs: 900,
        visemes: [],
        source: 'estimated' as const
      },
      retrievedKnowledge: []
    };

    streamGuideAnswer('route', undefined, {
      onDelta: vi.fn(),
      onError: vi.fn(),
      onResult,
      onDone
    });

    const socket = FakeWebSocket.instances[0]!;
    socket.open();
    socket.emit({ type: 'result', response });
    socket.emit({ type: 'result', response });
    socket.emit({ type: 'done' });

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
