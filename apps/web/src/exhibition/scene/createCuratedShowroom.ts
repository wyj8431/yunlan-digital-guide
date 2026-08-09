import * as THREE from 'three';
import type { HallMaterials } from '../exhibitionMaterials';

export const SHOWROOM_ZONES = [
  {
    id: 'entrance',
    name: 'Wuzhen Entrance Hall',
    title: '乌镇入口前厅',
    subtitle: 'WUZHEN ENTRANCE HALL',
    z: 52
  },
  {
    id: 'wuzhen',
    name: 'Wuzhen Panorama',
    title: '乌镇全景总览',
    subtitle: 'WUZHEN PANORAMA',
    z: 38
  },
  {
    id: 'global',
    name: 'Dongzha Living Street',
    title: '东栅生活街区',
    subtitle: 'DONGZHA LIVING STREET',
    z: 24
  },
  {
    id: 'interactive',
    name: 'Xizha Night Tour and Venues',
    title: '西栅夜游与场馆',
    subtitle: 'XIZHA NIGHT TOUR AND VENUES',
    z: 10
  },
  {
    id: 'supporting',
    name: 'Waterway Dining and Crafts',
    title: '水巷餐饮与文创',
    subtitle: 'WATERWAY DINING AND CRAFTS',
    z: -4
  },
  {
    id: 'culture',
    name: 'Muxin and Intangible Heritage',
    title: '木心与非遗文化',
    subtitle: 'MUXIN AND INTANGIBLE HERITAGE',
    z: -18
  }
] as const;

export type ShowroomZoneId = (typeof SHOWROOM_ZONES)[number]['id'];

export type CuratedShowroom = {
  root: THREE.Group;
  exhibitRoots: THREE.Object3D[];
  update: (deltaSeconds: number) => void;
};

const FEATURE_IMAGE_WIDTH = 6.4;
const FEATURE_IMAGE_HEIGHT = 3.6;

function box(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function panel(width: number, height: number, materials: HallMaterials, color = '#123536') {
  const group = new THREE.Group();
  group.add(box(width + 0.22, height + 0.22, 0.16, materials.metal));
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ color, toneMapped: false })
  );
  screen.position.z = 0.09;
  group.add(screen);
  return group;
}

function signPanel(
  width: number,
  height: number,
  materials: HallMaterials,
  title: string,
  subtitle: string
) {
  const group = panel(width, height, materials, '#193f40');
  if (typeof document === 'undefined') return group;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 192;
    const context = canvas.getContext('2d');
    if (!context) return group;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#f5e6b7';
    context.font = '600 42px "Microsoft YaHei", sans-serif';
    context.fillText(title, 48, 88);
    context.fillStyle = 'rgba(220, 193, 111, 0.9)';
    context.font = '700 20px Arial, sans-serif';
    context.letterSpacing = '2px';
    context.fillText(subtitle, 50, 139);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(width - 0.22, height - 0.12),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false })
    );
    screen.position.z = 0.1;
    group.add(screen);
  } catch {
    return group;
  }
  return group;
}

