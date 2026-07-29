import * as THREE from 'three';
import type { LoadedExhibitionAssets } from '../assets/ExhibitionAssetLoader';
import type { ExhibitLayoutItem } from '../exhibitionLayout';

const DISPLAY_SURFACE_Y = 0.64;

const MODEL_BINDINGS = [
  { assetId: 'bicycle', exhibitId: 'west-lake-bicycle', maxHeight: 1.75 },
  { assetId: 'shuttle', exhibitId: 'green-mobility-car', maxHeight: 1.9 },
  { assetId: 'tea-set', exhibitId: 'silk-and-tea', maxHeight: 1.2 },
  { assetId: 'silk-garment', exhibitId: 'silk-garment', maxHeight: 1.95 }
] as const;

function markExhibit(root: THREE.Object3D, exhibitId: string) {
  root.traverse((object) => {
    object.userData.exhibitId = exhibitId;
  });
}

function configureShadows(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const opaque = materials.every((material) => {
      const physical = material as THREE.MeshPhysicalMaterial;
      return !material.transparent && (physical.transmission ?? 0) === 0;
    });
    mesh.castShadow = opaque;
    mesh.receiveShadow = opaque;
  });
}

function createFallback(exhibitId: string, layout: ExhibitLayoutItem) {
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: exhibitId === 'silk-garment' ? '#8f2838' : '#b99a59',
    metalness: 0.12,
    roughness: 0.62
  });
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(
      layout.size.width * 0.62,
      Math.min(layout.size.height, 1.3),
      layout.size.depth * 0.55
    ),
    material
  );
  mesh.position.y = DISPLAY_SURFACE_Y + Math.min(layout.size.height, 1.3) / 2;
  root.add(mesh);
  return root;
}

function normalizeModel(model: THREE.Group, maxHeight: number) {
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = maxHeight / Math.max(size.y, size.x, size.z, 0.001);
  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);
  const normalized = new THREE.Box3().setFromObject(model);
  const center = normalized.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y += DISPLAY_SURFACE_Y - normalized.min.y;
}

function createLowDetailProxy(model: THREE.Object3D) {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const proxy = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    new THREE.MeshStandardMaterial({ color: '#64736c', roughness: 0.82 })
  );
  proxy.position.copy(center);
  proxy.castShadow = true;
  proxy.receiveShadow = true;
  return proxy;
}

export function createRealisticExhibits(
  assets: LoadedExhibitionAssets,
  layout: ExhibitLayoutItem[]
) {
  const roots = new Map<string, THREE.Group>();
  const lods: THREE.LOD[] = [];
  const failures: string[] = [];

  for (const binding of MODEL_BINDINGS) {
    const item = layout.find((candidate) => candidate.id === binding.exhibitId);
    if (!item) continue;
    const source = assets.models.get(binding.assetId);
    const root = new THREE.Group();
    root.name = `${binding.exhibitId}-model`;
    root.position.set(item.position.x, 0, item.position.z);
    root.userData.exhibitId = binding.exhibitId;
    root.userData.assetSource = source ? 'glb' : 'fallback';

    if (source) {
      const detailed = source.clone(true);
      normalizeModel(detailed, binding.maxHeight);
      configureShadows(detailed);
      const lod = new THREE.LOD();
      lod.addLevel(detailed, 0);
      lod.addLevel(createLowDetailProxy(detailed), 10);
      root.add(lod);
      lods.push(lod);
    } else {
      root.add(createFallback(binding.exhibitId, item));
      failures.push(binding.exhibitId);
    }
    markExhibit(root, binding.exhibitId);
    roots.set(binding.exhibitId, root);
  }

  return { roots, lods, failures };
}
