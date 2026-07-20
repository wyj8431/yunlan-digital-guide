import type { ServerEnv } from '../../config/env.js';

type ChatCompletionMessage = {
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
