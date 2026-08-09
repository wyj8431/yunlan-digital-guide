import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { disposeObject3D } from '../../lib/three/disposeObject3D';
import type { LoadedExhibitionAssets } from '../assets/ExhibitionAssetLoader';
import type { Collider } from '../collision';
import type { QualityProfile } from '../quality/qualityProfile';

export const WEST_LAKE_COLLIDERS: Collider[] = [
  { minX: -8.5, maxX: -0.9, minZ: -5, maxZ: 5 },
  { minX: 0.9, maxX: 8.5, minZ: -5, maxZ: 5 },
  { minX: -1.02, maxX: -0.72, minZ: -1.55, maxZ: 1.55 },
  { minX: 0.72, maxX: 1.02, minZ: -1.55, maxZ: 1.55 },
  { minX: 4.65, maxX: 6.75, minZ: -5.85, maxZ: -3.75 },
  { minX: -3.55, maxX: -2.7, minZ: 5.35, maxZ: 6.25 },
  { minX: 2.65, maxX: 3.55, minZ: 5.25, maxZ: 6.15 }
];

type LakeZone = 'lake' | 'shore' | 'vegetation' | 'distance';

export type WestLakeEnvironment = {
  root: THREE.Group;
  water: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshPhysicalMaterial>;
  instancedVegetation: THREE.InstancedMesh;
  foliageUniforms: { time: { value: number }; windStrength: { value: number } };
  atmosphere: THREE.Group;
  colliders: Collider[];
  update(deltaSeconds: number): void;
  setReducedMotion(reduced: boolean): void;
  setZoneVisible(zone: LakeZone, visible: boolean): void;
  dispose(): void;
};

function mesh<TGeometry extends THREE.BufferGeometry, TMaterial extends THREE.Material>(
  geometry: TGeometry,
  material: TMaterial,
  name?: string
) {
  const result = new THREE.Mesh(geometry, material);
  if (name) result.name = name;
  result.castShadow = false;
  result.receiveShadow = false;
  return result;
}

function createWater() {
  const material = new THREE.MeshPhysicalMaterial({
    color: '#357c83',
    roughness: 0.28,
    metalness: 0.04,
    transparent: true,
    opacity: 0.94,
    clearcoat: 0.28,
    clearcoatRoughness: 0.3
  });
  const outline = new THREE.Shape();
  outline.moveTo(-8.9, -4.1);
  outline.bezierCurveTo(-7.4, -5.25, -3.2, -5.1, 0, -4.72);
  outline.bezierCurveTo(3.4, -5.25, 7.25, -5.05, 8.95, -3.92);
  outline.bezierCurveTo(9.3, -1.4, 9.05, 2.65, 8.25, 4.38);
  outline.bezierCurveTo(5.9, 5.18, 2.65, 4.82, 0, 4.55);
  outline.bezierCurveTo(-3.3, 5.15, -7.25, 4.92, -8.75, 3.75);
  outline.bezierCurveTo(-9.2, 1.7, -9.15, -1.85, -8.9, -4.1);
  const water = mesh(new THREE.ShapeGeometry(outline, 12), material, 'lake-surface');
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.03;
  water.castShadow = false;
  const directions = [new THREE.Vector2(0.92, 0.38), new THREE.Vector2(-0.28, 0.96)];
  const offset = new THREE.Vector2();
  water.userData.windField = { directions, offset, speeds: [0.042, 0.026] };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.windOffset = { value: offset };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec2 windOffset;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed.z += (sin(position.x * 1.7 + windOffset.x * 20.0) + cos(position.y * 1.25 + windOffset.y * 18.0)) * 0.022;'
      );
  };
  material.customProgramCacheKey = () => 'west-lake-two-direction-wind-v1';
  return water;
}

