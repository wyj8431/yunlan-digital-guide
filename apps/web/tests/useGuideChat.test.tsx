import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildConversationHistory, useGuideChat } from '../src/hooks/useGuideChat';
import type { GuideChatStreamHandlers } from '../src/api/guideApi';
import {
  dispatchGuideSpeechDuration,
  dispatchGuideSpeechPlayback
} from '../src/lib/guideSpeechSync';
import type { GuideSpeechTimeline } from '../src/types/guide';
import { saveGuideChatHistory } from '../src/lib/guideChatHistory';

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
    localStorage.clear();
    streamGuideAnswerMock.mockImplementation(
      (_message: string, _image: unknown, handlers: GuideChatStreamHandlers) => {
        window.setTimeout(() => handlers.onDelta('abc'), 0);
        window.setTimeout(() => {
          handlers.onResult({
            answer: 'abcdef',
            cards: [],
            source: 'local-fallback',
            speechTimeline: createSpeechTimeline('abcdef'),
            retrievedKnowledge: []
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

  it('shows the first character quickly and paces the rest with speech playback', async () => {
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

    expect(result.current.messages[1]?.content).toBe('a');
    expect(result.current.messages[1]?.streaming).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(20);
      await Promise.resolve();
    });

    expect(result.current.messages[1]?.content).not.toBe('abcdef');
    expect(result.current.latestAnswer).toBe('abcdef');
    expect(result.current.speechTimeline?.text).toBe('abcdef');
    expect(result.current.loading).toBe(false);

    act(() => {
      dispatchGuideSpeechDuration({ text: 'abcdef', durationMs: 1_200 });
      dispatchGuideSpeechPlayback({ text: 'abcdef', phase: 'start' });
      vi.advanceTimersByTime(600);
    });

    expect(result.current.messages[1]?.content.length).toBeGreaterThan(1);
    expect(result.current.messages[1]?.content.length).toBeLessThan(6);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.messages[1]).toMatchObject({ content: 'abcdef', streaming: false });
  });

  it('buffers fast stream deltas instead of rendering the whole answer at network speed', async () => {
    streamGuideAnswerMock.mockImplementationOnce(
      (_message: string, _image: unknown, handlers: GuideChatStreamHandlers) => {
        window.setTimeout(() => handlers.onDelta('abc'), 0);
        window.setTimeout(() => handlers.onDelta('def'), 120);
        window.setTimeout(() => {
          handlers.onResult({
            answer: 'abcdef',
            cards: [],
            source: 'local-fallback',
            speechTimeline: createSpeechTimeline('abcdef'),
            retrievedKnowledge: []
          });
          handlers.onDone?.();
        }, 140);

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

    expect(result.current.messages[1]?.content).toBe('a');
    expect(result.current.messages[1]?.streaming).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(120);
    });

    expect(result.current.messages[1]?.content).not.toBe('abcdef');
    expect(result.current.messages[1]?.streaming).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(20);
      await Promise.resolve();
    });

    expect(result.current.messages[1]?.content).not.toBe('abcdef');

    act(() => {
      dispatchGuideSpeechPlayback({ text: 'abcdef', phase: 'start' });
      vi.advanceTimersByTime(450);
    });

    expect(result.current.messages[1]?.content.length).toBeLessThan(6);

    act(() => {
      dispatchGuideSpeechPlayback({ text: 'abcdef', phase: 'end' });
    });

    expect(result.current.messages[1]).toMatchObject({ content: 'abcdef', streaming: false });
  });

  it('keeps a long answer incomplete until avatar playback actually ends', async () => {
    const longAnswer = '旅游路线建议。'.repeat(160);
    streamGuideAnswerMock.mockImplementationOnce(
      (_message: string, _image: unknown, handlers: GuideChatStreamHandlers) => {
        window.setTimeout(() => {
          handlers.onResult({
            answer: longAnswer,
            cards: [],
            source: 'local-fallback',
            speechTimeline: createSpeechTimeline(longAnswer),
            retrievedKnowledge: []
          });
          handlers.onDone?.();
        }, 0);

        return { close: vi.fn() };
      }
    );

    const { result } = renderHook(() => useGuideChat());

    act(() => {
      void result.current.ask('分析长文档');
    });

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });

    act(() => {
      dispatchGuideSpeechDuration({ text: longAnswer, durationMs: 2_000 });
      dispatchGuideSpeechPlayback({ text: longAnswer, phase: 'start' });
      vi.advanceTimersByTime(2_000);
    });

    expect(result.current.messages[1]?.content.length).toBeLessThan(longAnswer.length);
    expect(result.current.messages[1]?.streaming).toBe(true);

    act(() => {
      dispatchGuideSpeechPlayback({ text: longAnswer, phase: 'end' });
    });

    expect(result.current.messages[1]).toMatchObject({
      content: longAnswer,
      streaming: false
    });
  });

  it('paces a completed result even when the stream has no deltas', async () => {
    streamGuideAnswerMock.mockImplementationOnce(
      (_message: string, _image: unknown, handlers: GuideChatStreamHandlers) => {
        window.setTimeout(() => {
          handlers.onResult({
            answer: 'abc',
            cards: [],
            source: 'local-fallback',
            speechTimeline: createSpeechTimeline('abc'),
            retrievedKnowledge: []
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
    expect(streamGuideAnswerMock).toHaveBeenCalledWith('intro', undefined, expect.any(Object));
    expect(result.current.messages[1]).toMatchObject({ content: 'a', streaming: true });

    act(() => {
      dispatchGuideSpeechPlayback({ text: 'abc', phase: 'start' });
      vi.advanceTimersByTime(900);
    });

    expect(result.current.messages[1]).toMatchObject({ content: 'abc', streaming: false });
    expect(result.current.loading).toBe(false);
  });

  it('sends image attachments with the guide question', () => {
    const { result } = renderHook(() => useGuideChat());
    const image = {
      name: 'bridge.png',
      mimeType: 'image/png',
      kind: 'image' as const,
      dataUrl: 'data:image/png;base64,aaaa'
    };

    act(() => {
      void result.current.ask('分析这张图', image);
    });

    expect(result.current.messages[1]).toMatchObject({
      role: 'assistant',
      content: '正在识别画面并整理景点推荐，请稍候…',
      streaming: true
    });

    expect(result.current.messages[0]).toMatchObject({
      role: 'user',
      content: '分析这张图',
      imagePreviewUrl: image.dataUrl,
      imageName: 'bridge.png'
    });
    expect(streamGuideAnswerMock).toHaveBeenCalledWith('分析这张图', image, expect.any(Object));
  });

  it('stores uploaded document metadata without treating it as an image preview', () => {
    const { result } = renderHook(() => useGuideChat());
    const attachment = {
      name: 'route.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      kind: 'spreadsheet' as const,
      dataUrl: 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,aaaa'
    };

    act(() => {
      void result.current.ask('分析预算表', attachment);
    });

    expect(result.current.messages[0]).toMatchObject({
      role: 'user',
      content: '分析预算表',
      attachmentName: 'route.xlsx',
      attachmentKind: 'spreadsheet'
    });
    expect(result.current.messages[0]?.imagePreviewUrl).toBeUndefined();
    expect(result.current.messages[1]).toMatchObject({
      role: 'assistant',
      content: '正在读取文档并提炼重点，请稍候…',
      streaming: true
    });
    expect(streamGuideAnswerMock).toHaveBeenCalledWith(
      '分析预算表',
      attachment,
      expect.any(Object)
    );
  });

  it('attaches retrieved knowledge sources to the assistant message', async () => {
    streamGuideAnswerMock.mockImplementationOnce(
      (_message: string, _image: unknown, handlers: GuideChatStreamHandlers) => {
        window.setTimeout(() => {
          handlers.onResult({
            answer: '上海迪士尼亲子游详细攻略',
            cards: [],
            source: 'llm',
            speechTimeline: createSpeechTimeline('上海迪士尼亲子游详细攻略'),
            retrievedKnowledge: [
              {
                id: 'destination:上海迪士尼度假区',
                title: '上海迪士尼度假区',
                source: 'destination-knowledge',
                content: '飞跃地平线',
                keywords: ['上海迪士尼度假区'],
                score: 100
              }
            ]
          });
          handlers.onDone?.();
        }, 0);

        return { close: vi.fn() };
      }
    );

    const { result } = renderHook(() => useGuideChat());

    act(() => {
      void result.current.ask('上海迪士尼亲子游怎么玩？');
    });

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(result.current.messages[1]?.retrievedKnowledge?.[0]).toMatchObject({
      title: '上海迪士尼度假区',
      source: 'destination-knowledge'
    });
  });

  it('keeps only recent user and assistant messages for follow-up questions', () => {
    const history = buildConversationHistory([
      { id: '1', role: 'user', content: '旧问题 1' },
      { id: '2', role: 'assistant', content: '旧回答 1' },
      { id: '3', role: 'user', content: '旧问题 2' },
      { id: '4', role: 'assistant', content: '旧回答 2' },
      { id: '5', role: 'user', content: '旧问题 3' },
      { id: '6', role: 'assistant', content: '旧回答 3' },
      { id: '7', role: 'user', content: '当前问题' }
    ]);

    expect(history).toEqual([
      { role: 'assistant', content: '旧回答 1' },
      { role: 'user', content: '旧问题 2' },
      { role: 'assistant', content: '旧回答 2' },
      { role: 'user', content: '旧问题 3' },
      { role: 'assistant', content: '旧回答 3' },
      { role: 'user', content: '当前问题' }
    ]);
  });

  it('automatically saves a completed conversation to browser history', async () => {
    const { result } = renderHook(() => useGuideChat());

    act(() => {
      void result.current.ask('西湖一日游怎么安排？');
    });

    await act(async () => {
      vi.advanceTimersByTime(25);
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(result.current.historySessions[0]).toMatchObject({
      id: result.current.activeSessionId,
      title: '西湖一日游怎么安排？'
    });
    expect(result.current.historySessions[0]?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: '西湖一日游怎么安排？' }),
        expect.objectContaining({ role: 'assistant' })
      ])
    );
  });

  it('restores a saved conversation and starts a separate new conversation', () => {
    saveGuideChatHistory({
      id: 'saved-session',
      title: '乌镇夜游',
      createdAt: '2026-07-27T10:00:00.000Z',
      updatedAt: '2026-07-27T10:05:00.000Z',
      messages: [
        { id: 'saved-user', role: 'user', content: '乌镇夜游怎么走？' },
        { id: 'saved-answer', role: 'assistant', content: '从西栅入口开始。' }
      ]
    });
    const { result } = renderHook(() => useGuideChat());

    act(() => {
      result.current.openConversation('saved-session');
    });

    expect(result.current.activeSessionId).toBe('saved-session');
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.latestAnswer).toBe('从西栅入口开始。');

    act(() => {
      result.current.startNewConversation();
    });

    expect(result.current.activeSessionId).not.toBe('saved-session');
    expect(result.current.messages).toEqual([]);
    expect(result.current.historySessions).toHaveLength(1);
  });

  it('deletes the active saved conversation and resets the chat', () => {
    saveGuideChatHistory({
      id: 'saved-session',
      title: '旧对话',
      createdAt: '2026-07-27T10:00:00.000Z',
      updatedAt: '2026-07-27T10:05:00.000Z',
      messages: [{ id: 'saved-user', role: 'user', content: '旧问题' }]
    });
    const { result } = renderHook(() => useGuideChat());

    act(() => {
      result.current.openConversation('saved-session');
      result.current.deleteConversation('saved-session');
    });

    expect(result.current.historySessions).toEqual([]);
    expect(result.current.messages).toEqual([]);
    expect(result.current.activeSessionId).not.toBe('saved-session');
  });
});
