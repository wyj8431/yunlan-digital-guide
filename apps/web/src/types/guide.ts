export type ScenicAreaInfo = {
  id: string;
  name: string;
  description: string;
  openingHours: string;
  ticketInfo: string;
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
};

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