function imagePanel(url: string, width: number, height: number, materials: HallMaterials) {
  const group = panel(width, height, materials);
  if (!Object.prototype.hasOwnProperty.call(THREE, 'TextureLoader')) return group;

  const imageMaterial = new THREE.MeshBasicMaterial({ toneMapped: false });
  const image = new THREE.Mesh(new THREE.PlaneGeometry(width, height), imageMaterial);
  image.position.z = 0.1;
  group.add(image);

  const texture = new THREE.TextureLoader().load(url, (loadedTexture) => {
    const source = loadedTexture.image as {
      height?: number;
      naturalHeight?: number;
      naturalWidth?: number;
      width?: number;
    };
    const imageWidth = source.naturalWidth ?? source.width ?? 0;
    const imageHeight = source.naturalHeight ?? source.height ?? 0;

    if (imageWidth > 0 && imageHeight > 0) {
      const imageAspect = imageWidth / imageHeight;
      const displayHeight = Math.min(height, width / imageAspect);
      const displayWidth = displayHeight * imageAspect;
      image.scale.set(displayWidth / width, displayHeight / height, 1);
    }

    imageMaterial.map = loadedTexture;
    imageMaterial.needsUpdate = true;
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  imageMaterial.map = texture;
  imageMaterial.needsUpdate = true;
  return group;
}

function labeledImagePanel(
  url: string,
  width: number,
  height: number,
  materials: HallMaterials,
  title: string,
  subtitle: string
) {
  const group = imagePanel(url, width, height, materials);
  const label = signPanel(width, 0.62, materials, title, subtitle);
  label.position.set(0, height / 2 + 0.52, 0.03);
  group.add(label);
  return group;
}

function markExhibit(root: THREE.Object3D, exhibitId: string) {
  root.name = exhibitId;
  root.userData.exhibitId = exhibitId;
  root.userData.focusPosition = root.position.clone();
  root.traverse((object) => {
    object.userData.exhibitId = exhibitId;
  });
}

function addExhibit(
  zone: THREE.Group,
  roots: THREE.Object3D[],
  exhibitId: string,
  object: THREE.Object3D,
  position: [number, number, number],
  rotationY = 0
) {
  object.position.set(...position);
  object.rotation.y = rotationY;
  markExhibit(object, exhibitId);
  zone.add(object);
  roots.push(object);
  return object;
}

function createConsole(
  materials: HallMaterials,
  width = 2.4,
  title = '乌镇导览',
  introduction = '在此查看展厅信息'
) {
  const root = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: '#9da59b', roughness: 0.86 });
  const desk = signPanel(width, 0.62, materials, title, introduction);
  root.add(
    box(width * 0.54, 0.68, 0.64, materials.wood, 0, 0.36, 0),
    box(width * 0.72, 0.08, 0.82, stone, 0, 0.73, 0),
    desk
  );
  desk.position.set(0, 1.01, -0.22);
  desk.rotation.x = -0.34;
  return root;
}

function createBoat(materials: HallMaterials) {
  const root = new THREE.Group();
  root.add(
    box(3.7, 0.48, 1.3, materials.wood, 0, 0.58, 0),
    box(1.8, 0.62, 0.96, materials.wall, -0.15, 1.05, 0),
    box(2.1, 0.12, 1.1, materials.wood, -0.15, 1.43, 0)
  );
  return root;
}

function createShelf(materials: HallMaterials) {
  const root = new THREE.Group();
  root.add(box(7.2, 3.7, 0.36, materials.wall, 0, 1.85, 0));
  for (const y of [0.65, 1.65, 2.65]) {
    root.add(box(6.7, 0.11, 0.78, materials.wood, 0, y, 0.24));
  }
  const productMaterial = new THREE.MeshStandardMaterial({ color: '#b99a63', roughness: 0.54 });
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      root.add(
        new THREE.Mesh(
          column % 2 === 0
            ? new THREE.CylinderGeometry(0.18, 0.22, 0.42, 20)
            : new THREE.BoxGeometry(0.38, 0.4, 0.32),
          productMaterial
        )
      );
      root.children[root.children.length - 1].position.set(-2.75 + column * 1.1, 0.9 + row, 0.52);
    }
  }
  return root;
}

function createExhibitTable(materials: HallMaterials, width: number, depth: number) {
  const root = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: '#9ea49a', roughness: 0.82 });
  root.add(
    box(width, 0.16, depth, materials.wood, 0, 0.78, 0),
    box(width + 0.28, 0.1, depth + 0.28, stone, 0, 0.64, 0)
  );
  for (const x of [-width / 2 + 0.18, width / 2 - 0.18]) {
    for (const z of [-depth / 2 + 0.18, depth / 2 - 0.18]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.64, 12), materials.wood);
      leg.position.set(x, 0.32, z);
      leg.castShadow = false;
      root.add(leg);
    }
  }
  return root;
}

