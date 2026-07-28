import { describe, expect, it } from 'vitest';
import type { GuideChatResponse } from '../src/modules/guide/guide.service';
import { VoiceSession } from '../src/modules/voice/voice-session';
import type {
  VoiceAsrCallbacks,
  VoiceAsrSession,
  VoiceServerEvent
} from '../src/modules/voice/voice.types';

const guideResponse: GuideChatResponse = {
  answer: '建议安排黄山一日游路线。',
  cards: [],
  source: 'llm',
  speechTimeline: {
    text: '建议安排黄山一日游路线。',
    durationMs: 900,
    visemes: [],
    source: 'estimated'
  },
  retrievedKnowledge: []
};

class FakeAsr implements VoiceAsrSession {
  callbacks!: VoiceAsrCallbacks;
  opened = false;
  finished = false;
  cancelled = false;

  constructor(callbacks: VoiceAsrCallbacks) {
    this.callbacks = callbacks;
  }

  async open() {
    this.opened = true;
  }

  pushAudio() {}

  finish() {
    this.finished = true;
  }

  cancel() {
    this.cancelled = true;
  }
}

describe('voice session', () => {
  it('forwards one final transcript and creates one guide answer', async () => {
    const events: VoiceServerEvent[] = [];
    let asr: FakeAsr | null = null;
    const session = new VoiceSession({
      sessionId: 'session-1',
      outputMode: 'xfyun-avatar',
      createAsr: (callbacks) => {
        asr = new FakeAsr(callbacks);
        return asr;
      },
      createGuideResponse: async () => guideResponse,
      emit: (event) => events.push(event)
    });

    await session.start();
    asr?.callbacks.onPartial('黄山一日游');
    asr?.callbacks.onFinal('黄山一日游');
    asr?.callbacks.onFinal('黄山一日游');
    await Promise.resolve();

    expect(events.map((event) => event.type)).toEqual([
      'session.created',
      'transcript.partial',
      'transcript.final',
      'answer.final',
      'response.done'
    ]);
    expect(events.filter((event) => event.type === 'answer.final')).toHaveLength(1);
    expect(session.currentState).toBe('done');
  });

  it('keeps an empty transcript from calling the guide agent', async () => {
    const events: VoiceServerEvent[] = [];
    const guide = async () => guideResponse;
    let asr: FakeAsr | null = null;
    const session = new VoiceSession({
      sessionId: 'session-2',
      outputMode: 'xfyun-avatar',
      createAsr: (callbacks) => {
        asr = new FakeAsr(callbacks);
        return asr;
      },
      createGuideResponse: guide,
      emit: (event) => events.push(event)
    });

    await session.start();
    asr?.callbacks.onFinal('   ');
    await Promise.resolve();

    expect(events.find((event) => event.type === 'error')).toMatchObject({
      type: 'error',
      code: 'EMPTY_TRANSCRIPT',
      recoverable: true
    });
    expect(events.some((event) => event.type === 'answer.final')).toBe(false);
  });
});
