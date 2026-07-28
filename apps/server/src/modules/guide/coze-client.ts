import type { ServerEnv } from '../../config/env.js';
import sharp from 'sharp';
import type { ChatCompletionMessage, LlmChat, LlmChatStream } from './llm-client.js';

type CozeDeltaPayload = {
  type?: string;
  content?: string;
  delta?: {
    content?: string;
  };
  message?: {
    content?: string;
  };
  choices?: Array<{
    delta?: {
      content?: string;
    };
    message?: {
      content?: string;
    };
  }>;
};

type CozeUploadResponse = {
  code?: number;
  msg?: string;
  data?: {
    id?: string;
  };
};

type CozeObjectStringItem = { type: 'text'; text: string } | { type: 'image'; file_id: string };

function assertCozeConfig(env: ServerEnv): void {
  if (!env.cozeApiToken || !env.cozeBotId) {
    throw new Error('Coze configuration is missing: COZE_API_TOKEN and COZE_BOT_ID are required');
  }
}

function splitDataUrl(dataUrl: string): { mimeType: string; bytes: Uint8Array } {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/is);

  if (!match) {
    throw new Error('Coze image upload only supports base64 data URLs');
  }

  return {
    mimeType: match[1],
    bytes: Uint8Array.from(Buffer.from(match[2].replace(/\s/g, ''), 'base64'))
  };
}

type OptimizedCozeImage = {
  mimeType: string;
  extension: string;
  bytes: Uint8Array;
};

const COZE_IMAGE_MAX_EDGE = 512;

async function optimizeCozeImage(mimeType: string, bytes: Uint8Array): Promise<OptimizedCozeImage> {
  const normalizedMimeType = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
  const extension =
    normalizedMimeType === 'image/jpeg' ? 'jpg' : normalizedMimeType.split('/')[1] || 'png';

  if (
    bytes.byteLength < 128 ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(normalizedMimeType)
  ) {
    return { mimeType, extension, bytes };
  }

  try {
    const input = Buffer.from(bytes);
    const metadata = await sharp(input).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    if (width <= COZE_IMAGE_MAX_EDGE && height <= COZE_IMAGE_MAX_EDGE) {
      return { mimeType: normalizedMimeType, extension, bytes };
    }

    let pipeline = sharp(input).rotate().resize({
      width: COZE_IMAGE_MAX_EDGE,
      height: COZE_IMAGE_MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true
    });

    if (normalizedMimeType === 'image/jpeg') {
      pipeline = pipeline.jpeg({ quality: 82, progressive: true });
    } else if (normalizedMimeType === 'image/webp') {
      pipeline = pipeline.webp({ quality: 82, smartSubsample: true });
    } else {
      pipeline = pipeline.png({ compressionLevel: 8, adaptiveFiltering: true });
    }

    return {
      mimeType: normalizedMimeType,
      extension,
      bytes: Uint8Array.from(await pipeline.toBuffer())
    };
  } catch {
    // Invalid or unsupported test fixtures still follow the existing upload path.
    return { mimeType, extension, bytes };
  }
}

