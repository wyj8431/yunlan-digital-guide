import { useCallback, useEffect, useRef, useState } from 'react';
import { synthesizeSpeechAudio } from '../api/speechApi';
import { dispatchGuideSpeechDuration, dispatchGuideSpeechPlayback } from '../lib/guideSpeechSync';

type WindowWithWebkitAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

type ActiveAudioPlayback = {
  source: AudioBufferSourceNode;
  text: string;
  finish: () => void;
};

type DecodedSpeechChunkResult = { ok: true; audio: AudioBuffer } | { ok: false; error: unknown };

const MAX_SPEECH_CHUNK_CHARS = 24;
const SPEECH_CHUNK_PREFETCH_WINDOW = 2;
const MIN_PROJECTED_DURATION_CHUNKS = 4;

function scoreVoice(voice: SpeechSynthesisVoice): number {
  const lang = voice.lang.toLowerCase();
  let score = 0;

  if (lang.startsWith('zh')) {
    score += 100;
  }

  if (lang === 'zh-cn') {
    score += 20;
  }

  if (/female|xiao|huihui|yating|xiaoxiao|zhiyu|zhizhe/i.test(voice.name)) {
    score += 10;
  }

  if (voice.localService) {
    score += 5;
  }

  return score;
}

function pickPreferredVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    return null;
  }

  return [...voices].sort((first, second) => scoreVoice(second) - scoreVoice(first))[0] ?? null;
}

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext ?? null;
}

