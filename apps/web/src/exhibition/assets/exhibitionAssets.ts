export type MaterialSlot = 'baseColor' | 'normal' | 'roughness' | 'ao';

export type ExhibitionAssetFile = {
  localPath: `/exhibition/${string}`;
  directUrl?: `https://${string}`;
  byteSize: number;
  sha256: string;
  materialSlot?: MaterialSlot;
};

export type ExhibitionAsset = {
  id: string;
  kind: 'glb' | 'hdr' | 'ktx2' | 'texture' | 'ies' | 'audio';
  localPath: `/exhibition/${string}`;
  sourceUrl: `https://${string}`;
  author: string;
  license: 'CC0-1.0' | 'CC-BY-4.0' | 'MIT' | 'project-owned';
  attribution?: string;
  files: ExhibitionAssetFile[];
};

const local = (
  localPath: `/exhibition/${string}`,
  byteSize: number,
  sha256: string
): ExhibitionAssetFile => ({ localPath, byteSize, sha256 });
const remote = (
  localPath: `/exhibition/${string}`,
  directUrl: `https://${string}`,
  byteSize: number,
  sha256: string,
  materialSlot?: MaterialSlot
): ExhibitionAssetFile => ({ localPath, directUrl, byteSize, sha256, materialSlot });

const projectUrl = 'https://github.com/wyj8431/yunlan-digital-guide' as const;

