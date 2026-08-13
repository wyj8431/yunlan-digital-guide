import { createServer } from 'node:http';
import WebSocket from 'ws';
import { afterEach, describe, expect, it } from 'vitest';
import { attachGuideWebSocketServer } from '../src/modules/guide/guide.websocket';
import type { GuideChatResponse } from '../src/modules/guide/guide.service';

type GuideStreamEvent =
  | { type: 'start' }
  | { type: 'delta'; delta: string }
  | { type: 'speech-timeline' }
  | { type: 'result'; response: GuideChatResponse }
  | { type: 'error'; code: string; message: string }
  | { type: 'done' };

const servers: Array<ReturnType<typeof createServer>> = [];
const clients: WebSocket[] = [];

function guideResponse(answer: string): GuideChatResponse {
  return {
    answer,
    cards: [],
    source: 'llm',
    speechTimeline: { text: answer, durationMs: 500, visemes: [], source: 'estimated' },
    retrievedKnowledge: []
  };
}

async function connect(server: ReturnType<typeof createServer>) {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('server did not bind to an ephemeral port');
  }

  const client = new WebSocket(`ws://127.0.0.1:${address.port}/api/guide/chat/stream`);
  clients.push(client);
  await new Promise<void>((resolve, reject) => {
    client.once('open', resolve);
    client.once('error', reject);
  });
  return client;
}

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

describe('guide websocket', () => {
  it('cancels a superseded request and emits results only for the latest request', async () => {
    const server = createServer();
    servers.push(server);
    let firstRequestAborted = false;
    let resolveFirstRequest!: () => void;
    attachGuideWebSocketServer(server, {
      createGuideStreamResponse: async ({ message, onDelta, signal }) => {
        if (message === 'slow request') {
          return new Promise<GuideChatResponse>((resolve) => {
            resolveFirstRequest = () => resolve(guideResponse('stale answer'));
            signal?.addEventListener(
              'abort',
              () => {
                firstRequestAborted = true;
              },
              { once: true }
            );
          });
        }
        onDelta('latest answer');
        return guideResponse('latest answer');
      }
    });
    const client = await connect(server);
    const events: GuideStreamEvent[] = [];
    const done = new Promise<void>((resolve, reject) => {
      client.on('message', (raw) => {
        const event = JSON.parse(raw.toString()) as GuideStreamEvent;
        events.push(event);
        if (event.type === 'done') resolve();
      });
      client.on('error', reject);
    });

    client.send(JSON.stringify({ type: 'ask', message: 'slow request' }));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    client.send(JSON.stringify({ type: 'ask', message: 'latest request' }));
    await done;
    resolveFirstRequest();

    expect(firstRequestAborted).toBe(true);
    expect(events.filter((event) => event.type === 'start')).toHaveLength(2);
    expect(events.filter((event) => event.type === 'result')).toEqual([
      expect.objectContaining({
        type: 'result',
        response: expect.objectContaining({ answer: 'latest answer' })
      })
    ]);
    expect(events.filter((event) => event.type === 'done')).toHaveLength(1);
  });

  it('aborts the active guide request when the client disconnects', async () => {
    const server = createServer();
    servers.push(server);
    let aborted!: () => void;
    const requestAborted = new Promise<void>((resolve) => {
      aborted = resolve;
    });
    attachGuideWebSocketServer(server, {
      createGuideStreamResponse: async ({ signal }) =>
        new Promise<GuideChatResponse>((_resolve, reject) => {
          signal?.addEventListener(
            'abort',
            () => {
              aborted();
              reject(new Error('aborted'));
            },
            { once: true }
          );
        })
    });
    const client = await connect(server);
    const started = new Promise<void>((resolve) => {
      client.on('message', (raw) => {
        if ((JSON.parse(raw.toString()) as GuideStreamEvent).type === 'start') resolve();
      });
    });

    client.send(JSON.stringify({ type: 'ask', message: 'slow request' }));
    await started;
    client.close();
    await requestAborted;
  });

  it('returns a stable error and done event for malformed requests', async () => {
    const server = createServer();
    servers.push(server);
    attachGuideWebSocketServer(server);
    const client = await connect(server);
    const events: GuideStreamEvent[] = [];
    const done = new Promise<void>((resolve, reject) => {
      client.on('message', (raw) => {
        const event = JSON.parse(raw.toString()) as GuideStreamEvent;
        events.push(event);
        if (event.type === 'done') resolve();
      });
      client.on('error', reject);
    });

    client.send(JSON.stringify({ type: 'not-ask' }));
    await done;

    expect(events).toEqual([
      { type: 'error', code: 'INVALID_STREAM_REQUEST', message: 'Invalid guide stream request.' },
      { type: 'done' }
    ]);
  });

  it('closes oversized payloads before attachment parsing', async () => {
    const server = createServer();
    servers.push(server);
    attachGuideWebSocketServer(server);
    const client = await connect(server);
    const closed = new Promise<number>((resolve, reject) => {
      client.once('close', (code) => resolve(code));
      client.once('error', reject);
    });

    client.send(Buffer.alloc(14 * 1024 * 1024 + 1, 0x61));

    await expect(closed).resolves.toBe(1009);
  });
});
