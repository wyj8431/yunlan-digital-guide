import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dispatchGuideSpeechDuration,
  dispatchGuideSpeechPlayback
} from '../src/lib/guideSpeechSync';
import { estimateSpeechDurationMs, useGuideChat } from '../src/hooks/useGuideChat';
import type { GuideChatStreamHandlers } from '../src/api/guideApi';
import type { GuideSpeechTimeline } from '../src/types/guide';

const streamGuideAnswerMock = vi.hoisted(() => vi.fn());

function createSpeechTimeline(text: string): GuideSpeechTimeline {
  return {
    text,
    durationMs: 900,
    visemes: [{ startMs: 0, endMs: 120, viseme: 'aa', mouthOpen: 0.6 }],
    source: 'estimated'
  };
}

vi.mock('../src/api/guideApi', () => ({
  streamGuideAnswer: streamGuideAnswerMock
}));

describe('useGuideChat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    streamGuideAnswerMock.mockImplementation(
      (_message: string, handlers: GuideChatStreamHandlers) => {
        window.setTimeout(() => handlers.onDelta('abc'), 0);
        window.setTimeout(() => {
          handlers.onResult({
            answer: 'abcdef',
            cards: [],
            source: 'local-fallback',
            speechTimeline: createSpeechTimeline('abcdef')
          });
          handlers.onDone?.();
        }, 20);

        return { close: vi.fn() };
      }
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    streamGuideAnswerMock.mockReset();
  });

  it('waits for speech playback before printing assistant deltas', async () => {
    const { result } = renderHook(() => useGuideChat());

    act(() => {
      void result.current.ask('intro');
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1]).toMatchObject({
      role: 'assistant',
      content: '',
      streaming: true
    });

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.messages[1]?.content).toBe('');
    expect(result.current.messages[1]?.streaming).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(20);
      await Promise.resolve();
    });

    expect(result.current.latestAnswer).toBe('abcdef');
    expect(result.current.speechTimeline?.text).toBe('abcdef');

    act(() => {
      dispatchGuideSpeechDuration({ text: 'abcdef', durationMs: 600 });
      dispatchGuideSpeechPlayback({ text: 'abcdef', phase: 'start' });
    });

    expect(result.current.messages[1]?.content).toBe('a');

    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });

    expect(result.current.messages[1]).toMatchObject({
      content: 'abcdef',
      streaming: false
    });
    expect(result.current.loading).toBe(false);
  });

  it('buffers streamed guide deltas until speech playback starts', async () => {
    streamGuideAnswerMock.mockImplementationOnce(
      (_message: string, handlers: GuideChatStreamHandlers) => {
        window.setTimeout(() => handlers.onDelta('abcdef'), 0);
        window.setTimeout(() => {
          handlers.onResult({
            answer: 'abcdef',
            cards: [],
            source: 'local-fallback',
            speechTimeline: createSpeechTimeline('abcdef')
          });
          handlers.onDone?.();
        }, 20);

        return { close: vi.fn() };
      }
    );

    const { result } = renderHook(() => useGuideChat());

    act(() => {
      void result.current.ask('intro');
    });

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.messages[1]?.content).toBe('');
    expect(result.current.messages[1]?.streaming).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(120);
    });

    expect(result.current.messages[1]?.content).toBe('');

    await act(async () => {
      vi.advanceTimersByTime(20);
      await Promise.resolve();
    });

    act(() => {
      dispatchGuideSpeechPlayback({ text: 'abcdef', phase: 'start' });
    });

    expect(result.current.messages[1]?.content).toBe('a');
  });

  it('keeps buffering while speech playback is preparing', async () => {
    const { result } = renderHook(() => useGuideChat());

    act(() => {
      void result.current.ask('intro');
    });

    await act(async () => {
      vi.advanceTimersByTime(30);
      await Promise.resolve();
    });

    expect(result.current.latestAnswer).toBe('abcdef');

    act(() => {
      dispatchGuideSpeechPlayback({ text: 'abcdef', phase: 'preparing' });
      vi.advanceTimersByTime(900);
    });

    expect(result.current.messages[1]?.content).toBe('');

    act(() => {
      dispatchGuideSpeechDuration({ text: 'abcdef', durationMs: 600 });
      dispatchGuideSpeechPlayback({ text: 'abcdef', phase: 'start' });
    });

    expect(result.current.messages[1]?.content).toBe('a');
  });

  it('falls back to the speech-duration typewriter when the stream has no deltas', async () => {
    streamGuideAnswerMock.mockImplementationOnce(
      (_message: string, handlers: GuideChatStreamHandlers) => {
        window.setTimeout(() => {
          handlers.onResult({
            answer: 'abc',
            cards: [],
            source: 'local-fallback',
            speechTimeline: createSpeechTimeline('abc')
          });
          handlers.onDone?.();
        }, 0);

        return { close: vi.fn() };
      }
    );

    const { result } = renderHook(() => useGuideChat());

    act(() => {
      void result.current.ask('intro');
    });

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(result.current.latestAnswer).toBe('abc');
    expect(result.current.messages[1]?.content).toBe('');

    act(() => {
      dispatchGuideSpeechDuration({ text: 'abc', durationMs: 600 });
      dispatchGuideSpeechPlayback({ text: 'abc', phase: 'start' });
      vi.advanceTimersByTime(600);
    });

    await act(async () => {
      vi.advanceTimersByTime(estimateSpeechDurationMs('abc') + 1);
      await Promise.resolve();
    });

    expect(streamGuideAnswerMock).toHaveBeenCalledWith('intro', expect.any(Object));
    expect(result.current.messages[1]).toMatchObject({
      content: 'abc',
      streaming: false
    });
  });
});