function createShoreline() {
  const root = new THREE.Group();
  root.name = 'natural-shoreline';
  const stone = new THREE.MeshStandardMaterial({ color: '#a9aa9d', roughness: 0.94 });
  const soil = new THREE.MeshStandardMaterial({ color: '#556f55', roughness: 0.98 });
  const points: Array<[number, number, number]> = [
    [-9.2, -5.5, 0.7],
    [-7.4, -5.35, 0.55],
    [-5.1, -5.6, 0.72],
    [-2.8, -5.35, 0.5],
    [2.7, -5.5, 0.58],
    [5.2, -5.35, 0.68],
    [7.5, -5.55, 0.52],
    [9.1, -5.3, 0.72],
    [-9.1, 5.3, 0.62],
    [-6.9, 5.5, 0.7],
    [-4.6, 5.28, 0.48],
    [4.5, 5.42, 0.56],
    [7.1, 5.24, 0.7],
    [9.15, 5.5, 0.58]
  ];
  points.forEach(([x, z, radius], index) => {
    const bank = mesh(new THREE.DodecahedronGeometry(radius, 1), index % 3 === 0 ? stone : soil);
    bank.scale.set(1.6, 0.32 + (index % 2) * 0.08, 0.72);
    bank.position.set(x, 0.02, z);
    bank.rotation.y = index * 0.71;
    root.add(bank);
  });
  return root;
}

function createCauseway() {
  const root = new THREE.Group();
  root.name = 'su-causeway';
  const paving = new THREE.MeshStandardMaterial({ color: '#8b9285', roughness: 0.9 });
  const edge = new THREE.MeshStandardMaterial({ color: '#626d65', roughness: 0.96 });
  const deck = mesh(new THREE.BoxGeometry(1.8, 0.22, 15.5), paving);
  deck.position.y = 0.11;
  const leftEdge = mesh(new THREE.BoxGeometry(0.14, 0.32, 15.5), edge);
  leftEdge.position.set(-0.86, 0.12, 0);
  const rightEdge = leftEdge.clone();
  rightEdge.position.x = 0.86;
  root.add(deck, leftEdge, rightEdge);
  return root;
}

function createStoneBridge() {
  const root = new THREE.Group();
  root.name = 'stone-arch-bridge';
  const stone = new THREE.MeshStandardMaterial({ color: '#d6d1c3', roughness: 0.88 });
  const deckGeometry = new THREE.BoxGeometry(1.8, 0.22, 3.2, 1, 1, 16);
  const positions = deckGeometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const z = positions.getZ(index);
    positions.setY(index, positions.getY(index) + Math.cos((z / 3.2) * Math.PI) * 0.36);
  }
  positions.needsUpdate = true;
  deckGeometry.computeVertexNormals();
  const deck = mesh(deckGeometry, stone);
  deck.position.y = 0.3;
  root.add(deck);
  for (const x of [-0.86, 0.86]) {
    const rail = mesh(new THREE.BoxGeometry(0.13, 0.16, 3.1), stone);
    rail.position.set(x, 0.83, 0);
    root.add(rail);
    for (let z = -1.35; z <= 1.36; z += 0.45) {
      const post = mesh(new THREE.BoxGeometry(0.13, 0.56, 0.13), stone);
      post.position.set(x, 0.58 + Math.cos((z / 3.2) * Math.PI) * 0.34, z);
      root.add(post);
    }
  }
  return root;
}

