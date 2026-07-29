# Photorealistic 3D Exhibition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the low-poly exhibition with a realistic Jiangnan garden museum using licensed local assets, calibrated PBR rendering, adaptive post-processing, spatial audio, and a similarly upgraded West Lake scene.

**Architecture:** React owns loading, scene, detail, transition, error, audio, and quality state. Focused Three.js modules own assets, environment, hall architecture, display cases, exhibits, post-processing, motion, audio, collision, and disposal; both scenes share one quality contract and asset registry. Every expensive visual feature is quality-gated and has a deterministic fallback.

**Tech Stack:** React 19, TypeScript, Three.js 0.178 addons, Vite, Vitest, React Testing Library, Playwright, GLB/Draco or Meshopt, KTX2/Basis, HDR/PMREM, Web Audio

---

## File Structure

| File                                                         | Responsibility                                                        |
| ------------------------------------------------------------ | --------------------------------------------------------------------- |
| `apps/web/src/exhibition/assets/exhibitionAssets.ts`         | Typed registry for GLB, HDR, PBR, IES, and audio assets               |
| `apps/web/src/exhibition/assets/ExhibitionAssetLoader.ts`    | GLTF, Draco, KTX2, RGBE, PMREM, cache, progress, fallback, disposal   |
| `apps/web/src/exhibition/quality/qualityProfile.ts`          | High, medium, low feature budgets and runtime downgrade rules         |
| `apps/web/src/exhibition/quality/PostProcessingPipeline.ts`  | Composer, AO, SSR, bloom, rays, color, transition focus               |
| `apps/web/src/exhibition/scene/createJiangnanHall.ts`        | Moon gate, walnut lattice, stone floor, ceiling, signage, walls       |
| `apps/web/src/exhibition/scene/createMuseumCases.ts`         | Open plinths, glass cases, labels, RectAreaLight, IES spotlights      |
| `apps/web/src/exhibition/scene/createRealisticExhibits.ts`   | Four GLB exhibits, stable IDs, LOD, click roots, fallback models      |
| `apps/web/src/exhibition/scene/createWestLakeEnvironment.ts` | Water, causeway, bridge, vegetation, pagoda, mountains, fog           |
| `apps/web/src/exhibition/audio/ExhibitionAudio.ts`           | User-unlocked ambience, footsteps, water, narration, ducking          |
| `apps/web/src/exhibition/ExhibitionRenderer.ts`              | Hall orchestration, movement, proximity, quality, telemetry, disposal |
| `apps/web/src/exhibition/westLakeScene.ts`                   | West Lake orchestration, movement, quality, audio, disposal           |
| `apps/web/src/components/ExhibitionPage.tsx`                 | Loading, scene transition, detail, quality, audio, error UI           |
| `apps/web/src/styles.css`                                    | Museum controls, progress, labels, transitions, responsive layout     |
| `apps/web/public/exhibition/**`                              | Licensed models, compressed textures, HDRI, IES, and audio            |
| `docs/licenses/exhibition-assets.md`                         | Source, author, license, changes, attribution, local path             |

### Task 1: Licensed Asset Registry and Loader

**Files:**

- Create: `apps/web/src/exhibition/assets/exhibitionAssets.ts`
- Create: `apps/web/src/exhibition/assets/ExhibitionAssetLoader.ts`
- Create: `apps/web/tests/exhibitionAssets.test.ts`
- Create: `apps/web/tests/ExhibitionAssetLoader.test.ts`
- Create: `docs/licenses/exhibition-assets.md`
- Add: `apps/web/public/exhibition/models/*`
- Add: `apps/web/public/exhibition/environment/*`
- Add: `apps/web/public/exhibition/materials/*`
- Add: `apps/web/public/exhibition/lights/*`
- Add: `apps/web/public/exhibition/audio/*`

- [ ] **Step 1: Write the failing asset contract tests**

```ts
expect(EXHIBITION_ASSETS.map((asset) => asset.id)).toEqual(
  expect.arrayContaining([
    'bicycle',
    'shuttle',
    'tea-set',
    'silk-garment',
    'hall-hdri',
    'stone-pbr',
    'walnut-pbr',
    'display-ies',
    'hall-ambience',
    'lake-ambience',
    'footstep-stone',
    'narration-bicycle',
    'narration-shuttle',
    'narration-tea-set',
    'narration-silk-garment'
  ])
);
expect(EXHIBITION_ASSETS.every((asset) => asset.localPath.startsWith('/exhibition/'))).toBe(true);
expect(EXHIBITION_ASSETS.every((asset) => asset.license !== 'unknown')).toBe(true);
expect(validateAssetRegistry(EXHIBITION_ASSETS)).toEqual([]);
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm --workspace apps/web run test -- exhibitionAssets`

