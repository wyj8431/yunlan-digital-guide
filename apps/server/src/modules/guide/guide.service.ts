import type { ServerEnv } from '../../config/env.js';
import type { ScenicData } from '../../types/scenic.js';
import { loadScenicData } from '../scenic/scenic-data.js';
import { chatWithLlm, type LlmChat } from './llm-client.js';

export type RouteCard = {
  type: 'route-step';
  title: string;
  duration: string;
  description: string;
};

export type GuideChatResponse = {
  answer: string;
  cards: RouteCard[];
  source: 'llm';
};

export class GuideServiceError extends Error {
  constructor(
    public readonly code: 'EMPTY_MESSAGE' | 'LLM_CONFIG_MISSING' | 'LLM_REQUEST_FAILED',
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

type CreateGuideResponseInput = {
  message: string;
  env: ServerEnv;
  scenicData?: ScenicData;
  chat?: LlmChat;
};

export async function createGuideResponse({
  message,
  env,
  scenicData = loadScenicData(),
  chat = chatWithLlm
}: CreateGuideResponseInput): Promise<GuideChatResponse> {
  const trimmed = message.trim();

  if (!trimmed) {
    throw new GuideServiceError('EMPTY_MESSAGE', '请输入想咨询的导游问题。');
  }

  if (!env.llmBaseUrl || !env.llmApiKey || !env.llmModel) {
    throw new GuideServiceError('LLM_CONFIG_MISSING', '后端尚未配置 LLM 服务，请检查 .env。', 503);
  }

  const route = scenicData.routes[0];
  const scenicContext = JSON.stringify(scenicData, null, 2);

  try {
    const answer = await chat(
      [
        {
          role: 'system',
          content: [
            '你是云岚古镇的 AI 数字导游。',
            '只能基于给定景区资料回答问题；资料没有明确记录时，要说明当前资料里没有明确记录。',
            '涉及路线推荐时，优先使用资料中已有路线，不编造开放时间、票价、医疗等关键事实。',
            `景区资料：${scenicContext}`
          ].join('\n')
        },
        { role: 'user', content: trimmed }
      ],
      env
    );

    return {
      answer,
      cards: route.steps.map((step) => ({
        type: 'route-step',
        title: step.title,
        duration: `${step.durationMinutes} 分钟`,
        description: step.description
      })),
      source: 'llm'
    };
  } catch (caught) {
    if (caught instanceof GuideServiceError) {
      throw caught;
    }

    throw new GuideServiceError(
      'LLM_REQUEST_FAILED',
      '数字导游暂时没有回答成功，请稍后再试。',
      502
    );
  }
}