function createTeaTable(materials: HallMaterials) {
  const root = createExhibitTable(materials, 2.8, 1.65);
  const ceramic = new THREE.MeshStandardMaterial({ color: '#d7ded5', roughness: 0.42 });
  const tea = new THREE.MeshStandardMaterial({ color: '#486a48', roughness: 0.58 });
  const pot = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 12), ceramic);
  pot.scale.y = 0.62;
  pot.position.set(-0.15, 1.06, 0);
  root.add(pot);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.07, 16), ceramic);
  lid.position.set(-0.15, 1.27, 0);
  root.add(lid);
  for (const [x, z] of [
    [-0.75, -0.38],
    [0.55, -0.34],
    [0.62, 0.4]
  ] as const) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.18, 18), ceramic);
    cup.position.set(x, 1.01, z);
    root.add(cup);
  }
  const teaCanister = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.52, 18), tea);
  teaCanister.position.set(0.86, 1.12, 0.05);
  root.add(teaCanister);
  return root;
}

function createLoomDisplay(materials: HallMaterials) {
  const root = new THREE.Group();
  const silk = new THREE.MeshStandardMaterial({ color: '#bfc9af', roughness: 0.62 });
  root.add(box(2.8, 0.16, 1.48, materials.wood, 0, 0.82, 0));
  for (const x of [-1.18, 1.18]) root.add(box(0.14, 2.15, 0.14, materials.wood, x, 1.9, 0));
  for (const y of [1.08, 2.52, 3.0]) root.add(box(2.6, 0.1, 0.12, materials.wood, 0, y, 0));
  for (let index = 0; index < 11; index += 1) {
    root.add(box(0.025, 1.38, 0.025, silk, -0.92 + index * 0.184, 1.8, 0.03));
  }
  root.add(box(1.78, 0.7, 0.03, silk, 0, 1.55, 0.06));
  return root;
}

function createJiangnanHouse(materials: HallMaterials, width = 3.15) {
  const root = new THREE.Group();
  const plaster = new THREE.MeshStandardMaterial({ color: '#e5e4dc', roughness: 0.92 });
  const tile = new THREE.MeshStandardMaterial({
    color: '#69776d',
    roughness: 0.78,
    metalness: 0.04
  });
  const windowPaper = new THREE.MeshStandardMaterial({ color: '#d7cfb3', roughness: 0.8 });
  root.name = 'jiangnan-white-wall-house';
  root.add(
    box(width + 0.32, 0.16, 1.48, materials.floor, 0, 0.08, 0),
    box(width, 1.9, 0.72, plaster, 0, 1.05, 0),
    box(width + 0.46, 0.12, 1.18, tile, 0, 2.12, 0.28),
    box(width + 0.46, 0.12, 1.18, tile, 0, 2.12, -0.28)
  );
  root.children[root.children.length - 2].rotation.x = 0.48;
  root.children[root.children.length - 1].rotation.x = -0.48;
  for (const x of [-width * 0.27, width * 0.27]) {
    root.add(
      box(0.7, 0.78, 0.06, materials.wood, x, 1.18, 0.39),
      box(0.56, 0.62, 0.025, windowPaper, x, 1.18, 0.43)
    );
    for (const offset of [-0.16, 0, 0.16]) {
      root.add(box(0.025, 0.57, 0.035, materials.wood, x + offset, 1.18, 0.46));
    }
  }
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.38, 12), materials.wood);
  pot.position.set(width * 0.43, 0.3, 0.64);
  const foliage = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.34, 1),
    new THREE.MeshStandardMaterial({ color: '#5b8260', roughness: 0.9 })
  );
  foliage.position.set(width * 0.43, 0.72, 0.64);
  root.add(pot, foliage);
  return root;
}

function createCanalPier(materials: HallMaterials) {
  const root = new THREE.Group();
  root.name = 'canal-stone-pier';
  root.add(box(3.8, 0.2, 1.08, materials.floor, 0, 0.1, 0));
  for (const x of [-1.55, -0.52, 0.52, 1.55]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.14, 12), materials.wood);
    post.position.set(x, 0.57, -0.34);
    root.add(post);
  }
  const rope = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.028, 8, 20, Math.PI),
    materials.lightTrim
  );
  rope.rotation.y = Math.PI / 2;
  rope.position.set(-1.55, 0.72, -0.22);
  root.add(rope);
  return root;
}