Expected: FAIL because the registry and loader do not exist.

- [ ] **Step 3: Define the typed registry and validation**

```ts
export type ExhibitionAsset = {
  id: string;
  kind: 'glb' | 'hdr' | 'ktx2' | 'ies' | 'audio';
  localPath: `/exhibition/${string}`;
  sourceUrl: `https://${string}`;
  author: string;
  license: 'CC0-1.0' | 'CC-BY-4.0' | 'project-owned';
  attribution?: string;
};

export function validateAssetRegistry(assets: ExhibitionAsset[]): string[] {
  const ids = new Set<string>();
  return assets.flatMap((asset) => {
    const errors: string[] = [];
    if (ids.has(asset.id)) errors.push(`duplicate:${asset.id}`);
    ids.add(asset.id);
    if (!asset.sourceUrl.startsWith('https://')) errors.push(`source:${asset.id}`);
    if (!asset.localPath.startsWith('/exhibition/')) errors.push(`path:${asset.id}`);
    return errors;
  });
}
```

- [ ] **Step 4: Acquire, verify, compress, and document the assets**

Select redistribution-compatible assets for the four exhibits, one neutral indoor HDRI, two tileable PBR surfaces, one IES profile, ambience, footsteps, and four narration files. Record the exact source page, direct download, author, license, modifications, attribution, original byte size, optimized byte size, and SHA-256 in `docs/licenses/exhibition-assets.md`. Reject any asset whose redistribution terms are absent or ambiguous. Store optimized files only under `apps/web/public/exhibition/`; do not load third-party hosts at runtime.

- [ ] **Step 5: Implement one shared loader with real progress and fallback**

```ts
export type AssetProgress = {
  loadedBytes: number;
  totalBytes: number | null;
  completed: number;
  total: number;
};
export type LoadedExhibitionAssets = {
  models: Map<string, THREE.Group>;
  textures: Map<string, THREE.Texture>;
  environment: THREE.Texture | null;
  audio: Map<string, AudioBuffer>;
  failures: Map<string, Error>;
};

