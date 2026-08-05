import * as THREE from 'three';
import { WUZHEN_DISTRICTS, WUZHEN_EXHIBITION, type DistrictId, type WeatherMode } from './wuzhenConfig';

export type WuzhenWorld = {
  root: THREE.Group;
  hotspots: THREE.Object3D[];
  setDistrict: (districtId: DistrictId) => void;
  setWeather: (mode: WeatherMode) => void;
  setDyeProcess: (index: number) => void;
  update: (elapsedSeconds: number, deltaSeconds: number) => void;
};

type PbrMaterialSet = {
  wall: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial;
  timber: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial;
  indigo: THREE.MeshStandardMaterial;
  water: THREE.MeshPhysicalMaterial;
  lantern: THREE.MeshStandardMaterial;
  window: THREE.MeshStandardMaterial;
};

const textureLoader = new THREE.TextureLoader();
const textureRoot = '/wuzhen/textures';

function loadTexture(filename: string, repeat: [number, number], color = false) {
  const texture = textureLoader.load(`${textureRoot}/${filename}`);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = 4;
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function createPbrMaterial(
  name: 'wall' | 'roof' | 'wood' | 'stone' | 'indigo',
  repeat: [number, number],
  roughness: number,
  color = '#ffffff'
) {
  const prefixes = {
    wall: 'wall',
    roof: 'roof',
    wood: 'wood',
    stone: 'stone',
    indigo: 'indigo'
  } as const;
  const prefix = prefixes[name];
  return new THREE.MeshStandardMaterial({
    color,
    map: loadTexture(`${prefix}-diffuse.jpg`, repeat, true),
    normalMap: loadTexture(`${prefix}-normal.jpg`, repeat),
    roughnessMap: loadTexture(`${prefix}-roughness.jpg`, repeat),
    roughness,
    metalness: 0.02
  });
}

function createMaterials(): PbrMaterialSet {
  return {
    wall: createPbrMaterial('wall', [2.4, 1.5], 0.84, '#d8d8c9'),
    roof: createPbrMaterial('roof', [3.5, 2.2], 0.78, '#d2d4d0'),
    timber: createPbrMaterial('wood', [2, 2], 0.74, '#b59b77'),
    stone: createPbrMaterial('stone', [4, 4], 0.88, '#c3c8b8'),
    indigo: createPbrMaterial('indigo', [1, 1.6], 0.82, '#41647c'),
    water: new THREE.MeshPhysicalMaterial({
      color: '#204f5c',
      roughness: 0.18,
      metalness: 0.2,
      transparent: true,
      opacity: 0.93,
      clearcoat: 0.9,
      clearcoatRoughness: 0.18
    }),
    lantern: new THREE.MeshStandardMaterial({
      color: '#9e3820',
      emissive: '#f4a34c',
      emissiveIntensity: 0.25,
      roughness: 0.56
    }),
    window: new THREE.MeshStandardMaterial({
      color: '#4f210d',
      emissive: '#ffad4c',
      emissiveIntensity: 0.02,
      roughness: 0.42
    })
  };
}

function gableGeometry(width: number, wallHeight: number, depth: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(-width / 2, wallHeight * 0.58);
  shape.lineTo(0, wallHeight);
  shape.lineTo(width / 2, wallHeight * 0.58);
  shape.lineTo(width / 2, 0);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geometry.center();
  return geometry;
}

function shadow(mesh: THREE.Mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addHouse(
  group: THREE.Group,
  position: [number, number, number],
  size: [number, number, number],
  rotation: number,
  materials: PbrMaterialSet
) {
  const [width, height, depth] = size;
  const house = new THREE.Group();
  house.position.set(...position);
  house.rotation.y = rotation;
  const wall = shadow(new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials.wall));
  wall.position.y = height / 2;
  house.add(wall);
  const roof = shadow(new THREE.Mesh(gableGeometry(width + 0.55, height * 0.64, depth + 0.66), materials.roof));
  roof.position.y = height + height * 0.2;
  house.add(roof);
  const eave = shadow(new THREE.Mesh(new THREE.BoxGeometry(width + 0.58, 0.22, depth + 0.64), materials.timber));
  eave.position.y = height + height * 0.1;
  house.add(eave);
  const beam = shadow(new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 0.16, 0.12), materials.timber));
  beam.position.set(0, height * 0.72, depth / 2 + 0.08);
  house.add(beam);
  const door = shadow(new THREE.Mesh(new THREE.BoxGeometry(Math.min(1.2, width * 0.24), height * 0.42, 0.1), materials.timber));
  door.position.set(0, height * 0.21, depth / 2 + 0.11);
  house.add(door);
  for (const side of [-1, 1]) {
    const window = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.82, 0.06), materials.window);
    window.position.set(side * width * 0.24, height * 0.48, depth / 2 + 0.08);
    house.add(window);
    const sill = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.08, 0.12), materials.timber));
    sill.position.set(side * width * 0.24, height * 0.23, depth / 2 + 0.1);
    house.add(sill);
  }
  for (const x of [-width * 0.4, width * 0.4]) {
    const post = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.13, height * 0.92, 0.13), materials.timber));
    post.position.set(x, height * 0.46, depth / 2 + 0.12);
    house.add(post);
  }
  group.add(house);
  return house;
}

