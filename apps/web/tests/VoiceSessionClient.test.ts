import { describe, expect, it, vi } from 'vitest';
import { VoiceSessionClient } from '../src/voice/VoiceSessionClient';
import type { VoiceServerEvent } from '../src/types/voice';

class FakeSocket extends EventTarget {
  static OPEN = 1;
  readyState = FakeSocket.OPEN;
  sent: unknown[] = [];
  url: string;

  constructor(url: string) {
    super();
    this.url = url;
  }

  send(payload: unknown) {
    this.sent.push(payload);
  }

  close() {
    this.readyState = 3;
  }

  open() {
    this.dispatchEvent(new Event('open'));
  }

  emit(event: VoiceServerEvent) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(event) }));
  }
}

describe('VoiceSessionClient', () => {
  it('submits one final transcript and one answer for a voice session', async () => {
    const socket = new FakeSocket('ws://test/api/voice');
    const onPartial = vi.fn();
    const onFinalTranscript = vi.fn();
    const onAnswer = vi.fn();
    const onStatus = vi.fn();
    const client = new VoiceSessionClient({
      url: 'ws://test/api/voice',
      callbacks: {
        onStatus,
        onPartial,
        onFinalTranscript,
        onAnswer,
        onError: vi.fn()
      },
      createCapture: (onChunk) => ({
        async start() {
          onChunk(new ArrayBuffer(2));
        },
        async stop() {}
      }),
      createSocket: () => socket as unknown as WebSocket
    });

    await client.start();
    socket.open();
    const startPayload = JSON.parse(String(socket.sent[0]));
    const sessionId = startPayload.sessionId as string;

    socket.emit({ type: 'session.created', sessionId, sequence: 1 });
    socket.emit({ type: 'transcript.partial', sessionId, sequence: 2, text: '黄山' });
    socket.emit({ type: 'transcript.final', sessionId, sequence: 3, text: '黄山怎么玩' });
    socket.emit({ type: 'transcript.final', sessionId, sequence: 3, text: '黄山怎么玩' });
    socket.emit({
      type: 'answer.final',
      sessionId,
      sequence: 4,
      answer: '建议走云谷索道。',
      cards: []
    });
    socket.emit({
      type: 'answer.final',
      sessionId,
      sequence: 4,
      answer: '重复答案',
      cards: []
    });
    socket.emit({ type: 'response.done', sessionId, sequence: 5 });

    expect(onPartial).toHaveBeenCalledWith('黄山');
    expect(onFinalTranscript).toHaveBeenCalledTimes(1);
    expect(onFinalTranscript).toHaveBeenCalledWith(sessionId, '黄山怎么玩');
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer.mock.calls[0][1]).toMatchObject({
      answer: '建议走云谷索道。',
      source: 'llm'
    });
    expect(onStatus).toHaveBeenCalledWith('idle');
  });
});