function createVenuePavilion(materials: HallMaterials) {
  const root = createExhibitTable(materials, 2.9, 2.1);
  const roof = new THREE.MeshStandardMaterial({
    color: '#718077',
    roughness: 0.76,
    metalness: 0.04
  });
  for (const x of [-1.12, 1.12]) root.add(box(0.1, 2.05, 0.1, materials.wood, x, 1.8, 0));
  root.add(box(3.15, 0.11, 1.34, roof, 0, 2.62, 0.28), box(3.15, 0.11, 1.34, roof, 0, 2.62, -0.28));
  root.children[root.children.length - 2].rotation.x = 0.47;
  root.children[root.children.length - 1].rotation.x = -0.47;
  return root;
}

function createCraftStall(materials: HallMaterials) {
  const root = new THREE.Group();
  const awning = new THREE.MeshStandardMaterial({ color: '#617c68', roughness: 0.72 });
  root.name = 'craft-market-stall';
  root.add(box(3.2, 0.78, 0.84, materials.wood, 0, 0.7, 0), box(3.5, 0.1, 1.3, awning, 0, 2.42, 0));
  for (const x of [-1.42, 1.42]) root.add(box(0.1, 2.24, 0.1, materials.wood, x, 1.12, 0));
  for (const x of [-0.95, -0.32, 0.32, 0.95]) {
    const basket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 0.2, 12),
      materials.lightTrim
    );
    basket.position.set(x, 1.18, 0.16);
    root.add(basket);
  }
  return root;
}

function createStreetLantern(materials: HallMaterials) {
  const root = new THREE.Group();
  const glow = new THREE.MeshStandardMaterial({
    color: '#f2d58b',
    emissive: '#8a6426',
    emissiveIntensity: 0.55,
    roughness: 0.38
  });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.8, 12), materials.wood);
  pole.position.y = 1.4;
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.46, 12), glow);
  lantern.position.y = 2.48;
  root.add(
    pole,
    lantern,
    box(0.64, 0.1, 0.64, materials.wood, 0, 2.76, 0),
    box(0.12, 0.12, 0.12, materials.wood, 0, 2.93, 0)
  );
  return root;
}

function createStoneBench() {
  const root = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: '#9aa19b', roughness: 0.92 });
  root.add(
    box(2.15, 0.16, 0.48, stone, 0, 0.68, 0),
    box(0.22, 0.64, 0.42, stone, -0.72, 0.32, 0),
    box(0.22, 0.64, 0.42, stone, 0.72, 0.32, 0)
  );
  return root;
}

function createArtifactPedestal(materials: HallMaterials, accent = '#b6c7b2') {
  const root = new THREE.Group();
  const accentMaterial = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.58 });
  root.add(
    box(1.3, 0.14, 1.04, materials.floor, 0, 0.07, 0),
    box(0.72, 0.74, 0.72, materials.wood, 0, 0.48, 0),
    box(0.96, 0.1, 0.96, accentMaterial, 0, 0.9, 0)
  );
  const artifact = new THREE.Mesh(new THREE.DodecahedronGeometry(0.27, 1), accentMaterial);
  artifact.position.y = 1.2;
  artifact.castShadow = false;
  root.add(artifact);
  return root;
}

function createWayfindingTotem(materials: HallMaterials) {
  const root = new THREE.Group();
  const accent = new THREE.MeshStandardMaterial({
    color: '#1d5050',
    roughness: 0.48,
    metalness: 0.12
  });
  root.add(
    box(0.52, 0.12, 0.52, materials.floor, 0, 0.06, 0),
    box(0.14, 2.35, 0.14, materials.wood, 0, 1.18, 0),
    box(0.8, 0.48, 0.12, accent, 0, 2.08, 0),
    box(0.52, 0.08, 0.22, materials.lightTrim, 0, 2.39, 0)
  );
  return root;
}

function createIntroPlaque(_materials: HallMaterials, _title: string, _subtitle: string) {
  // Entity-level plaques are intentionally omitted so physical exhibits stay visually open.
  void _materials;
  void _title;
  void _subtitle;
  return new THREE.Group();
}

function withInfoBoard<T extends THREE.Object3D>(
  object: T,
  materials: HallMaterials,
  title: string,
  introduction: string,
  height = 1.35
) {
  const plaque = createIntroPlaque(materials, title, introduction);
  plaque.position.y = height;
  object.add(plaque);
  return object;
}

