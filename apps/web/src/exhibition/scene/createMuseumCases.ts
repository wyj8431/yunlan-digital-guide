import * as THREE from 'three';
import type { ExhibitLayoutItem } from '../exhibitionLayout';
import type { HallMaterials } from '../exhibitionMaterials';
import type { QualityProfile } from '../quality/qualityProfile';

const CASES = [
  {
    name: 'bicycle-plinth',
    exhibitId: 'west-lake-bicycle',
    x: -15.2,
    z: -5.6,
    glass: false,
    title: 'Slow Travel Bicycle',
    detail: 'Water-town lanes and bridges'
  },
  {
    name: 'shuttle-plinth',
    exhibitId: 'green-mobility-car',
    x: 15.2,
    z: -5.6,
    glass: false,
    title: 'Scenic Shuttle',
    detail: 'Low-carbon visitor connection'
  },
  {
    name: 'tea-glass-case',
    exhibitId: 'silk-and-tea',
    x: -15.2,
    z: -1.2,
    glass: true,
    title: 'Tea Ceremony',
    detail: 'Water-town hospitality'
  },
  {
    name: 'silk-glass-case',
    exhibitId: 'silk-garment',
    x: 15.2,
    z: -1.2,
    glass: true,
    title: 'Silk Garment',
    detail: 'Jiangnan textile craft'
  }
] as const;

type IesSpotLight = THREE.SpotLight & { iesMap: THREE.Texture | null };

function createCaption(title: string, detail: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = '#153230';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#c8a85d';
  context.lineWidth = 8;
  context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  context.fillStyle = '#f5e6b7';
  context.font = '600 42px Arial, sans-serif';
  context.fillText(title, 42, 108);
  context.fillStyle = '#b8d6c6';
  context.font = '26px Arial, sans-serif';
  context.fillText(detail, 42, 164);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(1.42, 0.48),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
  );
}

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
  const glassMeshes: THREE.Mesh[] = [];
  const iesLights: IesSpotLight[] = [];
  const contactShadows: THREE.Mesh[] = [];
  const proximity = new Map<
    string,
    { current: number; start: number; target: number; elapsed: number }
  >(
    CASES.map((definition) => [
      definition.exhibitId,
      { current: 0, start: 0, target: 0, elapsed: 0 }
    ])
  );

  for (const definition of CASES) {
    const group = new THREE.Group();
    group.name = definition.name;
    group.position.set(definition.x, 0, definition.z);
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.62, 1.75), materials.floor);
    base.position.y = 0.31;
    base.castShadow = false;
    base.receiveShadow = false;
    group.add(base);

    if (definition.glass) {
      const glassMaterial = new THREE.MeshPhysicalMaterial({
        color: '#d8eee5',
        transparent: true,
        opacity: 0.16,
        transmission: 0.18,
        thickness: 0.01,
        roughness: 0.16,
        ior: 1.45,
        depthWrite: false,
        side: THREE.FrontSide
      });
      glassMaterials.push(glassMaterial);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(2.45, 1.55, 1.42), glassMaterial);
      glass.position.y = 1.38;
      glass.castShadow = false;
      glass.receiveShadow = false;
      glassMeshes.push(glass);
      group.add(glass);
      const trimMaterial = new THREE.MeshStandardMaterial({
        color: '#6c8177',
        metalness: 0.28,
        roughness: 0.46
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
    label.castShadow = false;
    label.receiveShadow = false;
    label.userData.exhibitId = definition.exhibitId;
    labels.push(label);
    group.add(label);

    const caption = createCaption(definition.title, definition.detail);
    if (caption) {
      caption.position.set(0, 1.62, -0.92);
      caption.rotation.y = Math.PI;
      group.add(caption);
    }

    const spot = new THREE.SpotLight('#fff0cf', 42, 9, Math.PI / 7, 0.42, 1.3) as IesSpotLight;
    spot.iesMap = null;
    spot.name = `${definition.name}-ies-spot`;
    spot.position.set(0, 4.15, 0.35);
    spot.target.position.set(0, 0.8, 0);
    spot.castShadow = false;
    spot.userData.exhibitId = definition.exhibitId;
    group.add(spot, spot.target);
    iesLights.push(spot);
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
    const state = proximity.get(exhibitId);
    if (!state || state.target === value) return;
    state.start = state.current;
    state.target = value;
    state.elapsed = 0;
  }

  function applyProximity(exhibitId: string, value: number) {
    for (const label of labels) {
      if (label.userData.exhibitId !== exhibitId) continue;
      (label.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.05 + value * 0.75;
    }
    for (const light of focusLights.get(exhibitId) ?? []) light.intensity = 2.6 + value * 2.4;
  }

  function update(deltaSeconds: number) {
    for (const [exhibitId, state] of proximity) {
      if (state.current === state.target) continue;
      state.elapsed += Math.max(0, deltaSeconds);
      const progress = THREE.MathUtils.clamp(state.elapsed / 0.32, 0, 1);
      state.current = THREE.MathUtils.lerp(state.start, state.target, progress);
      applyProximity(exhibitId, state.current);
    }
  }

  function setIesTexture(texture: THREE.Texture) {
    for (const light of iesLights) light.iesMap = texture;
  }

  return {
    root,
    areaLights,
    labels,
    focusLights,
    glassMaterials,
    glassMeshes,
    iesLights,
    contactShadows,
    setIesTexture,
    setProximity,
    update
  };
}