function addLantern(group: THREE.Group, position: [number, number, number], materials: PbrMaterialSet) {
  const lantern = new THREE.Group();
  lantern.position.set(...position);
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 14), materials.lantern);
  globe.scale.y = 1.24;
  const capGeometry = new THREE.CylinderGeometry(0.18, 0.24, 0.08, 12);
  const capTop = new THREE.Mesh(capGeometry, materials.timber);
  capTop.position.y = 0.42;
  const capBottom = capTop.clone();
  capBottom.position.y = -0.42;
  lantern.add(globe, capTop, capBottom);
  const light = new THREE.PointLight('#ffc86f', 0.38, 11, 1.7);
  lantern.add(light);
  lantern.userData.light = light;
  group.add(lantern);
  return lantern;
}

function addTree(group: THREE.Group, position: [number, number, number], scale: number, materials: PbrMaterialSet) {
  const tree = new THREE.Group();
  tree.position.set(...position);
  const trunk = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.1 * scale, 0.17 * scale, 1.5 * scale, 8), materials.timber));
  trunk.position.y = 0.75 * scale;
  const foliage = shadow(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.88 * scale, 14, 12),
      new THREE.MeshStandardMaterial({ color: '#365440', roughness: 0.9 })
    )
  );
  foliage.position.y = 1.75 * scale;
  foliage.scale.set(0.9, 1.32, 0.9);
  tree.add(trunk, foliage);
  group.add(tree);
}

function addBridge(group: THREE.Group, position: [number, number, number], rotation: number, material: THREE.Material) {
  const bridge = new THREE.Group();
  bridge.position.set(...position);
  bridge.rotation.y = rotation;
  const arch = shadow(new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.36, 12, 38, Math.PI), material));
  arch.rotation.z = Math.PI;
  arch.position.y = 1.55;
  arch.scale.y = 0.7;
  const deck = shadow(new THREE.Mesh(new THREE.BoxGeometry(8.1, 0.28, 1.7), material));
  deck.position.y = 2.72;
  bridge.add(arch, deck);
  for (const x of [-3.6, -1.8, 0, 1.8, 3.6]) {
    const step = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 1.92), material));
    step.position.set(x, 2.92 - Math.abs(x) * 0.09, 0);
    bridge.add(step);
  }
  for (const z of [-0.62, 0.62]) {
    const rail = shadow(new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.1, 0.09), material));
    rail.position.set(0, 3.55, z);
    bridge.add(rail);
    for (const x of [-3.2, -1.05, 1.05, 3.2]) {
      const post = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.78, 0.1), material));
      post.position.set(x, 3.18, z);
      bridge.add(post);
    }
  }
  group.add(bridge);
}

function addBoat(group: THREE.Group, position: [number, number, number], rotation: number, materials: PbrMaterialSet) {
  const boat = new THREE.Group();
  boat.position.set(...position);
  boat.rotation.y = rotation;
  const hull = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.56, 3.2, 8, 14), materials.timber));
  hull.rotation.z = Math.PI / 2;
  hull.scale.set(1, 0.42, 1);
  hull.position.y = 0.45;
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 1.5, 14, 1, true), materials.roof);
  canopy.rotation.z = Math.PI / 2;
  canopy.position.set(0, 0.94, -0.35);
  const deck = shadow(new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.16, 1.05), materials.timber));
  deck.position.y = 0.54;
  const lantern = addLantern(boat, [1.1, 1.45, 0.72], materials);
  lantern.scale.setScalar(0.52);
  boat.add(hull, canopy, deck);
  boat.userData.boat = true;
  group.add(boat);
}

