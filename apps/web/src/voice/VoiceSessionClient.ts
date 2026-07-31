// 浏览器语音会话客户端，负责采集 PCM、传输事件和断线清理。
import { PcmCapture } from './audio/PcmCapture';
import { createBackendWebSocketUrl } from '../api/backendSocketUrl';
import type { GuideChatResponse } from '../types/guide';
import type { VoiceOutputMode, VoiceServerEvent, VoiceSessionCallbacks } from '../types/voice';

type CaptureLike = {
  start(): Promise<void>;
  stop(): Promise<void>;
};

type VoiceSessionClientOptions = {
  url?: string;
  outputMode?: VoiceOutputMode;
  callbacks: VoiceSessionCallbacks;
  createCapture?: (onChunk: (pcm: ArrayBuffer) => void) => CaptureLike;
  createSocket?: (url: string) => WebSocket;
};

function createSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `voice-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function estimatedSpeechTimeline(text: string): GuideChatResponse['speechTimeline'] {
  return {
    text,
    durationMs: Math.max(900, Array.from(text).length * 145),
    visemes: [],
    source: 'estimated'
  };
}

export class VoiceSessionClient {
  private socket: WebSocket | null = null;
  private capture: CaptureLike | null = null;
  private sessionId: string | null = null;
  private sequence = 0;
  private finalTranscriptHandled = false;
  private answerHandled = false;
  private closing = false;
  private readonly pendingChunks: ArrayBuffer[] = [];

  constructor(private readonly options: VoiceSessionClientOptions) {}

  async start() {
    if (this.socket || this.sessionId) {
      return;
    }

    const sessionId = createSessionId();
    this.sessionId = sessionId;
    this.sequence = 0;
    this.finalTranscriptHandled = false;
    this.answerHandled = false;
    this.closing = false;
    this.options.callbacks.onStatus('connecting');

    this.capture =
      this.options.createCapture?.((pcm) => this.sendAudio(pcm)) ??
      new PcmCapture({ onChunk: (pcm) => this.sendAudio(pcm) });
    await this.capture.start();

    const socketFactory = this.options.createSocket ?? ((url: string) => new WebSocket(url));
    const socket = socketFactory(this.options.url ?? createBackendWebSocketUrl('/api/voice'));
    this.socket = socket;

    socket.addEventListener('open', () => {
      if (this.closing || this.sessionId !== sessionId) {
        return;
      }

      socket.send(
        JSON.stringify({
          type: 'session.start',
          sessionId,
          sequence: 1,
          outputMode: this.options.outputMode ?? 'xfyun-avatar',
          sampleRate: 16000
        })
      );
      this.pendingChunks.splice(0).forEach((chunk) => socket.send(chunk));
    });
    socket.addEventListener('message', (event) =>
      this.handleMessage(String(event.data), sessionId)
    );
    socket.addEventListener('error', () => {
      this.fail(sessionId, '语音连接失败，请检查麦克风权限和网络。');
    });
    socket.addEventListener('close', () => {
      if (!this.closing && this.sessionId === sessionId && !this.answerHandled) {
        this.fail(sessionId, '语音连接已断开，请重试。');
      }
    });
  }

  private sendAudio(pcm: ArrayBuffer) {
    if (this.closing || !this.sessionId) {
      return;
    }

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(pcm);
      return;
    }

    if (this.pendingChunks.length < 24) {
      this.pendingChunks.push(pcm);
    }
  }

  private handleMessage(raw: string, expectedSessionId: string) {
    let event: VoiceServerEvent;
    try {
      event = JSON.parse(raw) as VoiceServerEvent;
    } catch {
      this.fail(expectedSessionId, '语音服务返回了无效数据。');
      return;
    }

    if (event.sessionId !== expectedSessionId || event.sequence <= this.sequence || this.closing) {
      return;
    }
    this.sequence = event.sequence;

    if (event.type === 'session.created') {
      this.options.callbacks.onStatus('listening');
      return;
    }

    if (event.type === 'transcript.partial') {
      this.options.callbacks.onStatus('recognizing');
      this.options.callbacks.onPartial(event.text);
      return;
    }

    if (event.type === 'transcript.final') {
      if (this.finalTranscriptHandled) {
        return;
      }
      this.finalTranscriptHandled = true;
      void this.capture?.stop();
      this.options.callbacks.onStatus('thinking');
      this.options.callbacks.onFinalTranscript(event.sessionId, event.text);
      return;
    }

    if (event.type === 'answer.final') {
      if (this.answerHandled) {
        return;
      }
      this.answerHandled = true;
      this.options.callbacks.onStatus('speaking');
      const response: GuideChatResponse = {
        answer: event.answer,
        cards: event.cards,
        source: 'llm',
        speechTimeline: estimatedSpeechTimeline(event.answer),
        retrievedKnowledge: []
      };
      this.options.callbacks.onAnswer(event.sessionId, response);
      return;
    }

    if (event.type === 'error') {
      this.fail(event.sessionId, event.message);
      return;
    }

    if (event.type === 'response.done') {
      this.options.callbacks.onStatus('idle');
      void this.dispose();
    }
  }

  private fail(sessionId: string, message: string) {
    if (this.closing || this.sessionId !== sessionId) {
      return;
    }

    this.options.callbacks.onStatus('error');
    this.options.callbacks.onError(sessionId, message);
    void this.dispose();
  }

  async cancel() {
    if (!this.sessionId) {
      return;
    }

    const sessionId = this.sessionId;
    this.closing = true;
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'session.cancel',
          sessionId,
          sequence: this.sequence + 1
        })
      );
    }
    await this.dispose();
    this.options.callbacks.onStatus('idle');
  }

  async dispose() {
    this.closing = true;
    await this.capture?.stop();
    this.capture = null;
    this.pendingChunks.length = 0;
    this.socket?.close();
    this.socket = null;
    this.sessionId = null;
  }
}