export const EXHIBITION_ASSETS: ExhibitionAsset[] = [
  {
    id: 'bicycle',
    kind: 'glb',
    localPath: '/exhibition/models/bicycle.glb',
    sourceUrl:
      'https://github.com/mrdoob/three.js/blob/master/examples/models/gltf/CarbonFrameBike.glb',
    author: 'three.js contributors',
    license: 'MIT',
    attribution: 'CarbonFrameBike.glb from the three.js examples repository',
    files: [
      remote(
        '/exhibition/models/bicycle.glb',
        'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/CarbonFrameBike.glb',
        3395040,
        'df83e23ad16d5bf947a00bf3660fbbeb0fd1176af3b1e29d2e9658ebf5be5328'
      )
    ]
  },
  {
    id: 'shuttle',
    kind: 'glb',
    localPath: '/exhibition/models/shuttle.glb',
    sourceUrl: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept',
    author: 'Darmstadt Graphics Group GmbH and Eric Chadwick',
    license: 'CC-BY-4.0',
    attribution: 'Car Concept by Darmstadt Graphics Group GmbH and Eric Chadwick, CC BY 4.0',
    files: [
      remote(
        '/exhibition/models/shuttle.glb',
        'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CarConcept/glTF-Binary/CarConcept.glb',
        11778688,
        'c272098089d78c5cd9fd9f24ff50ee8acf8d932c55f2d55fc10adb6c8998966b'
      )
    ]
  },
  {
    id: 'tea-set',
    kind: 'glb',
    localPath: '/exhibition/models/tea-set.glb',
    sourceUrl:
      'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/DiffuseTransmissionTeacup',
    author: 'Poly Haven and Eric Chadwick',
    license: 'CC0-1.0',
    files: [
      remote(
        '/exhibition/models/tea-set.glb',
        'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DiffuseTransmissionTeacup/glTF-Binary/DiffuseTransmissionTeacup.glb',
        4795028,
        'd4f567186fea262819aac6664cb9d7cef7f4600406038046771a69e10363935b'
      )
    ]
  },
  {
    id: 'silk-garment',
    kind: 'glb',
    localPath: '/exhibition/models/silk-garment.glb',
    sourceUrl: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenCloth',
    author: 'Microsoft',
    license: 'CC0-1.0',
    files: [
      remote(
        '/exhibition/models/silk-garment.glb',
        'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenCloth/glTF/SheenCloth.gltf',
        4176332,
        'e5683c6f14429f34aeb575ea33dfae6880961e150ab1605bbb7c258a50f1121f'
      )
    ]
  },
  {
    id: 'hall-hdri',
    kind: 'hdr',
    localPath: '/exhibition/environment/hall.hdr',
    sourceUrl: 'https://polyhaven.com/a/studio_small_09',
    author: 'Poly Haven',
    license: 'CC0-1.0',
    files: [
      remote(
        '/exhibition/environment/hall.hdr',
        'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr',
        1615248,
        'e7cfda5f4e98e623db12b8bfd0184e048488e4855d9c83e2751fb44a32e80c45'
      )
    ]
  },
  {
    id: 'stone-pbr',
    kind: 'texture',
    localPath: '/exhibition/materials/stone-baseColor.jpg',
    sourceUrl: 'https://polyhaven.com/a/floor_tiles_06',
    author: 'Poly Haven',
    license: 'CC0-1.0',
    files: [
      remote(
        '/exhibition/materials/stone-baseColor.jpg',
        'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/floor_tiles_06/floor_tiles_06_diff_1k.jpg',
        356257,
        'ac159ca6072e30dd9d5c65e2d6eae7bb55a7dc9f06e6d141e9119390563511c2',
        'baseColor'
      ),
      remote(
        '/exhibition/materials/stone-normal.jpg',
        'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/floor_tiles_06/floor_tiles_06_nor_gl_1k.jpg',
        121299,
        'efaff964d5688dd52ea3b876d5dac63ffee76d8d7270e30c11c81095246d5fdd',
        'normal'
      ),
      remote(
        '/exhibition/materials/stone-roughness.jpg',
        'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/floor_tiles_06/floor_tiles_06_rough_1k.jpg',
        114013,
        '9c1996177892f220bcfdbc44675d0cd404482cfa80b1c577c7bcc100637ef8b6',
        'roughness'
      ),
      remote(
        '/exhibition/materials/stone-ao.jpg',
        'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/floor_tiles_06/floor_tiles_06_ao_1k.jpg',
        196815,
        'b83b09eb794060185d73d6395b87d2df411830b11073474a8e330d373e86ee45',
        'ao'
      )
    ]
  },
  {
    id: 'walnut-pbr',
    kind: 'texture',
    localPath: '/exhibition/materials/walnut-baseColor.jpg',
    sourceUrl: 'https://polyhaven.com/a/dark_wood',
    author: 'Poly Haven',
    license: 'CC0-1.0',
    files: [
      remote(
        '/exhibition/materials/walnut-baseColor.jpg',
        'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/dark_wood/dark_wood_diff_1k.jpg',
        754754,
        'd68da31655bf47024af893156a6a01a6c95bb60f55d97e2dc9bdd47be320e5b5',
        'baseColor'
      ),
      remote(
        '/exhibition/materials/walnut-normal.jpg',
        'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/dark_wood/dark_wood_nor_gl_1k.jpg',
        344338,
        'c42541f1bda0a14b39f120c24407eeba699af8ac85b371c7cef98ffd7d7b13bf',
        'normal'
      ),
      remote(
        '/exhibition/materials/walnut-roughness.jpg',
        'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/dark_wood/dark_wood_rough_1k.jpg',
        574415,
        '47ea12dbf649109b02eaa164dde9732a74e839957f29ad0ec7f5266b575d1835',
        'roughness'
      ),
      remote(
        '/exhibition/materials/walnut-ao.jpg',
        'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/dark_wood/dark_wood_ao_1k.jpg',
        429293,
        'f4fc614d45f7413f3ea8d4c35c08f3fe573a882dfea6e13b5425023305cc1d02',
        'ao'
      )
    ]
  },
  {
    id: 'display-ies',
    kind: 'ies',
    localPath: '/exhibition/lights/display.ies',
    sourceUrl: 'https://github.com/mrdoob/three.js/tree/master/examples/ies',
    author: 'BEGA / three.js contributors',
    license: 'MIT',
    attribution: 'IES profile distributed with the MIT-licensed three.js examples',
    files: [
      remote(
        '/exhibition/lights/display.ies',
        'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/ies/007cfb11e343e2f42e3b476be4ab684e.ies',
        1403,
        'd5e4a4b92dfe5a2b3027f3bd8eec78a8b9679621b089845253bf5ba410b767b2'
      )
    ]
  },
  {
    id: 'hall-ambience',
    kind: 'audio',
    localPath: '/exhibition/audio/hall-ambience.wav',
    sourceUrl: projectUrl,
    author: 'Yunlan project',
    license: 'project-owned',
    files: [
      local(
        '/exhibition/audio/hall-ambience.wav',
        2116878,
        '72a464cad973c0683527f93d22d59f9b6c44b1a9fe360258a2e804bff5d7a520'
      )
    ]
  },
  {
    id: 'lake-ambience',
    kind: 'audio',
    localPath: '/exhibition/audio/lake-ambience.wav',
    sourceUrl: projectUrl,
    author: 'Yunlan project',
    license: 'project-owned',
    files: [
      local(
        '/exhibition/audio/lake-ambience.wav',
        2116878,
        'a94f944db99e57092cfc78199e7b2401d7f5f45c7d7d52fd05516f7967d54a2a'
      )
    ]
  },
  {
    id: 'footstep-stone',
    kind: 'audio',
    localPath: '/exhibition/audio/footstep-stone.wav',
    sourceUrl: projectUrl,
    author: 'Yunlan project',
    license: 'project-owned',
    files: [
      local(
        '/exhibition/audio/footstep-stone.wav',
        88278,
        '120863a92376cf934667d397a247ad506705a0ac10998e3f9c572d113a2b6445'
      )
    ]
  },
  {
    id: 'narration-bicycle',
    kind: 'audio',
    localPath: '/exhibition/audio/narration-bicycle.wav',
    sourceUrl: projectUrl,
    author: 'Yunlan project',
    license: 'project-owned',
    files: [
      local(
        '/exhibition/audio/narration-bicycle.wav',
        267394,
        '4c027145273cabb229d2555d9f2973e08cb93ff723fcd457e7bddc5d83db1277'
      )
    ]
  },
  {
    id: 'narration-shuttle',
    kind: 'audio',
    localPath: '/exhibition/audio/narration-shuttle.wav',
    sourceUrl: projectUrl,
    author: 'Yunlan project',
    license: 'project-owned',
    files: [
      local(
        '/exhibition/audio/narration-shuttle.wav',
        272680,
        '9cede4b0ac9f5bfc8132926928b0e6f0056c7297795307857b1cef8197fd44af'
      )
    ]
  },
  {
    id: 'narration-tea-set',
    kind: 'audio',
    localPath: '/exhibition/audio/narration-tea-set.wav',
    sourceUrl: projectUrl,
    author: 'Yunlan project',
    license: 'project-owned',
    files: [
      local(
        '/exhibition/audio/narration-tea-set.wav',
        281488,
        'cd93b3aac06c21c343ee8250d741bce334bc20012abea1a81c7377e1fbf37eb7'
      )
    ]
  },
  {
    id: 'narration-silk-garment',
    kind: 'audio',
    localPath: '/exhibition/audio/narration-silk-garment.wav',
    sourceUrl: projectUrl,
    author: 'Yunlan project',
    license: 'project-owned',
    files: [
      local(
        '/exhibition/audio/narration-silk-garment.wav',
        285014,
        '95c760af83a3b8d40afbb97cd31f656ffa3c3c654c87ee452c6206688c956781'
      )
    ]
  }
];