function createWater(width: number, length: number, materials: PbrMaterialSet) {
  const geometry = new THREE.PlaneGeometry(width, length, 36, 108);
  const water = new THREE.Mesh(geometry, materials.water);
  water.rotation.x = -Math.PI / 2;
  water.userData.waterSurface = true;
  water.userData.basePositions = Float32Array.from(geometry.getAttribute('position').array);
  return water;
}

function addReflection(
  group: THREE.Group,
  position: [number, number, number],
  width: number,
  length: number,
  color = '#d78939'
) {
  const [x, y, z] = position;
  for (let index = 0; index < 5; index += 1) {
    const stripLength = length * (0.1 + index * 0.025);
    const reflection = new THREE.Mesh(
      new THREE.PlaneGeometry(width * (0.78 + (index % 2) * 0.32), stripLength),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.56 - index * 0.06, depthWrite: false })
    );
    reflection.rotation.x = -Math.PI / 2;
    reflection.position.set(x + (index % 2 === 0 ? -0.07 : 0.08), y, z - index * length * 0.18);
    reflection.renderOrder = 2;
    reflection.userData.reflection = true;
    reflection.userData.baseScaleZ = 1;
    group.add(reflection);
  }
}

function addMarker(
  group: THREE.Group,
  districtId: DistrictId,
  position: [number, number, number],
  hotspots: THREE.Object3D[]
) {
  const marker = new THREE.Group();
  marker.position.set(...position);
  marker.userData.districtId = districtId;
  marker.userData.baseY = position[1];
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.055, 10, 32),
    new THREE.MeshBasicMaterial({ color: '#f3c85a', transparent: true, opacity: 0.92 })
  );
  halo.rotation.x = Math.PI / 2;
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.2, 0.86, 10),
    new THREE.MeshStandardMaterial({ color: '#ffe29a', emissive: '#d7942f', emissiveIntensity: 1.25 })
  );
  beacon.position.y = 0.42;
  marker.add(halo, beacon);
  marker.traverse((object) => {
    object.userData.districtId = districtId;
  });
  group.add(marker);
  hotspots.push(marker);
}

function createSandtable(materials: PbrMaterialSet, hotspots: THREE.Object3D[]) {
  const group = new THREE.Group();
  const aerial = textureLoader.load(WUZHEN_EXHIBITION.assets.aerial);
  aerial.colorSpace = THREE.SRGBColorSpace;
  aerial.repeat.set(1, 0.5);
  aerial.offset.y = 0.02;
  const map = new THREE.Mesh(
    new THREE.PlaneGeometry(52, 27),
    new THREE.MeshStandardMaterial({ map: aerial, roughness: 0.88, metalness: 0 })
  );
  map.rotation.x = -Math.PI / 2;
  map.position.y = -0.32;
  map.receiveShadow = true;
  const rim = shadow(new THREE.Mesh(new THREE.BoxGeometry(54, 0.65, 29), materials.timber));
  rim.position.y = -0.74;
  group.add(map, rim);
  const landmarks: Array<[[number, number, number], [number, number, number], number]> = [
    [[-14, 0.16, -5], [5.6, 1.2, 3.4], -0.2],
    [[-4, 0.16, 4], [6.8, 1.35, 3.2], 0.1],
    [[8, 0.16, -1], [5.4, 1.1, 4.2], -0.15],
    [[17, 0.16, 5], [4.4, 1, 3.5], 0.22]
  ];
  for (const [position, size, rotation] of landmarks) {
    const miniature = new THREE.Group();
    miniature.position.set(...position);
    miniature.rotation.y = rotation;
    const base = shadow(new THREE.Mesh(new THREE.BoxGeometry(...size), materials.wall));
    base.position.y = size[1] / 2;
    const roof = shadow(new THREE.Mesh(gableGeometry(size[0] + 0.38, size[1] * 0.7, size[2] + 0.42), materials.roof));
    roof.position.y = size[1] + size[1] * 0.18;
    miniature.add(base, roof);
    for (let index = -1; index <= 1; index += 1) {
      const laneHouse = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.45, 0.96), materials.wall));
      laneHouse.position.set(index * 1.35, size[1] + 0.24, 0.16);
      miniature.add(laneHouse);
    }
    group.add(miniature);
  }
  for (const district of WUZHEN_DISTRICTS) {
    addMarker(group, district.id, district.marker, hotspots);
  }
  return group;
}