function createVegetation(
  profile: QualityProfile,
  foliageUniforms: WestLakeEnvironment['foliageUniforms']
) {
  const count = Math.max(22, Math.round(72 * profile.vegetationDensity));
  const trunk = new THREE.CylinderGeometry(0.09, 0.15, 1.05, 7);
  trunk.translate(0, 0.52, 0);
  const crown = new THREE.IcosahedronGeometry(0.52, 1);
  crown.scale(0.86, 1.12, 0.82);
  crown.translate(0, 1.35, 0);
  const leftCrown = new THREE.IcosahedronGeometry(0.34, 1);
  leftCrown.scale(0.9, 1.1, 0.86);
  leftCrown.translate(-0.34, 1.17, 0.05);
  const rightCrown = leftCrown.clone();
  rightCrown.translate(0.68, 0.08, -0.08);
  const geometry = mergeGeometries(
    [trunk, crown, leftCrown, rightCrown].map((part) => (part.index ? part.toNonIndexed() : part)),
    true
  );
  if (!geometry) throw new Error('Unable to merge West Lake vegetation geometry');
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: '#52483a', roughness: 0.96 });
  const foliageMaterial = new THREE.MeshStandardMaterial({ color: '#3f7957', roughness: 0.92 });
  foliageMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.foliageTime = foliageUniforms.time;
    shader.uniforms.windStrength = foliageUniforms.windStrength;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float foliageTime;\nuniform float windStrength;'
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed.x += sin(foliageTime * 1.4 + position.y * 2.7) * windStrength * max(position.y, 0.0);'
      );
  };
  foliageMaterial.customProgramCacheKey = () => 'west-lake-instanced-foliage-v2';
  const vegetation = new THREE.InstancedMesh(
    geometry,
    [trunkMaterial, foliageMaterial, foliageMaterial, foliageMaterial],
    count
  );
  vegetation.name = 'vegetation-instances';
  vegetation.castShadow = profile.shadowMapSize >= 1024;
  vegetation.receiveShadow = false;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  for (let index = 0; index < count; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const row = Math.floor(index / 2);
    const z = -7.4 + ((row * 1.91) % 14.8);
    const x = side * (3.15 + ((row * 1.37) % 5.9));
    const size = 0.62 + ((index * 37) % 39) / 100;
    position.set(x, 0.1 + ((index * 13) % 8) / 100, z);
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), index * 1.618);
    scale.set(size * (0.82 + (index % 3) * 0.1), size * (1.15 + (index % 4) * 0.08), size);
    matrix.compose(position, quaternion, scale);
    vegetation.setMatrixAt(index, matrix);
  }
  vegetation.instanceMatrix.needsUpdate = true;
  return vegetation;
}

function createPagoda() {
  const root = new THREE.Group();
  root.name = 'leifeng-pagoda';
  const plaster = new THREE.MeshStandardMaterial({ color: '#b58b5f', roughness: 0.76 });
  const timber = new THREE.MeshStandardMaterial({ color: '#46362f', roughness: 0.72 });
  const roof = new THREE.MeshStandardMaterial({
    color: '#263d36',
    roughness: 0.64,
    metalness: 0.08
  });
  const base = mesh(new THREE.CylinderGeometry(1.18, 1.28, 0.3, 8), timber);
  base.position.y = 0.15;
  root.add(base);
  for (let level = 0; level < 5; level += 1) {
    const width = 0.9 - level * 0.075;
    const body = mesh(new THREE.CylinderGeometry(width, width * 1.06, 0.62, 8), plaster);
    body.position.y = 0.62 + level * 0.72;
    const eave = mesh(new THREE.CylinderGeometry(0.16, width * 1.42, 0.18, 8), roof);
    eave.position.y = 0.98 + level * 0.72;
    root.add(body, eave);
  }
  const finial = mesh(new THREE.CylinderGeometry(0.035, 0.07, 0.62, 8), timber);
  finial.position.y = 4.18;
  root.add(finial);
  root.position.set(5.7, 0, -4.8);
  return root;
}

function createMountains() {
  const root = new THREE.Group();
  root.name = 'distant-mountains';
  const colors = ['#718a7b', '#668071', '#587365'];
  const ranges = [
    { z: -11.2, y: 1.1, scale: 1 },
    { z: -13, y: 1.5, scale: 1.28 },
    { z: -15.2, y: 1.8, scale: 1.55 }
  ];
  ranges.forEach((range, rangeIndex) => {
    const shape = new THREE.Shape();
    shape.moveTo(-15, 0);
    for (let index = 0; index <= 12; index += 1) {
      const x = -15 + index * 2.5;
      const base = 0.55 + Math.sin(index * 1.31 + rangeIndex) * 0.22;
      const peak = base + (0.85 + ((index * 17 + rangeIndex * 11) % 13) / 10) * range.scale;
      shape.lineTo(x - 0.8, base);
      shape.quadraticCurveTo(x, peak, x + 0.8, base + 0.08);
    }
    shape.lineTo(15, -0.3);
    shape.lineTo(-15, -0.3);
    const geometry = new THREE.ShapeGeometry(shape, 10);
    const ridge = mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: colors[rangeIndex],
        roughness: 1,
        transparent: true,
        opacity: 0.58 - rangeIndex * 0.1,
        side: THREE.DoubleSide
      })
    );
    ridge.position.set(0, range.y - 0.7, range.z);
    ridge.castShadow = false;
    root.add(ridge);
  });
  return root;
}

