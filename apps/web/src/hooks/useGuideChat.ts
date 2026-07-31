import { useCallback, useEffect, useRef, useState } from 'react';
import {
  streamGuideAnswer,
  type GuideChatStreamController,
  type GuideChatStreamHandlers,
  type GuideConversationMessage
} from '../api/guideApi';
import {
  GUIDE_SPEECH_DURATION_EVENT,
  GUIDE_SPEECH_PLAYBACK_EVENT,
  isGuideSpeechDurationEvent,
  isGuideSpeechPlaybackEvent
} from '../lib/guideSpeechSync';
import {
  clearGuideChatHistory,
  loadGuideChatHistory,
  removeGuideChatHistory,
  saveGuideChatHistory
} from '../lib/guideChatHistory';
import type {
  ChatMessage,
  GuideAttachment,
  GuideChatSession,
  GuideSpeechTimeline,
  RouteCard
} from '../types/guide';

// 该 Hook 是聊天状态机：负责请求、流式增量、打字机、语音同步和历史持久化。

const TYPEWRITER_FRAME_MS = 48;
const PREVIEW_CHARACTER_MS = 145;
const PREVIEW_CHARACTER_LIMIT = 10;
const LONG_ANSWER_SYNC_THRESHOLD = 240;
const LONG_ANSWER_MAX_VISIBLE_PROGRESS = 0.94;
const SPEECH_START_FALLBACK_MS = 6_000;
const MIN_SPEECH_DURATION_MS = 900;
const HISTORY_SAVE_DELAY_MS = 250;
const IMAGE_ANALYSIS_STATUS = '正在识别画面并整理景点推荐，请稍候…';
const DOCUMENT_ANALYSIS_STATUS = '正在读取文档并提炼重点，请稍候…';

type ActiveTypewriter = {
  messageId: string;
  answer: string;
  characters: string[];
  visibleCount: number;
  phase: 'preview' | 'speech';
  previewStartedAt: number;
  speechStartedAt: number | null;
  speechStartVisibleCount: number;
  durationMs: number;
};

function getSpeechVisibleLimit(typewriter: ActiveTypewriter): number {
  // 长回答限制文字领先语音的距离，让嘴型、播报和屏幕内容保持接近。
  if (typewriter.characters.length < LONG_ANSWER_SYNC_THRESHOLD) {
    return typewriter.characters.length;
  }

  return Math.max(
    typewriter.speechStartVisibleCount,
    Math.min(
      typewriter.characters.length - 1,
      Math.floor(typewriter.characters.length * LONG_ANSWER_MAX_VISIBLE_PROGRESS)
    )
  );
}

function estimateSpeechDurationMs(text: string): number {
  return Math.max(MIN_SPEECH_DURATION_MS, Array.from(text).length * PREVIEW_CHARACTER_MS);
}

export function buildConversationHistory(messages: ChatMessage[]): GuideConversationMessage[] {
  // 发送给服务端的历史只包含有内容的最近消息，控制上下文长度。
  return messages
    .filter((message) => message.content.trim())
    .slice(-6)
    .map(({ role, content }) => ({ role, content }));
}

function buildSessionTitle(messages: ChatMessage[]) {
  const firstQuestion = messages.find((message) => message.role === 'user');
  const title = firstQuestion?.content.replace(/\s+/g, ' ').trim() || '附件分析';
  return Array.from(title).slice(0, 32).join('');
}