export class ExhibitionAssetLoader {
  constructor(renderer: THREE.WebGLRenderer, assets: ExhibitionAsset[]);
  load(onProgress: (progress: AssetProgress) => void): Promise<LoadedExhibitionAssets>;
  cloneModel(id: string): THREE.Group | null;
  dispose(): void;
}
```

Configure one `DRACOLoader`, `KTX2Loader.detectSupport(renderer)`, `GLTFLoader`, `RGBELoader`, and `PMREMGenerator`. Cache source assets, clone GLB scenes for placement, return failures without rejecting the entire load, and dispose decoder, PMREM targets, textures, audio references, and cached scene resources exactly once.

- [ ] **Step 6: Verify loader success, progress, partial failure, and disposal**

Run: `npm --workspace apps/web run test -- exhibitionAssets ExhibitionAssetLoader`

Expected: PASS with monotonic progress, four model IDs, partial-failure results, and idempotent disposal.

- [ ] **Step 7: Commit the asset foundation**

```bash
git add apps/web/src/exhibition/assets apps/web/public/exhibition docs/licenses/exhibition-assets.md apps/web/tests/exhibitionAssets.test.ts apps/web/tests/ExhibitionAssetLoader.test.ts
git commit -m "feat(web): add licensed exhibition asset pipeline"
```

### Task 2: Adaptive Rendering Quality and Post-Processing

**Files:**

- Create: `apps/web/src/exhibition/quality/qualityProfile.ts`
- Create: `apps/web/src/exhibition/quality/PostProcessingPipeline.ts`
- Create: `apps/web/tests/exhibitionQuality.test.ts`
- Modify: `apps/web/src/exhibition/ExhibitionRenderer.ts`
- Modify: `apps/web/src/exhibition/westLakeScene.ts`

- [ ] **Step 1: Write failing quality-profile tests**

```ts
expect(QUALITY_PROFILES.high).toMatchObject({
  pixelRatio: 2,
  ssao: true,
  ssr: true,
  godRays: true,
  cascadedShadows: true
});
expect(QUALITY_PROFILES.low).toMatchObject({
  pixelRatio: 1.25,
  ssr: false,
  depthOfField: false,
  godRays: false,
  volumetricFog: false
});
expect(nextLowerQuality('high')).toBe('medium');
expect(nextLowerQuality('medium')).toBe('low');
expect(nextLowerQuality('low')).toBe('low');
```

- [ ] **Step 2: Verify failure**

Run: `npm --workspace apps/web run test -- exhibitionQuality`

Expected: FAIL because profiles and pipeline are absent.

- [ ] **Step 3: Implement explicit budgets and downgrade sampling**

```ts
export type QualityLevel = 'high' | 'medium' | 'low';
export type QualityProfile = {
  pixelRatio: number;
  shadowMapSize: 2048 | 1024 | 512;
  postScale: 1 | 0.75 | 0.5;
  ssao: boolean;
  ssr: boolean;
  bloom: boolean;
  depthOfField: boolean;
  godRays: boolean;
  volumetricFog: boolean;
  cascadedShadows: boolean;
  areaLightCount: number;
  vegetationDensity: number;
};
export const QUALITY_PROFILES: Record<QualityLevel, QualityProfile> = {
  high: {
    pixelRatio: 2,
    shadowMapSize: 2048,
    postScale: 1,
    ssao: true,
    ssr: true,
    bloom: true,
    depthOfField: true,
    godRays: true,
    volumetricFog: true,
    cascadedShadows: true,
    areaLightCount: 8,
    vegetationDensity: 1
  },
  medium: {
    pixelRatio: 1.5,
    shadowMapSize: 1024,
    postScale: 0.75,
    ssao: true,
    ssr: false,
    bloom: true,
    depthOfField: true,
    godRays: false,
    volumetricFog: true,
    cascadedShadows: false,
    areaLightCount: 4,
    vegetationDensity: 0.7
  },
  low: {
    pixelRatio: 1.25,
    shadowMapSize: 512,
    postScale: 0.5,
    ssao: false,
    ssr: false,
    bloom: true,
    depthOfField: false,
    godRays: false,
    volumetricFog: false,
    cascadedShadows: false,
    areaLightCount: 2,
    vegetationDensity: 0.45
  }
};
```

Sample rolling FPS after a five-second warm-up. Downgrade one level after three consecutive windows below the active scene target, with a 20-second cooldown; never automatically upgrade during the same visit.

- [ ] **Step 4: Implement the quality-gated composer**

Use `EffectComposer`, `RenderPass`, `GTAOPass` or `SSAOPass`, `SSRPass`, `UnrealBloomPass`, `BokehPass`, `ShaderPass`, `GodRaysShader`, and `OutputPass`. Configure ACES Filmic tone mapping, PMREM environment, low bloom threshold, focus-only depth of field, and half/three-quarter-resolution expensive passes. Expose:

```ts
render(deltaSeconds: number): void;
resize(width: number, height: number, pixelRatio: number): void;
setQuality(level: QualityLevel): void;
setFocus(target: THREE.Vector3 | null): void;
setTransitionProgress(value: number): void;
dispose(): void;
```

- [ ] **Step 5: Integrate without changing movement behavior**

Replace direct `renderer.render` in both scenes with the pipeline, preserve the existing collision and input APIs, and ensure `prefers-reduced-motion` disables focus animation, rays, and animated fog while retaining ACES, PMREM, and static AO where the profile permits.

- [ ] **Step 6: Run quality, renderer, and disposal tests**

Run: `npm --workspace apps/web run test -- exhibitionQuality ExhibitionRenderer WestLakeScene`

Expected: PASS; low profile creates no SSR/DOF/rays passes, resizing updates composer targets, and disposal releases all render targets once.

- [ ] **Step 7: Commit the rendering pipeline**

```bash
git add apps/web/src/exhibition/quality apps/web/src/exhibition/ExhibitionRenderer.ts apps/web/src/exhibition/westLakeScene.ts apps/web/tests/exhibitionQuality.test.ts
git commit -m "feat(web): add adaptive exhibition post processing"
```

### Task 3: Realistic Jiangnan Hall Architecture and PBR Materials

**Files:**

- Create: `apps/web/src/exhibition/scene/createJiangnanHall.ts`
- Create: `apps/web/tests/jiangnanHall.test.ts`
- Modify: `apps/web/src/exhibition/exhibitionLayout.ts`
- Modify: `apps/web/src/exhibition/ExhibitionRenderer.ts`

- [ ] **Step 1: Write failing scene-structure tests**

```ts
const hall = createJiangnanHall(materials);
expect(hall.children.map((child) => child.name)).toEqual(
  expect.arrayContaining([
    'architectural-shell',
    'moon-gate',
    'walnut-lattice',
    'stone-floor',
    'ceiling-tracks',
    'west-lake-scroll',
    'wayfinding',
    'fire-exit'
  ])
);
expect(assertMainAisleClear(EXHIBITION_LAYOUT, 2.4)).toBe(true);
expect(hall.userData.instancedLatticeCount).toBeGreaterThanOrEqual(24);
```

- [ ] **Step 2: Verify failure**

Run: `npm --workspace apps/web run test -- jiangnanHall`

Expected: FAIL because the scene factory is absent.

- [ ] **Step 3: Build full-scale architecture**

Create a 16×20×4.8 metre hall with wall thickness, skirting, recessed ceiling, entrance reveal, 3.4 metre moon gate, walnut lattice side screens, stone tile floor with real-world UV scale, rear scroll wall, floor wayfinding, and a recognizable but restrained fire exit. Use instanced lattice members and shared geometries. Keep the central 2.4 metre aisle unobstructed and register wall, gate-side, and screen colliders.

- [ ] **Step 4: Calibrate the PBR materials**

Use KTX2 stone and walnut maps with `MeshStandardMaterial` or `MeshPhysicalMaterial`; set color maps to sRGB and non-color maps to linear. Configure anisotropy from renderer capabilities, repeat by metres rather than object dimensions, and add controlled normal/roughness intensity. Use a layered procedural fallback with tile joints and wood direction when a compressed texture fails.

- [ ] **Step 5: Replace the old hall shell**

Remove the previous flat walls, pure-color floor, pendant shades, spherical plants, and geometric wall art from `ExhibitionRenderer`. Mount the new named hall group while preserving camera start, input, exhibit callback, scene roots, collision resolution, and lifecycle behavior.

- [ ] **Step 6: Verify architecture and renderer regression**

Run: `npm --workspace apps/web run test -- jiangnanHall exhibitionLayout ExhibitionRenderer`

Expected: PASS with the required named roots, aisle width, instancing count, material color spaces, and existing movement tests.

- [ ] **Step 7: Commit the hall architecture**

```bash
git add apps/web/src/exhibition/scene/createJiangnanHall.ts apps/web/src/exhibition/exhibitionLayout.ts apps/web/src/exhibition/ExhibitionRenderer.ts apps/web/tests/jiangnanHall.test.ts
git commit -m "feat(web): build realistic jiangnan exhibition hall"
```

### Task 4: Museum Cases, Area Lighting, IES, and Shadows

**Files:**

- Create: `apps/web/src/exhibition/scene/createMuseumCases.ts`
- Create: `apps/web/tests/museumCases.test.ts`
- Modify: `apps/web/src/exhibition/exhibitionLayout.ts`
- Modify: `apps/web/src/exhibition/ExhibitionRenderer.ts`

- [ ] **Step 1: Write failing case and lighting tests**

```ts
const result = createMuseumCases(layout, materials, QUALITY_PROFILES.high);
expect(result.root.children.map((child) => child.name)).toEqual(
  expect.arrayContaining(['bicycle-plinth', 'shuttle-plinth', 'tea-glass-case', 'silk-glass-case'])
);
expect(result.areaLights).toHaveLength(8);
expect(result.labels.map((label) => label.userData.exhibitId)).toEqual(
  expect.arrayContaining([
    'west-lake-bicycle',
    'green-mobility-car',
    'silk-and-tea',
    'silk-garment'
  ])
);
```

- [ ] **Step 2: Verify failure**

Run: `npm --workspace apps/web run test -- museumCases`

Expected: FAIL because the display-case factory does not exist.

- [ ] **Step 3: Build professional display systems**

Create two 2.6–3.8 metre open stone plinths and two enclosed low-iron glass cases with real glass thickness, black titanium trim, warm linear emissive strips, hidden light blockers, and physical label plates. Do not nest decorative cards or add floating text panels inside Three.js.

- [ ] **Step 4: Add calibrated lights and shadow strategy**

Initialize `RectAreaLightUniformsLib`, create profile-budgeted RectAreaLights, and load the local IES profile through `IESLoader` for track spots. Use PCF soft shadows, contact-shadow receivers under hero exhibits, and CSM only in the high profile. Restrict shadow cameras to occupied hall bounds and exclude glass, labels, and distant decoration.

- [ ] **Step 5: Integrate cases and proximity hooks**

Return stable references for labels and focus lights. Add `setProximity(exhibitId, amount)` that interpolates label emissive intensity and focus-light power over 250–400 ms without reallocating materials or lights.

- [ ] **Step 6: Run scene and quality tests**

Run: `npm --workspace apps/web run test -- museumCases exhibitionQuality ExhibitionRenderer`

Expected: PASS; high/medium/low create 8/4/2 area lights, glass is non-opaque, and no display object enters the central aisle.

- [ ] **Step 7: Commit the exhibition lighting**

```bash
git add apps/web/src/exhibition/scene/createMuseumCases.ts apps/web/src/exhibition/exhibitionLayout.ts apps/web/src/exhibition/ExhibitionRenderer.ts apps/web/tests/museumCases.test.ts
git commit -m "feat(web): add museum cases and calibrated lighting"
```

### Task 5: Four Real GLB Exhibits, LOD, and Proximity Interaction

**Files:**

- Create: `apps/web/src/exhibition/scene/createRealisticExhibits.ts`
- Create: `apps/web/tests/realisticExhibits.test.ts`
- Modify: `apps/web/src/exhibition/exhibitionLayout.ts`
- Modify: `apps/web/src/exhibition/ExhibitionRenderer.ts`

- [ ] **Step 1: Write failing exhibit contract tests**

```ts
const exhibits = createRealisticExhibits(loadedAssets, layout, fallbackFactories);
expect([...exhibits.roots.keys()]).toEqual([
  'west-lake-bicycle',
  'green-mobility-car',
  'silk-and-tea',
  'silk-garment'
]);
expect([...exhibits.roots.values()].every((root) => root.userData.assetSource === 'glb')).toBe(
  true
);
expect(exhibits.lods.every((lod) => lod.levels.length >= 2)).toBe(true);
```

- [ ] **Step 2: Verify failure**

Run: `npm --workspace apps/web run test -- realisticExhibits`

Expected: FAIL because real exhibit placement does not exist.

- [ ] **Step 3: Normalize and place each GLB**

Clone model scenes, compute world bounds, scale to real dimensions, place the lowest point on the case/plinth surface, normalize forward direction, enable shadows only on opaque hero meshes, and retain original PBR materials after color-space correction. Mark the root and descendants with the existing stable exhibit ID.

- [ ] **Step 4: Add LOD and deterministic fallback**

Use the optimized GLB as level zero and a simplified mesh or generated silhouette as the distant level. If a source model failed, instantiate a detailed fallback that remains correctly sized, clickable, lit, and collidable; mark it `assetSource: 'fallback'` so loading UI can report degraded content without blocking the hall.

- [ ] **Step 5: Add proximity animation without camera theft**

Measure horizontal distance from the player to each collider. Within 2.4 metres, ease the matching label and focus light toward one; outside 3 metres, ease toward zero. Apply a maximum two-degree camera composition offset only when the player is stationary, pointer lock is active, reduced motion is false, and no detail is open. Any movement, mouse input, or Escape cancels it immediately.

- [ ] **Step 6: Verify exhibit loading, click, collision, LOD, and fallback**

Run: `npm --workspace apps/web run test -- realisticExhibits ExhibitionRenderer exhibitionCollision`

Expected: PASS for four GLBs, stable IDs, correct real dimensions, two LOD levels, partial fallback, and non-blocking proximity behavior.

- [ ] **Step 7: Commit the real exhibits**

```bash
git add apps/web/src/exhibition/scene/createRealisticExhibits.ts apps/web/src/exhibition/exhibitionLayout.ts apps/web/src/exhibition/ExhibitionRenderer.ts apps/web/tests/realisticExhibits.test.ts
git commit -m "feat(web): add realistic interactive exhibition models"
```

### Task 6: Realistic West Lake, Environment Motion, and Visibility

**Files:**

- Create: `apps/web/src/exhibition/scene/createWestLakeEnvironment.ts`
- Create: `apps/web/tests/westLakeEnvironment.test.ts`
- Modify: `apps/web/src/exhibition/westLakeScene.ts`
- Modify: `apps/web/tests/WestLakeScene.test.ts`

- [ ] **Step 1: Write failing environment tests**

```ts
const environment = createWestLakeEnvironment(assets, QUALITY_PROFILES.high);
expect(environment.root.children.map((child) => child.name)).toEqual(
  expect.arrayContaining([
    'lake-water',
    'natural-shoreline',
    'su-causeway',
    'stone-arch-bridge',
    'instanced-vegetation',
    'leifeng-pagoda',
    'distant-mountains',
    'atmosphere'
  ])
);
expect(environment.instancedVegetation.count).toBeGreaterThan(40);
expect(environment.water.userData.windField).toBeDefined();
```

- [ ] **Step 2: Verify failure**

Run: `npm --workspace apps/web run test -- westLakeEnvironment`

Expected: FAIL because the realistic environment factory is absent.

- [ ] **Step 3: Replace low-poly landmarks**

Build an irregular shoreline, walkable 1.8 metre causeway, stone bridge with rail collision, correctly proportioned pagoda, layered mountain meshes, and instanced trees/shrubs with varied transforms. Remove sphere crowns and cone mountains. Use room/zone groups so invisible zones can skip animation updates.

- [ ] **Step 4: Add water wind, vegetation motion, fog, rays, and aerial perspective**

Drive water normal offsets from a two-direction wind field; animate foliage through shared shader uniforms or lightweight bone transforms. Use exponential distance fog plus a quality-gated volumetric layer and directional God Rays. Reduced motion freezes wind and foliage and removes animated fog/rays while preserving static water shading and distance fog.

- [ ] **Step 5: Preserve bounded first-person movement**

Keep `LAKE_BOUNDS`, water exclusion, causeway walkability, bridge rail, pagoda base, and major tree collision. Use zone visibility to pause updates outside the camera area; rely on Three.js frustum culling by default and add GPU occlusion queries only after browser profiling proves a stable gain.

- [ ] **Step 6: Verify environment, movement, motion, and disposal**

Run: `npm --workspace apps/web run test -- westLakeEnvironment WestLakeScene exhibitionCollision`

Expected: PASS for named roots, instancing, wind uniforms, reduced motion, water collision, bridge movement, visibility pause, and idempotent disposal.

- [ ] **Step 7: Commit the West Lake upgrade**

```bash
git add apps/web/src/exhibition/scene/createWestLakeEnvironment.ts apps/web/src/exhibition/westLakeScene.ts apps/web/tests/westLakeEnvironment.test.ts apps/web/tests/WestLakeScene.test.ts
git commit -m "feat(web): rebuild west lake with realistic atmosphere"
```

### Task 7: Spatial Audio, Footsteps, and Narration

**Files:**

- Create: `apps/web/src/exhibition/audio/ExhibitionAudio.ts`
- Create: `apps/web/tests/exhibitionAudio.test.ts`
- Modify: `apps/web/src/exhibition/ExhibitionRenderer.ts`
- Modify: `apps/web/src/exhibition/westLakeScene.ts`

- [ ] **Step 1: Write failing browser-audio tests**

```ts
const audio = new ExhibitionAudio(listener, buffers);
expect(audio.isUnlocked()).toBe(false);
await audio.unlock();
expect(audio.isUnlocked()).toBe(true);
audio.playNarration('west-lake-bicycle');
expect(audio.getMix()).toMatchObject({ narration: 1, ambience: 0.35 });
audio.setMuted(true);
expect(audio.getMix().master).toBe(0);
```

- [ ] **Step 2: Verify failure**

Run: `npm --workspace apps/web run test -- exhibitionAudio`

Expected: FAIL because the audio controller is absent.

- [ ] **Step 3: Implement user-unlocked spatial audio**

Create one `AudioListener`, looping indoor/lake ambience, positional water sound, throttled stone footsteps based on actual travelled distance, and one narration channel. `unlock()` resumes AudioContext only after a user action. Narration ducks ambience to 0.35 over 200 ms and restores it after completion, cancellation, or detail close.

- [ ] **Step 4: Integrate audio without affecting scene startup**

Attach the listener to the active camera after unlock. Start the correct ambience when entering a scene, update positional sources each frame, trigger footsteps only while moving on walkable surfaces, expose `setMuted`, `playNarration`, and `stopNarration`, and treat missing buffers as silent recoverable failures.

- [ ] **Step 5: Verify autoplay, mix, motion, switching, and disposal**

Run: `npm --workspace apps/web run test -- exhibitionAudio ExhibitionRenderer WestLakeScene`

Expected: PASS with no audio before unlock, correct ducking, no footsteps while stationary, scene ambience switching, and source/listener cleanup.

- [ ] **Step 6: Commit spatial audio**

```bash
git add apps/web/src/exhibition/audio apps/web/src/exhibition/ExhibitionRenderer.ts apps/web/src/exhibition/westLakeScene.ts apps/web/tests/exhibitionAudio.test.ts
git commit -m "feat(web): add exhibition spatial audio"
```

### Task 8: Loading, Museum UI, Detail Focus, and Scene Transitions

**Files:**

- Modify: `apps/web/src/components/ExhibitionPage.tsx`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/tests/ExhibitionPage.test.tsx`

