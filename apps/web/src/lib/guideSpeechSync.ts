// 通过页面级事件解耦聊天打字机与不同数字人供应商的语音进度。
export const GUIDE_SPEECH_DURATION_EVENT = 'yunlan:guide-speech-duration';
export const GUIDE_SPEECH_PLAYBACK_EVENT = 'yunlan:guide-speech-playback';

export type GuideSpeechDurationDetail = {
  text: string;
  durationMs: number;
};

export type GuideSpeechPlaybackPhase = 'preparing' | 'start' | 'end' | 'error';

export type GuideSpeechPlaybackDetail = {
  text: string;
  phase: GuideSpeechPlaybackPhase;
};

export function dispatchGuideSpeechDuration(detail: GuideSpeechDurationDetail) {
  window.dispatchEvent(
    new CustomEvent<GuideSpeechDurationDetail>(GUIDE_SPEECH_DURATION_EVENT, {
      detail
    })
  );
}

export function dispatchGuideSpeechPlayback(detail: GuideSpeechPlaybackDetail) {
  window.dispatchEvent(
    new CustomEvent<GuideSpeechPlaybackDetail>(GUIDE_SPEECH_PLAYBACK_EVENT, {
      detail
    })
  );
}

export function isGuideSpeechDurationEvent(
  event: Event
): event is CustomEvent<GuideSpeechDurationDetail> {
  const detail = (event as CustomEvent<GuideSpeechDurationDetail>).detail;
  return (
    event.type === GUIDE_SPEECH_DURATION_EVENT &&
    typeof detail?.text === 'string' &&
    Number.isFinite(detail.durationMs) &&
    detail.durationMs > 0
  );
}

export function isGuideSpeechPlaybackEvent(
  event: Event
): event is CustomEvent<GuideSpeechPlaybackDetail> {
  const detail = (event as CustomEvent<GuideSpeechPlaybackDetail>).detail;
  return (
    event.type === GUIDE_SPEECH_PLAYBACK_EVENT &&
    typeof detail?.text === 'string' &&
    (detail.phase === 'preparing' ||
      detail.phase === 'start' ||
      detail.phase === 'end' ||
      detail.phase === 'error')
  );
}
