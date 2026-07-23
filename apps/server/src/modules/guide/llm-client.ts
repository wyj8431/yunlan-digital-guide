import type { ServerEnv } from '../../config/env.js';
import { chatWithCoze, chatWithCozeStream } from './coze-client.js';

export type ChatCompletionMessage = {
  role: 'system' | 'user';
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }
      >;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export type LlmChat = (messages: ChatCompletionMessage[], env: ServerEnv) => Promise<string>;

export type LlmChatStream = (
  messages: ChatCompletionMessage[],
  env: ServerEnv,
  onDelta: (delta: string) => void,
  signal?: AbortSignal
) => Promise<string>;

const HYBRID_PRIMARY_TIMEOUT_MS = 15_000;
const HYBRID_PRIMARY_IMAGE_TIMEOUT_MS = 60_000;

function usesCozeProvider(env: ServerEnv): boolean {
  return env.llmProvider === 'coze';
}

function usesHybridProvider(env: ServerEnv): boolean {
  return env.llmProvider === 'hybrid';
}

function messagesHaveImage(messages: ChatCompletionMessage[]): boolean {
  return messages.some(
    (message) =>
      Array.isArray(message.content) && message.content.some((part) => part.type === 'image_url')
  );
}

function getHybridPrimaryTimeoutMs(messages: ChatCompletionMessage[]): number {
  return messagesHaveImage(messages) ? HYBRID_PRIMARY_IMAGE_TIMEOUT_MS : HYBRID_PRIMARY_TIMEOUT_MS;
}

function createTimedOperation<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  parentSignal: AbortSignal | undefined,
  timeoutMs: number
) {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
    rejectTimeout(new Error('Coze hybrid request timed out'));
  }, timeoutMs);
  const abortFromParent = () => controller.abort(parentSignal?.reason);
  let rejectTimeout: (error: Error) => void = () => undefined;

  if (parentSignal?.aborted) {
    abortFromParent();
  } else {
    parentSignal?.addEventListener('abort', abortFromParent, { once: true });
  }

  const primaryPromise = operation(controller.signal);
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    rejectTimeout = reject;
  });
  primaryPromise.catch(() => undefined);

  return {
    promise: Promise.race([primaryPromise, timeoutPromise]),
    get timedOut() {
      return timedOut;
    },
    clear() {
      clearTimeout(timeoutId);
      parentSignal?.removeEventListener('abort', abortFromParent);
    }
  };
}

const chatWithOpenAiCompatible: LlmChat = async (messages, env) => {
  const response = await fetch(`${env.llmBaseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.llmApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: env.llmModel,
      messages,
      temperature: 0.4
    })
  });

  if (!response.ok) {
    throw new Error(`LLM request failed with status ${response.status}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error('LLM response did not include content');
  }

  return content;
};

export const chatWithLlm: LlmChat = async (messages, env) => {
  if (usesCozeProvider(env)) {
    return chatWithCoze(messages, env);
  }

  if (usesHybridProvider(env)) {
    const primary = createTimedOperation(
      (primarySignal) => chatWithCozeStream(messages, env, () => undefined, primarySignal),
      undefined,
      getHybridPrimaryTimeoutMs(messages)
    );

    try {
      return await primary.promise;
    } catch {
      return chatWithOpenAiCompatible(messages, env);
    } finally {
      primary.clear();
    }
  }

  return chatWithOpenAiCompatible(messages, env);
};

function parseStreamChunk(chunk: string): string[] {
  return chunk
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s*/, ''))
    .filter((line) => line && line !== '[DONE]');
}

const chatWithOpenAiCompatibleStream: LlmChatStream = async (messages, env, onDelta, signal) => {
  const response = await fetch(`${env.llmBaseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.llmApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: env.llmModel,
      messages,
      temperature: 0.4,
      stream: true
    }),
    signal
  });

  if (!response.ok) {
    throw new Error(`LLM stream request failed with status ${response.status}`);
  }

  if (!response.body) {
    throw new Error('LLM stream response did not include a body');
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
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      for (const payload of parseStreamChunk(part)) {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
        };
        const delta =
          parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content ?? '';

        if (delta) {
          answer += delta;
          onDelta(delta);
        }
      }
    }
  }

  for (const payload of parseStreamChunk(buffer)) {
    const parsed = JSON.parse(payload) as {
      choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
    };
    const delta =
      parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content ?? '';

    if (delta) {
      answer += delta;
      onDelta(delta);
    }
  }

  const content = answer.trim();

  if (!content) {
    throw new Error('LLM stream response did not include content');
  }

  return content;
};

export const chatWithLlmStream: LlmChatStream = async (messages, env, onDelta, signal) => {
  if (usesCozeProvider(env)) {
    return chatWithCozeStream(messages, env, onDelta, signal);
  }

  if (usesHybridProvider(env)) {
    const primaryDeltas: string[] = [];
    const primary = createTimedOperation(
      (primarySignal) =>
        chatWithCozeStream(messages, env, (delta) => primaryDeltas.push(delta), primarySignal),
      signal,
      getHybridPrimaryTimeoutMs(messages)
    );

    try {
      const answer = await primary.promise;
      primaryDeltas.forEach((delta) => onDelta(delta));

      return answer;
    } catch {
      if (signal?.aborted && !primary.timedOut) {
        throw new Error('LLM stream request was aborted');
      }

      return chatWithOpenAiCompatibleStream(messages, env, onDelta, signal);
    } finally {
      primary.clear();
    }
  }

  return chatWithOpenAiCompatibleStream(messages, env, onDelta, signal);
};
