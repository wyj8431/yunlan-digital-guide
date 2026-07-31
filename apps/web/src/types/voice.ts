// 浏览器与服务端语音 WebSocket 之间交换的事件协议。
import type { GuideChatResponse, RouteCard } from './guide';

export type VoiceOutputMode = 'xfyun-avatar' | 'local-avatar';

export type VoiceServerEvent =
  | { type: 'session.created'; sessionId: string; sequence: number }
  | { type: 'transcript.partial'; sessionId: string; sequence: number; text: string }
  | { type: 'transcript.final'; sessionId: string; sequence: number; text: string }
  | {
      type: 'answer.final';
      sessionId: string;
      sequence: number;
      answer: string;
      cards: RouteCard[];
    }
  | { type: 'response.done'; sessionId: string; sequence: number }
  | {
      type: 'error';
      sessionId: string;
      sequence: number;
      code: string;
      message: string;
      recoverable: boolean;
    };

export type VoiceSessionCallbacks = {
  onStatus(
    status: 'connecting' | 'listening' | 'recognizing' | 'thinking' | 'speaking' | 'idle' | 'error'
  ): void;
  onPartial(text: string): void;
  onFinalTranscript(sessionId: string, text: string): void;
  onAnswer(sessionId: string, response: GuideChatResponse): void;
  onError(sessionId: string, message: string): void;
};
