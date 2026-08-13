// 导游前端共享类型，覆盖景区、消息、附件、路线和语音时间轴。
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

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachmentName?: string;
  attachmentKind?: GuideAttachmentKind;
  attachmentPreviewUrl?: string;
  imagePreviewUrl?: string;
  imageName?: string;
  streaming?: boolean;
  source?: 'llm' | 'local-fallback';
  retrievedKnowledge?: GuideKnowledgeResult[];
};

export type GuideChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
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

export type GuideAvatarEmotion = 'neutral' | 'warm' | 'happy' | 'thoughtful';

export type GuideAvatarDirective = {
  emotion?: GuideAvatarEmotion;
  action?: string;
  scene?: string;
};

export type GuideChatResponse = {
  answer: string;
  cards: RouteCard[];
  source: 'llm' | 'local-fallback';
  speechTimeline: GuideSpeechTimeline;
  retrievedKnowledge: GuideKnowledgeResult[];
  avatarDirective?: GuideAvatarDirective;
};

export type GuideAttachmentKind =
  'image' | 'document' | 'spreadsheet' | 'presentation' | 'markdown';

export type GuideAttachment = {
  name: string;
  mimeType: string;
  kind: GuideAttachmentKind;
  dataUrl: string;
  sizeBytes?: number;
};

export type GuideImageAttachment = GuideAttachment;

export type GuideKnowledgeSource = 'destination-knowledge' | 'local-scenic';

export type GuideKnowledgeResult = {
  id: string;
  title: string;
  source: GuideKnowledgeSource;
  content: string;
  keywords: string[];
  score: number;
};
