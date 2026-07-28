import type { GuideChatResponse } from '../guide/guide.service.js';
import type {
  VoiceAsrCallbacks,
  VoiceAsrSession,
  VoiceOutputMode,
  VoiceServerEvent
} from './voice.types.js';

type VoiceSessionOptions = {
  sessionId: string;
  outputMode: VoiceOutputMode;
  createAsr(callbacks: VoiceAsrCallbacks): VoiceAsrSession;
  createGuideResponse(message: string): Promise<GuideChatResponse>;
  emit(event: VoiceServerEvent): void;
};

type VoiceSessionState = 'created' | 'listening' | 'answering' | 'done' | 'cancelled';
type VoiceEventPayload = {
  [Type in VoiceServerEvent['type']]: Omit<
    Extract<VoiceServerEvent, { type: Type }>,
    'sessionId' | 'sequence'
  >;
}[VoiceServerEvent['type']];

export class VoiceSession {
  private state: VoiceSessionState = 'created';
  private sequence = 0;
  private finalHandled = false;
  private responseDone = false;
  private readonly asr: VoiceAsrSession;

  constructor(private readonly options: VoiceSessionOptions) {
    this.asr = options.createAsr({
      onPartial: (text) => this.handlePartial(text),
      onFinal: (text) => {
        void this.handleFinal(text);
      },
      onError: (error) => this.handleError('ASR_FAILED', error.message, false)
    });
  }

  private emit(event: VoiceEventPayload) {
    this.options.emit({
      ...event,
      sessionId: this.options.sessionId,
      sequence: ++this.sequence
    } as VoiceServerEvent);
  }

  private handlePartial(text: string) {
    if (this.state !== 'listening' || !text.trim()) {
      return;
    }

    this.emit({ type: 'transcript.partial', text });
  }

  private handleError(code: string, message: string, recoverable: boolean) {
    if (this.state === 'cancelled' || this.responseDone) {
      return;
    }

    this.emit({ type: 'error', code, message, recoverable });
    this.finishResponse();
  }

  private finishResponse() {
    if (this.responseDone) {
      return;
    }

    this.responseDone = true;
    this.state = 'done';
    this.emit({ type: 'response.done' });
  }

  private async handleFinal(text: string) {
    if (this.state !== 'listening' || this.finalHandled) {
      return;
    }

    this.finalHandled = true;
    const normalizedText = text.trim();
    this.emit({ type: 'transcript.final', text: normalizedText });

    if (!normalizedText) {
      this.handleError('EMPTY_TRANSCRIPT', '没有识别到语音内容。', true);
      return;
    }

    this.state = 'answering';

    try {
      const response = await this.options.createGuideResponse(normalizedText);
      if ((this.state as VoiceSessionState) === 'cancelled') {
        return;
      }

      this.emit({
        type: 'answer.final',
        answer: response.answer,
        cards: response.cards
      });
      this.finishResponse();
    } catch (caught) {
      this.handleError(
        'GUIDE_FAILED',
        caught instanceof Error ? caught.message : '导游回答失败。',
        true
      );
    }
  }

  async start() {
    if (this.state !== 'created') {
      return;
    }

    this.emit({ type: 'session.created' });

    try {
      await this.asr.open();
      if (this.state === 'created') {
        this.state = 'listening';
      }
    } catch (caught) {
      this.handleError(
        'ASR_CONFIG_MISSING',
        caught instanceof Error ? caught.message : '语音识别配置缺失。',
        true
      );
    }
  }

  pushAudio(pcm: Buffer) {
    if (this.state === 'listening') {
      this.asr.pushAudio(pcm);
    }
  }

  finish() {
    if (this.state === 'listening') {
      this.asr.finish();
    }
  }

  cancel() {
    if (this.state === 'cancelled' || this.state === 'done') {
      return;
    }

    this.state = 'cancelled';
    this.asr.cancel();
  }

  get currentState() {
    return this.state;
  }

  get id() {
    return this.options.sessionId;
  }

  get activeOutputMode() {
    return this.options.outputMode;
  }
}