function createXizhaStreet(materials: PbrMaterialSet, hotspots: THREE.Object3D[], lanterns: THREE.Group[]) {
  const group = new THREE.Group();
  const water = createWater(6.2, 48, materials);
  water.position.y = 0.02;
  const leftWalk = shadow(new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.34, 48), materials.stone));
  leftWalk.position.set(-5.8, 0.02, 0);
  const rightWalk = shadow(new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.34, 48), materials.stone));
  rightWalk.position.set(5.65, 0.02, 0);
  group.add(water, leftWalk, rightWalk);
  const positions: Array<[[number, number, number], [number, number, number], number]> = [
    [[-9.6, 0.18, -17], [4.5, 5.7, 5], -0.04], [[9, 0.18, -17], [4.8, 5.4, 4.8], 0.02],
    [[-9.6, 0.18, -9], [5.6, 5.1, 4.5], 0.04], [[9.2, 0.18, -8.8], [4.6, 4.6, 5], -0.02],
    [[-9.3, 0.18, 0], [5, 5.6, 4.8], -0.03], [[9.2, 0.18, 0], [5.6, 5.2, 4.7], 0.02],
    [[-9.4, 0.18, 9], [5.2, 4.9, 4.5], 0.04], [[9.3, 0.18, 9.5], [4.5, 5.4, 5.2], -0.04],
    [[-9.2, 0.18, 17.5], [5.7, 5.4, 4.8], -0.03], [[9.4, 0.18, 17.5], [5.2, 4.8, 4.5], 0.04]
  ];
  for (const [position, size, rotation] of positions) addHouse(group, position, size, rotation, materials);
  addBridge(group, [0, 0.08, 2], 0, materials.stone);
  addBoat(group, [0, 0.19, -10], 0, materials);
  addBoat(group, [0.5, 0.19, 13], Math.PI, materials);
  for (const position of [[-5, 4.2, -11], [5, 4.2, -6], [-5, 4.3, 4], [5, 4.2, 11], [-5, 4.3, 18]] as Array<[number, number, number]>) {
    const lantern = addLantern(group, position, materials);
    lanterns.push(lantern);
    addReflection(group, [position[0] * 0.58, 0.055, position[2] - 2.3], 0.33, 4.6);
  }
  for (const position of [[-13, 0, -4], [13, 0, 6], [-13, 0, 15]] as Array<[number, number, number]>) {
    addTree(group, position, 1.2, materials);
  }
  const clothRack = new THREE.Group();
  clothRack.position.set(-6.8, 2.2, -7);
  for (const x of [-2.4, -0.8, 0.8, 2.4]) {
    const pole = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 4.1, 8), materials.timber));
    pole.position.set(x, 0, 0);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 2.15, 10, 8), materials.indigo);
    cloth.position.set(x, 0.05, 0.07);
    cloth.userData.cloth = true;
    clothRack.add(pole, cloth);
  }
  group.add(clothRack);
  addMarker(group, 'xizha', [0, 3.5, 4], hotspots);
  addMarker(group, 'dyeworks', [-6, 3.7, -6.6], hotspots);
  return group;
}

function addDyeFocus(
  group: THREE.Group,
  index: number,
  position: [number, number, number],
  size: [number, number, number],
  focuses: THREE.LineSegments[]
) {
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(...size)),
    new THREE.LineBasicMaterial({ color: '#f0c567', transparent: true, opacity: 0.94 })
  );
  outline.position.set(...position);
  outline.visible = index === 0;
  outline.userData.dyeFocus = true;
  outline.userData.dyeProcess = index;
  focuses.push(outline);
  group.add(outline);
}

