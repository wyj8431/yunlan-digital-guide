import * as THREE from 'three';
import type { ExhibitLayoutItem } from '../exhibitionLayout';
import type { HallMaterials } from '../exhibitionMaterials';
import type { QualityProfile } from '../quality/qualityProfile';

const CASES = [
  { name: 'bicycle-plinth', exhibitId: 'west-lake-bicycle', x: -4.3, z: -5.6, glass: false },
  { name: 'shuttle-plinth', exhibitId: 'green-mobility-car', x: 3.6, z: -5.6, glass: false },
  { name: 'tea-glass-case', exhibitId: 'silk-and-tea', x: -3.8, z: -1.2, glass: true },
  { name: 'silk-glass-case', exhibitId: 'silk-garment', x: 3.8, z: -1.2, glass: true }
] as const;

export function createMuseumCases(
  _layout: ExhibitLayoutItem[],
  materials: HallMaterials,
  profile: QualityProfile
) {
  const root = new THREE.Group();
  root.name = 'museum-cases';
  const areaLights: THREE.RectAreaLight[] = [];
  const labels: THREE.Mesh[] = [];
  const focusLights = new Map<string, THREE.RectAreaLight[]>();
  const glassMaterials: THREE.MeshPhysicalMaterial[] = [];

  for (const definition of CASES) {
    const group = new THREE.Group();
    group.name = definition.name;
    group.position.set(definition.x, 0, definition.z);
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.62, 1.75), materials.floor);
    base.position.y = 0.31;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    if (definition.glass) {
      const glassMaterial = new THREE.MeshPhysicalMaterial({
        color: '#e8fff7',
        transparent: true,
        opacity: 0.24,
        transmission: 0.9,
        thickness: 0.018,
        roughness: 0.06,
        ior: 1.48,
        side: THREE.DoubleSide
      });
      glassMaterials.push(glassMaterial);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(2.45, 1.55, 1.42), glassMaterial);
      glass.position.y = 1.38;
      glass.castShadow = false;
      group.add(glass);
      const trimMaterial = new THREE.MeshStandardMaterial({
        color: '#171b19',
        metalness: 0.76,
        roughness: 0.24
      });
      for (const x of [-1.24, 1.24]) {
        for (const z of [-0.72, 0.72]) {
          const trim = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.6, 0.035), trimMaterial);
          trim.position.set(x, 1.38, z);
          group.add(trim);
        }
      }
    }

    const labelMaterial = new THREE.MeshStandardMaterial({
      color: '#f2efe5',
      emissive: '#c8a85d',
      emissiveIntensity: 0.05,
      roughness: 0.5
    });
    const label = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.025, 0.34), labelMaterial);
    label.position.set(0, 0.66, 1.02);
    label.rotation.x = -0.18;
    label.userData.exhibitId = definition.exhibitId;
    labels.push(label);
    group.add(label);
    root.add(group);
  }

  for (let index = 0; index < profile.areaLightCount; index += 1) {
    const definition = CASES[index % CASES.length];
    const light = new THREE.RectAreaLight('#ffe6b2', 2.6, 1.2, 0.5);
    light.position.set(definition.x + (index % 2 === 0 ? -0.55 : 0.55), 3.65, definition.z);
    light.lookAt(definition.x, 0.7, definition.z);
    light.userData.exhibitId = definition.exhibitId;
    areaLights.push(light);
    focusLights.set(definition.exhibitId, [
      ...(focusLights.get(definition.exhibitId) ?? []),
      light
    ]);
    root.add(light);
  }

  function setProximity(exhibitId: string, amount: number) {
    const value = THREE.MathUtils.clamp(amount, 0, 1);
    for (const label of labels) {
      if (label.userData.exhibitId !== exhibitId) continue;
      (label.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.05 + value * 0.75;
    }
    for (const light of focusLights.get(exhibitId) ?? []) light.intensity = 2.6 + value * 2.4;
  }

  return { root, areaLights, labels, focusLights, glassMaterials, setProximity };
}
