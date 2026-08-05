// 从本地景区知识中召回与用户问题最相关的结构化片段。
import type { ScenicData } from '../../types/scenic.js';
import { destinationGuidePlanRecords, destinationPlanAliases } from './guide-knowledge-data.js';
import { formatProvinceTourismRecord, provinceTourismRecords } from './province-tourism-data.js';

export type GuideKnowledgeSource = 'destination-knowledge' | 'local-scenic';

export type GuideKnowledgeDocument = {
  id: string;
  title: string;
  source: GuideKnowledgeSource;
  content: string;
  keywords: string[];
};

export type RetrievedGuideKnowledge = GuideKnowledgeDocument & {
  score: number;
};

const GENERIC_INTENT_KEYWORDS = new Set(['景点', '拍照', '路线', '行程', '服务', '问答']);
const NATIONAL_RECOMMENDATION_KEYWORDS = ['全国', '各省', '国内推荐'];
const NATIONAL_REPRESENTATIVE_PROVINCES = ['北京', '山西', '上海', '湖南'];
const LIVE_SCENIC_INTENT_KEYWORDS = ['门票', '票价', '票务', '开放时间', '几点开放', '价格'];

function hasDetailedDestinationMention(message: string): boolean {
  return (
    destinationGuidePlanRecords.some((record) => message.includes(record.destination)) ||
    Object.keys(destinationPlanAliases).some((alias) => message.includes(alias))
  );
}

function findProvinceOnlyMention(message: string) {
  return provinceTourismRecords.find((record) => {
    const names = [record.province, ...record.aliases];
    const hasProvince = names.some((name) => message.includes(name));
    const hasAttraction = record.highlights.some((spot) => message.includes(spot.name));
    return hasProvince && !hasAttraction && !hasDetailedDestinationMention(message);
  });
}

function buildDestinationDocuments(): GuideKnowledgeDocument[] {
  return destinationGuidePlanRecords.map((record) => {
    const aliases = Object.entries(destinationPlanAliases)
      .filter(([, canonical]) => canonical === record.destination)
      .map(([alias]) => alias);

    return {
      id: `destination:${record.destination}`,
      title: record.destination,
      source: 'destination-knowledge',
      content: record.sections.join('\n'),
      keywords: [record.destination, ...aliases]
    };
  });
}

function buildProvinceTourismDocuments(): GuideKnowledgeDocument[] {
  return provinceTourismRecords.flatMap((record) => {
    const overview: GuideKnowledgeDocument = {
      id: `province:${record.province}`,
      title: `${record.province}旅游推荐`,
      source: 'destination-knowledge',
      content: formatProvinceTourismRecord(record),
      keywords: [record.province, ...record.aliases]
    };
    const attractions = record.highlights.map((spot) => ({
      id: `province-spot:${record.province}:${spot.name}`,
      title: `${spot.name}（${record.province}·${spot.city}）`,
      source: 'destination-knowledge' as const,
      content: [
        `${spot.name}位于${record.province}${spot.city}。`,
        spot.recommendation,
        `类型：${spot.categories.join('、')}。`,
        `所属省份概览：${record.summary}`,
        `推荐联游：${record.routes.join('；')}`,
        `注意事项：${record.tips}`
      ].join('\n'),
      keywords: [spot.name, spot.city, record.province, ...record.aliases, ...spot.categories]
    }));

    return [overview, ...attractions];
  });
}

function buildLocalScenicDocuments(scenicData: ScenicData): GuideKnowledgeDocument[] {
  const scenicArea = scenicData.scenicArea;
  const documents: GuideKnowledgeDocument[] = [
    {
      id: `local:scenic-area:${scenicArea.id}`,
      title: scenicArea.name,
      source: 'local-scenic',
      content: [
        scenicArea.description,
        `开放时间：${scenicArea.openingHours}`,
        `票务信息：${scenicArea.ticketInfo}`,
        scenicArea.location ? `位置：${scenicArea.location}` : '',
        scenicArea.sourceName ? `来源：${scenicArea.sourceName}` : ''
      ]
        .filter(Boolean)
        .join('\n'),
      keywords: [scenicArea.name, scenicArea.location ?? '', '乌镇', '东栅', '西栅'].filter(Boolean)
    },
    ...scenicData.spots.map((spot) => ({
      id: `local:spot:${spot.id}`,
      title: spot.name,
      source: 'local-scenic' as const,
      content: [spot.summary, spot.story, `建议停留：${spot.recommendedDurationMinutes} 分钟`].join(
        '\n'
      ),
      keywords: [spot.name, '乌镇', '景点', '拍照']
    })),
    ...scenicData.routes.map((route) => ({
      id: `local:route:${route.id}`,
      title: route.name,
      source: 'local-scenic' as const,
      content: [
        route.description,
        `推荐时长：${route.duration}`,
        ...route.steps.map(
          (step) => `${step.title}：${step.description}（${step.durationMinutes} 分钟）`
        )
      ].join('\n'),
      keywords: [route.name, '乌镇', '路线', '行程', route.id]
    })),
    ...scenicData.services.map((service) => ({
      id: `local:service:${service.id}`,
      title: service.name,
      source: 'local-scenic' as const,
      content: service.description,
      keywords: [service.name, service.type, '乌镇', '服务']
    })),
    ...scenicData.faqs.map((faq, index) => ({
      id: `local:faq:${index}`,
      title: faq.question,
      source: 'local-scenic' as const,
      content: faq.question.includes('门票')
        ? `官方实时票务信息：${scenicArea.ticketInfo}`
        : faq.question.includes('开放')
          ? `官方实时开放时间：${scenicArea.openingHours}`
          : faq.answer,
      keywords: [faq.question, '乌镇', '问答']
    }))
  ];

  return documents;
}

