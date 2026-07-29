export type ExhibitionAsset = {
  id: string;
  kind: 'glb' | 'hdr' | 'ktx2' | 'ies' | 'audio';
  localPath: `/exhibition/${string}`;
  sourceUrl: `https://${string}`;
  author: string;
  license: 'CC0-1.0' | 'CC-BY-4.0' | 'project-owned';
  attribution?: string;
};

export const EXHIBITION_ASSETS: ExhibitionAsset[] = [
  {
    id: 'bicycle',
    kind: 'glb',
    localPath: '/exhibition/models/bicycle.glb',
    sourceUrl: 'https://github.com/wyj8431/yunlan-digital-guide',
    author: 'Yunlan project',
    license: 'project-owned'
  },
  {
    id: 'shuttle',
    kind: 'glb',
    localPath: '/exhibition/models/shuttle.glb',
    sourceUrl: 'https://github.com/wyj8431/yunlan-digital-guide',
    author: 'Yunlan project',
    license: 'project-owned'
  },
  {
    id: 'tea-set',
    kind: 'glb',
    localPath: '/exhibition/models/tea-set.glb',
    sourceUrl: 'https://github.com/wyj8431/yunlan-digital-guide',
    author: 'Yunlan project',
    license: 'project-owned'
  },
  {
    id: 'silk-garment',
    kind: 'glb',
    localPath: '/exhibition/models/silk-garment.glb',
    sourceUrl: 'https://github.com/wyj8431/yunlan-digital-guide',
    author: 'Yunlan project',
    license: 'project-owned'
  },
  {
    id: 'hall-hdri',
    kind: 'hdr',
    localPath: '/exhibition/environment/hall.hdr',
    sourceUrl: 'https://polyhaven.com/hdris',
    author: 'Poly Haven',
    license: 'CC0-1.0'
  },
  {
    id: 'stone-pbr',
    kind: 'ktx2',
    localPath: '/exhibition/materials/stone.ktx2',
    sourceUrl: 'https://polyhaven.com/textures',
    author: 'Poly Haven',
    license: 'CC0-1.0'
  },
  {
    id: 'walnut-pbr',
    kind: 'ktx2',
    localPath: '/exhibition/materials/walnut.ktx2',
    sourceUrl: 'https://polyhaven.com/textures',
    author: 'Poly Haven',
    license: 'CC0-1.0'
  },
  {
    id: 'display-ies',
    kind: 'ies',
    localPath: '/exhibition/lights/display.ies',
    sourceUrl: 'https://github.com/wyj8431/yunlan-digital-guide',
    author: 'Yunlan project',
    license: 'project-owned'
  },
  {
    id: 'hall-ambience',
    kind: 'audio',
    localPath: '/exhibition/audio/hall-ambience.wav',
    sourceUrl: 'https://github.com/wyj8431/yunlan-digital-guide',
    author: 'Yunlan project',
    license: 'project-owned'
  },
  {
    id: 'lake-ambience',
    kind: 'audio',
    localPath: '/exhibition/audio/lake-ambience.wav',
    sourceUrl: 'https://github.com/wyj8431/yunlan-digital-guide',
    author: 'Yunlan project',
    license: 'project-owned'
  },
  {
    id: 'footstep-stone',
    kind: 'audio',
    localPath: '/exhibition/audio/footstep-stone.wav',
    sourceUrl: 'https://github.com/wyj8431/yunlan-digital-guide',
    author: 'Yunlan project',
    license: 'project-owned'
  },
  {
    id: 'narration-bicycle',
    kind: 'audio',
    localPath: '/exhibition/audio/narration-bicycle.wav',
    sourceUrl: 'https://github.com/wyj8431/yunlan-digital-guide',
    author: 'Yunlan project',
    license: 'project-owned'
  },
  {
    id: 'narration-shuttle',
    kind: 'audio',
    localPath: '/exhibition/audio/narration-shuttle.wav',
    sourceUrl: 'https://github.com/wyj8431/yunlan-digital-guide',
    author: 'Yunlan project',
    license: 'project-owned'
  },
  {
    id: 'narration-tea-set',
    kind: 'audio',
    localPath: '/exhibition/audio/narration-tea-set.wav',
    sourceUrl: 'https://github.com/wyj8431/yunlan-digital-guide',
    author: 'Yunlan project',
    license: 'project-owned'
  },
  {
    id: 'narration-silk-garment',
    kind: 'audio',
    localPath: '/exhibition/audio/narration-silk-garment.wav',
    sourceUrl: 'https://github.com/wyj8431/yunlan-digital-guide',
    author: 'Yunlan project',
    license: 'project-owned'
  }
];

export function validateAssetRegistry(assets: ExhibitionAsset[]): string[] {
  const ids = new Set<string>();
  return assets.flatMap((asset) => {
    const errors: string[] = [];
    if (ids.has(asset.id)) errors.push(`duplicate:${asset.id}`);
    ids.add(asset.id);
    if (!asset.sourceUrl.startsWith('https://')) errors.push(`source:${asset.id}`);
    if (!asset.localPath.startsWith('/exhibition/')) errors.push(`path:${asset.id}`);
    return errors;
  });
}