- [ ] **Step 1: Write failing page-state tests**

```tsx
expect(screen.getByRole('progressbar', { name: '展馆资源加载进度' })).toHaveAttribute(
  'aria-valuenow',
  '40'
);
fireEvent.click(screen.getByRole('button', { name: '开启环境声音' }));
expect(rendererState.unlockAudio).toHaveBeenCalled();
act(() => rendererState.selectExhibit?.('west-lake-bicycle'));
expect(rendererState.setFocus).toHaveBeenCalledWith('west-lake-bicycle');
fireEvent.click(screen.getByRole('button', { name: '播放语音讲解' }));
expect(rendererState.playNarration).toHaveBeenCalledWith('west-lake-bicycle');
fireEvent.click(screen.getByRole('button', { name: '进入西湖沙盘' }));
expect(screen.getByTestId('scene-transition')).toHaveAttribute('data-phase', 'fade-out');
```

- [ ] **Step 2: Verify failure**

Run: `npm --workspace apps/web run test -- ExhibitionPage`

Expected: FAIL because progress, audio controls, focus, narration, and phased transitions are absent.

- [ ] **Step 3: Implement explicit React states and renderer callbacks**

Use `loading | hall | detail-open | transitioning | lake | render-error`, real byte/count progress, quality label, muted state, transition phase, and degraded-asset notices. Extend renderer constructors with callbacks for progress, quality changes, recoverable asset failures, and fatal render errors. Keep return and service actions usable in every state.