function createDyeworksInterior(
  materials: PbrMaterialSet,
  hotspots: THREE.Object3D[],
  lanterns: THREE.Group[],
  focuses: THREE.LineSegments[]
) {
  const group = new THREE.Group();
  const floor = shadow(new THREE.Mesh(new THREE.BoxGeometry(24, 0.42, 18), materials.stone));
  floor.position.y = -0.22;
  group.add(floor);
  const backWall = shadow(new THREE.Mesh(new THREE.BoxGeometry(24, 8, 0.5), materials.wall));
  backWall.position.set(0, 4, -8.5);
  const leftWall = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 18), materials.wall));
  leftWall.position.set(-12, 4, 0);
  const rightWall = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 18), materials.wall));
  rightWall.position.set(12, 4, 0);
  const ceiling = shadow(new THREE.Mesh(new THREE.BoxGeometry(24, 0.45, 18), materials.timber));
  ceiling.position.y = 8.45;
  group.add(backWall, leftWall, rightWall, ceiling);
  for (const x of [-10, -5, 0, 5, 10]) {
    const beam = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.42, 8.6, 0.42), materials.timber));
    beam.position.set(x, 4.3, -6.8);
    const roofBeam = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 17), materials.timber));
    roofBeam.position.set(x, 8.1, 0);
    group.add(beam, roofBeam);
  }
  const rack = new THREE.Group();
  rack.position.set(0, 3.4, -5.8);
  for (const x of [-7, -3.5, 0, 3.5, 7]) {
    const bar = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5.5, 8), materials.timber));
    bar.rotation.z = Math.PI / 2;
    bar.position.set(x, 0, 0);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.2, 14, 10), materials.indigo);
    cloth.position.set(x, -0.2, 0.12);
    cloth.userData.cloth = true;
    rack.add(bar, cloth);
  }
  group.add(rack);
  for (const position of [[-7, 0.55, 1.5], [-2.2, 0.55, 1.2], [3.1, 0.55, 1.4], [7.5, 0.55, 1.2]] as Array<[number, number, number]>) {
    const vat = shadow(new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.34, 1.3, 20), materials.timber));
    vat.position.set(...position);
    const dye = new THREE.Mesh(new THREE.CylinderGeometry(0.94, 0.94, 0.07, 20), materials.water);
    dye.position.set(position[0], position[1] + 0.7, position[2]);
    group.add(vat, dye);
  }
  const workbench = shadow(new THREE.Mesh(new THREE.BoxGeometry(8.4, 1.1, 2.4), materials.timber));
  workbench.position.set(0, 0.55, 5);
  group.add(workbench);
  for (const x of [-2.1, 0, 2.1]) {
    const carvedBoard = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.1, 1.7), materials.timber));
    carvedBoard.position.set(x, 1.15, 5);
    carvedBoard.rotation.z = x * 0.04;
    group.add(carvedBoard);
  }
  const pasteTray = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.12, 1.15),
    new THREE.MeshStandardMaterial({ color: '#d7d4be', roughness: 0.48 })
  );
  pasteTray.position.set(-3.05, 1.18, 5);
  group.add(pasteTray);
  for (const position of [[-8, 6.5, -4.2], [0, 6.6, -3.8], [8, 6.5, -4.2]] as Array<[number, number, number]>) {
    const lantern = addLantern(group, position, materials);
    lanterns.push(lantern);
  }
  for (const position of [[-6, 6.2, 1], [0, 6.5, 2], [6, 6.2, 1]] as Array<[number, number, number]>) {
    const workLight = new THREE.PointLight('#ffd598', 1.15, 13, 1.7);
    workLight.position.set(...position);
    group.add(workLight);
  }
  addDyeFocus(group, 0, [0, 1.34, 5], [5.8, 0.38, 2.1], focuses);
  addDyeFocus(group, 1, [-3.05, 1.35, 5], [2.4, 0.34, 1.4], focuses);
  addDyeFocus(group, 2, [3.1, 1.28, 1.4], [2.8, 1.45, 2.8], focuses);
  addDyeFocus(group, 3, [0, 3.2, -5.65], [18, 4.2, 0.5], focuses);
  addMarker(group, 'xizha', [10.3, 1.5, 5], hotspots);
  return group;
}

