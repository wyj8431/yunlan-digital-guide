// 通过页面级事件解耦聊天打字机与不同数字人供应商的语音进度。
export const GUIDE_SPEECH_DURATION_EVENT = 'yunlan:guide-speech-duration';
export const GUIDE_SPEECH_PLAYBACK_EVENT = 'yunlan:guide-speech-playback';
export const COZE_AGENT_EVENT = 'yunlan:coze-agent-event';

export type CozeAgentMessageType = 'text' | 'voice' | 'command';

export type CozeAgentEventDetail = {
  role: 'user' | 'assistant';
  content: string;
  type: CozeAgentMessageType;
  timestamp: number;
};

export type GuideSpeechDurationDetail = {
  text: string;
  durationMs: number;
};

export type GuideSpeechPlaybackPhase = 'preparing' | 'start' | 'end' | 'error';

export type GuideSpeechPlaybackDetail = {
  text: string;
  phase: GuideSpeechPlaybackPhase;
  playbackId?: string;
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

export function dispatchCozeAgentEvent(detail: CozeAgentEventDetail) {
  window.dispatchEvent(
    new CustomEvent<CozeAgentEventDetail>(COZE_AGENT_EVENT, {
      detail
    })
  );
}

export function subscribeCozeAgentEvents(
  handler: (detail: CozeAgentEventDetail) => void
): () => void {
  const listener = (event: Event) => {
    if (isCozeAgentEvent(event)) {
      handler(event.detail);
    }
  };

  window.addEventListener(COZE_AGENT_EVENT, listener);
  return () => window.removeEventListener(COZE_AGENT_EVENT, listener);
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
    (detail?.phase === 'preparing' ||
      detail?.phase === 'start' ||
      detail?.phase === 'end' ||
      detail?.phase === 'error') &&
    (detail?.playbackId === undefined || typeof detail.playbackId === 'string')
  );
}

export function isCozeAgentEvent(event: Event): event is CustomEvent<CozeAgentEventDetail> {
  const detail = (event as CustomEvent<CozeAgentEventDetail>).detail;
  return (
    event.type === COZE_AGENT_EVENT &&
    (detail?.role === 'user' || detail?.role === 'assistant') &&
    typeof detail.content === 'string' &&
    (detail.type === 'text' || detail.type === 'voice' || detail.type === 'command') &&
    Number.isFinite(detail.timestamp)
  );
}
