import * as THREE from 'three';
import type { HallMaterials } from '../exhibitionMaterials';

export const SHOWROOM_ZONES = [
  { id: 'entrance', name: 'Wuzhen Entrance Hall', z: 52 },
  { id: 'wuzhen', name: 'Wuzhen Panorama', z: 38 },
  { id: 'global', name: 'Dongzha Living Street', z: 24 },
  { id: 'interactive', name: 'Routes and Immersion', z: 10 },
  { id: 'supporting', name: 'Waterway Dining and Crafts', z: -4 },
  { id: 'culture', name: 'Muxin and Intangible Heritage', z: -18 }
] as const;

export type ShowroomZoneId = (typeof SHOWROOM_ZONES)[number]['id'];

export type CuratedShowroom = {
  root: THREE.Group;
  exhibitRoots: THREE.Object3D[];
  update: (deltaSeconds: number) => void;
};

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
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function panel(width: number, height: number, materials: HallMaterials, color = '#123536') {
  const group = new THREE.Group();
  group.add(box(width + 0.22, height + 0.22, 0.16, materials.wood));
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

  const texture = new THREE.TextureLoader().load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  const image = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
  );
  image.position.z = 0.1;
  group.add(image);
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

function createConsole(materials: HallMaterials, width = 2.4) {
  const root = new THREE.Group();
  root.add(
    box(width * 0.66, 0.82, 0.72, materials.wall, 0, 0.41, 0),
    panel(width, 0.92, materials, '#1c4d4b')
  );
  root.children[1].position.set(0, 1.15, -0.16);
  root.children[1].rotation.x = -0.65;
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

function createZoneHeader(zone: typeof SHOWROOM_ZONES[number], materials: HallMaterials) {
  const header = panel(5.2, 0.72, materials, '#193f40');
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
  const entranceSign = signPanel(
    7.2,
    0.62,
    materials,
    '乌镇入口前厅',
    'WUZHEN ENTRANCE HALL'
  );
  entranceSign.position.set(0, 1.78, -0.02);
  welcome.add(entranceSign);
  addExhibit(entrance, exhibitRoots, 'entrance-hologram', welcome, [0, 2.8, 52]);
  addExhibit(entrance, exhibitRoots, 'route-query-console', createConsole(materials, 1.75), [15.5, 0, 49.5], -Math.PI / 2);

  const overview = zones.get('wuzhen')!;
  addExhibit(overview, exhibitRoots, 'wuzhen-streets', imagePanel('/images/wuzhen-water-town-bg.jpg', 7, 3.8, materials), [0, 2.55, 38]);
  addExhibit(overview, exhibitRoots, 'wuzhen-boat', createBoat(materials), [-12.5, 0, 42]);

  const dongzha = zones.get('global')!;
  addExhibit(dongzha, exhibitRoots, 'route-comparison', createConsole(materials, 3.3), [7.8, 0, 24]);

  const interactive = zones.get('interactive')!;
  addExhibit(interactive, exhibitRoots, 'itinerary-diy', createConsole(materials, 4.2), [0, 0, 10]);
  const vr = new THREE.Group();
  for (let index = 0; index < 5; index += 1) vr.add(createConsole(materials, 1.25));
  addExhibit(interactive, exhibitRoots, 'vr-port', vr, [11.5, 0, 10], -Math.PI / 2);

  const supporting = zones.get('supporting')!;
  addExhibit(supporting, exhibitRoots, 'souvenir-shelf', createShelf(materials), [-20.45, 0, -4], Math.PI / 2);
  addExhibit(supporting, exhibitRoots, 'itinerary-export', createConsole(materials, 1.7), [8, 0, 0]);

  const culture = zones.get('culture')!;
  addExhibit(
    culture,
    exhibitRoots,
    'culture-shops',
    labeledImagePanel(
      '/images/wuzhen-frames/dyeworks.jpg',
      6.5,
      2.8,
      materials,
      '乌镇染坊',
      'BLUE PRINT DYEING'
    ),
    [-20.55, 2.5, -18],
    Math.PI / 2
  );
  addExhibit(
    culture,
    exhibitRoots,
    'culture-seasonal',
    labeledImagePanel(
      '/images/wuzhen-frames/night-river.jpg',
      6.2,
      2.8,
      materials,
      '乌镇水巷夜游',
      'NIGHT RIVER JOURNEY'
    ),
    [20.55, 2.5, -18],
    -Math.PI / 2
  );
  addExhibit(
    culture,
    exhibitRoots,
    'culture-folk',
    labeledImagePanel(
      '/images/wuzhen-frames/xizha.jpg',
      7.6,
      3,
      materials,
      '水乡非遗手艺',
      'MUXIN AND INTANGIBLE HERITAGE'
    ),
    [0, 2.7, -22]
  );

  root.userData.exhibitCount = exhibitRoots.length;
  root.userData.zoneCount = SHOWROOM_ZONES.length;
  return {
    root,
    exhibitRoots,
    update() {}
  };
}
