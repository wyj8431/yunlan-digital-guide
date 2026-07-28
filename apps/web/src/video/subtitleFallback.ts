import type { SubtitleCue } from '../types/video';

export type LiveSubtitleState =
  | { status: 'idle' | 'listening' | 'unsupported' | 'failed' }
  | { status: 'ready'; transcript: string };

export type SubtitleDisplay = {
  text: string;
  source: 'preset' | 'live';
};

export function canUseLiveSubtitleRecognition(
  scope:
    Pick<Window, 'SpeechRecognition' | 'webkitSpeechRecognition'> | undefined = typeof window ===
  'undefined'
    ? undefined
    : window
): boolean {
  return Boolean(scope?.SpeechRecognition || scope?.webkitSpeechRecognition);
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