- [ ] **Step 4: Add restrained museum controls**

Use lucide icons for audio, quality, close, return, and narration. Keep controls outside the central observation area, use square or compact controls, provide tooltips and accessible labels, and show real exhibit names only. Do not add feature-description copy, shortcut tutorials, floating decorative cards, or fabricated telemetry.

- [ ] **Step 5: Implement natural transitions**

Coordinate renderer `setTransitionProgress` and `setFocus` over 500–800 ms. Freeze input during fade-out, switch only after the target scene is ready, then fade in and restore interaction. On failure restore the previous scene. Under reduced motion use a short opacity transition without DOF or exposure animation.

- [ ] **Step 6: Run page, renderer, reduced-motion, and CSS tests**

Run: `npm --workspace apps/web run test -- ExhibitionPage ExhibitionRenderer WestLakeScene layoutCss`

Expected: PASS for loading, progress, audio unlock, focus, narration, scene failure recovery, transition phases, reduced motion, safe areas, and accessible controls.

- [ ] **Step 7: Commit the UI and transitions**

```bash
git add apps/web/src/components/ExhibitionPage.tsx apps/web/src/styles.css apps/web/tests/ExhibitionPage.test.tsx
git commit -m "feat(web): refine exhibition loading and transitions"
```

### Task 9: Performance Evidence and Real Browser Acceptance

