import { useCallback, useEffect, useRef, useState } from 'react';
import { streamGuideAnswer, type GuideChatStreamController } from '../api/guideApi';
import {
  GUIDE_SPEECH_DURATION_EVENT,
  GUIDE_SPEECH_PLAYBACK_EVENT,
  isGuideSpeechDurationEvent,
  isGuideSpeechPlaybackEvent
} from '../lib/guideSpeechSync';
import type { ChatMessage, GuideSpeechTimeline, RouteCard } from '../types/guide';

const FALLBACK_CJK_MS = 145;
const FALLBACK_WHITESPACE_MS = 35;
const FALLBACK_LATIN_MS = 55;
const FALLBACK_COMMA_MS = 180;
const FALLBACK_SENTENCE_END_MS = 260;
const TYPEWRITER_FRAME_MS = 48;
const MIN_SPEECH_DURATION_MS = 900;
const SPEECH_START_FALLBACK_MS = 900;
const SPEECH_PREPARING_FALLBACK_MS = 30000;

type ActiveTypewriter = {
  messageId: string;
  answer: string;
  characters: string[];
  startedAt: number | null;
  durationMs: number;
  visibleCount: number;
  resolve: () => void;
  promise: Promise<void>;
};

function isCjkCharacter(character: string): boolean {
  return /[\u3400-\u9fff]/.test(character);
}

function isCommaLikePause(character: string): boolean {
  return /[,;:]/.test(character) || ['\uFF0C', '\u3001', '\uFF1B', '\uFF1A'].includes(character);
}

function isSentenceEndingPause(character: string): boolean {
  return /[.!?]/.test(character) || ['\u3002', '\uFF01', '\uFF1F'].includes(character);
}

export function getTypewriterDelayMs(character: string): number {
  if (/\s/.test(character)) {
    return FALLBACK_WHITESPACE_MS;
  }

  if (isSentenceEndingPause(character)) {
    return FALLBACK_SENTENCE_END_MS;
  }

  if (isCommaLikePause(character)) {
    return FALLBACK_COMMA_MS;
  }

  if (isCjkCharacter(character)) {
    return FALLBACK_CJK_MS;
  }

  return FALLBACK_LATIN_MS;
}

export function estimateSpeechDurationMs(answer: string): number {
  const characters = Array.from(answer);
  const estimatedMs = characters.reduce(
    (total, character) => total + getTypewriterDelayMs(character),
    0
  );

  return Math.max(MIN_SPEECH_DURATION_MS, estimatedMs);
}

export function estimateTypewriterIntervalMs(answer: string): number {
  const characters = Array.from(answer);

  if (characters.length === 0) {
    return FALLBACK_CJK_MS;
  }

  return Math.round(estimateSpeechDurationMs(answer) / characters.length);
}

