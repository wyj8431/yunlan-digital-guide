// 服务端景区数据的结构化契约，与静态 JSON 字段保持一致。
export type ScenicAreaInfo = {
  id: string;
  name: string;
  description: string;
  openingHours: string;
  ticketInfo: string;
  location?: string;
  sourceName?: string;
  sourceUrl?: string;
  sourceUpdatedAt?: string;
};

export type ScenicSpot = {
  id: string;
  name: string;
  summary: string;
  story: string;
  recommendedDurationMinutes: number;
};

export type RouteStep = {
  spotId: string;
  title: string;
  durationMinutes: number;
  description: string;
};

export type ScenicRoute = {
  id: string;
  name: string;
  duration: string;
  description: string;
  steps: RouteStep[];
};

export type ScenicService = {
  id: string;
  name: string;
  type: 'visitor-center' | 'parking' | 'restroom' | 'food' | 'transport' | 'booking';
  description: string;
};

export type ScenicFaq = {
  question: string;
  answer: string;
};

export type ScenicData = {
  scenicArea: ScenicAreaInfo;
  spots: ScenicSpot[];
  routes: ScenicRoute[];
  services: ScenicService[];
  faqs: ScenicFaq[];
};

export type ScenicAreaSummary = {
  scenicArea: ScenicAreaInfo;
  spots: Pick<ScenicSpot, 'id' | 'name' | 'summary'>[];
  routes: Pick<ScenicRoute, 'id' | 'name' | 'duration' | 'description'>[];
  services: ScenicService[];
  quickQuestions: string[];
  officialInfo?: ScenicOfficialInfo;
};

export type ScenicOfficialInfo = {
  status: 'live' | 'stale' | 'fallback' | 'unconfigured';
  sourceName?: string;
  sourceUrl?: string;
  updatedAt?: string;
  checkedAt?: string;
  notices: string[];
};
