export const EXHIBITION_PRIORITIES = ['P0', 'P1', 'P2'] as const;
export type ExhibitionPriority = (typeof EXHIBITION_PRIORITIES)[number];

export type ExhibitionZone = {
  id: string;
  name: string;
  description: string;
  order: number;
};

export type ExhibitionItem = {
  id: string;
  zoneId: string;
  name: string;
  displayForm: string;
  functionDescription: string;
  backendTables: string[];
  coreFields: string[];
  priority: ExhibitionPriority;
  implemented: boolean;
  interaction: 'detail' | 'guide' | 'scene' | 'custom-route' | 'monitor';
};

export type ExhibitionCatalog = {
  title: string;
  description: string;
  source: string;
  zones: ExhibitionZone[];
  items: ExhibitionItem[];
};