function scoreDocument(message: string, document: GuideKnowledgeDocument): number {
  const normalizedMessage = message.toLowerCase();
  const normalizedTitle = document.title.toLowerCase();
  const normalizedContent = document.content.toLowerCase();
  let score = 0;

  for (const rawKeyword of document.keywords) {
    const keyword = rawKeyword.trim().toLowerCase();

    if (!keyword) {
      continue;
    }

    if (GENERIC_INTENT_KEYWORDS.has(keyword)) {
      continue;
    }

    if (normalizedMessage.includes(keyword)) {
      score += keyword.length * 12;
      if (document.id.startsWith('province:')) {
        score += 120;
      }
      if (document.id.startsWith('destination:')) {
        score += 200;
      }
      if (document.id.startsWith('province-spot:')) {
        const spotName = document.id.split(':').slice(2).join(':').toLowerCase();
        if (keyword === spotName) {
          score += 100;
        }
      }
    } else if (keyword.includes(normalizedMessage) || normalizedTitle.includes(normalizedMessage)) {
      score += keyword.length * 4;
    }
  }

  if (normalizedMessage.includes(normalizedTitle)) {
    score += 80;
  }

  if (
    document.id.startsWith('local:scenic-area') &&
    LIVE_SCENIC_INTENT_KEYWORDS.some((keyword) => message.includes(keyword))
  ) {
    score += 180;
  }

  for (const token of normalizedMessage.split(/[，。！？、\s,.;:!?]+/).filter(Boolean)) {
    if (token.length < 2) {
      continue;
    }

    if (normalizedTitle.includes(token)) {
      score += 20;
    }

    if (normalizedContent.includes(token)) {
      score += 8;
    }
  }

  return score;
}

export function retrieveGuideKnowledge(
  message: string,
  scenicData: ScenicData,
  limit = 4
): RetrievedGuideKnowledge[] {
  const documents = [
    ...buildDestinationDocuments(),
    ...buildProvinceTourismDocuments(),
    ...buildLocalScenicDocuments(scenicData)
  ];

  if (NATIONAL_RECOMMENDATION_KEYWORDS.some((keyword) => message.includes(keyword))) {
    return NATIONAL_REPRESENTATIVE_PROVINCES.map((province, index) => {
      const document = documents.find((candidate) => candidate.id === `province:${province}`);
      return document ? { ...document, score: 200 - index } : null;
    })
      .filter((document): document is RetrievedGuideKnowledge => document !== null)
      .slice(0, limit);
  }

  const provinceOnlyMention = findProvinceOnlyMention(message);
  if (provinceOnlyMention) {
    const document = documents.find(
      (candidate) => candidate.id === `province:${provinceOnlyMention.province}`
    );
    return document ? [{ ...document, score: 300 }] : [];
  }

  const ranked = documents
    .map((document) => ({
      ...document,
      score: scoreDocument(message, document)
    }))
    .filter((document) => document.score > 0)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));

  const selected = ranked.slice(0, limit);
  const exactAttraction = selected.find((document) => document.id.startsWith('province-spot:'));
  if (!exactAttraction) {
    return selected;
  }

  const province = exactAttraction.id.split(':')[1];
  const provinceDocument = documents.find((document) => document.id === `province:${province}`);
  if (!provinceDocument || selected.some((document) => document.id === provinceDocument.id)) {
    return selected;
  }

  return [
    ...selected.slice(0, Math.max(1, limit - 1)),
    { ...provinceDocument, score: Math.max(1, exactAttraction.score - 1) }
  ].slice(0, limit);
}

export function formatGuideKnowledgeContext(documents: RetrievedGuideKnowledge[]): string {
  if (documents.length === 0) {
    return '检索到的景区知识库上下文：暂无高置信度匹配资料。';
  }

  return [
    '检索到的景区知识库上下文：',
    ...documents.map((document, index) =>
      [
        `${index + 1}. 来源：${document.source}；标题：${document.title}；相关度：${document.score}`,
        document.content
      ].join('\n')
    )
  ].join('\n\n');
}
