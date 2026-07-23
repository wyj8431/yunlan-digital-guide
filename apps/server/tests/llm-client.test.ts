import { afterEach, describe, expect, it, vi } from 'vitest';
import { chatWithLlmStream } from '../src/modules/guide/llm-client';
import type { ServerEnv } from '../src/config/env';

const hybridEnv: ServerEnv = {
  port: 8787,
  llmProvider: 'hybrid',
  llmBaseUrl: 'https://ark.example.com/api/v3',
  llmApiKey: 'ark-key',
  llmModel: 'ark-model',
  cozeApiBase: 'https://api.coze.cn',
  cozeApiToken: 'coze-token',
  cozeBotId: 'bot-123',
  cozeUserId: 'wyj-test-user',
  virtualHumanEnabled: false,
  xfyunVirtualHumanAppId: '',
  xfyunVirtualHumanApiKey: '',
  xfyunVirtualHumanApiSecret: '',
  xfyunVirtualHumanServiceId: '',
  xfyunVirtualHumanAvatarId: '',
  xfyunVirtualHumanSdkScriptUrl: '',
  xfyunVirtualHumanTtsVoice: '',
  xfyunVirtualHumanActions: '',
  xfyunTtsAppId: '',
  xfyunTtsApiKey: '',
  xfyunTtsApiSecret: '',
  xfyunTtsVoice: 'xiaoyan'
};

function streamFromText(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    }
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('llm client hybrid provider', () => {
  it('uses Coze first when hybrid provider succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          streamFromText(
            [
              'event:conversation.message.delta',
              'data: {"type":"answer","content":"扣子路线"}',
              ''
            ].join('\n')
          ),
          { status: 200 }
        )
      );
    vi.stubGlobal('fetch', fetchMock);
    const deltas: string[] = [];

    const answer = await chatWithLlmStream(
      [{ role: 'user', content: '西湖怎么玩' }],
      hybridEnv,
      (delta) => deltas.push(delta)
    );

    expect(answer).toBe('扣子路线');
    expect(deltas).toEqual(['扣子路线']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.coze.cn/v3/chat');
  });

  it('falls back to Ark when Coze fails in hybrid provider', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('bad gateway', { status: 502 }))
      .mockResolvedValueOnce(
        new Response(
          streamFromText(
            [
              'data: {"choices":[{"delta":{"content":"火山"}}]}',
              '',
              'data: {"choices":[{"delta":{"content":"兜底"}}]}',
              '',
              'data: [DONE]',
              ''
            ].join('\n')
          ),
          { status: 200 }
        )
      );
    vi.stubGlobal('fetch', fetchMock);
    const deltas: string[] = [];

    const answer = await chatWithLlmStream(
      [{ role: 'user', content: '西湖怎么玩' }],
      hybridEnv,
      (delta) => deltas.push(delta)
    );

    expect(answer).toBe('火山兜底');
    expect(deltas).toEqual(['火山', '兜底']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.coze.cn/v3/chat');
    expect(fetchMock.mock.calls[1][0]).toBe('https://ark.example.com/api/v3/chat/completions');
  });

  it('falls back to Ark when Coze does not respond before the hybrid timeout', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockImplementationOnce((_url, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        });
      })
      .mockResolvedValueOnce(
        new Response(
          streamFromText(
            [
              'data: {"choices":[{"delta":{"content":"超时"}}]}',
              '',
              'data: {"choices":[{"delta":{"content":"兜底"}}]}',
              ''
            ].join('\n')
          ),
          { status: 200 }
        )
      );
    vi.stubGlobal('fetch', fetchMock);
    const deltas: string[] = [];

    const pending = chatWithLlmStream(
      [{ role: 'user', content: '西湖怎么玩' }],
      hybridEnv,
      (delta) => deltas.push(delta)
    );

    await vi.advanceTimersByTimeAsync(15_000);

    const answer = await pending;

    expect(answer).toBe('超时兜底');
    expect(deltas).toEqual(['超时', '兜底']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to Ark when Coze opens a stream but does not finish before the hybrid timeout', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream({
            start() {
              // Keep the stream open without sending a complete answer.
            }
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          streamFromText(
            [
              'data: {"choices":[{"delta":{"content":"火山流"}}]}',
              '',
              'data: {"choices":[{"delta":{"content":"完成"}}]}',
              ''
            ].join('\n')
          ),
          { status: 200 }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    const pending = chatWithLlmStream(
      [{ role: 'user', content: '西湖怎么玩' }],
      hybridEnv,
      () => undefined
    );

    await vi.advanceTimersByTimeAsync(15_000);

    await expect(pending).resolves.toBe('火山流完成');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('waits longer for image recognition before falling back from Coze to Ark', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 0, data: { id: 'coze-file-123' } }), { status: 200 })
      )
      .mockImplementationOnce((_url, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        });
      })
      .mockResolvedValueOnce(
        new Response(
          streamFromText(
            [
              'data: {"choices":[{"delta":{"content":"图片兜底"}}]}',
              '',
              'data: {"choices":[{"delta":{"content":"路线"}}]}',
              ''
            ].join('\n')
          ),
          { status: 200 }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    const pending = chatWithLlmStream(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: '识别这张景区图片' },
            {
              type: 'image_url',
              image_url: { url: 'data:image/png;base64,aGVsbG8=', detail: 'auto' }
            }
          ]
        }
      ],
      hybridEnv,
      () => undefined
    );

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(45_000);

    await expect(pending).resolves.toBe('图片兜底路线');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toBe('https://ark.example.com/api/v3/chat/completions');
  });
});
