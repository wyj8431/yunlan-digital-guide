import * as THREE from 'three';
import { HALL_DIMENSIONS } from '../exhibitionLayout';
import type { HallMaterials } from '../exhibitionMaterials';
import type { Collider } from '../collision';

export const JIANGNAN_HALL_COLLIDERS: Collider[] = [
  { minX: -8, maxX: -1.7, minZ: 7.5, maxZ: 7.95 },
  { minX: 1.7, maxX: 8, minZ: 7.5, maxZ: 7.95 },
  { minX: -7.45, maxX: -6.25, minZ: -8.2, maxZ: -1.1 },
  { minX: 6.25, maxX: 7.45, minZ: -8.2, maxZ: -1.1 }
];

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

  const shell = new THREE.Group();
  shell.name = 'architectural-shell';
  shell.add(
    box(16, 4.8, 0.22, materials.wall, 0, 2.4, -10),
    box(0.22, 4.8, 20, materials.wall, -8, 2.4, 0),
    box(0.22, 4.8, 20, materials.wall, 8, 2.4, 0),
    box(16, 0.18, 20, materials.ceiling, 0, 4.71, 0),
    box(16, 0.18, 0.22, materials.metal, 0, 4.3, 10)
  );

  const floor = new THREE.Group();
  floor.name = 'stone-floor';
  floor.add(box(16, 0.18, 20, materials.floor, 0, -0.09, 0));

  const moonGate = new THREE.Group();
  moonGate.name = 'moon-gate';
  const gateShape = new THREE.Shape();
  gateShape.moveTo(-2.15, 0);
  gateShape.lineTo(2.15, 0);
  gateShape.lineTo(2.15, 4.25);
  gateShape.lineTo(-2.15, 4.25);
  gateShape.closePath();
  const opening = new THREE.Path();
  opening.absarc(0, 1.72, 1.7, 0, Math.PI * 2, false);
  gateShape.holes.push(opening);
  const gate = new THREE.Mesh(
    new THREE.ExtrudeGeometry(gateShape, { depth: 0.28, bevelEnabled: false }),
    materials.wall
  );
  gate.position.set(0, 0, 7.65);
  gate.castShadow = true;
  moonGate.add(gate);

  const lattice = new THREE.Group();
  lattice.name = 'walnut-lattice';
  const latticeGeometry = new THREE.BoxGeometry(0.055, 2.8, 0.09);
  const latticeCount = 32;
  const instances = new THREE.InstancedMesh(latticeGeometry, materials.wood, latticeCount);
  instances.name = 'lattice-members';
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < latticeCount; index += 1) {
    const side = index < latticeCount / 2 ? -1 : 1;
    const local = index % (latticeCount / 2);
    matrix.makeTranslation(
      side * (6.45 + (local % 4) * 0.23),
      2.35,
      -7.5 + Math.floor(local / 4) * 1.65
    );
    instances.setMatrixAt(index, matrix);
  }
  instances.castShadow = true;
  lattice.add(instances);
  hall.userData.instancedLatticeCount = latticeCount;

  const tracks = new THREE.Group();
  tracks.name = 'ceiling-tracks';
  for (const x of [-4.8, 0, 4.8]) tracks.add(box(0.07, 0.06, 14, materials.metal, x, 4.57, -0.8));

  const scroll = new THREE.Group();
  scroll.name = 'west-lake-scroll';
  scroll.add(box(8.4, 2.55, 0.06, materials.wall, 0, 2.35, -9.84));

  const wayfinding = new THREE.Group();
  wayfinding.name = 'wayfinding';
  for (const z of [6, 2, -2, -6])
    wayfinding.add(box(0.12, 0.012, 1.1, materials.metal, 0, 0.012, z));

  const fireExit = new THREE.Group();
  fireExit.name = 'fire-exit';
  const signMaterial = new THREE.MeshStandardMaterial({
    color: '#176a45',
    emissive: '#0b301f',
    emissiveIntensity: 0.35
  });
  fireExit.add(box(0.88, 0.3, 0.035, signMaterial, 6.7, 3.55, -9.86));

  hall.add(shell, moonGate, lattice, floor, tracks, scroll, wayfinding, fireExit);
  return hall;
}