async function uploadCozeImage(dataUrl: string, env: ServerEnv): Promise<string> {
  const parsed = splitDataUrl(dataUrl);
  const optimized = await optimizeCozeImage(parsed.mimeType, parsed.bytes);
  const arrayBuffer = new ArrayBuffer(optimized.bytes.byteLength);
  new Uint8Array(arrayBuffer).set(optimized.bytes);
  const formData = new FormData();
  formData.append(
    'file',
    new Blob([arrayBuffer], { type: optimized.mimeType }),
    `guide-image.${optimized.extension}`
  );

  const response = await fetch(`${env.cozeApiBase.replace(/\/$/, '')}/v1/files/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.cozeApiToken}`
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Coze image upload failed with status ${response.status}`);
  }

  const data = (await response.json()) as CozeUploadResponse;
  const fileId = data.data?.id;

  if (data.code !== undefined && data.code !== 0) {
    throw new Error(`Coze image upload failed: ${data.msg ?? data.code}`);
  }

  if (!fileId) {
    throw new Error('Coze image upload did not include a file id');
  }

  return fileId;
}

function textFromMessageContent(content: ChatCompletionMessage['content']): string {
  if (typeof content === 'string') {
    return content;
  }

  return content
    .map((part) => {
      if (part.type === 'text') {
        return part.text;
      }

      return `用户上传了一张图片：${part.image_url.url}`;
    })
    .filter(Boolean)
    .join('\n');
}

async function buildCozeAdditionalMessage(messages: ChatCompletionMessage[], env: ServerEnv) {
  const objectItems: CozeObjectStringItem[] = [];
  let hasImage = false;

  for (const message of messages) {
    const prefix =
      message.role === 'system'
        ? '系统要求'
        : message.role === 'assistant'
          ? '导游历史回答'
          : '用户问题';

    if (typeof message.content === 'string') {
      objectItems.push({ type: 'text', text: `${prefix}：${message.content}` });
      continue;
    }

    const textParts = message.content
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .filter(Boolean);

    if (textParts.length > 0) {
      objectItems.push({ type: 'text', text: `${prefix}：${textParts.join('\n')}` });
    }

    for (const part of message.content) {
      if (part.type === 'image_url') {
        hasImage = true;
        objectItems.push({
          type: 'image',
          file_id: await uploadCozeImage(part.image_url.url, env)
        });
      }
    }
  }

  if (hasImage) {
    return {
      role: 'user',
      type: 'question',
      content: JSON.stringify(objectItems),
      content_type: 'object_string'
    };
  }

  return {
    role: 'user',
    type: 'question',
    content: messages
      .map((message) => {
        const prefix =
          message.role === 'system'
            ? '系统要求'
            : message.role === 'assistant'
              ? '导游历史回答'
              : '用户问题';

        return `${prefix}：${textFromMessageContent(message.content)}`;
      })
      .join('\n\n'),
    content_type: 'text'
  };
}

function parseSseEvent(chunk: string): { eventName: string; payloads: string[] } {
  const lines = chunk.split('\n').map((line) => line.trim());
  const eventName = lines.find((line) => line.startsWith('event:'))?.replace(/^event:\s*/, '');
  const dataLines = chunk
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s*/, ''));

  return {
    eventName: eventName ?? '',
    payloads:
      dataLines.length > 0
        ? [dataLines.join('\n')].filter((payload) => payload && payload !== '[DONE]')
        : []
  };
}

function readDeltaFromPayload(payload: string): string {
  const parsed = JSON.parse(payload) as CozeDeltaPayload;

  if (parsed.type && parsed.type !== 'answer') {
    return '';
  }

  return (
    parsed.content ??
    parsed.delta?.content ??
    parsed.message?.content ??
    parsed.choices?.[0]?.delta?.content ??
    parsed.choices?.[0]?.message?.content ??
    ''
  );
}

export const chatWithCozeStream: LlmChatStream = async (messages, env, onDelta, signal) => {
  assertCozeConfig(env);
  const additionalMessage = await buildCozeAdditionalMessage(messages, env);

  const response = await fetch(`${env.cozeApiBase.replace(/\/$/, '')}/v3/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.cozeApiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      bot_id: env.cozeBotId,
      user_id: env.cozeUserId,
      stream: true,
      auto_save_history: false,
      additional_messages: [additionalMessage]
    }),
    signal
  });

  if (!response.ok) {
    throw new Error(`Coze stream request failed with status ${response.status}`);
  }

  if (!response.body) {
    throw new Error('Coze stream response did not include a body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const event of events) {
      const parsedEvent = parseSseEvent(event);

      if (parsedEvent.eventName !== 'conversation.message.delta') {
        continue;
      }

      for (const payload of parsedEvent.payloads) {
        const delta = readDeltaFromPayload(payload);

        if (delta) {
          answer += delta;
          onDelta(delta);
        }
      }
    }
  }

  const parsedEvent = parseSseEvent(buffer);

  if (parsedEvent.eventName === 'conversation.message.delta') {
    for (const payload of parsedEvent.payloads) {
      const delta = readDeltaFromPayload(payload);

      if (delta) {
        answer += delta;
        onDelta(delta);
      }
    }
  }

  const content = answer.trim();

  if (!content) {
    throw new Error('Coze stream response did not include content');
  }

  return content;
};

export const chatWithCoze: LlmChat = async (messages, env) =>
  chatWithCozeStream(messages, env, () => undefined);
