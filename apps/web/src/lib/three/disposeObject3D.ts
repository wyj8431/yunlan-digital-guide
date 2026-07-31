// 递归释放 Three.js 对象树中的几何体、材质和纹理资源。
import * as THREE from 'three';

function disposeMaterialTextures(material: THREE.Material, disposedTextures: Set<THREE.Texture>) {
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture && !disposedTextures.has(value)) {
      disposedTextures.add(value);
      value.dispose();
    }
  }
}

function disposeMaterial(
  material: THREE.Material | THREE.Material[],
  disposedTextures: Set<THREE.Texture>
) {
  const materials = Array.isArray(material) ? material : [material];

  for (const item of materials) {
    disposeMaterialTextures(item, disposedTextures);
    item.dispose();
  }
}

export function disposeObject3D(root: THREE.Object3D) {
  const disposedTextures = new Set<THREE.Texture>();

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    object.geometry?.dispose();
    disposeMaterial(object.material, disposedTextures);
  });
}