**Files:**

- Modify: `apps/web/tests/exhibition.browser.test.js`
- Create: `apps/web/tests/exhibition.performance.test.js`
- Modify: `docs/integration/digital-human-3d-video.md`
- Modify: `docs/licenses/exhibition-assets.md`

- [ ] **Step 1: Add failing browser assertions for real assets and visual quality**

```js
await expect(page.locator('[data-exhibition-ready="true"]')).toBeVisible();
expect(await page.evaluate(() => window.__EXHIBITION_TELEMETRY__.assetSources)).toEqual({
  bicycle: 'glb',
  shuttle: 'glb',
  teaSet: 'glb',
  silkGarment: 'glb'
});
expect(await page.evaluate(() => window.__EXHIBITION_TELEMETRY__.qualityLevel)).toMatch(
  /high|medium/
);
expect(await nonBackgroundPixelRatio(page.locator('canvas'))).toBeGreaterThan(0.32);
```

- [ ] **Step 2: Add deterministic telemetry and performance sampling**

Expose development/test-only read telemetry through an injected callback or guarded `window.__EXHIBITION_TELEMETRY__`: scene, camera pose, quality, rolling FPS, draw calls, triangles, textures, active passes, asset sources, visible zones, audio unlock, and active canvas count. Do not render this telemetry in production UI.

