import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { splitSpeechText, useSpeechSynthesis } from '../src/hooks/useSpeechSynthesis';
import {
  GUIDE_SPEECH_DURATION_EVENT,
  GUIDE_SPEECH_PLAYBACK_EVENT
} from '../src/lib/guideSpeechSync';

const WELCOME_TEXT = '\u6b22\u8fce\u6765\u5230\u4e91\u5c9a\u53e4\u9547';
const LONG_TEXT = 'First sentence. Second sentence.';
const PARTIAL_FAILURE_TEXT = 'First sentence. Broken sentence. Third sentence.';
const FIRST_FAILURE_TEXT = 'Broken sentence. Second sentence. Third sentence.';
const MANY_CHUNKS_TEXT = 'One. Two. Three. Four. Five.';

describe('useSpeechSynthesis', () => {
  it('splits long speech into short phrase chunks', () => {
    expect(splitSpeechText('Opening route: bridge, tea house, stage.')).toEqual([
      'Opening route:',
      'bridge,',
      'tea house,',
      'stage.'
    ]);
  });

  function installAudioContext(durations = [1.2]) {
    function createSource() {
      return {
        buffer: null as AudioBuffer | null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null
      };
    }

    const source = createSource();
    const sources = [source];
    let decodeCallIndex = 0;
    let createSourceCallIndex = 0;
    const audioContext = {
      destination: {},
      state: 'running',
      decodeAudioData: vi.fn(async () => {
        const duration = durations[Math.min(decodeCallIndex, durations.length - 1)] ?? 1;
        decodeCallIndex += 1;
        return { duration } as AudioBuffer;
      }),
      createBufferSource: vi.fn(() => {
        if (createSourceCallIndex === 0) {
          createSourceCallIndex += 1;
          return source;
        }

        createSourceCallIndex += 1;
        const nextSource = createSource();
        sources.push(nextSource);
        return nextSource;
      }),
      resume: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined)
    };
    const AudioContextMock = vi.fn(() => audioContext);

    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: AudioContextMock
    });

    return { audioContext, source, sources, AudioContextMock };
  }

  beforeEach(() => {
    const voices = [
      {
        name: 'English Voice',
        lang: 'en-US',
        localService: true
      },
      {
        name: 'Microsoft Xiaoxiao Online (Natural) - Chinese (Simplified, China)',
        lang: 'zh-CN',
        localService: true
      }
    ] as SpeechSynthesisVoice[];

    class TestUtterance {
      lang = '';
      rate = 1;
      pitch = 1;
      voice: SpeechSynthesisVoice | null = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public readonly text: string) {}
    }

    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: TestUtterance
    });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: vi.fn(() => voices),
        cancel: vi.fn(),
        speak: vi.fn((utterance: TestUtterance) => {
          utterance.onstart?.();
          utterance.onend?.();
        })
      }
    });
    vi.stubGlobal('fetch', vi.fn());
  });

  it('plays long server speech in sentence chunks', async () => {
    const { source, sources } = installAudioContext([0.8, 1.1]);
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn(async () => new ArrayBuffer(8))
    } as unknown as Response);
    const { result } = renderHook(() => useSpeechSynthesis());
    const playbackEvents: Array<{ text: string; phase: string }> = [];
    const durationEvents: Array<{ text: string; durationMs: number }> = [];
    window.addEventListener(GUIDE_SPEECH_PLAYBACK_EVENT, (event) => {
      playbackEvents.push((event as CustomEvent<{ text: string; phase: string }>).detail);
    });
    window.addEventListener(GUIDE_SPEECH_DURATION_EVENT, (event) => {
      durationEvents.push((event as CustomEvent<{ text: string; durationMs: number }>).detail);
    });

    await act(async () => {
      await result.current.speak(LONG_TEXT);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      text: 'First sentence.'
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      text: 'Second sentence.'
    });
    expect(durationEvents).toEqual([{ text: LONG_TEXT, durationMs: 1900 }]);
    expect(source.start).toHaveBeenCalledTimes(1);
    expect(sources).toHaveLength(1);

    act(() => {
      source.onended?.();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(sources).toHaveLength(2);
    expect(sources[1].start).toHaveBeenCalledTimes(1);

    act(() => {
      sources[1].onended?.();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(playbackEvents).toEqual([
      { text: LONG_TEXT, phase: 'preparing' },
      { text: LONG_TEXT, phase: 'start' },
      { text: LONG_TEXT, phase: 'end' }
    ]);
  });

  it('skips failed middle server speech chunks and continues playback', async () => {
    const { source, sources } = installAudioContext([0.8, 1.1]);
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { text: string };

      if (body.text === 'Broken sentence.') {
        return {
          ok: false,
          json: vi.fn(async () => ({ message: 'chunk failed' }))
        } as unknown as Response;
      }

      return {
        ok: true,
        arrayBuffer: vi.fn(async () => new ArrayBuffer(8))
      } as unknown as Response;
    });
    const { result } = renderHook(() => useSpeechSynthesis());
    const playbackEvents: Array<{ text: string; phase: string }> = [];
    const durationEvents: Array<{ text: string; durationMs: number }> = [];
    window.addEventListener(GUIDE_SPEECH_PLAYBACK_EVENT, (event) => {
      playbackEvents.push((event as CustomEvent<{ text: string; phase: string }>).detail);
    });
    window.addEventListener(GUIDE_SPEECH_DURATION_EVENT, (event) => {
      durationEvents.push((event as CustomEvent<{ text: string; durationMs: number }>).detail);
    });

    await act(async () => {
      await result.current.speak(PARTIAL_FAILURE_TEXT);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(durationEvents).toEqual([]);
    expect(source.start).toHaveBeenCalledTimes(1);

    act(() => {
      source.onended?.();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sources).toHaveLength(2);
    expect(sources[1].start).toHaveBeenCalledTimes(1);

    act(() => {
      sources[1].onended?.();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(durationEvents).toEqual([{ text: PARTIAL_FAILURE_TEXT, durationMs: 1900 }]);
    expect(playbackEvents).toEqual([
      { text: PARTIAL_FAILURE_TEXT, phase: 'preparing' },
      { text: PARTIAL_FAILURE_TEXT, phase: 'start' },
      { text: PARTIAL_FAILURE_TEXT, phase: 'end' }
    ]);
  });

  it('starts from the first successful server speech chunk when the first chunk fails', async () => {
    const { source, sources } = installAudioContext([0.8, 1.1]);
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { text: string };

      if (body.text === 'Broken sentence.') {
        return {
          ok: false,
          json: vi.fn(async () => ({ message: 'first chunk failed' }))
        } as unknown as Response;
      }

      return {
        ok: true,
        arrayBuffer: vi.fn(async () => new ArrayBuffer(8))
      } as unknown as Response;
    });
    const { result } = renderHook(() => useSpeechSynthesis());
    const playbackEvents: Array<{ text: string; phase: string }> = [];
    const durationEvents: Array<{ text: string; durationMs: number }> = [];
    window.addEventListener(GUIDE_SPEECH_PLAYBACK_EVENT, (event) => {
      playbackEvents.push((event as CustomEvent<{ text: string; phase: string }>).detail);
    });
    window.addEventListener(GUIDE_SPEECH_DURATION_EVENT, (event) => {
      durationEvents.push((event as CustomEvent<{ text: string; durationMs: number }>).detail);
    });

    await act(async () => {
      await result.current.speak(FIRST_FAILURE_TEXT);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
    expect(durationEvents).toEqual([]);
    expect(source.start).toHaveBeenCalledTimes(1);

    act(() => {
      source.onended?.();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sources).toHaveLength(2);
    expect(sources[1].start).toHaveBeenCalledTimes(1);

    act(() => {
      sources[1].onended?.();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(durationEvents).toEqual([{ text: FIRST_FAILURE_TEXT, durationMs: 1900 }]);
    expect(playbackEvents).toEqual([
      { text: FIRST_FAILURE_TEXT, phase: 'preparing' },
      { text: FIRST_FAILURE_TEXT, phase: 'start' },
      { text: FIRST_FAILURE_TEXT, phase: 'end' }
    ]);
  });

  it('prefetches server speech chunks with a small request window', async () => {
    const { source, sources } = installAudioContext([0.5, 0.5, 0.5, 0.5, 0.5]);
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn(async () => new ArrayBuffer(8))
    } as unknown as Response);
    const { result } = renderHook(() => useSpeechSynthesis());
    const durationEvents: Array<{ text: string; durationMs: number }> = [];
    window.addEventListener(GUIDE_SPEECH_DURATION_EVENT, (event) => {
      durationEvents.push((event as CustomEvent<{ text: string; durationMs: number }>).detail);
    });

    await act(async () => {
      await result.current.speak(MANY_CHUNKS_TEXT);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ text: 'One.' });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ text: 'Two.' });
    expect(source.start).toHaveBeenCalledTimes(1);
    expect(durationEvents).toEqual([{ text: MANY_CHUNKS_TEXT, durationMs: 3000 }]);

    act(() => {
      source.onended?.();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toEqual({ text: 'Three.' });
    expect(sources).toHaveLength(2);
    expect(sources[1].start).toHaveBeenCalledTimes(1);
  });

  it('speaks server synthesized audio with WebAudio and publishes decoded duration', async () => {
    const { source } = installAudioContext();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn(async () => new ArrayBuffer(8))
    } as unknown as Response);
    const { result } = renderHook(() => useSpeechSynthesis());
    const playbackEvents: Array<{ text: string; phase: string }> = [];
    const durationEvents: Array<{ text: string; durationMs: number }> = [];
    window.addEventListener(GUIDE_SPEECH_PLAYBACK_EVENT, (event) => {
      playbackEvents.push((event as CustomEvent<{ text: string; phase: string }>).detail);
    });
    window.addEventListener(GUIDE_SPEECH_DURATION_EVENT, (event) => {
      durationEvents.push((event as CustomEvent<{ text: string; durationMs: number }>).detail);
    });

    await act(async () => {
      await result.current.speak(WELCOME_TEXT);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/speech/synthesize', expect.any(Object));
    expect(source.start).toHaveBeenCalledTimes(1);
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
    expect(durationEvents).toEqual([{ text: WELCOME_TEXT, durationMs: 1200 }]);
    expect(playbackEvents).toEqual([
      { text: WELCOME_TEXT, phase: 'preparing' },
      { text: WELCOME_TEXT, phase: 'start' }
    ]);

    act(() => {
      source.onended?.();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(playbackEvents).toEqual([
      { text: WELCOME_TEXT, phase: 'preparing' },
      { text: WELCOME_TEXT, phase: 'start' },
      { text: WELCOME_TEXT, phase: 'end' }
    ]);
  });

  it('falls back to browser speech synthesis when server audio is unavailable', async () => {
    installAudioContext();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: false,
      json: vi.fn(async () => ({ message: 'TTS not configured' }))
    } as unknown as Response);
    const { result } = renderHook(() => useSpeechSynthesis());
    const playbackEvents: Array<{ text: string; phase: string }> = [];
    window.addEventListener(GUIDE_SPEECH_PLAYBACK_EVENT, (event) => {
      playbackEvents.push((event as CustomEvent<{ text: string; phase: string }>).detail);
    });

    await act(async () => {
      await result.current.speak(WELCOME_TEXT);
    });

    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    expect(
      (window.speechSynthesis.speak as ReturnType<typeof vi.fn>).mock.calls[0][0].voice?.lang
    ).toBe('zh-CN');
    expect(playbackEvents).toEqual([
      { text: WELCOME_TEXT, phase: 'preparing' },
      { text: WELCOME_TEXT, phase: 'start' },
      { text: WELCOME_TEXT, phase: 'end' }
    ]);
  });

  it('waits for the browser utterance start event before advancing captions', async () => {
    installAudioContext();
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: vi.fn(async () => ({ message: 'TTS not configured' }))
    } as unknown as Response);
    let utterance: SpeechSynthesisUtterance | null = null;
    vi.mocked(window.speechSynthesis.speak).mockImplementationOnce((nextUtterance) => {
      utterance = nextUtterance;
    });
    const { result } = renderHook(() => useSpeechSynthesis());
    const playbackEvents: Array<{ text: string; phase: string }> = [];
    window.addEventListener(GUIDE_SPEECH_PLAYBACK_EVENT, (event) => {
      playbackEvents.push((event as CustomEvent<{ text: string; phase: string }>).detail);
    });

    await act(async () => {
      await result.current.speak(WELCOME_TEXT);
    });

    expect(playbackEvents).toEqual([{ text: WELCOME_TEXT, phase: 'preparing' }]);

    act(() => {
      utterance?.onstart?.(new Event('start') as SpeechSynthesisEvent);
    });
    expect(playbackEvents).toEqual([
      { text: WELCOME_TEXT, phase: 'preparing' },
      { text: WELCOME_TEXT, phase: 'start' }
    ]);

    act(() => {
      utterance?.onend?.(new Event('end') as SpeechSynthesisEvent);
    });
    expect(playbackEvents).toEqual([
      { text: WELCOME_TEXT, phase: 'preparing' },
      { text: WELCOME_TEXT, phase: 'start' },
      { text: WELCOME_TEXT, phase: 'end' }
    ]);
  });

  it('stops active speech when the document is hidden', async () => {
    const { source } = installAudioContext();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn(async () => new ArrayBuffer(8))
    } as unknown as Response);
    const { result } = renderHook(() => useSpeechSynthesis());
    const playbackEvents: Array<{ text: string; phase: string }> = [];
    window.addEventListener(GUIDE_SPEECH_PLAYBACK_EVENT, (event) => {
      playbackEvents.push((event as CustomEvent<{ text: string; phase: string }>).detail);
    });

    await act(async () => {
      await result.current.speak(WELCOME_TEXT);
    });

    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(source.stop).toHaveBeenCalledTimes(1);
    expect(result.current.speaking).toBe(false);
    expect(playbackEvents.at(-1)).toEqual({ text: WELCOME_TEXT, phase: 'end' });

    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  });
});
