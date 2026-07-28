import { useCallback, useEffect, useRef, useState } from 'react';
import { VoiceSessionClient } from './VoiceSessionClient';
import type { GuideChatResponse } from '../types/guide';
import type { VoiceSessionCallbacks } from '../types/voice';

export type VoiceGuideState = {
  supported: boolean;
  status: 'idle' | 'connecting' | 'listening' | 'recognizing' | 'thinking' | 'speaking' | 'error';
  transcript: string;
  error: string | null;
  toggle(): void;
  cancel(): void;
};

type UseVoiceGuideSessionOptions = {
  onFinalTranscript(sessionId: string, text: string): void;
  onAnswer(sessionId: string, response: GuideChatResponse): void;
  onError(sessionId: string, message: string): void;
};

function canUseStreamingVoice() {
  return (
    typeof window !== 'undefined' &&
    typeof WebSocket !== 'undefined' &&
    typeof AudioWorkletNode !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    Boolean(
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    )
  );
}

function getVoiceStartError(caught: unknown) {
  if (
    typeof caught === 'object' &&
    caught !== null &&
    'name' in caught &&
    (caught.name === 'NotAllowedError' || caught.name === 'PermissionDeniedError')
  ) {
    return '\u9ea6\u514b\u98ce\u6743\u9650\u4e0d\u53ef\u7528\uff0c\u8bf7\u5141\u8bb8\u6d4f\u89c8\u5668\u4f7f\u7528\u9ea6\u514b\u98ce\u3002';
  }

  return caught instanceof Error
    ? caught.message
    : '\u8bed\u97f3\u8f93\u5165\u542f\u52a8\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u9ea6\u514b\u98ce\u6743\u9650\u3002';
}

export function useVoiceGuideSession(options: UseVoiceGuideSessionOptions): VoiceGuideState {
  const [status, setStatus] = useState<VoiceGuideState['status']>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<VoiceSessionClient | null>(null);

  const supported = canUseStreamingVoice();

  const callbacks: VoiceSessionCallbacks = {
    onStatus: setStatus,
    onPartial: (text) => {
      setTranscript(text);
      setError(null);
    },
    onFinalTranscript: (sessionId, text) => {
      setTranscript('');
      options.onFinalTranscript(sessionId, text);
    },
    onAnswer: options.onAnswer,
    onError: (sessionId, message) => {
      setError(message);
      options.onError(sessionId, message);
    }
  };

  const cancel = useCallback(() => {
    void clientRef.current?.cancel();
  }, []);

  const toggle = useCallback(() => {
    if (!supported) {
      setError('当前浏览器不支持实时语音输入，可以直接打字提问。');
      setStatus('error');
      return;
    }

    if (clientRef.current) {
      void clientRef.current.cancel();
      clientRef.current = null;
      return;
    }

    const client = new VoiceSessionClient({ callbacks });
    clientRef.current = client;
    void client.start().catch((caught) => {
      setError(getVoiceStartError(caught));
      setStatus('error');
      clientRef.current = null;
    });
  }, [callbacks, supported]);

  useEffect(() => {
    return () => {
      void clientRef.current?.dispose();
      clientRef.current = null;
    };
  }, []);

  return { supported, status, transcript, error, toggle, cancel };
}