- [ ] **Step 3: Test both desktop viewports and key workflows**

At 1440×900 and 1920×1080, verify one nonblank full-screen canvas, all four GLBs, hall named roots, non-overlapping controls, no overexposed pixel region larger than 8% of the canvas, clickable exhibits, proximity label/light change, detail focus, narration after audio unlock, West Lake transition, water collision, return to hall, and zero console errors.

- [ ] **Step 4: Measure adaptive quality and resource stability**

After a ten-second warm-up, sample at least 15 seconds and require indoor average ≥45 FPS and lake average ≥40 FPS on the configured desktop runner. Inject a controlled slow-frame sequence and verify one-level downgrade plus disabled passes. Navigate into and out of the exhibition and lake five times; require one canvas, stable listener counts, and no monotonically growing renderer memory counters.

- [ ] **Step 5: Perform screenshot and canvas-pixel review**

Capture hall entrance, each display, detail focus, West Lake bridge, and West Lake pagoda at both viewports. Inspect screenshots for missing assets, placeholder geometry, sphere trees, cone mountains, texture scale errors, glass sorting, black contact patches, shadow acne, bloom pollution, SSR trails, God Ray banding, fog clipping, UI overlap, and blank canvas regions. Fix every observed regression and rerun the affected screenshot.

- [ ] **Step 6: Document controls, quality, assets, audio, and fallback**

