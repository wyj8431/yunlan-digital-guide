import { createServer } from 'node:http';
import WebSocket from 'ws';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { attachVoiceWebSocketServer } from '../src/modules/voice/voice-websocket';
import type {
  VoiceAsrCallbacks,
  VoiceAsrSession,
  VoiceServerEvent
} from '../src/modules/voice/voice.types';

class FakeAsr implements VoiceAsrSession {
  constructor(readonly callbacks: VoiceAsrCallbacks) {}

  async open() {}

  pushAudio() {}

  finish() {}

  cancel() {}
}

const servers: Array<ReturnType<typeof createServer>> = [];
const clients: WebSocket[] = [];

afterEach(async () => {
  clients.splice(0).forEach((client) => client.terminate());
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        })
    )
  );
});

describe('voice websocket', () => {
  it('creates one session and forwards final guide response events', async () => {
    const server = createServer(createApp().callback());
    servers.push(server);
    let asr: FakeAsr | null = null;
    attachVoiceWebSocketServer(server, {
      createAsr: (callbacks) => {
        asr = new FakeAsr(callbacks);
        return asr;
      },
      createGuideResponse: async () => ({
        answer: '黄山建议走云谷索道上山。',
        cards: [],
        source: 'llm' as const,
        speechTimeline: {
          text: '黄山建议走云谷索道上山。',
          durationMs: 900,
          visemes: [],
          source: 'estimated' as const
        },
        retrievedKnowledge: []
      })
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('server did not bind to an ephemeral port');
    }

    const client = new WebSocket(`ws://127.0.0.1:${address.port}/api/voice`);
    clients.push(client);
    const events: VoiceServerEvent[] = [];
    let resolveCreated!: () => void;
    const created = new Promise<void>((resolve) => {
      resolveCreated = resolve;
    });
    const received = new Promise<void>((resolve, reject) => {
      client.on('message', (raw) => {
        const event = JSON.parse(raw.toString()) as VoiceServerEvent;
        events.push(event);
        if (event.type === 'session.created') {
          resolveCreated();
        }
        if (event.type === 'response.done') {
          resolve();
        }
      });
      client.on('error', reject);
    });

    await new Promise<void>((resolve) => client.once('open', () => resolve()));
    client.send(
      JSON.stringify({
        type: 'session.start',
        sessionId: 'ws-session',
        sequence: 1,
        outputMode: 'xfyun-avatar',
        sampleRate: 16000
      })
    );

    await created;
    asr?.callbacks.onPartial('黄山怎么玩');
    asr?.callbacks.onFinal('黄山怎么玩');
    await received;

    expect(events.map((event) => event.type)).toEqual([
      'session.created',
      'transcript.partial',
      'transcript.final',
      'answer.final',
      'response.done'
    ]);
    expect(events.at(-1)).toMatchObject({ type: 'response.done', sessionId: 'ws-session' });
    client.close();
  });
});