export function useGuideChat() {
  const typingTimerRef = useRef<number | null>(null);
  const speechStartFallbackTimerRef = useRef<number | null>(null);
  const activeTypewriterRef = useRef<ActiveTypewriter | null>(null);
  const activeStreamRef = useRef<GuideChatStreamController | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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

  const finishTypewriter = useCallback(
    (typewriter: ActiveTypewriter) => {
      clearTypingTimer();
      activeTypewriterRef.current = null;
      updateAssistantMessage(typewriter.messageId, typewriter.answer, false);
      typewriter.resolve();
    },
    [clearTypingTimer, updateAssistantMessage]
  );

  const renderTypewriterFrame = useCallback(() => {
    const typewriter = activeTypewriterRef.current;

    if (!typewriter) {
      return;
    }

    const characterCount = typewriter.characters.length;

    if (typewriter.startedAt === null) {
      return;
    }

    if (characterCount === 0) {
      finishTypewriter(typewriter);
      return;
    }

    const elapsedMs = Math.max(0, Date.now() - typewriter.startedAt);
    const progress = Math.min(1, elapsedMs / Math.max(typewriter.durationMs, 1));
    const nextVisibleCount = Math.min(
      characterCount,
      Math.max(typewriter.visibleCount, Math.max(1, Math.floor(progress * characterCount)))
    );

    if (nextVisibleCount > typewriter.visibleCount) {
      typewriter.visibleCount = nextVisibleCount;
      updateAssistantMessage(
        typewriter.messageId,
        typewriter.characters.slice(0, nextVisibleCount).join(''),
        nextVisibleCount < characterCount
      );
    }

    if (nextVisibleCount >= characterCount || progress >= 1) {
      finishTypewriter(typewriter);
      return;
    }

    const remainingMs = Math.max(0, typewriter.durationMs - elapsedMs);
    typingTimerRef.current = window.setTimeout(
      renderTypewriterFrame,
      Math.min(TYPEWRITER_FRAME_MS, remainingMs)
    );
  }, [finishTypewriter, updateAssistantMessage]);

  const startTypewriter = useCallback(
    (text: string) => {
      const typewriter = activeTypewriterRef.current;

      if (!typewriter || typewriter.answer !== text) {
        return;
      }

      clearSpeechStartFallbackTimer();

      if (typewriter.startedAt === null) {
        typewriter.startedAt = Date.now();
      }

      clearTypingTimer();
      renderTypewriterFrame();
    },
    [clearSpeechStartFallbackTimer, clearTypingTimer, renderTypewriterFrame]
  );

  const syncTypewriterDuration = useCallback(
    (text: string, durationMs: number) => {
      const typewriter = activeTypewriterRef.current;

      if (!typewriter || typewriter.answer !== text) {
        return;
      }

      const visibleProgress =
        typewriter.characters.length > 0
          ? typewriter.visibleCount / typewriter.characters.length
          : 0;
      if (typewriter.startedAt !== null) {
        typewriter.startedAt = Date.now() - durationMs * visibleProgress;
      }
      typewriter.durationMs = Math.max(TYPEWRITER_FRAME_MS, durationMs);
      clearTypingTimer();
      renderTypewriterFrame();
    },
    [clearTypingTimer, renderTypewriterFrame]
  );

  const paceAssistantAnswer = useCallback(
    (messageId: string, answer: string): Promise<void> => {
      const typewriter = activeTypewriterRef.current;
      const characters = Array.from(answer);
      const durationMs = estimateSpeechDurationMs(answer);

      if (typewriter && typewriter.messageId === messageId) {
        typewriter.answer = answer;
        typewriter.characters = characters;
        typewriter.durationMs = Math.max(TYPEWRITER_FRAME_MS, durationMs);
        clearTypingTimer();
        renderTypewriterFrame();
        return typewriter.promise;
      }

      let resolveTypewriter!: () => void;
      const promise = new Promise<void>((resolve) => {
        resolveTypewriter = resolve;
      });

      activeTypewriterRef.current = {
        messageId,
        answer,
        characters,
        startedAt: null,
        durationMs,
        visibleCount: 0,
        resolve: resolveTypewriter,
        promise
      };

      renderTypewriterFrame();
      return promise;
    },
    [clearTypingTimer, renderTypewriterFrame]
  );

  const scheduleSpeechStartFallback = useCallback(
    (text: string, delayMs = SPEECH_START_FALLBACK_MS) => {
      clearSpeechStartFallbackTimer();
      speechStartFallbackTimerRef.current = window.setTimeout(() => {
        speechStartFallbackTimerRef.current = null;
        startTypewriter(text);
      }, delayMs);
    },
    [clearSpeechStartFallbackTimer, startTypewriter]
  );

  useEffect(() => {
    const handleSpeechDuration = (event: Event) => {
      if (isGuideSpeechDurationEvent(event)) {
        syncTypewriterDuration(event.detail.text, event.detail.durationMs);
      }
    };
    const handleSpeechPlayback = (event: Event) => {
      if (!isGuideSpeechPlaybackEvent(event)) {
        return;
      }

      if (event.detail.phase === 'preparing') {
        scheduleSpeechStartFallback(event.detail.text, SPEECH_PREPARING_FALLBACK_MS);
        return;
      }

      if (event.detail.phase === 'start') {
        startTypewriter(event.detail.text);
        return;
      }

      if (event.detail.phase === 'error') {
        startTypewriter(event.detail.text);
      }
    };

    window.addEventListener(GUIDE_SPEECH_DURATION_EVENT, handleSpeechDuration);
    window.addEventListener(GUIDE_SPEECH_PLAYBACK_EVENT, handleSpeechPlayback);
    return () => {
      window.removeEventListener(GUIDE_SPEECH_DURATION_EVENT, handleSpeechDuration);
      window.removeEventListener(GUIDE_SPEECH_PLAYBACK_EVENT, handleSpeechPlayback);
      clearTypingTimer();
      clearSpeechStartFallbackTimer();
      activeStreamRef.current?.close();
      activeStreamRef.current = null;
    };
  }, [
    clearSpeechStartFallbackTimer,
    clearTypingTimer,
    scheduleSpeechStartFallback,
    startTypewriter,
    syncTypewriterDuration
  ]);

  const typeAssistantAnswer = useCallback(
    (messageId: string, answer: string) => {
      clearTypingTimer();
      activeTypewriterRef.current = null;
      return paceAssistantAnswer(messageId, answer);
    },
    [clearTypingTimer, paceAssistantAnswer]
  );

  const ask = useCallback(
    async (message: string) => {
      const trimmed = message.trim();

      if (!trimmed || loading) {
        return;
      }

      const assistantMessageId = crypto.randomUUID();
      let streamedAnswer = '';
      let receivedStreamDelta = false;
      let receivedResult = false;

      activeStreamRef.current?.close();
      clearTypingTimer();
      clearSpeechStartFallbackTimer();
      activeTypewriterRef.current = null;
      setLoading(true);
      setError(null);
      setLatestAnswer('');
      setSpeechTimeline(null);
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'user', content: trimmed },
        { id: assistantMessageId, role: 'assistant', content: '', streaming: true }
      ]);

      try {
        await new Promise<void>((resolve, reject) => {
          activeStreamRef.current = streamGuideAnswer(trimmed, {
            onDelta: (delta) => {
              streamedAnswer += delta;
              receivedStreamDelta = true;
              void paceAssistantAnswer(assistantMessageId, streamedAnswer);
            },
            onSpeechTimeline: setSpeechTimeline,
            onResult: (response) => {
              receivedResult = true;
              setLatestAnswer(response.answer);
              setRouteCards(response.cards);
              setSpeechTimeline(response.speechTimeline);

              if (receivedStreamDelta) {
                scheduleSpeechStartFallback(response.answer);
                void paceAssistantAnswer(assistantMessageId, response.answer).then(resolve, reject);
                return;
              }

              scheduleSpeechStartFallback(response.answer);
              void typeAssistantAnswer(assistantMessageId, response.answer).then(resolve, reject);
            },
            onError: reject,
            onDone: () => {
              if (!receivedResult) {
                reject(new Error('Guide stream ended before the answer was ready.'));
              }
            }
          });
        });
      } catch (caught) {
        activeTypewriterRef.current = null;
        setMessages((current) => current.filter((message) => message.id !== assistantMessageId));
        setError(caught instanceof Error ? caught.message : '数字导游暂时没有回答成功');
      } finally {
        activeStreamRef.current = null;
        setLoading(false);
      }
    },
    [
      clearSpeechStartFallbackTimer,
      clearTypingTimer,
      loading,
      paceAssistantAnswer,
      scheduleSpeechStartFallback,
      typeAssistantAnswer
    ]
  );

  return { messages, routeCards, latestAnswer, speechTimeline, loading, error, ask };
}