Document audio unlock/mute, narration, quality levels, adaptive downgrade, GLB/HDR/KTX2/IES locations, attribution, fallback behavior, reduced motion, browser commands, performance runner requirements, and the remaining Vite chunk-size warning if it still exists.

- [ ] **Step 7: Run the complete quality gate**

Run: `npm run typecheck && npm run test && npm run build && npm run lint`

Expected: all commands exit `0`. Report any unrelated pre-existing failure separately; do not weaken the exhibition assertions to hide it.

- [ ] **Step 8: Commit acceptance evidence**

```bash
git add apps/web/tests/exhibition.browser.test.js apps/web/tests/exhibition.performance.test.js docs/integration/digital-human-3d-video.md docs/licenses/exhibition-assets.md
git commit -m "test(web): verify photorealistic exhibition quality"
```

## Plan Self-Review

- Spec coverage: licensed GLB/PBR/HDR/IES/audio assets, Jiangnan architecture, museum cases, RectAreaLight, IES, soft/contact/cascaded shadows, ACES/PMREM, AO/SSR/bloom/DOF/rays/fog, environment motion, proximity behavior, LOD/instancing/visibility/KTX2, spatial audio, refined UI, transitions, reduced motion, fallbacks, resource disposal, performance tiers, and desktop browser evidence map to Tasks 1–9.
- Type consistency: `QualityLevel`, `QualityProfile`, `AssetProgress`, `LoadedExhibitionAssets`, `ExhibitionAssetLoader`, `PostProcessingPipeline`, `setFocus`, `setTransitionProgress`, `playNarration`, and telemetry names have one owner and spelling.
- Performance consistency: expensive passes are never unconditional; low quality disables SSR, DOF, rays, volumetric fog, and CSM while retaining ACES, PMREM, and usable materials.
- Scope: no digital twin, VR, multiplayer, mobile joystick, remote runtime assets, or unproven GPU occlusion requirement is introduced.
- Placeholder scan: implementation steps identify concrete files, APIs, commands, assertions, failure modes, and acceptance thresholds; binary asset choice remains license-gated rather than guessed.
