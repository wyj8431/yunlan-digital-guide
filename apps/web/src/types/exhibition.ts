export type ExhibitionPriority = 'P0' | 'P1' | 'P2';

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

export type ExhibitionCatalogResponse = ExhibitionCatalog;
