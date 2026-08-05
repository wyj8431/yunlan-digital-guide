import * as THREE from 'three';
import type { Collider } from '../collision';
import { HALL_DIMENSIONS, HALL_Z_BOUNDS } from '../exhibitionLayout';
import type { HallMaterials } from '../exhibitionMaterials';

const DIVIDER_Z = [42, 28, 14, 0, -14] as const;
const HALF_HALL_WIDTH = HALL_DIMENSIONS.width / 2;
const HALL_CENTER_Z = (HALL_Z_BOUNDS.min + HALL_Z_BOUNDS.max) / 2;
const AISLE_HALF_WIDTH = 6;
const SIDE_BAY_WIDTH = HALF_HALL_WIDTH - AISLE_HALF_WIDTH;
const SIDE_BAY_CENTER = (HALF_HALL_WIDTH + AISLE_HALF_WIDTH) / 2;

export const JIANGNAN_HALL_COLLIDERS: Collider[] = DIVIDER_Z.flatMap((z) => [
  { minX: -HALF_HALL_WIDTH, maxX: -AISLE_HALF_WIDTH, minZ: z - 0.22, maxZ: z + 0.22 },
  { minX: AISLE_HALF_WIDTH, maxX: HALF_HALL_WIDTH, minZ: z - 0.22, maxZ: z + 0.22 }
]);

function box(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createJiangnanHall(materials: HallMaterials): THREE.Group {
  const hall = new THREE.Group();
  hall.name = 'jiangnan-museum-hall';
  hall.userData.dimensions = { ...HALL_DIMENSIONS };

  const wall = materials.wall;
  const shell = new THREE.Group();
  shell.name = 'architectural-shell';
  shell.add(
    box(HALL_DIMENSIONS.width, HALL_DIMENSIONS.height, 0.24, wall, 0, 3.2, HALL_Z_BOUNDS.min),
    box(HALL_DIMENSIONS.width, HALL_DIMENSIONS.height, 0.24, wall, 0, 3.2, HALL_Z_BOUNDS.max),
    box(0.24, HALL_DIMENSIONS.height, HALL_DIMENSIONS.depth, wall, -HALF_HALL_WIDTH, 3.2, HALL_CENTER_Z),
    box(0.24, HALL_DIMENSIONS.height, HALL_DIMENSIONS.depth, wall, HALF_HALL_WIDTH, 3.2, HALL_CENTER_Z),
    box(HALL_DIMENSIONS.width, 0.2, HALL_DIMENSIONS.depth, materials.ceiling, 0, 6.3, HALL_CENTER_Z)
  );

  const floor = new THREE.Group();
  floor.name = 'stone-floor';
  floor.add(box(HALL_DIMENSIONS.width, 0.2, HALL_DIMENSIONS.depth, materials.floor, 0, -0.1, HALL_CENTER_Z));

  const moonGate = new THREE.Group();
  moonGate.name = 'moon-gate';
  for (const z of DIVIDER_Z) {
    moonGate.add(
      box(SIDE_BAY_WIDTH, 6, 0.34, wall, -SIDE_BAY_CENTER, 3, z),
      box(SIDE_BAY_WIDTH, 6, 0.34, wall, SIDE_BAY_CENTER, 3, z),
      box(HALL_DIMENSIONS.width - 2, 0.32, 0.42, materials.wood, 0, 6.05, z)
    );
  }

  const lattice = new THREE.Group();
  lattice.name = 'walnut-lattice';
  const latticeGeometry = new THREE.BoxGeometry(0.11, 4.5, 0.16);
  const latticeCount = 72;
  const instances = new THREE.InstancedMesh(latticeGeometry, materials.wood, latticeCount);
  instances.name = 'lattice-members';
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < latticeCount; index += 1) {
    const side = index < latticeCount / 2 ? -1 : 1;
    const local = index % (latticeCount / 2);
    matrix.makeTranslation(side * (HALF_HALL_WIDTH - 0.22), 3.15, 56 - local * 1.62);
    instances.setMatrixAt(index, matrix);
  }
  instances.castShadow = true;
  lattice.add(instances);
  hall.userData.instancedLatticeCount = latticeCount;

  const tracks = new THREE.Group();
  tracks.name = 'ceiling-tracks';
  for (const x of [-14, -7, 0, 7, 14]) {
    tracks.add(box(0.09, 0.08, HALL_DIMENSIONS.depth - 2, materials.metal, x, 6.14, HALL_CENTER_Z));
  }

  const scroll = new THREE.Group();
  scroll.name = 'west-lake-scroll';
  for (const [index, z] of [52, 38, 24, 10, -4, -18].entries()) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(index === 2 ? 3.2 : 2.15, 0.055, 8, 64),
      materials.lightTrim
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 6.12, z);
    scroll.add(ring);
  }

  const wayfinding = new THREE.Group();
  wayfinding.name = 'wayfinding';
  wayfinding.add(box(0.1, 0.018, HALL_DIMENSIONS.depth - 2, materials.lightTrim, 0, 0.018, HALL_CENTER_Z));
  for (const z of [52, 38, 24, 10, -4, -18]) {
    wayfinding.add(
      box(5.2, 0.018, 0.08, materials.lightTrim, -2.6, 0.02, z),
      box(5.2, 0.018, 0.08, materials.lightTrim, 2.6, 0.02, z)
    );
  }

  const fireExit = new THREE.Group();
  fireExit.name = 'fire-exit';
  const signMaterial = new THREE.MeshStandardMaterial({
    color: '#176a45',
    emissive: '#0b5a3a',
    emissiveIntensity: 0.5
  });
  fireExit.add(box(1.1, 0.34, 0.04, signMaterial, 20.4, 4.8, HALL_Z_BOUNDS.min + 0.16));

  hall.add(shell, moonGate, lattice, floor, tracks, scroll, wayfinding, fireExit);
  return hall;
}
