import type { ServerEnv } from '../../config/env.js';
import type { ScenicData } from '../../types/scenic.js';
import { loadScenicData } from '../scenic/scenic-data.js';
import {
  chatWithLlm,
  chatWithLlmStream,
  type ChatCompletionMessage,
  type LlmChat,
  type LlmChatStream
} from './llm-client.js';
import { createGuideSpeechTimeline, type GuideSpeechTimeline } from './speech-timeline.js';

export type RouteCard = {
  type: 'route-step';
  title: string;
  duration: string;
  description: string;
};

export type GuideChatResponse = {
  answer: string;
  cards: RouteCard[];
  source: 'llm' | 'local-fallback';
  speechTimeline: GuideSpeechTimeline;
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

type CreateGuideStreamResponseInput = CreateGuideResponseInput & {
  streamChat?: LlmChatStream;
  onDelta: (delta: string) => void;
  signal?: AbortSignal;
};

function pickRoute(message: string, scenicData: ScenicData) {
  const normalized = message.toLowerCase();

  if (message.includes('亲子') || message.includes('孩子') || normalized.includes('family')) {
    return scenicData.routes.find((route) => route.id === 'family-easy') ?? scenicData.routes[0];
  }

  return scenicData.routes[0];
}

function buildRouteCards(route: ScenicData['routes'][number]): RouteCard[] {
  return route.steps.map((step) => ({
    type: 'route-step',
    title: step.title,
    duration: `${step.durationMinutes} 分钟`,
    description: step.description
  }));
}

function createLocalFallbackAnswer(message: string, scenicData: ScenicData): GuideChatResponse {
  const route = pickRoute(message, scenicData);
  const photoSpots = scenicData.spots
    .filter((spot) => spot.id === 'yunlan-bridge' || spot.id === 'river-lantern-lane')
    .map((spot) => spot.name)
    .join('、');

  let answer = `${scenicData.scenicArea.name}开放时间为 ${scenicData.scenicArea.openingHours}，${scenicData.scenicArea.ticketInfo}`;

  if (message.includes('路线') || message.includes('半日') || message.includes('游览')) {
    answer = `可以走“${route.name}”：${route.description} 建议按路线卡片顺序游览，全程 ${route.duration} 左右。`;
  } else if (message.includes('拍照') || message.includes('照片') || message.includes('打卡')) {
    answer = `适合拍照的位置有${photoSpots || '云岚古桥、河畔灯巷'}。傍晚去河畔灯巷，灯影和水面倒影会更有层次。`;
  } else if (message.includes('亲子') || message.includes('孩子')) {
    answer = `亲子游建议走“${route.name}”：少走回头路，优先安排茶坊手作、河畔慢行和听雨戏台休息。`;
  } else if (message.includes('开放') || message.includes('门票') || message.includes('价格')) {
    answer = `${scenicData.scenicArea.name}开放时间是 ${scenicData.scenicArea.openingHours}，${scenicData.scenicArea.ticketInfo}`;
  }

  return {
    answer,
    cards: buildRouteCards(route),
    source: 'local-fallback',
    speechTimeline: createGuideSpeechTimeline(answer)
  };
}

async function emitAnswerDeltas(
  answer: string,
  onDelta: (delta: string) => void,
  signal?: AbortSignal
) {
  const characters = Array.from(answer);

  for (let index = 0; index < characters.length; index += 4) {
    if (signal?.aborted) {
      throw new Error('GUIDE_STREAM_ABORTED');
    }

    onDelta(characters.slice(index, index + 4).join(''));

    if (index + 4 < characters.length) {
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
  }
}

function buildGuideMessages(trimmed: string, scenicData: ScenicData): ChatCompletionMessage[] {
  const scenicContext = JSON.stringify(scenicData, null, 2);

  return [
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
  ];
}

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

  const route = pickRoute(trimmed, scenicData);

  if (!env.llmBaseUrl || !env.llmApiKey || !env.llmModel) {
    return createLocalFallbackAnswer(trimmed, scenicData);
  }

  try {
    const answer = await chat(buildGuideMessages(trimmed, scenicData), env);

    return {
      answer,
      cards: buildRouteCards(route),
      source: 'llm',
      speechTimeline: createGuideSpeechTimeline(answer)
    };
  } catch (caught) {
    if (caught instanceof GuideServiceError) {
      throw caught;
    }

    return createLocalFallbackAnswer(trimmed, scenicData);
  }
}

export async function createGuideStreamResponse({
  message,
  env,
  scenicData,
  chat,
  streamChat = chatWithLlmStream,
  onDelta,
  signal
}: CreateGuideStreamResponseInput): Promise<GuideChatResponse> {
  const trimmed = message.trim();
  const resolvedScenicData = scenicData ?? loadScenicData();

  if (!trimmed) {
    throw new GuideServiceError('EMPTY_MESSAGE', '请输入想咨询的导游问题。');
  }

  if (!env.llmBaseUrl || !env.llmApiKey || !env.llmModel) {
    const response = await createGuideResponse({
      message,
      env,
      scenicData: resolvedScenicData,
      chat
    });
    await emitAnswerDeltas(response.answer, onDelta, signal);
    return response;
  }

  try {
    const route = pickRoute(trimmed, resolvedScenicData);
    const answer = await streamChat(
      buildGuideMessages(trimmed, resolvedScenicData),
      env,
      onDelta,
      signal
    );

    return {
      answer,
      cards: buildRouteCards(route),
      source: 'llm',
      speechTimeline: createGuideSpeechTimeline(answer)
    };
  } catch (caught) {
    if (caught instanceof GuideServiceError || signal?.aborted) {
      throw caught;
    }

    const fallback = createLocalFallbackAnswer(trimmed, resolvedScenicData);
    await emitAnswerDeltas(fallback.answer, onDelta, signal);
    return fallback;
  }
}