function splitLongSpeechSegment(segment: string): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < segment.length; index += MAX_SPEECH_CHUNK_CHARS) {
    const chunk = segment.slice(index, index + MAX_SPEECH_CHUNK_CHARS).trim();
    if (chunk) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

export function splitSpeechText(text: string): string[] {
  const normalizedText = text.trim();

  if (!normalizedText) {
    return [];
  }

  const sentenceMatches = normalizedText.match(
    /[^,;:.!?\u3001\u3002\uff0c\uff01\uff1a\uff1b\uff1f]+[,;:.!?\u3001\u3002\uff0c\uff01\uff1a\uff1b\uff1f]?/g
  ) ?? [normalizedText];
  const chunks: string[] = [];

  for (const match of sentenceMatches) {
    const segment = match.trim();
    if (!segment) {
      continue;
    }

    if (segment.length <= MAX_SPEECH_CHUNK_CHARS) {
      chunks.push(segment);
      continue;
    }

    chunks.push(...splitLongSpeechSegment(segment));
  }

  return chunks.length > 0 ? chunks : [normalizedText];
}

export function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeAudioRef = useRef<ActiveAudioPlayback | null>(null);
  const playbackTokenRef = useRef(0);
  const browserSpeechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const webAudioSupported = getAudioContextConstructor() !== null;
  const supported = browserSpeechSupported || webAudioSupported;

  const stopServerAudio = useCallback((phase: 'end' | 'error' | null = 'end') => {
    const activeAudio = activeAudioRef.current;
    if (!activeAudio) {
      return;
    }

    activeAudioRef.current = null;
    activeAudio.source.onended = null;

    try {
      activeAudio.source.stop();
    } catch {
      // Already stopped sources throw in some browsers.
    }
    activeAudio.finish();

    setSpeaking(false);
    if (phase) {
      dispatchGuideSpeechPlayback({ text: activeAudio.text, phase });
    }
  }, []);

  const playDecodedServerAudio = useCallback(
    (
      audioContext: AudioContext,
      text: string,
      decodedAudio: AudioBuffer,
      dispatchStart: boolean
    ): Promise<void> =>
      new Promise((resolve) => {
        const source = audioContext.createBufferSource();
        let finished = false;
        const finish = () => {
          if (finished) {
            return;
          }

          finished = true;
          if (activeAudioRef.current?.source === source) {
            activeAudioRef.current = null;
          }
          setSpeaking(false);
          resolve();
        };

        source.buffer = decodedAudio;
        source.connect(audioContext.destination);
        activeAudioRef.current = { source, text, finish };
        source.onended = finish;

        setSpeaking(true);
        source.start();
        if (dispatchStart) {
          dispatchGuideSpeechPlayback({ text, phase: 'start' });
        }
      }),
    []
  );

  const playServerAudioSequence = useCallback(
    async (
      audioContext: AudioContext,
      text: string,
      firstDecodedAudio: AudioBuffer,
      firstChunkIndex: number,
      speechChunks: string[],
      loadChunk: (index: number) => Promise<DecodedSpeechChunkResult>,
      prefetchFrom: (index: number) => void,
      playbackToken: number
    ) => {
      try {
        let durationMs = Math.max(1, Math.round(firstDecodedAudio.duration * 1000));
        let knownCharacterCount = Math.max(
          1,
          Array.from(speechChunks[firstChunkIndex] ?? '').length
        );
        let plannedCharacterCount = speechChunks
          .slice(firstChunkIndex)
          .reduce((total, chunk) => total + Array.from(chunk).length, 0);
        let durationDispatched = false;
        const dispatchDuration = () => {
          if (durationDispatched || playbackTokenRef.current !== playbackToken) {
            return;
          }

          durationDispatched = true;
          dispatchGuideSpeechDuration({ text, durationMs });
        };

        const dispatchProjectedDuration = () => {
          if (playbackTokenRef.current !== playbackToken) {
            return;
          }

          const averageCharacterMs = Math.min(
            500,
            Math.max(40, durationMs / Math.max(knownCharacterCount, 1))
          );
          const remainingCharacterCount = Math.max(0, plannedCharacterCount - knownCharacterCount);
          dispatchGuideSpeechDuration({
            text,
            durationMs: Math.max(
              1,
              Math.round(durationMs + remainingCharacterCount * averageCharacterMs)
            )
          });
        };

        if (speechChunks.length >= MIN_PROJECTED_DURATION_CHUNKS) {
          dispatchProjectedDuration();
        }

        await playDecodedServerAudio(audioContext, text, firstDecodedAudio, true);

        for (let index = firstChunkIndex + 1; index < speechChunks.length; index += 1) {
          if (playbackTokenRef.current !== playbackToken) {
            return;
          }

          prefetchFrom(index);
          const decodedChunk = await loadChunk(index);
          if (playbackTokenRef.current !== playbackToken) {
            return;
          }

          if (!decodedChunk.ok) {
            plannedCharacterCount -= Array.from(speechChunks[index] ?? '').length;
            if (speechChunks.length >= MIN_PROJECTED_DURATION_CHUNKS) {
              dispatchProjectedDuration();
            }
            continue;
          }

          durationMs += Math.max(1, Math.round(decodedChunk.audio.duration * 1000));
          knownCharacterCount += Array.from(speechChunks[index] ?? '').length;
          if (speechChunks.length >= MIN_PROJECTED_DURATION_CHUNKS) {
            dispatchProjectedDuration();
          }
          await playDecodedServerAudio(audioContext, text, decodedChunk.audio, false);
        }

        if (playbackTokenRef.current === playbackToken) {
          dispatchDuration();
          dispatchGuideSpeechPlayback({ text, phase: 'end' });
        }
      } catch {
        if (playbackTokenRef.current === playbackToken) {
          activeAudioRef.current = null;
          setSpeaking(false);
          dispatchGuideSpeechPlayback({ text, phase: 'error' });
        }
      }
    },
    [playDecodedServerAudio]
  );

  const speakWithBrowser = useCallback(
    (text: string) => {
      if (!browserSpeechSupported) {
        setSpeaking(false);
        dispatchGuideSpeechPlayback({ text, phase: 'error' });
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const preferredVoice = pickPreferredVoice();
      let startDispatched = false;

      const dispatchBrowserStart = () => {
        if (startDispatched) {
          return;
        }

        startDispatched = true;
        dispatchGuideSpeechPlayback({ text, phase: 'start' });
      };

      utterance.lang = 'zh-CN';
      if (preferredVoice) {
        utterance.voice = preferredVoice;
        utterance.lang = preferredVoice.lang || utterance.lang;
      }
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.onstart = () => {
        setSpeaking(true);
        dispatchBrowserStart();
      };
      utterance.onend = () => {
        setSpeaking(false);
        dispatchGuideSpeechPlayback({ text, phase: 'end' });
      };
      utterance.onerror = () => {
        setSpeaking(false);
        dispatchGuideSpeechPlayback({ text, phase: 'error' });
      };
      window.speechSynthesis.speak(utterance);
    },
    [browserSpeechSupported]
  );

  const speakWithServerAudio = useCallback(
    async (text: string, playbackToken: number): Promise<boolean> => {
      const AudioContextConstructor = getAudioContextConstructor();
      if (!AudioContextConstructor) {
        return false;
      }

      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextConstructor();
        }

        const audioContext = audioContextRef.current;
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

        const speechChunks = splitSpeechText(text);
        const decodedChunkPromises: Array<Promise<DecodedSpeechChunkResult> | undefined> = [];
        const loadChunk = (index: number): Promise<DecodedSpeechChunkResult> => {
          if (!decodedChunkPromises[index]) {
            const speechChunk = speechChunks[index];
            decodedChunkPromises[index] = (async (): Promise<DecodedSpeechChunkResult> => {
              if (!speechChunk) {
                return { ok: false, error: new Error('Speech chunk does not exist.') };
              }

              try {
                const audioBuffer = await synthesizeSpeechAudio(speechChunk);
                const audio = await audioContext.decodeAudioData(audioBuffer.slice(0));
                return { ok: true, audio };
              } catch (error) {
                return { ok: false, error };
              }
            })();
          }

          return decodedChunkPromises[index];
        };
        const prefetchFrom = (index: number) => {
          for (
            let nextIndex = index;
            nextIndex < Math.min(speechChunks.length, index + SPEECH_CHUNK_PREFETCH_WINDOW);
            nextIndex += 1
          ) {
            void loadChunk(nextIndex);
          }
        };

        prefetchFrom(0);
        let firstSuccessfulChunk: { index: number; audio: AudioBuffer } | null = null;
        for (let index = 0; index < speechChunks.length; index += 1) {
          prefetchFrom(index);
          const decodedChunk = await loadChunk(index);
          if (playbackTokenRef.current !== playbackToken) {
            return true;
          }

          if (decodedChunk.ok) {
            firstSuccessfulChunk = { index, audio: decodedChunk.audio };
            break;
          }
        }

        if (!firstSuccessfulChunk) {
          throw new Error('No server speech chunks could be synthesized.');
        }

        if (speechChunks.length <= SPEECH_CHUNK_PREFETCH_WINDOW) {
          const pendingDecodedChunks = decodedChunkPromises.filter(
            (decodedChunkPromise): decodedChunkPromise is Promise<DecodedSpeechChunkResult> =>
              Boolean(decodedChunkPromise)
          );
          void Promise.all(pendingDecodedChunks).then((decodedChunks) => {
            if (playbackTokenRef.current !== playbackToken) {
              return;
            }

            const successfulChunks = decodedChunks.filter(
              (decodedChunk): decodedChunk is { ok: true; audio: AudioBuffer } => decodedChunk.ok
            );
            if (successfulChunks.length === 0) {
              return;
            }

            const durationMs = successfulChunks.reduce(
              (total, decodedChunk) =>
                total + Math.max(1, Math.round(decodedChunk.audio.duration * 1000)),
              0
            );
            dispatchGuideSpeechDuration({ text, durationMs });
          });
        }

        void playServerAudioSequence(
          audioContext,
          text,
          firstSuccessfulChunk.audio,
          firstSuccessfulChunk.index,
          speechChunks,
          loadChunk,
          prefetchFrom,
          playbackToken
        );
        return true;
      } catch {
        if (playbackTokenRef.current === playbackToken) {
          stopServerAudio('error');
        }

        return false;
      }
    },
    [playServerAudioSequence, stopServerAudio]
  );
  const speak = useCallback(
    async (text: string) => {
      const normalizedText = text.trim();
      playbackTokenRef.current += 1;
      const playbackToken = playbackTokenRef.current;

      stopServerAudio('end');
      if (browserSpeechSupported) {
        window.speechSynthesis.cancel();
      }

      if (!normalizedText || !supported) {
        setSpeaking(false);
        return;
      }

      dispatchGuideSpeechPlayback({ text: normalizedText, phase: 'preparing' });
      const playedServerAudio = await speakWithServerAudio(normalizedText, playbackToken);
      if (!playedServerAudio && playbackTokenRef.current === playbackToken) {
        speakWithBrowser(normalizedText);
      }
    },
    [browserSpeechSupported, speakWithBrowser, speakWithServerAudio, stopServerAudio, supported]
  );

  useEffect(() => {
    return () => {
      playbackTokenRef.current += 1;
      stopServerAudio(null);

      if (browserSpeechSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [browserSpeechSupported, stopServerAudio]);

  return { supported, speaking, speak };
}
