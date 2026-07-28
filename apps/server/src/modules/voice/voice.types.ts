import type { RouteCard } from '../guide/guide.service.js';

export type VoiceOutputMode = 'xfyun-avatar' | 'local-avatar';

export type VoiceClientEvent =
  | {
      type: 'session.start';
      sessionId: string;
      sequence: number;
      outputMode: VoiceOutputMode;
      sampleRate: 16000;
    }
  | { type: 'session.cancel'; sessionId: string; sequence: number };

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

export type VoiceAsrCallbacks = {
  onPartial(text: string): void;
  onFinal(text: string): void;
  onError(error: Error): void;
};

export type VoiceAsrSession = {
  open(): Promise<void>;
  pushAudio(pcm: Buffer): void;
  finish(): void;
  cancel(): void;
};