function createNightRiver(materials: PbrMaterialSet, hotspots: THREE.Object3D[], lanterns: THREE.Group[]) {
  const group = new THREE.Group();
  const water = createWater(13.5, 52, materials);
  water.position.y = -0.06;
  group.add(water);
  const leftBank = shadow(new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.58, 52), materials.stone));
  leftBank.position.set(-9.5, -0.25, 0);
  const rightBank = shadow(new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.58, 52), materials.stone));
  rightBank.position.set(9.5, -0.25, 0);
  group.add(leftBank, rightBank);
  for (const [position, size] of [
    [[-14, 0, -16], [5.8, 5.1, 5]], [[14, 0, -16], [5.6, 5.5, 5.2]],
    [[-14, 0, -6], [5.1, 5.7, 4.7]], [[14, 0, -5], [5.5, 5.3, 5.2]],
    [[-14, 0, 5], [5.6, 5, 4.8]], [[14, 0, 6], [5.2, 5.4, 5]],
    [[-14, 0, 16], [5.2, 5.8, 5]], [[14, 0, 16], [5.9, 5, 4.7]]
  ] as Array<[[number, number, number], [number, number, number]]>) {
    addHouse(group, position, size, position[0] < 0 ? -Math.PI / 2 : Math.PI / 2, materials);
  }
  addBridge(group, [0, 0, -11], 0, materials.stone);
  const bow = new THREE.Group();
  bow.position.set(0, 0.25, 11.2);
  const deck = shadow(new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.3, 7.8), materials.timber));
  deck.position.y = 0.25;
  const leftRail = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.25, 7.1), materials.timber));
  leftRail.position.set(-4, 0.95, 0);
  const rightRail = leftRail.clone();
  rightRail.position.x = 4;
  bow.add(deck, leftRail, rightRail);
  group.add(bow);
  const tower = new THREE.Group();
  tower.position.set(0, 0, -23);
  for (let level = 0; level < 5; level += 1) {
    const body = shadow(new THREE.Mesh(new THREE.CylinderGeometry(1.1 - level * 0.11, 1.34 - level * 0.11, 1.35, 8), materials.wall));
    body.position.y = level * 1.25 + 0.7;
    const roof = shadow(new THREE.Mesh(new THREE.ConeGeometry(1.68 - level * 0.12, 0.5, 8), materials.roof));
    roof.position.y = level * 1.25 + 1.6;
    tower.add(body, roof);
  }
  group.add(tower);
  const towerLight = new THREE.PointLight('#ffca72', 5.8, 22, 1.5);
  towerLight.position.set(0, 4.5, -22.2);
  group.add(towerLight);
  for (const [x, z, length] of [[-5.5, -13, 7], [5.6, -7, 8], [-4.8, 4, 6], [5, 13, 5], [0, -21, 9]] as Array<[number, number, number]>) {
    addReflection(group, [x, 0.065, z], x === 0 ? 1.1 : 0.52, length, x === 0 ? '#e4a04d' : '#d78939');
  }
  for (const position of [[-8.7, 4.3, -17], [8.7, 4.3, -16], [-8.7, 4.4, -6], [8.7, 4.3, -4], [-8.7, 4.2, 7], [8.7, 4.4, 8], [-8.7, 4.3, 17], [8.7, 4.3, 17]] as Array<[number, number, number]>) {
    const lantern = addLantern(group, position, materials);
    lanterns.push(lantern);
    addReflection(group, [position[0] * 0.58, 0.065, position[2] - 1.8], 0.34, 4.8);
  }
  addMarker(group, 'overview', [0, 3, 4], hotspots);
  return group;
}

function createRain() {
  const count = 1500;
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    positions[offset] = (Math.random() - 0.5) * 48;
    positions[offset + 1] = Math.random() * 24;
    positions[offset + 2] = (Math.random() - 0.5) * 54;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: '#d9ebee', size: 0.075, transparent: true, opacity: 0.72, depthWrite: false });
  const rain = new THREE.Points(geometry, material);
  rain.visible = false;
  return rain;
}

