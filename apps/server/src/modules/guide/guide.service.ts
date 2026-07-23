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

export type GuideImageAttachment = {
  name?: string;
  mimeType: string;
  dataUrl: string;
};

export type GuideChatResponse = {
  answer: string;
  cards: RouteCard[];
  source: 'llm' | 'local-fallback';
  speechTimeline: GuideSpeechTimeline;
};

export class GuideServiceError extends Error {
  constructor(
    public readonly code:
      | 'EMPTY_MESSAGE'
      | 'INVALID_IMAGE'
      | 'IMAGE_TOO_LARGE'
      | 'LLM_CONFIG_MISSING'
      | 'LLM_REQUEST_FAILED',
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

type CreateGuideResponseInput = {
  message: string;
  env: ServerEnv;
  image?: GuideImageAttachment | null;
  scenicData?: ScenicData;
  chat?: LlmChat;
};

type CreateGuideStreamResponseInput = CreateGuideResponseInput & {
  streamChat?: LlmChatStream;
  onDelta: (delta: string) => void;
  signal?: AbortSignal;
};

const MAX_IMAGE_DATA_URL_LENGTH = 6_000_000;
const SUPPORTED_IMAGE_DATA_URL = /^data:image\/(png|jpeg|jpg|webp);base64,[a-z0-9+/=\r\n]+$/i;
const SCENIC_TOURISM_KEYWORDS = [
  '景区',
  '景点',
  '旅游',
  '旅行',
  '游玩',
  '游览',
  '导游',
  '导览',
  '路线',
  '行程',
  '攻略',
  '一日游',
  '半日游',
  '几日游',
  '门票',
  '票务',
  '购票',
  '开放时间',
  '打卡',
  '拍照',
  '游客',
  '亲子游',
  '自驾',
  '索道',
  '缆车',
  '停车',
  '换乘',
  '夜游',
  '讲解',
  '古镇',
  '古城',
  '古村',
  '水乡',
  '博物馆',
  '美术馆',
  '公园',
  '乐园',
  '寺庙',
  '遗址',
  '世界遗产',
  '黄山',
  '泰山',
  '华山',
  '张家界',
  '九寨沟',
  '峨眉山',
  '故宫',
  '长城',
  '西湖',
  '迪士尼',
  '环球影城',
  '卢浮宫',
  '埃菲尔',
  '富士山',
  '乌镇',
  '东栅',
  '西栅',
  'route',
  'travel',
  'tour',
  'tourism',
  'ticket',
  'attraction',
  'museum',
  'park',
  'resort'
];
const NON_TOURISM_KEYWORDS = [
  '股票',
  '交易策略',
  '基金',
  '期货',
  '币圈',
  '二叉树',
  '算法',
  '代码',
  '编程',
  '写论文',
  '作业答案',
  '医疗诊断',
  '法律意见'
];
const TRAVEL_DESTINATION_KEYWORDS = [
  '北京',
  '上海',
  '天津',
  '重庆',
  '河北',
  '山西',
  '内蒙古',
  '辽宁',
  '吉林',
  '黑龙江',
  '江苏',
  '浙江',
  '安徽',
  '福建',
  '江西',
  '山东',
  '河南',
  '湖北',
  '湖南',
  '广东',
  '广西',
  '海南',
  '四川',
  '贵州',
  '云南',
  '西藏',
  '陕西',
  '甘肃',
  '青海',
  '宁夏',
  '新疆',
  '香港',
  '澳门',
  '台湾',
  '太原',
  '大同',
  '平遥',
  '忻州',
  '五台山',
  '壶口瀑布',
  '云冈石窟',
  '杭州',
  '苏州',
  '南京',
  '成都',
  '西安',
  '桂林',
  '丽江',
  '厦门',
  '青岛',
  '洛阳'
];
const AMBIGUOUS_TRAVEL_PATTERNS = [
  /怎么(安排|玩|逛|走)/,
  /(去哪|哪里).*(玩|逛|拍)/,
  /(去|到|想去|准备去|打算去).{1,12}(玩|旅游|旅行|游玩|逛|路线|攻略|行程)/,
  /\d+\s*(天|日).*(游|行程|路线|攻略)/,
  /(附近|周边).*(玩|逛|吃|住|拍)/
];
const SCENIC_REFUSAL_ANSWER =
  '我只能回答景区旅游相关问题，比如全球景点攻略、路线规划、门票开放时间、交通住宿、拍照打卡、亲子游和图片里的景区线索。';
const GUIDE_INTRO_ANSWER =
  '你好，我是你的全球景区旅游数字导游，可以介绍自己、推荐各地区好玩的景区，帮你规划路线、查门票开放时间、做亲子游和拍照打卡建议。';
const REGIONAL_RECOMMENDATION_ANSWER =
  '推荐路线可以先这样选：华北走北京故宫-长城一日文化线；华东走杭州西湖-乌镇水乡两日线；西南走成都-峨眉山-乐山三日线；华南走桂林漓江-阳朔两日线；西北走西安兵马俑-华山两日线。';

function pickRoute(message: string, scenicData: ScenicData) {
  const normalized = message.toLowerCase();

  if (message.includes('亲子') || message.includes('孩子') || normalized.includes('family')) {
    return scenicData.routes.find((route) => route.id === 'family-easy') ?? scenicData.routes[0];
  }

  if (message.includes('一天') || message.includes('一日') || message.includes('东西栅')) {
    return (
      scenicData.routes.find((route) => route.id === 'one-day-east-west') ?? scenicData.routes[0]
    );
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

function isLocalScenicQuestion(message: string, scenicData: ScenicData) {
  const localTerms = [
    scenicData.scenicArea.name,
    scenicData.scenicArea.location,
    ...scenicData.spots.map((spot) => spot.name),
    ...scenicData.routes.map((route) => route.name),
    '乌镇',
    '东栅',
    '西栅',
    '水乡'
  ].filter(Boolean);

  return localTerms.some((term) => message.includes(term as string));
}

function isGuideGreetingOrIntro(message: string) {
  const normalized = message.trim().toLowerCase();

  return (
    ['你好', '您好', 'hello', 'hi', '嗨'].includes(normalized) ||
    /介绍(一下)?(你自己|自己)/.test(message) ||
    /你是谁|你能做什么|有什么功能/.test(message)
  );
}

function asksRegionalScenicRecommendations(message: string) {
  return (
    /(各个|全国|国内|世界|全球|热门|不同).*(地区|城市|地方|景区|景点).*(推荐|好玩|路线|攻略)/.test(
      message
    ) || /(推荐|介绍).*(景区|景点).*(路线|行程|攻略)/.test(message)
  );
}

function asksDestinationTravel(message: string) {
  const mentionsDestination = TRAVEL_DESTINATION_KEYWORDS.some((destination) =>
    message.includes(destination)
  );
  const hasTravelIntent = /(去|到|想去|准备去|打算去|玩|旅游|旅行|游玩|逛|路线|攻略|行程)/.test(
    message
  );

  return mentionsDestination && hasTravelIntent;
}

function isScenicTourismQuestion(message: string, image?: GuideImageAttachment | null) {
  const normalized = message.trim().toLowerCase();

  if (!normalized) {
    return Boolean(image);
  }

  const hasScenicKeyword = SCENIC_TOURISM_KEYWORDS.some((keyword) =>
    normalized.includes(keyword.toLowerCase())
  );

  if (hasScenicKeyword) {
    return true;
  }

  const looksNonTourism = NON_TOURISM_KEYWORDS.some((keyword) =>
    normalized.includes(keyword.toLowerCase())
  );

  if (looksNonTourism) {
    return false;
  }

  if (isGuideGreetingOrIntro(message)) {
    return true;
  }

  if (asksDestinationTravel(message)) {
    return true;
  }

  if (image && /图|图片|照片|截图|看一下|分析/.test(message)) {
    return true;
  }

  return AMBIGUOUS_TRAVEL_PATTERNS.some((pattern) => pattern.test(message));
}

function createScenicRefusalResponse(): GuideChatResponse {
  return {
    answer: SCENIC_REFUSAL_ANSWER,
    cards: [],
    source: 'local-fallback',
    speechTimeline: createGuideSpeechTimeline(SCENIC_REFUSAL_ANSWER)
  };
}

function buildRelevantRouteCards(
  message: string,
  scenicData: ScenicData,
  image?: GuideImageAttachment | null
) {
  if (!isLocalScenicQuestion(message, scenicData) && !image) {
    return [];
  }

  return buildRouteCards(pickRoute(message, scenicData));
}

function createLocalFallbackAnswer(
  message: string,
  scenicData: ScenicData,
  image?: GuideImageAttachment | null
): GuideChatResponse {
  const route = pickRoute(message, scenicData);
  const isLocalQuestion = isLocalScenicQuestion(message, scenicData);
  const photoSpots = scenicData.spots
    .filter((spot) => ['xizha-street', 'water-market', 'wuzhen-grand-theater'].includes(spot.id))
    .map((spot) => spot.name)
    .join('、');

  let answer = `${scenicData.scenicArea.name}参考开放时间为 ${scenicData.scenicArea.openingHours}，${scenicData.scenicArea.ticketInfo}`;

  if (isGuideGreetingOrIntro(message)) {
    answer = GUIDE_INTRO_ANSWER;
  } else if (asksRegionalScenicRecommendations(message)) {
    answer = REGIONAL_RECOMMENDATION_ANSWER;
  } else if (image) {
    answer =
      '我已经收到图片，但当前后端没有可用的视觉大模型配置，暂时只能根据乌镇景区资料回答。配置支持图片理解的 LLM 后，我可以分析图片里的建筑、水乡元素、路牌或票务截图。';
  } else if (!isLocalQuestion) {
    answer =
      '这是景区旅游相关问题。当前离线模式只内置乌镇景区资料；接入后台智能体后，我可以继续回答全球景区路线、门票、交通、拍照和游玩建议。';
  } else if (message.includes('路线') || message.includes('半日') || message.includes('游览')) {
    answer = `可以走“${route.name}”：${route.description} 建议按路线卡片顺序游览，全程 ${route.duration} 左右。`;
  } else if (message.includes('拍照') || message.includes('照片') || message.includes('打卡')) {
    answer = `适合拍照的位置有${photoSpots || '西栅老街、水上集市'}。傍晚到西栅看灯影和水面倒影，画面层次会更好。`;
  } else if (message.includes('亲子') || message.includes('孩子')) {
    answer = `亲子游建议走“${route.name}”：少走回头路，优先安排水上集市、短距离街巷慢行、错峰用餐和夜景前休息。`;
  } else if (message.includes('开放') || message.includes('门票') || message.includes('价格')) {
    answer = `${scenicData.scenicArea.name}参考开放时间是 ${scenicData.scenicArea.openingHours}，${scenicData.scenicArea.ticketInfo}`;
  }

  return {
    answer,
    cards: isLocalQuestion || image ? buildRouteCards(route) : [],
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

export function normalizeGuideImage(input: unknown): GuideImageAttachment | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const image = input as Partial<GuideImageAttachment>;
  const dataUrl = typeof image.dataUrl === 'string' ? image.dataUrl.trim() : '';
  const mimeType = typeof image.mimeType === 'string' ? image.mimeType.trim().toLowerCase() : '';

  if (!dataUrl && !mimeType) {
    return null;
  }

  if (dataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
    throw new GuideServiceError('IMAGE_TOO_LARGE', '图片太大，请压缩到 4MB 以内再发送。', 413);
  }

  if (!SUPPORTED_IMAGE_DATA_URL.test(dataUrl) || !/^image\/(png|jpeg|jpg|webp)$/i.test(mimeType)) {
    throw new GuideServiceError('INVALID_IMAGE', '仅支持 PNG、JPG 或 WebP 图片。', 400);
  }

  return {
    name: typeof image.name === 'string' ? image.name.slice(0, 80) : undefined,
    mimeType,
    dataUrl
  };
}

function buildScenicAgentContext(scenicData: ScenicData): string {
  return JSON.stringify(
    {
      scenicArea: scenicData.scenicArea,
      spots: scenicData.spots,
      routes: scenicData.routes,
      services: scenicData.services,
      faqs: scenicData.faqs
    },
    null,
    2
  );
}

function buildGuideMessages(
  trimmed: string,
  scenicData: ScenicData,
  image?: GuideImageAttachment | null
): ChatCompletionMessage[] {
  const scenicContext = buildScenicAgentContext(scenicData);
  const shouldUseLocalScenicContext = !image || isLocalScenicQuestion(trimmed, scenicData);
  const userText = image
    ? [
        trimmed ||
          '请识别这张图片里的景区旅游线索，在全球范围内推断可能的位置，并推荐游玩项目和旅游路线。',
        `图片文件名：${image.name ?? '未命名图片'}`,
        '请按“图片内容、最可能位置、备选位置、推荐游玩项目、建议路线、注意事项”回答。',
        '如果无法唯一确定地点，也必须先给出一个最可能位置，再给 1-2 个备选位置和判断依据，不要只说当前内置资料没有记录。'
      ].join('\n')
    : trimmed;

  const userContent: ChatCompletionMessage['content'] = image
    ? [
        { type: 'text', text: userText },
        { type: 'image_url', image_url: { url: image.dataUrl, detail: 'auto' } }
      ]
    : userText;

  return [
    {
      role: 'system',
      content: [
        '你是全球景区旅游智能体，也是当前项目的后台智能体和 AI 数字导游。',
        '你的任务是回答世界范围内游客关于景区、景点、旅游路线、开放时间、票务、交通住宿、服务、拍照点、亲子游和图片内容的问题。',
        '当用户寒暄或让你介绍自己时，要先介绍你是全球景区旅游数字导游，并主动说明你可以推荐各地区好玩的景区和旅游路线。',
        '当用户询问各地区、全国、全球、热门景区推荐时，要按地区给出景区建议和可执行旅游路线，而不是只说能力范围。',
        '只回答景区旅游相关问题；如果用户提问与景区旅游无关，必须礼貌拒答，并说明“我只能回答景区旅游相关问题”。',
        shouldUseLocalScenicContext
          ? '当前项目内置景区资料是乌镇景区资料。用户问乌镇、东栅、西栅或内置资料覆盖内容时，优先基于这些资料回答；资料没有明确记录时，要说“当前资料里没有明确记录”。'
          : '这次用户上传图片要求全球范围识别。不要把图片地点限定为乌镇或当前项目内置景区资料；即使内置资料没有记录，也要基于图片可见线索和通用旅游知识给出候选位置、游玩项目和路线建议。',
        '用户问世界范围内其他景区旅游问题时，可以基于通用旅游知识回答；涉及事实可能变化时，要提醒以目的地官方当天公告或官方购票页为准。',
        '涉及票价、开放时间、优惠政策、演出排期等可能变化的信息，必须提醒以官方当天公告或官方购票页为准。',
        '分析图片时，先描述看得见的内容，再在全球范围内推断地点；要同时匹配画面里的多个线索，例如观音立像、湖景、亭台、广场、山体、建筑风格，不要只根据单个元素下结论。',
        '图片定位回答必须先给“最可能位置”，再给备选位置；如果不确定，要用“可能是/候选是/置信度”表达，并说明判断依据。',
        '图片类回答必须包含可玩的项目和一条半日或一日路线，除非图片完全无法识别。',
        '回答要简洁、口语化，适合数字人朗读；图片路线类问题可以写到 220 字以内。',
        shouldUseLocalScenicContext
          ? `当前项目内置景区资料：${scenicContext}`
          : '当前项目内置景区资料：本次图片识别不使用内置乌镇资料作为限制条件。'
      ].join('\n')
    },
    { role: 'user', content: userContent }
  ];
}

export async function createGuideResponse({
  message,
  env,
  image,
  scenicData = loadScenicData(),
  chat = chatWithLlm
}: CreateGuideResponseInput): Promise<GuideChatResponse> {
  const trimmed = message.trim();

  if (!trimmed && !image) {
    throw new GuideServiceError('EMPTY_MESSAGE', '请输入想咨询的导游问题。');
  }

  if (!isScenicTourismQuestion(trimmed, image)) {
    return createScenicRefusalResponse();
  }

  if (!env.llmBaseUrl || !env.llmApiKey || !env.llmModel) {
    return createLocalFallbackAnswer(trimmed, scenicData, image);
  }

  try {
    const answer = await chat(buildGuideMessages(trimmed, scenicData, image), env);

    return {
      answer,
      cards: buildRelevantRouteCards(trimmed, scenicData, image),
      source: 'llm',
      speechTimeline: createGuideSpeechTimeline(answer)
    };
  } catch (caught) {
    if (caught instanceof GuideServiceError) {
      throw caught;
    }

    return createLocalFallbackAnswer(trimmed, scenicData, image);
  }
}

export async function createGuideStreamResponse({
  message,
  env,
  image,
  scenicData,
  chat,
  streamChat = chatWithLlmStream,
  onDelta,
  signal
}: CreateGuideStreamResponseInput): Promise<GuideChatResponse> {
  const trimmed = message.trim();
  const resolvedScenicData = scenicData ?? loadScenicData();

  if (!trimmed && !image) {
    throw new GuideServiceError('EMPTY_MESSAGE', '请输入想咨询的导游问题。');
  }

  if (!isScenicTourismQuestion(trimmed, image)) {
    const refusal = createScenicRefusalResponse();
    await emitAnswerDeltas(refusal.answer, onDelta, signal);
    return refusal;
  }

  if (!env.llmBaseUrl || !env.llmApiKey || !env.llmModel) {
    const response = await createGuideResponse({
      message,
      env,
      image,
      scenicData: resolvedScenicData,
      chat
    });
    await emitAnswerDeltas(response.answer, onDelta, signal);
    return response;
  }

  try {
    const answer = await streamChat(
      buildGuideMessages(trimmed, resolvedScenicData, image),
      env,
      onDelta,
      signal
    );

    return {
      answer,
      cards: buildRelevantRouteCards(trimmed, resolvedScenicData, image),
      source: 'llm',
      speechTimeline: createGuideSpeechTimeline(answer)
    };
  } catch (caught) {
    if (caught instanceof GuideServiceError || signal?.aborted) {
      throw caught;
    }

    const fallback = createLocalFallbackAnswer(trimmed, resolvedScenicData, image);
    await emitAnswerDeltas(fallback.answer, onDelta, signal);
    return fallback;
  }
}