function createZoneHeader(zone: (typeof SHOWROOM_ZONES)[number], materials: HallMaterials) {
  const header = signPanel(5.2, 0.72, materials, zone.title, zone.subtitle);
  header.name = 'zone-header-' + zone.id;
  header.position.set(0, 5.25, zone.z + 4.7);
  return header;
}

export function createCuratedShowroom(materials: HallMaterials): CuratedShowroom {
  const root = new THREE.Group();
  root.name = 'curated-six-zone-wuzhen-showroom';
  const exhibitRoots: THREE.Object3D[] = [];
  const zones = new Map<ShowroomZoneId, THREE.Group>();

  for (const zone of SHOWROOM_ZONES) {
    const group = new THREE.Group();
    group.name = 'zone-' + zone.id;
    group.userData.zoneId = zone.id;
    group.userData.zoneCenter = { x: 0, y: 0, z: zone.z };
    group.add(createZoneHeader(zone, materials));
    zones.set(zone.id, group);
    root.add(group);
  }

  const entrance = zones.get('entrance')!;
  const welcome = new THREE.Group();
  welcome.add(imagePanel('/images/wuzhen-aerial-panorama.jpg', 7.2, 2.85, materials));
  const entranceSign = signPanel(7.2, 0.62, materials, '乌镇入口前厅', 'WUZHEN ENTRANCE HALL');
  entranceSign.position.set(0, 1.78, -0.02);
  welcome.add(entranceSign);
  addExhibit(entrance, exhibitRoots, 'entrance-hologram', welcome, [0, 2.8, 52]);
  addExhibit(
    entrance,
    exhibitRoots,
    'route-query-console',
    createConsole(materials, 1.75, '游览咨询', '查询景点与步行路线'),
    [15.5, 0, 49.5],
    -Math.PI / 2
  );
  addExhibit(
    entrance,
    exhibitRoots,
    'entrance-waterfront-house',
    withInfoBoard(
      createJiangnanHouse(materials),
      materials,
      '临水民居',
      '白墙黛瓦，依河而居',
      2.65
    ),
    [-17.4, 0, 54.5],
    Math.PI / 2
  );
  addExhibit(
    entrance,
    exhibitRoots,
    'entrance-canal-pier',
    withInfoBoard(createCanalPier(materials), materials, '水乡码头', '水路曾是日常出行方式', 1.25),
    [-14.2, 0, 48.8],
    Math.PI / 2
  );
  addExhibit(
    entrance,
    exhibitRoots,
    'entrance-wupeng-boat',
    withInfoBoard(createBoat(materials), materials, '乌篷船模型', '从入口认识乌镇的水路尺度', 1.95),
    [10.8, 0, 51.2],
    -Math.PI / 2
  );
  const entranceLanterns = new THREE.Group();
  for (const z of [-1.3, 1.3]) {
    const lantern = createStreetLantern(materials);
    lantern.position.z = z;
    entranceLanterns.add(lantern);
  }
  addExhibit(
    entrance,
    exhibitRoots,
    'entrance-lanterns',
    entranceLanterns,
    [18.6, 0, 54.2],
    -Math.PI / 2
  );
  addExhibit(
    entrance,
    exhibitRoots,
    'entrance-rest-bench',
    createStoneBench(),
    [12.8, 0, 56.1],
    -Math.PI / 2
  );
  addExhibit(
    entrance,
    exhibitRoots,
    'entrance-wayfinding-totem',
    createWayfindingTotem(materials),
    [13.6, 0, 47.1],
    -Math.PI / 2
  );

  const overview = zones.get('wuzhen')!;
  addExhibit(
    overview,
    exhibitRoots,
    'wuzhen-streets',
    imagePanel('/images/wuzhen-water-town-bg.jpg', 7, 3.8, materials),
    [0, 2.55, 38]
  );
  addExhibit(
    overview,
    exhibitRoots,
    'wuzhen-boat',
    withInfoBoard(createBoat(materials), materials, '乌篷船', '连接水巷与街市的交通工具', 1.95),
    [-12.5, 0, 42]
  );
  addExhibit(
    overview,
    exhibitRoots,
    'wuzhen-canal-house',
    withInfoBoard(
      createJiangnanHouse(materials, 3.6),
      materials,
      '河埠民居',
      '河道与民居共同形成乌镇肌理',
      2.65
    ),
    [18.1, 0, 42.1],
    -Math.PI / 2
  );
  addExhibit(
    overview,
    exhibitRoots,
    'wuzhen-street-house',
    withInfoBoard(
      createJiangnanHouse(materials, 2.8),
      materials,
      '水巷人家',
      '临河开窗，街屋与水面相互借景',
      2.65
    ),
    [9.2, 0, 33.6],
    -Math.PI / 2
  );
  addExhibit(
    overview,
    exhibitRoots,
    'wuzhen-boat-pier',
    withInfoBoard(
      createCanalPier(materials),
      materials,
      '石砌河埠',
      '船只停靠与取水洗衣的节点',
      1.25
    ),
    [-14.7, 0, 34.7]
  );
  addExhibit(
    overview,
    exhibitRoots,
    'wuzhen-resting-bench',
    createStoneBench(),
    [-17.7, 0, 40.1],
    Math.PI / 2
  );
  addExhibit(
    overview,
    exhibitRoots,
    'wuzhen-lantern-corner',
    createStreetLantern(materials),
    [-18.1, 0, 35.4],
    Math.PI / 2
  );
  addExhibit(
    overview,
    exhibitRoots,
    'wuzhen-artifact-pedestal',
    createArtifactPedestal(materials, '#9ab6a6'),
    [-16.7, 0, 36.8],
    Math.PI / 2
  );
  addExhibit(
    overview,
    exhibitRoots,
    'wuzhen-panorama-note',
    labeledImagePanel(
      '/images/wuzhen-real/aerial-2023.jpg',
      4.4,
      2.25,
      materials,
      '从河网看乌镇',
      'A TOWN SHAPED BY WATER'
    ),
    [-20.45, 2.25, 37.8],
    Math.PI / 2
  );

  const dongzha = zones.get('global')!;
  addExhibit(
    dongzha,
    exhibitRoots,
    'dongzha-feature-image',
    labeledImagePanel(
      '/images/wuzhen-real/waterway.jpg',
      FEATURE_IMAGE_WIDTH,
      FEATURE_IMAGE_HEIGHT,
      materials,
      '东栅水巷日常',
      'LIFE BY THE CANAL'
    ),
    [0, 2.55, 24]
  );
  addExhibit(
    dongzha,
    exhibitRoots,
    'route-comparison',
    createConsole(materials, 3.3, '东栅街区', '沿街店铺与水巷生活并行'),
    [7.8, 0, 24]
  );
  const teaTable = createTeaTable(materials);
  teaTable.add(createIntroPlaque(materials, '临水茶席', '品茶也是水乡慢生活的一部分'));
  addExhibit(dongzha, exhibitRoots, 'dongzha-tea-house', teaTable, [-13.8, 0, 24]);
  const dongzhaHouses = new THREE.Group();
  const firstHouse = createJiangnanHouse(materials, 2.7);
  const secondHouse = createJiangnanHouse(materials, 2.35);
  firstHouse.position.z = -2.25;
  secondHouse.position.z = 2.18;
  dongzhaHouses.add(firstHouse, secondHouse);
  dongzhaHouses.add(createIntroPlaque(materials, '东栅街屋', '前店后宅的生活街区'));
  dongzhaHouses.children[dongzhaHouses.children.length - 1].position.y = 2.65;
  addExhibit(
    dongzha,
    exhibitRoots,
    'dongzha-street-buildings',
    dongzhaHouses,
    [18.4, 0, 24],
    -Math.PI / 2
  );
  const dongzhaLanterns = new THREE.Group();
  for (const z of [-1.4, 1.4]) {
    const lantern = createStreetLantern(materials);
    lantern.position.z = z;
    dongzhaLanterns.add(lantern);
  }
  addExhibit(
    dongzha,
    exhibitRoots,
    'dongzha-street-lanterns',
    dongzhaLanterns,
    [-18.1, 0, 24],
    Math.PI / 2
  );
  addExhibit(
    dongzha,
    exhibitRoots,
    'dongzha-weaving-rack',
    createLoomDisplay(materials),
    [12.6, 0, 30.4],
    -Math.PI / 2
  );
  addExhibit(
    dongzha,
    exhibitRoots,
    'dongzha-craft-pedestal',
    createArtifactPedestal(materials, '#c8a86a'),
    [12.3, 0, 20.7],
    -Math.PI / 2
  );
  addExhibit(
    dongzha,
    exhibitRoots,
    'dongzha-street-image',
    labeledImagePanel(
      '/images/wuzhen-real/xizha.jpg',
      4.8,
      2.6,
      materials,
      '沿街日常',
      'STREET LIFE BY THE CANAL'
    ),
    [-20.45, 2.5, 24],
    Math.PI / 2
  );
  addExhibit(
    dongzha,
    exhibitRoots,
    'dongzha-dyeing-image',
    labeledImagePanel(
      '/wuzhen/textures/indigo-diffuse.jpg',
      4.1,
      2.3,
      materials,
      '蓝印花布纹样',
      'INDIGO TEXTILE PATTERN'
    ),
    [20.45, 2.35, 24],
    -Math.PI / 2
  );

  const interactive = zones.get('interactive')!;
  addExhibit(
    interactive,
    exhibitRoots,
    'xizha-night-tour-panel',
    labeledImagePanel(
      '/images/wuzhen-real/night.jpg',
      FEATURE_IMAGE_WIDTH,
      FEATURE_IMAGE_HEIGHT,
      materials,
      '西栅夜游',
      'XIZHA NIGHT TOUR'
    ),
    [0, 2.55, 10]
  );
  const venuePavilion = createVenuePavilion(materials);
  venuePavilion.add(createIntroPlaque(materials, '水剧场与场馆', '戏台、展馆与夜游演艺汇集于此'));
  addExhibit(
    interactive,
    exhibitRoots,
    'xizha-venue-pavilion',
    venuePavilion,
    [13.8, 0, 10],
    -Math.PI / 2
  );
  addExhibit(
    interactive,
    exhibitRoots,
    'xizha-night-image',
    labeledImagePanel(
      '/images/wuzhen-real/night.jpg',
      4.8,
      2.6,
      materials,
      '夜色水巷',
      'NIGHTTIME WATER TOWN'
    ),
    [-20.45, 2.5, 10],
    Math.PI / 2
  );
  const venueHouse = withInfoBoard(
    createJiangnanHouse(materials, 2.8),
    materials,
    '西栅场馆街巷',
    '白墙黛瓦连接夜游入口与文化场馆',
    2.65
  );
  addExhibit(
    interactive,
    exhibitRoots,
    'xizha-venue-house',
    venueHouse,
    [18.6, 0, 12.8],
    -Math.PI / 2
  );
  const nightLanterns = new THREE.Group();
  for (const z of [-1.4, 1.4]) {
    const lantern = createStreetLantern(materials);
    lantern.position.z = z;
    nightLanterns.add(lantern);
  }
  addExhibit(
    interactive,
    exhibitRoots,
    'xizha-night-lanterns',
    nightLanterns,
    [-18.1, 0, 4.8],
    Math.PI / 2
  );
  addExhibit(
    interactive,
    exhibitRoots,
    'xizha-resting-bench',
    createStoneBench(),
    [10.6, 0, 5.4],
    -Math.PI / 2
  );
  addExhibit(
    interactive,
    exhibitRoots,
    'xizha-stage-totem',
    createWayfindingTotem(materials),
    [16.5, 0, 14.7],
    -Math.PI / 2
  );

  const supporting = zones.get('supporting')!;
  addExhibit(
    supporting,
    exhibitRoots,
    'souvenir-shelf',
    withInfoBoard(createShelf(materials), materials, '水乡文创', '把乌镇手艺带回日常生活', 4.35),
    [-20.45, 0, -4],
    Math.PI / 2
  );
  addExhibit(
    supporting,
    exhibitRoots,
    'waterway-night-boat',
    withInfoBoard(createBoat(materials), materials, '水巷夜航', '从餐饮街区通往西栅夜游入口', 1.95),
    [8, 0, -4]
  );
  addExhibit(
    supporting,
    exhibitRoots,
    'supporting-artifact-pedestal',
    createArtifactPedestal(materials, '#bd9b66'),
    [12.2, 0, -8.3]
  );
  const loom = createLoomDisplay(materials);
  loom.add(createIntroPlaque(materials, '织造手作', '经纬之间保留传统织造技艺'));
  addExhibit(supporting, exhibitRoots, 'waterway-loom', loom, [-13.6, 0, -4]);
  const craftStall = createCraftStall(materials);
  craftStall.add(createIntroPlaque(materials, '水巷小铺', '手作、茶礼与日常小物'));
  addExhibit(
    supporting,
    exhibitRoots,
    'waterway-craft-stall',
    craftStall,
    [18.1, 0, -7.9],
    -Math.PI / 2
  );
  addExhibit(
    supporting,
    exhibitRoots,
    'waterway-market-house',
    withInfoBoard(
      createJiangnanHouse(materials, 2.7),
      materials,
      '水巷店屋',
      '街巷里保留的交易与邻里空间',
      2.65
    ),
    [17.8, 0, 1.3],
    -Math.PI / 2
  );
  addExhibit(
    supporting,
    exhibitRoots,
    'waterway-night-image',
    labeledImagePanel(
      '/images/wuzhen-real/waterway.jpg',
      FEATURE_IMAGE_WIDTH,
      FEATURE_IMAGE_HEIGHT,
      materials,
      '水巷漫游',
      'WATERWAYS AND TOWNSCAPE'
    ),
    [0, 2.55, -4]
  );

  const culture = zones.get('culture')!;
  addExhibit(
    culture,
    exhibitRoots,
    'culture-folk',
    labeledImagePanel(
      // Keep the side heritage panel on a licensed, watermarked-free Wuzhen photograph.
      '/images/wuzhen-real/xizha.jpg',
      7.6,
      3,
      materials,
      '水乡文化意象',
      'WATER TOWN CULTURE'
    ),
    [-15.7, 2.7, -18],
    Math.PI / 2
  );
  addExhibit(
    culture,
    exhibitRoots,
    'culture-ink-gallery',
    labeledImagePanel(
      // The indigo fabric texture is the closest local, watermark-free visual for the culture zone.
      '/wuzhen/textures/indigo-diffuse.jpg',
      FEATURE_IMAGE_WIDTH,
      FEATURE_IMAGE_HEIGHT,
      materials,
      '蓝印花布纹样',
      'INDIGO TEXTILE PATTERN'
    ),
    [0, 2.55, -18]
  );
  const cultureHouse = createJiangnanHouse(materials, 3.65);
  cultureHouse.add(createIntroPlaque(materials, '水乡书屋', '阅读、创作与非遗记忆交汇'));
  addExhibit(
    culture,
    exhibitRoots,
    'culture-reading-house',
    cultureHouse,
    [15.6, 0, -18],
    -Math.PI / 2
  );
  addExhibit(
    culture,
    exhibitRoots,
    'culture-waterfront-pier',
    withInfoBoard(
      createCanalPier(materials),
      materials,
      '文脉河埠',
      '河流承载往来，也串联文化记忆',
      1.25
    ),
    [14.5, 0, -24.1],
    -Math.PI / 2
  );
  addExhibit(
    culture,
    exhibitRoots,
    'culture-weaving-rack',
    createLoomDisplay(materials),
    [-11.8, 0, -22.2],
    Math.PI / 2
  );
  addExhibit(
    culture,
    exhibitRoots,
    'culture-ink-pedestal',
    createArtifactPedestal(materials, '#78949a'),
    [-16.5, 0, -20.5],
    Math.PI / 2
  );
  addExhibit(
    culture,
    exhibitRoots,
    'culture-resting-bench',
    createStoneBench(),
    [10.2, 0, -15.2],
    Math.PI / 2
  );
  const cultureLanterns = new THREE.Group();
  for (const z of [-1.2, 1.2]) {
    const lantern = createStreetLantern(materials);
    lantern.position.z = z;
    cultureLanterns.add(lantern);
  }
  addExhibit(
    culture,
    exhibitRoots,
    'culture-reading-lanterns',
    cultureLanterns,
    [18.2, 0, -18],
    -Math.PI / 2
  );

  root.userData.exhibitCount = exhibitRoots.length;
  root.userData.zoneCount = SHOWROOM_ZONES.length;
  return {
    root,
    exhibitRoots,
    update() {}
  };
}