function createAtmosphere(profile: QualityProfile) {
  const root = new THREE.Group();
  root.name = 'atmosphere';
  root.userData.volumetric = profile.volumetricFog;
  root.userData.godRays = profile.godRays;
  if (profile.volumetricFog) {
    const mist = mesh(
      new THREE.PlaneGeometry(24, 5),
      new THREE.MeshBasicMaterial({
        color: '#d9e8df',
        transparent: true,
        opacity: 0.025,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      }),
      'volumetric-mist'
    );
    mist.position.set(0, 1.7, -7.8);
    mist.castShadow = false;
    root.add(mist);
  }
  if (profile.godRays) {
    const rayMaterial = new THREE.MeshBasicMaterial({
      color: '#fff2c7',
      transparent: true,
      opacity: 0.012,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    for (let index = 0; index < 3; index += 1) {
      const ray = mesh(
        new THREE.PlaneGeometry(0.7 + index * 0.32, 9),
        rayMaterial,
        `sun-ray-${index}`
      );
      ray.rotation.set(-0.22, 0.35, -0.52);
      ray.position.set(-4 + index * 1.8, 4.8, -4 - index);
      ray.castShadow = false;
      root.add(ray);
    }
  }
  return root;
}

export function createWestLakeEnvironment(
  assets: LoadedExhibitionAssets,
  profile: QualityProfile
): WestLakeEnvironment {
  const root = new THREE.Group();
  root.name = 'west-lake-environment';
  const waterZone = new THREE.Group();
  waterZone.name = 'lake-water';
  const water = createWater();
  waterZone.add(water);
  const shoreline = createShoreline();
  const causeway = createCauseway();
  const bridge = createStoneBridge();
  const foliageUniforms = { time: { value: 0 }, windStrength: { value: 0.018 } };
  const vegetationZone = new THREE.Group();
  vegetationZone.name = 'instanced-vegetation';
  const instancedVegetation = createVegetation(profile, foliageUniforms);
  vegetationZone.add(instancedVegetation);
  const pagoda = createPagoda();
  const mountains = createMountains();
  const atmosphere = createAtmosphere(profile);
  root.add(waterZone, shoreline, causeway, bridge, vegetationZone, pagoda, mountains, atmosphere);

  if (assets.environment) root.userData.environment = assets.environment;
  const zones: Record<LakeZone, THREE.Object3D[]> = {
    lake: [waterZone, causeway, bridge],
    shore: [shoreline, pagoda],
    vegetation: [vegetationZone],
    distance: [mountains, atmosphere]
  };
  let reducedMotion = false;
  let disposed = false;

  return {
    root,
    water,
    instancedVegetation,
    foliageUniforms,
    atmosphere,
    colliders: WEST_LAKE_COLLIDERS,
    update(deltaSeconds) {
      if (disposed || reducedMotion) return;
      if (waterZone.visible) {
        const wind = water.userData.windField as {
          directions: THREE.Vector2[];
          offset: THREE.Vector2;
          speeds: number[];
        };
        wind.offset.addScaledVector(wind.directions[0], deltaSeconds * wind.speeds[0]);
        wind.offset.addScaledVector(wind.directions[1], deltaSeconds * wind.speeds[1]);
      }
      if (vegetationZone.visible) foliageUniforms.time.value += deltaSeconds;
      if (atmosphere.visible) atmosphere.rotation.y += deltaSeconds * 0.004;
    },
    setReducedMotion(reduced) {
      reducedMotion = reduced;
      atmosphere.children.forEach((child) => {
        if (child.name.startsWith('sun-ray')) child.visible = !reduced;
      });
    },
    setZoneVisible(zone, visible) {
      zones[zone].forEach((object) => {
        object.visible = visible;
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeObject3D(root);
      root.clear();
    }
  };
}