export function createWuzhenWorld(): WuzhenWorld {
  const root = new THREE.Group();
  root.name = 'WuzhenExhibitionWorld';
  const materials = createMaterials();
  const hotspots: THREE.Object3D[] = [];
  const lanterns: THREE.Group[] = [];
  const dyeFocuses: THREE.LineSegments[] = [];
  const scenes: Record<DistrictId, THREE.Group> = {
    overview: createSandtable(materials, hotspots),
    xizha: createXizhaStreet(materials, hotspots, lanterns),
    dyeworks: createDyeworksInterior(materials, hotspots, lanterns, dyeFocuses),
    'night-river': createNightRiver(materials, hotspots, lanterns)
  };
  const rain = createRain();
  root.add(...Object.values(scenes), rain);
  let activeDistrict: DistrictId = 'overview';
  let activeWeather: WeatherMode = 'sun';
  let activeDyeProcess = 0;

  const setDistrict = (districtId: DistrictId) => {
    activeDistrict = districtId;
    for (const [id, scene] of Object.entries(scenes) as Array<[DistrictId, THREE.Group]>) {
      scene.visible = id === districtId;
    }
    if (districtId === 'night-river' && activeWeather !== 'night') setWeather('night');
  };

  const setWeather = (mode: WeatherMode) => {
    activeWeather = mode;
    const setting = WUZHEN_EXHIBITION.weather[mode];
    materials.water.color.set(setting.water);
    materials.water.emissive.set(mode === 'night' ? '#071c2a' : mode === 'rain' ? '#123540' : '#082128');
    materials.water.emissiveIntensity = mode === 'night' ? 0.88 : mode === 'rain' ? 0.36 : 0.18;
    materials.water.roughness = mode === 'rain' ? 0.08 : mode === 'night' ? 0.11 : 0.18;
    materials.water.clearcoatRoughness = mode === 'rain' ? 0.06 : 0.16;
    materials.stone.roughness = mode === 'rain' ? 0.44 : 0.88;
    materials.wall.roughness = mode === 'rain' ? 0.62 : 0.84;
    materials.window.emissiveIntensity = mode === 'night' ? 2.35 : mode === 'rain' ? 0.32 : 0.02;
    rain.visible = setting.rain;
    for (const lantern of lanterns) {
      const light = lantern.userData.light as THREE.PointLight;
      light.intensity = setting.lanternIntensity;
    }
    materials.lantern.emissiveIntensity = setting.lanternIntensity * 0.65;
  };

  const setDyeProcess = (index: number) => {
    activeDyeProcess = THREE.MathUtils.clamp(Math.floor(index), 0, 3);
    for (const focus of dyeFocuses) {
      focus.visible = focus.userData.dyeProcess === activeDyeProcess;
    }
  };

  const update = (elapsedSeconds: number, deltaSeconds: number) => {
    materials.water.opacity = 0.9 + Math.sin(elapsedSeconds * 1.4) * 0.025;
    scenes[activeDistrict].traverse((object) => {
      if (object.userData.cloth) object.rotation.y = Math.sin(elapsedSeconds * 1.7 + object.position.x) * 0.075;
      if (object.userData.boat) object.rotation.z = Math.sin(elapsedSeconds * 0.8 + object.position.z) * 0.025;
      if (object.userData.waterSurface) {
        const geometry = (object as THREE.Mesh).geometry;
        const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
        const base = object.userData.basePositions as Float32Array;
        for (let index = 0; index < positions.count; index += 1) {
          const offset = index * 3;
          const x = base[offset];
          const y = base[offset + 1];
          positions.setZ(index, Math.sin(x * 1.35 + elapsedSeconds * 1.9) * 0.052 + Math.cos(y * 1.1 - elapsedSeconds * 1.45) * 0.032);
        }
        positions.needsUpdate = true;
      }
      if (object.userData.reflection) {
        const scale = 0.86 + Math.sin(elapsedSeconds * 2.1 + object.position.z) * 0.14;
        object.scale.z = object.userData.baseScaleZ * scale;
      }
    });
    for (const focus of dyeFocuses) {
      if (!focus.visible) continue;
      const pulse = 1 + Math.sin(elapsedSeconds * 2.5) * 0.025;
      focus.scale.setScalar(pulse);
    }
    for (const hotspot of hotspots) {
      if (!hotspot.visible) continue;
      hotspot.rotation.y = elapsedSeconds * 0.65;
      hotspot.position.y = hotspot.userData.baseY + Math.sin(elapsedSeconds * 2.1) * 0.11;
    }
    if (rain.visible) {
      const positions = rain.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let index = 0; index < positions.count; index += 1) {
        const nextY = positions.getY(index) - deltaSeconds * 14;
        positions.setY(index, nextY < 0 ? 23 : nextY);
        positions.setX(index, positions.getX(index) - deltaSeconds * 2.2);
      }
      positions.needsUpdate = true;
    }
  };

  setDistrict('overview');
  setWeather('sun');
  setDyeProcess(0);
  return { root, hotspots, setDistrict, setWeather, setDyeProcess, update };
}