export function validateAssetRegistry(assets: ExhibitionAsset[]): string[] {
  const ids = new Set<string>();
  const paths = new Set<string>();
  return assets.flatMap((asset) => {
    const errors: string[] = [];
    if (ids.has(asset.id)) errors.push(`duplicate:${asset.id}`);
    ids.add(asset.id);
    if (!asset.sourceUrl.startsWith('https://')) errors.push(`source:${asset.id}`);
    if (!asset.localPath.startsWith('/exhibition/')) errors.push(`path:${asset.id}`);
    if (!asset.files.some((file) => file.localPath === asset.localPath)) {
      errors.push(`primary:${asset.id}`);
    }
    if (asset.kind === 'ktx2' || asset.kind === 'texture') {
      const slots = asset.files.map((file) => file.materialSlot);
      if (
        !(['baseColor', 'normal', 'roughness', 'ao'] as const).every((slot) => slots.includes(slot))
      ) {
        errors.push(`material:${asset.id}`);
      }
    }
    for (const file of asset.files) {
      if (paths.has(file.localPath)) errors.push(`duplicate-path:${file.localPath}`);
      paths.add(file.localPath);
      if (!file.localPath.startsWith('/exhibition/')) errors.push(`path:${asset.id}`);
      if (!Number.isInteger(file.byteSize) || file.byteSize <= 0) errors.push(`size:${asset.id}`);
      if (!/^[a-f0-9]{64}$/.test(file.sha256)) errors.push(`sha256:${asset.id}`);
      if (asset.license !== 'project-owned' && !file.directUrl?.startsWith('https://'))
        errors.push(`download:${asset.id}`);
    }
    return errors;
  });
}