export function useGuideChat() {
  // 请求与动画会并行更新状态，关键值通过 ref 在异步回调间保持最新。
  const typingTimerRef = useRef<number | null>(null);
  const speechStartFallbackTimerRef = useRef<number | null>(null);
  const activeTypewriterRef = useRef<ActiveTypewriter | null>(null);
  const activeStreamRef = useRef<GuideChatStreamController | null>(null);
  const activeExternalSessionRef = useRef<string | null>(null);
  const completedExternalSessionsRef = useRef(new Set<string>());
  const activeSessionIdRef = useRef<string>(crypto.randomUUID());
  const sessionCreatedAtRef = useRef(new Date().toISOString());
  const suppressNextHistorySaveRef = useRef(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historySessions, setHistorySessions] = useState<GuideChatSession[]>(() =>
    loadGuideChatHistory()
  );
  const [activeSessionId, setActiveSessionId] = useState<string>(activeSessionIdRef.current);
  const [routeCards, setRouteCards] = useState<RouteCard[]>([]);
  const [latestAnswer, setLatestAnswer] = useState('');
  const [speechTimeline, setSpeechTimeline] = useState<GuideSpeechTimeline | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearTypingTimer = useCallback(() => {
    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  }, []);

  const clearSpeechStartFallbackTimer = useCallback(() => {
    if (speechStartFallbackTimerRef.current !== null) {
      window.clearTimeout(speechStartFallbackTimerRef.current);
      speechStartFallbackTimerRef.current = null;
    }
  }, []);

  const updateAssistantMessage = useCallback(
    (messageId: string, content: string, streaming: boolean) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId ? { ...message, content, streaming } : message
        )
      );
    },
    []
  );

  const updateAssistantKnowledge = useCallback(
    (messageId: string, response: { retrievedKnowledge?: ChatMessage['retrievedKnowledge'] }) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? { ...message, retrievedKnowledge: response.retrievedKnowledge ?? [] }
            : message
        )
      );
    },
    []
  );

  const finishTypewriter = useCallback(
    (typewriter: ActiveTypewriter) => {
      clearTypingTimer();
      clearSpeechStartFallbackTimer();
      activeTypewriterRef.current = null;
      updateAssistantMessage(typewriter.messageId, typewriter.answer, false);
    },
    [clearSpeechStartFallbackTimer, clearTypingTimer, updateAssistantMessage]
  );

  const renderTypewriterFrame = useCallback(() => {
    const typewriter = activeTypewriterRef.current;

    if (!typewriter || typewriter.characters.length === 0) {
      return;
    }

    let nextVisibleCount = typewriter.visibleCount;
    let nextFrameDelayMs = TYPEWRITER_FRAME_MS;
    let speechVisibleLimit = typewriter.characters.length;

    if (typewriter.phase === 'preview') {
      const elapsedMs = Math.max(0, Date.now() - typewriter.previewStartedAt);
      nextVisibleCount = Math.min(
        typewriter.characters.length,
        PREVIEW_CHARACTER_LIMIT,
        Math.max(1, Math.floor(elapsedMs / PREVIEW_CHARACTER_MS) + 1)
      );
    } else if (typewriter.speechStartedAt !== null) {
      speechVisibleLimit = getSpeechVisibleLimit(typewriter);
      const elapsedMs = Math.max(0, Date.now() - typewriter.speechStartedAt);
      const progress = Math.min(1, elapsedMs / Math.max(typewriter.durationMs, 1));
      nextFrameDelayMs = Math.max(
        1,
        Math.min(TYPEWRITER_FRAME_MS, typewriter.durationMs - elapsedMs)
      );
      const remainingCharacters = Math.max(
        0,
        typewriter.characters.length - typewriter.speechStartVisibleCount
      );
      nextVisibleCount = Math.min(
        speechVisibleLimit,
        Math.max(
          typewriter.visibleCount,
          typewriter.speechStartVisibleCount + Math.floor(progress * remainingCharacters)
        )
      );
    }

    if (nextVisibleCount > typewriter.visibleCount) {
      typewriter.visibleCount = nextVisibleCount;
      updateAssistantMessage(
        typewriter.messageId,
        typewriter.characters.slice(0, nextVisibleCount).join(''),
        true
      );
    }

    if (typewriter.phase === 'speech' && nextVisibleCount >= typewriter.characters.length) {
      finishTypewriter(typewriter);
      return;
    }

    const previewTarget = Math.min(typewriter.characters.length, PREVIEW_CHARACTER_LIMIT);
    const shouldContinue =
      typewriter.phase === 'speech'
        ? nextVisibleCount < speechVisibleLimit
        : nextVisibleCount < previewTarget;

    if (shouldContinue) {
      clearTypingTimer();
      typingTimerRef.current = window.setTimeout(renderTypewriterFrame, nextFrameDelayMs);
    }
  }, [clearTypingTimer, finishTypewriter, updateAssistantMessage]);

  const paceAssistantAnswer = useCallback(
    (messageId: string, answer: string, durationMs?: number) => {
      const characters = Array.from(answer);
      const activeTypewriter = activeTypewriterRef.current;

      if (activeTypewriter?.messageId === messageId) {
        activeTypewriter.answer = answer;
        activeTypewriter.characters = characters;
        if (durationMs) {
          activeTypewriter.durationMs = Math.max(TYPEWRITER_FRAME_MS, durationMs);
        }
      } else {
        clearTypingTimer();
        activeTypewriterRef.current = {
          messageId,
          answer,
          characters,
          visibleCount: 0,
          phase: 'preview',
          previewStartedAt: Date.now(),
          speechStartedAt: null,
          speechStartVisibleCount: 0,
          durationMs: Math.max(TYPEWRITER_FRAME_MS, durationMs ?? estimateSpeechDurationMs(answer))
        };
      }

      renderTypewriterFrame();
    },
    [clearTypingTimer, renderTypewriterFrame]
  );

  const startSpeechPacing = useCallback(
    (text: string) => {
      const typewriter = activeTypewriterRef.current;

      if (!typewriter || typewriter.answer !== text) {
        return;
      }

      clearSpeechStartFallbackTimer();
      typewriter.phase = 'speech';
      typewriter.speechStartedAt = Date.now();
      typewriter.speechStartVisibleCount = typewriter.visibleCount;
      clearTypingTimer();
      renderTypewriterFrame();
    },
    [clearSpeechStartFallbackTimer, clearTypingTimer, renderTypewriterFrame]
  );

  const syncSpeechDuration = useCallback(
    (text: string, durationMs: number) => {
      const typewriter = activeTypewriterRef.current;

      if (!typewriter || typewriter.answer !== text) {
        return;
      }

      typewriter.durationMs = Math.max(TYPEWRITER_FRAME_MS, durationMs);
      if (typewriter.phase === 'speech') {
        clearTypingTimer();
        renderTypewriterFrame();
      }
    },
    [clearTypingTimer, renderTypewriterFrame]
  );

  const scheduleSpeechStartFallback = useCallback(
    (text: string) => {
      clearSpeechStartFallbackTimer();
      speechStartFallbackTimerRef.current = window.setTimeout(() => {
        speechStartFallbackTimerRef.current = null;
        startSpeechPacing(text);
      }, SPEECH_START_FALLBACK_MS);
    },
    [clearSpeechStartFallbackTimer, startSpeechPacing]
  );

  const discardTypewriter = useCallback(() => {
    clearTypingTimer();
    clearSpeechStartFallbackTimer();
    activeTypewriterRef.current = null;
  }, [clearSpeechStartFallbackTimer, clearTypingTimer]);

  useEffect(() => {
    const handleSpeechDuration = (event: Event) => {
      if (isGuideSpeechDurationEvent(event)) {
        syncSpeechDuration(event.detail.text, event.detail.durationMs);
      }
    };
    const handleSpeechPlayback = (event: Event) => {
      if (!isGuideSpeechPlaybackEvent(event)) {
        return;
      }

      const typewriter = activeTypewriterRef.current;
      if (!typewriter || typewriter.answer !== event.detail.text) {
        return;
      }

      if (event.detail.phase === 'start') {
        startSpeechPacing(event.detail.text);
      } else if (event.detail.phase === 'end' || event.detail.phase === 'error') {
        finishTypewriter(typewriter);
      }
    };

    window.addEventListener(GUIDE_SPEECH_DURATION_EVENT, handleSpeechDuration);
    window.addEventListener(GUIDE_SPEECH_PLAYBACK_EVENT, handleSpeechPlayback);
    return () => {
      window.removeEventListener(GUIDE_SPEECH_DURATION_EVENT, handleSpeechDuration);
      window.removeEventListener(GUIDE_SPEECH_PLAYBACK_EVENT, handleSpeechPlayback);
      discardTypewriter();
      activeStreamRef.current?.close();
      activeStreamRef.current = null;
    };
  }, [discardTypewriter, finishTypewriter, startSpeechPacing, syncSpeechDuration]);

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    if (suppressNextHistorySaveRef.current) {
      suppressNextHistorySaveRef.current = false;
      return;
    }

    const sessionId = activeSessionId;
    const createdAt = sessionCreatedAtRef.current;
    const timer = window.setTimeout(() => {
      const updatedSessions = saveGuideChatHistory({
        id: sessionId,
        title: buildSessionTitle(messages),
        createdAt,
        updatedAt: new Date().toISOString(),
        messages
      });
      setHistorySessions(updatedSessions);
    }, HISTORY_SAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [activeSessionId, messages]);

  const ask = useCallback(
    async (message: string, attachment?: GuideAttachment | null) => {
      const trimmed = message.trim();

      if ((!trimmed && !attachment) || loading) {
        return;
      }

      const history = buildConversationHistory(messages);
      const assistantMessageId = crypto.randomUUID();
      const attachmentIsImage = Boolean(
        attachment &&
        (attachment.kind === 'image' || attachment.mimeType.toLowerCase().startsWith('image/'))
      );
      let streamedAnswer = '';
      let receivedResult = false;

      activeStreamRef.current?.close();
      const previousTypewriter = activeTypewriterRef.current;
      if (previousTypewriter) {
        finishTypewriter(previousTypewriter);
      }
      setLoading(true);
      setError(null);
      setLatestAnswer('');
      setSpeechTimeline(null);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: trimmed || (attachmentIsImage ? '请分析这张图片' : '请分析这个附件'),
          attachmentName: attachment?.name,
          attachmentKind: attachmentIsImage ? 'image' : attachment?.kind,
          attachmentPreviewUrl: attachmentIsImage ? attachment?.dataUrl : undefined,
          imagePreviewUrl: attachmentIsImage ? attachment?.dataUrl : undefined,
          imageName: attachmentIsImage ? attachment?.name : undefined
        },
        {
          id: assistantMessageId,
          role: 'assistant',
          content: attachment
            ? attachmentIsImage
              ? IMAGE_ANALYSIS_STATUS
              : DOCUMENT_ANALYSIS_STATUS
            : '',
          streaming: true
        }
      ]);

      try {
        await new Promise<void>((resolve, reject) => {
          const handlers: GuideChatStreamHandlers = {
            onDelta: (delta) => {
              streamedAnswer += delta;
              paceAssistantAnswer(assistantMessageId, streamedAnswer);
            },
            onSpeechTimeline: (timeline) => {
              setSpeechTimeline(timeline);
              syncSpeechDuration(timeline.text, timeline.durationMs);
            },
            onResult: (response) => {
              receivedResult = true;
              paceAssistantAnswer(
                assistantMessageId,
                response.answer,
                response.speechTimeline.durationMs
              );
              scheduleSpeechStartFallback(response.answer);
              setLatestAnswer(response.answer);
              setRouteCards(response.cards);
              setSpeechTimeline(response.speechTimeline);
              updateAssistantKnowledge(assistantMessageId, response);
              resolve();
            },
            onError: reject,
            onDone: () => {
              if (!receivedResult) {
                reject(new Error('Guide stream ended before the answer was ready.'));
              }
            }
          };

          activeStreamRef.current =
            history.length > 0
              ? streamGuideAnswer(trimmed, attachment, handlers, history)
              : streamGuideAnswer(trimmed, attachment, handlers);
        });
      } catch (caught) {
        discardTypewriter();
        setMessages((current) => current.filter((message) => message.id !== assistantMessageId));
        setError(caught instanceof Error ? caught.message : '数字导游暂时没有回答成功');
      } finally {
        activeStreamRef.current = null;
        setLoading(false);
      }
    },
    [
      loading,
      messages,
      discardTypewriter,
      finishTypewriter,
      paceAssistantAnswer,
      scheduleSpeechStartFallback,
      syncSpeechDuration,
      updateAssistantKnowledge,
      updateAssistantMessage
    ]
  );

  const beginExternalQuestion = useCallback(
    (sessionId: string, message: string): boolean => {
      const trimmed = message.trim();

      if (!trimmed || loading || activeExternalSessionRef.current) {
        return false;
      }

      activeStreamRef.current?.close();
      activeExternalSessionRef.current = sessionId;
      setLoading(true);
      setError(null);
      setLatestAnswer('');
      setSpeechTimeline(null);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: trimmed
        }
      ]);

      return true;
    },
    [loading]
  );

  const completeExternalQuestion = useCallback(
    (
      sessionId: string,
      response: {
        answer: string;
        cards: RouteCard[];
        speechTimeline: GuideSpeechTimeline;
        retrievedKnowledge?: ChatMessage['retrievedKnowledge'];
      }
    ) => {
      if (
        activeExternalSessionRef.current !== sessionId ||
        completedExternalSessionsRef.current.has(sessionId)
      ) {
        return;
      }

      completedExternalSessionsRef.current.add(sessionId);
      activeExternalSessionRef.current = null;
      const assistantMessageId = crypto.randomUUID();
      const previousTypewriter = activeTypewriterRef.current;
      if (previousTypewriter) {
        finishTypewriter(previousTypewriter);
      }
      setLatestAnswer(response.answer);
      setRouteCards(response.cards);
      setSpeechTimeline(response.speechTimeline);
      setMessages((current) => [
        ...current,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          streaming: true,
          retrievedKnowledge: response.retrievedKnowledge ?? []
        }
      ]);
      paceAssistantAnswer(assistantMessageId, response.answer, response.speechTimeline.durationMs);
      scheduleSpeechStartFallback(response.answer);
      setLoading(false);
    },
    [finishTypewriter, paceAssistantAnswer, scheduleSpeechStartFallback]
  );

  const failExternalQuestion = useCallback((sessionId: string, message: string) => {
    if (activeExternalSessionRef.current !== sessionId) {
      return;
    }

    activeExternalSessionRef.current = null;
    setError(message);
    setLoading(false);
  }, []);

  const resetConversation = useCallback(() => {
    activeStreamRef.current?.close();
    activeStreamRef.current = null;
    activeExternalSessionRef.current = null;
    discardTypewriter();
    const nextSessionId = crypto.randomUUID();
    activeSessionIdRef.current = nextSessionId;
    sessionCreatedAtRef.current = new Date().toISOString();
    setActiveSessionId(nextSessionId);
    setMessages([]);
    setRouteCards([]);
    setLatestAnswer('');
    setSpeechTimeline(null);
    setLoading(false);
    setError(null);
  }, [discardTypewriter]);

  const startNewConversation = useCallback(() => {
    resetConversation();
  }, [resetConversation]);

  const openConversation = useCallback(
    (sessionId: string) => {
      const session =
        historySessions.find((item) => item.id === sessionId) ??
        loadGuideChatHistory().find((item) => item.id === sessionId);
      if (!session) {
        return false;
      }

      activeStreamRef.current?.close();
      activeStreamRef.current = null;
      activeExternalSessionRef.current = null;
      discardTypewriter();
      suppressNextHistorySaveRef.current = true;
      activeSessionIdRef.current = session.id;
      sessionCreatedAtRef.current = session.createdAt;
      setActiveSessionId(session.id);
      setMessages(session.messages);
      setRouteCards([]);
      setLatestAnswer(
        [...session.messages].reverse().find((message) => message.role === 'assistant')?.content ??
          ''
      );
      setSpeechTimeline(null);
      setLoading(false);
      setError(null);
      return true;
    },
    [discardTypewriter, historySessions]
  );

  const deleteConversation = useCallback(
    (sessionId: string) => {
      setHistorySessions(removeGuideChatHistory(sessionId));
      if (activeSessionIdRef.current === sessionId) {
        resetConversation();
      }
    },
    [resetConversation]
  );

  const clearConversationHistory = useCallback(() => {
    clearGuideChatHistory();
    setHistorySessions([]);
    resetConversation();
  }, [resetConversation]);

  return {
    messages,
    historySessions,
    activeSessionId,
    routeCards,
    latestAnswer,
    speechTimeline,
    loading,
    error,
    ask,
    startNewConversation,
    openConversation,
    deleteConversation,
    clearConversationHistory,
    beginExternalQuestion,
    completeExternalQuestion,
    failExternalQuestion
  };
}
