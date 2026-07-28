import { afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { chatWithCozeStream } from '../src/modules/guide/coze-client';
import { chatWithLlmStream } from '../src/modules/guide/llm-client';
import type { ServerEnv } from '../src/config/env';

const env: ServerEnv = {
  port: 8787,
  llmProvider: 'coze',
  llmBaseUrl: '',
  llmApiKey: '',
  llmModel: '',
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
  xfyunAsrEnabled: false,
  xfyunAsrAppId: '',
  xfyunAsrApiKey: '',
  xfyunAsrApiSecret: '',
  xfyunAsrUrl: 'wss://iat-api.xfyun.cn/v2/iat',
  xfyunTtsAppId: '',
  xfyunTtsApiKey: '',
  xfyunTtsApiSecret: '',
  xfyunTtsUrl: 'wss://tts-api.xfyun.cn/v2/tts',
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
  vi.restoreAllMocks();
});

describe('coze client', () => {
  it('posts a streaming chat request and emits Coze message deltas', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          streamFromText(
            [
              'event:conversation.message.delta',
              'data: {"content":"你好，"}',
              '',
              'event:conversation.message.delta',
              'data: {"content":"我是景区导游。"}',
              '',
              'event:conversation.chat.completed',
              'data: {"status":"completed"}',
              ''
            ].join('\n')
          ),
          { status: 200 }
        )
      );
    vi.stubGlobal('fetch', fetchMock);
    const deltas: string[] = [];

    const answer = await chatWithCozeStream(
      [
        { role: 'system', content: '你是景区导游智能体。' },
        { role: 'user', content: '介绍一下你自己' }
      ],
      env,
      (delta) => deltas.push(delta)
    );

    expect(answer).toBe('你好，我是景区导游。');
    expect(deltas).toEqual(['你好，', '我是景区导游。']);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.coze.cn/v3/chat',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer coze-token',
          'Content-Type': 'application/json'
        }
      })
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      bot_id: 'bot-123',
      user_id: 'wyj-test-user',
      stream: true,
      auto_save_history: false,
      additional_messages: [
        {
          role: 'user',
          type: 'question',
          content_type: 'text',
          content: expect.stringContaining('介绍一下你自己')
        }
      ]
    });
  });

  it('requires a token and bot id before calling Coze', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      chatWithCozeStream([{ role: 'user', content: '黄山怎么玩' }], {
        ...env,
        cozeApiToken: '',
        cozeBotId: ''
      })
    ).rejects.toThrow('Coze configuration is missing');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('routes generic LLM streaming calls to Coze when selected as provider', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          streamFromText(
            [
              'event:conversation.message.delta',
              'data: {"content":"黄山路线"}',
              '',
              'event:conversation.chat.completed',
              'data: {"status":"completed"}',
              ''
            ].join('\n')
          ),
          { status: 200 }
        )
      );
    vi.stubGlobal('fetch', fetchMock);
    const deltas: string[] = [];

    const answer = await chatWithLlmStream(
      [{ role: 'user', content: '黄山怎么玩' }],
      env,
      (delta) => deltas.push(delta)
    );

    expect(answer).toBe('黄山路线');
    expect(deltas).toEqual(['黄山路线']);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.coze.cn/v3/chat');
  });

  it('ignores non-answer Coze message content in the visible reply', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          streamFromText(
            [
              'event:conversation.message.delta',
              'data: {"type":"function_call","content":"internal tool payload"}',
              '',
              'event:conversation.message.delta',
              'data: {"type":"answer","content":"推荐西湖晨游"}',
              ''
            ].join('\n')
          ),
          { status: 200 }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    const answer = await chatWithCozeStream(
      [{ role: 'user', content: '西湖怎么玩' }],
      env,
      () => undefined
    );

    expect(answer).toBe('推荐西湖晨游');
  });

  it('does not duplicate the completed full answer after streaming deltas', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          streamFromText(
            [
              'event:conversation.message.delta',
              'data: {"type":"answer","content":"推荐西湖"}',
              '',
              'event:conversation.message.delta',
              'data: {"type":"answer","content":"晨游。"}',
              '',
              'event:conversation.message.completed',
              'data: {"type":"answer","content":"推荐西湖晨游。"}',
              ''
            ].join('\n')
          ),
          { status: 200 }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    const answer = await chatWithCozeStream(
      [{ role: 'user', content: '西湖怎么玩' }],
      env,
      () => undefined
    );

    expect(answer).toBe('推荐西湖晨游。');
  });

  it('uploads data URL images and sends Coze object_string image content', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 0, data: { id: 'coze-file-123' } }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(
          streamFromText(
            [
              'event:conversation.message.delta',
              'data: {"type":"answer","content":"这张图展示了景区入口。"}',
              ''
            ].join('\n')
          ),
          { status: 200 }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    const answer = await chatWithCozeStream(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: '请分析这张图片' },
            {
              type: 'image_url',
              image_url: { url: 'data:image/png;base64,aGVsbG8=', detail: 'auto' }
            }
          ]
        }
      ],
      env,
      () => undefined
    );

    expect(answer).toBe('这张图展示了景区入口。');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.coze.cn/v1/files/upload');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ Authorization: 'Bearer coze-token' });
    expect(fetchMock.mock.calls[0][1].body).toBeInstanceOf(FormData);

    const chatBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(chatBody.additional_messages[0]).toMatchObject({
      role: 'user',
      type: 'question',
      content_type: 'object_string'
    });
    expect(JSON.parse(chatBody.additional_messages[0].content)).toEqual([
      { type: 'text', text: '用户问题：请分析这张图片' },
      { type: 'image', file_id: 'coze-file-123' }
    ]);
  });

  it('downsizes large images before uploading them to Coze', async () => {
    const original = await sharp({
      create: {
        width: 2_400,
        height: 1_600,
        channels: 3,
        background: { r: 40, g: 120, b: 90 }
      }
    })
      .png()
      .toBuffer();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 0, data: { id: 'coze-file-optimized' } }), {
          status: 200
        })
      )
      .mockResolvedValueOnce(
        new Response(
          streamFromText(
            'event:conversation.message.delta\ndata: {"type":"answer","content":"图片分析完成"}\n\n'
          ),
          { status: 200 }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    await chatWithCozeStream(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: '分析图片' },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${original.toString('base64')}` }
            }
          ]
        }
      ],
      env,
      () => undefined
    );

    const uploadBody = fetchMock.mock.calls[0][1].body as FormData;
    const uploadedFile = uploadBody.get('file') as File;
    const optimized = Buffer.from(await uploadedFile.arrayBuffer());
    const metadata = await sharp(optimized).metadata();

    expect(metadata.width).toBeLessThanOrEqual(512);
    expect(metadata.height).toBeLessThanOrEqual(512);
    expect(optimized.byteLength).toBeLessThan(original.byteLength);
  });
});
