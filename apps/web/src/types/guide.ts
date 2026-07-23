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

export type ScenicAreaSummary = {
  scenicArea: ScenicAreaInfo;
  spots: Array<{ id: string; name: string; summary: string }>;
  routes: Array<{ id: string; name: string; duration: string; description: string }>;
  services: Array<{ id: string; name: string; type: string; description: string }>;
  quickQuestions: string[];
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imagePreviewUrl?: string;
  imageName?: string;
  streaming?: boolean;
};

export type RouteCard = {
  type: 'route-step';
  title: string;
  duration: string;
  description: string;
};

export type GuideViseme = 'sil' | 'aa' | 'ee' | 'oo' | 'ih' | 'oh' | 'mouth-open' | 'mouth-closed';

export type GuideVisemeCue = {
  startMs: number;
  endMs: number;
  viseme: GuideViseme;
  mouthOpen: number;
};

export type GuideSpeechTimeline = {
  text: string;
  durationMs: number;
  visemes: GuideVisemeCue[];
  source: 'estimated';
};

export type GuideChatResponse = {
  answer: string;
  cards: RouteCard[];
  source: 'llm' | 'local-fallback';
  speechTimeline: GuideSpeechTimeline;
};

export type GuideImageAttachment = {
  name?: string;
  mimeType: string;
  dataUrl: string;
};
