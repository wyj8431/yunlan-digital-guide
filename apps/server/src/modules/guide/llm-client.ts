import type { ServerEnv } from '../../config/env.js';

export type ChatCompletionMessage = {
  role: 'system' | 'user';
  content: string;
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

export const chatWithLlm: LlmChat = async (messages, env) => {
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

function parseStreamChunk(chunk: string): string[] {
  return chunk
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s*/, ''))
    .filter((line) => line && line !== '[DONE]');
}

export const chatWithLlmStream: LlmChatStream = async (messages, env, onDelta, signal) => {
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
