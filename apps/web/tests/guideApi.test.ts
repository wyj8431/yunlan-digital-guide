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
});
