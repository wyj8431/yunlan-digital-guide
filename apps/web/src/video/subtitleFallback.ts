import type { SubtitleCue } from '../types/video';

export type LiveSubtitleState =
  | { status: 'idle' | 'listening' | 'unsupported' | 'failed' }
  | { status: 'ready'; transcript: string };

export type SubtitleDisplay = {
  text: string;
  source: 'preset' | 'live';
};

type RecognitionScope = Pick<Window, 'SpeechRecognition' | 'webkitSpeechRecognition'>;

export function getSpeechRecognitionConstructor(
  scope: RecognitionScope | undefined = typeof window === 'undefined' ? undefined : window
): (new () => SpeechRecognition) | undefined {
  return scope?.SpeechRecognition ?? scope?.webkitSpeechRecognition;
}

export function canUseLiveSubtitleRecognition(
  scope: RecognitionScope | undefined = typeof window === 'undefined' ? undefined : window
): boolean {
  return Boolean(getSpeechRecognitionConstructor(scope));
}

export function createLiveSubtitleRecognition(
  scope: RecognitionScope | undefined = typeof window === 'undefined' ? undefined : window
): SpeechRecognition | null {
  const Recognition = getSpeechRecognitionConstructor(scope);
  if (!Recognition) return null;

  const recognition = new Recognition();
  recognition.lang = 'zh-CN';
  recognition.continuous = true;
  recognition.interimResults = true;
  return recognition;
}

export function readRecognitionTranscript(event: SpeechRecognitionEvent): string {
  let transcript = '';
  for (let index = event.resultIndex; index < event.results.length; index += 1) {
    transcript += event.results[index]?.[0]?.transcript ?? '';
  }
  return transcript.trim();
}

export function disposeLiveSubtitleRecognition(recognition: SpeechRecognition): void {
  recognition.onresult = null;
  recognition.onerror = null;
  recognition.onend = null;
  recognition.onnomatch = null;
  recognition.onspeechend = null;
  recognition.onaudioend = null;

  try {
    recognition.stop();
  } catch {
    // Some implementations throw when recognition never reached the running state.
  }
  try {
    recognition.abort();
  } catch {
    // Abort is best-effort during teardown.
  }
}

export function resolveSubtitleDisplay(
  cues: SubtitleCue[],
  currentMs: number,
  liveState: LiveSubtitleState = { status: 'unsupported' }
): SubtitleDisplay {
  if (liveState.status === 'ready' && liveState.transcript.trim()) {
    return { text: liveState.transcript.trim(), source: 'live' };
  }

  const cue = cues.find(
    (candidate) => candidate.startMs <= currentMs && currentMs < candidate.endMs
  );
  return { text: cue?.content ?? '预置字幕将在播放时同步显示', source: 'preset' };
}
