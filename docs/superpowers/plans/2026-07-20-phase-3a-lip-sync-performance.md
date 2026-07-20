# Phase 3A Lip Sync and Rendering Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an independently testable `/lab/lip-sync` workspace that drives `Thanh.glb` mouth morphs from arbitrary audio and records repeatable desktop/mobile rendering metrics without changing the XFYUN-first visitor experience.

**Architecture:** Keep the production `App` intact and add a tiny path resolver at the React root. The lab owns audio loading, Web Audio analysis, mouth-signal filtering, Three.js morph control, quality tiers, and metrics through focused modules; Zustand stores serializable controls and snapshots only. Shared Three.js cleanup and renderer-quality helpers are then applied to the existing local fallback stage.

**Tech Stack:** React 19, Vite 7, TypeScript 5.8, Three.js 0.178, Zustand, Lucide React, Web Audio API, Vitest, React Testing Library, Playwright browser verification.

**Design Reference:** `docs/superpowers/specs/2026-07-20-phase-three-voice-lip-sync-performance-design.md`

---

## File Map

### New Files

- `apps/web/src/RootApp.tsx` - selects the visitor app or lip-sync lab from `window.location.pathname`.
- `apps/web/src/routing/appRoute.ts` - pure route resolver.
- `apps/web/src/lab/lip-sync/LipSyncLab.tsx` - lab page composition.
- `apps/web/src/lab/lip-sync/lipSyncLab.css` - lab-only responsive layout.
- `apps/web/src/lab/lip-sync/types.ts` - source, filter, quality, and metric types.
- `apps/web/src/lab/lip-sync/audio/mouthSignal.ts` - pure threshold and attack/release filter.
- `apps/web/src/lab/lip-sync/audio/audioSource.ts` - preset/file/URL loading and Web Audio playback.
- `apps/web/src/lab/lip-sync/three/mouthMorphController.ts` - discovers and drives `jawOpen` and `mouthOpen` targets.
- `apps/web/src/lab/lip-sync/three/LipSyncRenderer.ts` - owns the lab scene, model, renderer, frame loop, and disposal.
- `apps/web/src/lab/lip-sync/components/LipSyncStage.tsx` - React lifecycle wrapper for `LipSyncRenderer`.
- `apps/web/src/lab/lip-sync/components/AudioSourceToolbar.tsx` - audio source selection and transport controls.
- `apps/web/src/lab/lip-sync/components/LipSyncControls.tsx` - parameter and quality controls.
- `apps/web/src/lab/lip-sync/components/PerformancePanel.tsx` - live metrics.
- `apps/web/src/lab/lip-sync/performance/performanceMonitor.ts` - FPS and P95 frame-time aggregation.
- `apps/web/src/lab/lip-sync/performance/qualityController.ts` - quality profiles and hysteresis.
- `apps/web/src/lab/lip-sync/store/useLipSyncLabStore.ts` - serializable Zustand store.
- `apps/web/src/lib/three/disposeObject3D.ts` - shared Three.js resource cleanup.
- `apps/web/tests/appRoute.test.ts` - route resolver tests.
- `apps/web/tests/mouthSignal.test.ts` - audio-to-mouth filter tests.
- `apps/web/tests/audioSource.test.ts` - source loading and playback-state tests.
- `apps/web/tests/mouthMorphController.test.ts` - morph discovery and reset tests.
- `apps/web/tests/performanceMonitor.test.ts` - metric aggregation tests.
- `apps/web/tests/qualityController.test.ts` - degradation and recovery tests.
- `apps/web/tests/lipSyncLabStore.test.ts` - Zustand updates and reset tests.
- `apps/web/tests/LipSyncLab.test.tsx` - page interaction tests.
- `apps/web/tests/LipSyncStage.test.tsx` - renderer lifecycle tests.
- `apps/web/tests/phase3a.browser.test.js` - CSS and browser acceptance assertions.
- `docs/performance/phase-3a-test-procedure.md` - repeatable acceptance procedure and report schema.

### Modified Files

- `apps/web/package.json` - add `zustand` and `lucide-react`.
- `apps/web/src/main.tsx` - render `RootApp`.
- `apps/web/src/components/DigitalHumanStage.tsx` - apply shared disposal, visibility pause, quality cap, and remove unnecessary preserved drawing buffer.
- `apps/web/tests/DigitalHumanStage.test.tsx` - verify renderer cleanup and hidden-page pause.

---

### Task 1: Add the Lab Route and Dependencies

**Files:**

- Modify: `apps/web/package.json`
- Create: `apps/web/src/routing/appRoute.ts`
- Create: `apps/web/src/RootApp.tsx`
- Create: `apps/web/src/lab/lip-sync/LipSyncLab.tsx`
- Modify: `apps/web/src/main.tsx`
- Test: `apps/web/tests/appRoute.test.ts`
- Test: `apps/web/tests/LipSyncLab.test.tsx`

- [ ] **Step 1: Install the scoped UI dependencies**

Run:

```powershell
npm --workspace apps/web install zustand lucide-react
```

Expected: `apps/web/package.json` lists both packages under `dependencies` and npm exits 0.

- [ ] **Step 2: Write the failing route test**

Create `apps/web/tests/appRoute.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveAppRoute } from '../src/routing/appRoute';

describe('resolveAppRoute', () => {
  it('selects the lip sync lab only for its exact route', () => {
    expect(resolveAppRoute('/lab/lip-sync')).toBe('lip-sync-lab');
    expect(resolveAppRoute('/')).toBe('guide');
    expect(resolveAppRoute('/lab/unknown')).toBe('guide');
  });
});
```

Create `apps/web/tests/LipSyncLab.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LipSyncLab } from '../src/lab/lip-sync/LipSyncLab';

describe('LipSyncLab', () => {
  it('renders the engineering workspace heading', () => {
    render(<LipSyncLab />);
    expect(screen.getByRole('heading', { name: '口型与性能实验室' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the route test and verify RED**

Run:

```powershell
npm --workspace apps/web run test -- appRoute.test.ts LipSyncLab.test.tsx
```

Expected: FAIL because the route resolver and lab component do not exist.

- [ ] **Step 4: Implement the route resolver and root component**

Create `apps/web/src/routing/appRoute.ts`:

```ts
export type AppRoute = 'guide' | 'lip-sync-lab';

export function resolveAppRoute(pathname: string): AppRoute {
  return pathname === '/lab/lip-sync' ? 'lip-sync-lab' : 'guide';
}
```

Create `apps/web/src/lab/lip-sync/LipSyncLab.tsx`:

```tsx
export function LipSyncLab() {
  return (
    <main className="lip-sync-lab">
      <h1>口型与性能实验室</h1>
    </main>
  );
}
```

Create `apps/web/src/RootApp.tsx`:

```tsx
import { App } from './App';
import { LipSyncLab } from './lab/lip-sync/LipSyncLab';
import { resolveAppRoute } from './routing/appRoute';

export function RootApp() {
  return resolveAppRoute(window.location.pathname) === 'lip-sync-lab' ? <LipSyncLab /> : <App />;
}
```

Modify `apps/web/src/main.tsx` so `StrictMode` renders `<RootApp />` instead of `<App />`.

- [ ] **Step 5: Verify GREEN and the production route**

Run:

```powershell
npm --workspace apps/web run test -- appRoute.test.ts LipSyncLab.test.tsx
npm --workspace apps/web run typecheck
```

Expected: both tests pass and typecheck exits 0.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/package.json package-lock.json apps/web/src/main.tsx apps/web/src/RootApp.tsx apps/web/src/routing/appRoute.ts apps/web/src/lab/lip-sync/LipSyncLab.tsx apps/web/tests/appRoute.test.ts apps/web/tests/LipSyncLab.test.tsx
git commit -m "feat(web): add lip sync lab route"
```

---

### Task 2: Implement the Pure Mouth-Signal Filter

**Files:**

- Create: `apps/web/src/lab/lip-sync/types.ts`
- Create: `apps/web/src/lab/lip-sync/audio/mouthSignal.ts`
- Test: `apps/web/tests/mouthSignal.test.ts`

- [ ] **Step 1: Write failing behavior tests**

Create `apps/web/tests/mouthSignal.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { nextMouthSignal } from '../src/lab/lip-sync/audio/mouthSignal';

const config = {
  threshold: 0.08,
  sensitivity: 2,
  maxOpen: 0.86,
  attackMs: 70,
  releaseMs: 140
};

describe('nextMouthSignal', () => {
  it('suppresses noise below the threshold', () => {
    expect(nextMouthSignal(0, 0.05, 16, config)).toBe(0);
  });

  it('clamps loud input to maxOpen', () => {
    expect(nextMouthSignal(0, 1, 1000, config)).toBeCloseTo(0.86, 3);
  });

  it('attacks faster than it releases', () => {
    const opened = nextMouthSignal(0, 0.5, 32, config);
    const released = nextMouthSignal(opened, 0, 32, config);

    expect(opened).toBeGreaterThan(0);
    expect(released).toBeGreaterThan(0);
    expect(opened - released).toBeLessThan(opened);
  });

  it('returns to zero without leaving a residual mouth opening', () => {
    let value = 0.8;
    for (let index = 0; index < 120; index += 1) {
      value = nextMouthSignal(value, 0, 16, config);
    }
    expect(value).toBeLessThan(0.001);
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npm --workspace apps/web run test -- mouthSignal.test.ts
```

Expected: FAIL because `mouthSignal.ts` does not exist.

- [ ] **Step 3: Add the complete filter types and implementation**

Create the relevant declarations in `apps/web/src/lab/lip-sync/types.ts`:

```ts
export type MouthSignalConfig = {
  threshold: number;
  sensitivity: number;
  maxOpen: number;
  attackMs: number;
  releaseMs: number;
};

export const DEFAULT_MOUTH_SIGNAL_CONFIG: MouthSignalConfig = {
  threshold: 0.08,
  sensitivity: 2,
  maxOpen: 0.86,
  attackMs: 70,
  releaseMs: 140
};
```

Create `apps/web/src/lab/lip-sync/audio/mouthSignal.ts`:

```ts
import type { MouthSignalConfig } from '../types';

// Work order: 3D digital-human lip sync and audio synchronization.

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function calculateRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  const sum = samples.reduce((total, sample) => total + sample * sample, 0);
  return Math.sqrt(sum / samples.length);
}

export function nextMouthSignal(
  current: number,
  rms: number,
  deltaMs: number,
  config: MouthSignalConfig
): number {
  const aboveNoise = Math.max(0, rms - config.threshold);
  const target = clamp(aboveNoise * config.sensitivity, 0, config.maxOpen);
  const duration = target > current ? config.attackMs : config.releaseMs;
  const alpha = duration <= 0 ? 1 : 1 - Math.exp(-Math.max(deltaMs, 0) / duration);
  const next = current + (target - current) * alpha;
  return target === 0 && next < 0.001 ? 0 : next;
}
```

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
npm --workspace apps/web run test -- mouthSignal.test.ts
```

Expected: all four tests pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/lab/lip-sync/types.ts apps/web/src/lab/lip-sync/audio/mouthSignal.ts apps/web/tests/mouthSignal.test.ts
git commit -m "feat(web): add audio mouth signal filter"
```

---

### Task 3: Discover and Drive Thanh Mouth Morphs

**Files:**

- Create: `apps/web/src/lab/lip-sync/three/mouthMorphController.ts`
- Test: `apps/web/tests/mouthMorphController.test.ts`

- [ ] **Step 1: Write the failing morph-controller test**

Create `apps/web/tests/mouthMorphController.test.ts` using real Three.js objects:

```ts
import { BufferGeometry, Mesh, MeshBasicMaterial, Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { createMouthMorphController } from '../src/lab/lip-sync/three/mouthMorphController';

function createFaceMesh() {
  const mesh = new Mesh(new BufferGeometry(), new MeshBasicMaterial());
  mesh.morphTargetDictionary = { jawOpen: 0, mouthOpen: 1, viseme_aa: 2 };
  mesh.morphTargetInfluences = [0, 0, 0];
  return mesh;
}

describe('createMouthMorphController', () => {
  it('drives every jawOpen and mouthOpen target and resets them', () => {
    const root = new Object3D();
    const first = createFaceMesh();
    const second = createFaceMesh();
    root.add(first, second);
    const controller = createMouthMorphController(root);

    expect(controller.bindingCount).toBe(4);
    controller.setOpen(0.65);
    expect(first.morphTargetInfluences).toEqual([0.65, 0.65, 0]);
    expect(second.morphTargetInfluences).toEqual([0.65, 0.65, 0]);

    controller.reset();
    expect(first.morphTargetInfluences).toEqual([0, 0, 0]);
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm --workspace apps/web run test -- mouthMorphController.test.ts
```

Expected: FAIL because the controller module does not exist.

- [ ] **Step 3: Implement the controller**

Create `apps/web/src/lab/lip-sync/three/mouthMorphController.ts`:

```ts
import * as THREE from 'three';

type MorphBinding = {
  influences: number[];
  index: number;
};

export type MouthMorphController = {
  bindingCount: number;
  setOpen: (value: number) => void;
  reset: () => void;
};

export function createMouthMorphController(root: THREE.Object3D): MouthMorphController {
  const bindings: MorphBinding[] = [];

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const dictionary = object.morphTargetDictionary;
    const influences = object.morphTargetInfluences;
    if (!dictionary || !influences) return;

    for (const name of ['jawOpen', 'mouthOpen']) {
      const index = dictionary[name];
      if (typeof index === 'number') bindings.push({ influences, index });
    }
  });

  const setOpen = (value: number) => {
    const normalized = Math.min(1, Math.max(0, value));
    for (const binding of bindings) binding.influences[binding.index] = normalized;
  };

  return {
    bindingCount: bindings.length,
    setOpen,
    reset: () => setOpen(0)
  };
}
```

- [ ] **Step 4: Verify GREEN and missing-target behavior**

Add a second test asserting an empty `Object3D` returns `bindingCount === 0` and `setOpen` does not throw. Then run:

```powershell
npm --workspace apps/web run test -- mouthMorphController.test.ts
```

Expected: both tests pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/lab/lip-sync/three/mouthMorphController.ts apps/web/tests/mouthMorphController.test.ts
git commit -m "feat(web): add three mouth morph controller"
```

---

### Task 4: Build Reusable Preset, File, and URL Audio Sources

**Files:**

- Modify: `apps/web/src/lab/lip-sync/types.ts`
- Create: `apps/web/src/lab/lip-sync/audio/audioSource.ts`
- Test: `apps/web/tests/audioSource.test.ts`

- [ ] **Step 1: Add failing source-loading tests**

Test these exact behaviors in `apps/web/tests/audioSource.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { readAudioSource } from '../src/lab/lip-sync/audio/audioSource';

describe('readAudioSource', () => {
  it('reads a local file without fetch', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'voice.wav');
    const fetcher = vi.fn();
    const result = await readAudioSource({ kind: 'file', file }, fetcher);
    expect(new Uint8Array(result)).toEqual(new Uint8Array([1, 2, 3]));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects a failed URL response with a source-specific message', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));
    await expect(
      readAudioSource({ kind: 'url', url: 'https://audio.test/a.mp3' }, fetcher)
    ).rejects.toThrow('音频地址加载失败：403');
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm --workspace apps/web run test -- audioSource.test.ts
```

Expected: FAIL because `readAudioSource` is missing.

- [ ] **Step 3: Add source types and loader**

Add to `types.ts`:

```ts
export type LabAudioSource =
  { kind: 'preset' } | { kind: 'file'; file: File } | { kind: 'url'; url: string };
```

Implement `readAudioSource` and an `AudioAnalysisSession` in `audioSource.ts`. The session must:

- decode through one injected `AudioContext`;
- connect `AudioBufferSourceNode -> AnalyserNode -> destination`;
- expose `play`, `pause`, `stop`, `sample`, `progress`, and `dispose`;
- keep a pause offset and recreate `AudioBufferSourceNode` after pause because buffer sources are one-shot;
- set mouth-driving samples to zero after stop, decode failure, or natural completion;
- revoke object URLs and close only contexts it created.

For `{ kind: 'preset' }`, generate a deterministic six-second `AudioBuffer` in memory using a 180 Hz tone with four amplitude envelopes. This source is repository-owned, requires no downloaded media license, and gives the performance test repeatable silent/loud transitions.

Use this public interface exactly:

```ts
export type AudioAnalysisFrame = {
  rms: number;
  currentTime: number;
  duration: number;
  playing: boolean;
};

export type AudioAnalysisSession = {
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  sample(): AudioAnalysisFrame;
  dispose(): Promise<void>;
};

export async function createAudioAnalysisSession(
  source: LabAudioSource,
  options?: { context?: AudioContext; fetcher?: typeof fetch }
): Promise<AudioAnalysisSession>;
```

- [ ] **Step 4: Test playback state with a fake AudioContext**

Add a minimal fake context to `audioSource.test.ts` that records `start`, `stop`, and `disconnect`. Assert `stop()` returns `sample().playing === false` and `dispose()` disconnects nodes. Run:

```powershell
npm --workspace apps/web run test -- audioSource.test.ts
```

Expected: all source and lifecycle tests pass.

- [ ] **Step 5: Test the deterministic preset**

Assert the generated preset is six seconds long at the active context sample rate and contains both near-zero and nonzero RMS windows. Run `audioSource.test.ts` again and expect all tests to pass.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/lab/lip-sync/types.ts apps/web/src/lab/lip-sync/audio/audioSource.ts apps/web/tests/audioSource.test.ts
git commit -m "feat(web): add reusable lab audio sources"
```

---

### Task 5: Add Performance Metrics and Quality Hysteresis

**Files:**

- Modify: `apps/web/src/lab/lip-sync/types.ts`
- Create: `apps/web/src/lab/lip-sync/performance/performanceMonitor.ts`
- Create: `apps/web/src/lab/lip-sync/performance/qualityController.ts`
- Test: `apps/web/tests/performanceMonitor.test.ts`
- Test: `apps/web/tests/qualityController.test.ts`

- [ ] **Step 1: Write failing monitor and quality tests**

Cover:

```ts
expect(monitor.snapshot().averageFps).toBeCloseTo(60, 0);
expect(monitor.snapshot().p95FrameMs).toBeCloseTo(16.7, 1);
expect(nextQualityTier('high', { averageFps: 42, lowWindows: 3, healthyWindows: 0 })).toBe(
  'medium'
);
expect(nextQualityTier('medium', { averageFps: 58, lowWindows: 0, healthyWindows: 6 })).toBe(
  'high'
);
expect(nextQualityTier('medium', { averageFps: 58, lowWindows: 0, healthyWindows: 2 })).toBe(
  'medium'
);
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm --workspace apps/web run test -- performanceMonitor.test.ts qualityController.test.ts
```

Expected: FAIL because both modules are absent.

- [ ] **Step 3: Implement stable metric types**

Add:

```ts
export type RenderQualityTier = 'low' | 'medium' | 'high';

export type PerformanceSnapshot = {
  averageFps: number;
  p95FrameMs: number;
  mouthResponseMs: number | null;
  drawCalls: number;
  triangles: number;
  heapMb: number | null;
  qualityTier: RenderQualityTier;
};
```

Implement `PerformanceMonitor.recordFrame(timestampMs)`, `markAudioStart(timestampMs)`, `markMouthResponse(timestampMs)`, `setRendererInfo(renderer.info)`, and `snapshot()`. Keep at most 600 recent frame durations so metrics do not grow without bound.

Add one module-level traceability comment to `performanceMonitor.ts`: `Work order: 3D digital-human rendering performance optimization.` Do not repeat the work-order comment inside individual methods.

- [ ] **Step 4: Implement quality profiles and hysteresis**

Use these concrete profiles:

```ts
export const QUALITY_PROFILES = {
  low: { pixelRatioCap: 1, shadows: false, stageEffects: false },
  medium: { pixelRatioCap: 1.5, shadows: true, stageEffects: false },
  high: { pixelRatioCap: 2, shadows: true, stageEffects: true }
} as const;
```

Degrade after three consecutive windows below the device target; recover only after six consecutive healthy windows. Desktop target is 55 FPS and viewports up to 860px use a 30 FPS target.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
npm --workspace apps/web run test -- performanceMonitor.test.ts qualityController.test.ts
```

Expected: all tests pass and metric arrays remain bounded.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/lab/lip-sync/types.ts apps/web/src/lab/lip-sync/performance apps/web/tests/performanceMonitor.test.ts apps/web/tests/qualityController.test.ts
git commit -m "feat(web): add render metrics and quality tiers"
```

---

### Task 6: Add the Scoped Zustand Store

**Files:**

- Create: `apps/web/src/lab/lip-sync/store/useLipSyncLabStore.ts`
- Test: `apps/web/tests/lipSyncLabStore.test.ts`

- [ ] **Step 1: Write the failing store test**

Test that parameter updates are clamped, metrics are replaced atomically, source mode changes do not retain a stale file, and `reset()` restores defaults.

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm --workspace apps/web run test -- lipSyncLabStore.test.ts
```

Expected: FAIL because the store does not exist.

- [ ] **Step 3: Implement a serializable store only**

The store shape is:

```ts
type LipSyncLabState = {
  sourceMode: 'preset' | 'file' | 'url';
  sourceUrl: string;
  sourceFile: File | null;
  playback: 'idle' | 'loading' | 'playing' | 'paused' | 'error';
  error: string | null;
  config: MouthSignalConfig;
  qualityTier: RenderQualityTier;
  automaticQuality: boolean;
  metrics: PerformanceSnapshot;
  setSourceMode(mode: LipSyncLabState['sourceMode']): void;
  setSourceUrl(url: string): void;
  setSourceFile(file: File | null): void;
  setPlayback(playback: LipSyncLabState['playback'], error?: string | null): void;
  updateConfig(patch: Partial<MouthSignalConfig>): void;
  setQualityTier(tier: RenderQualityTier): void;
  setAutomaticQuality(enabled: boolean): void;
  setMetrics(metrics: PerformanceSnapshot): void;
  reset(): void;
};
```

Do not store `AudioContext`, Three.js objects, analyser nodes, animation frame IDs, or controller instances in Zustand.

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
npm --workspace apps/web run test -- lipSyncLabStore.test.ts
```

Expected: all store tests pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/lab/lip-sync/store/useLipSyncLabStore.ts apps/web/tests/lipSyncLabStore.test.ts
git commit -m "feat(web): add lip sync lab state"
```

---

### Task 7: Build the Lab Three.js Renderer and React Stage

**Files:**

- Create: `apps/web/src/lib/three/disposeObject3D.ts`
- Create: `apps/web/src/lab/lip-sync/three/LipSyncRenderer.ts`
- Create: `apps/web/src/lab/lip-sync/components/LipSyncStage.tsx`
- Test: `apps/web/tests/LipSyncStage.test.tsx`

- [ ] **Step 1: Write a failing lifecycle test**

Mock `LipSyncRenderer` and assert `LipSyncStage` creates it once, calls `resize` through `ResizeObserver`, and calls `dispose` on unmount. Also assert the host has a stable `aria-label="本地 3D 数字人口型预览"`.

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm --workspace apps/web run test -- LipSyncStage.test.tsx
```

Expected: FAIL because the component and renderer do not exist.

- [ ] **Step 3: Implement shared disposal**

`disposeObject3D(root)` must traverse meshes, dispose geometries, dispose every material including arrays, and dispose material texture properties only once through a `Set<THREE.Texture>`.

- [ ] **Step 4: Implement `LipSyncRenderer` with an explicit API**

Use this interface:

```ts
export type LipSyncRendererOptions = {
  host: HTMLElement;
  modelUrl: string;
  getAudioFrame: () => AudioAnalysisFrame;
  getConfig: () => MouthSignalConfig;
  getQualityTier: () => RenderQualityTier;
  onMetrics: (metrics: PerformanceSnapshot) => void;
  onReady: () => void;
  onError: (message: string) => void;
};

export class LipSyncRenderer {
  constructor(options: LipSyncRendererOptions);
  start(): Promise<void>;
  resize(): void;
  dispose(): void;
}
```

The frame loop must sample RMS, call `nextMouthSignal`, call `mouthController.setOpen`, update metrics, apply sustained quality changes, and render. Use `requestAnimationFrame`; stop when `document.hidden`, resume on visibility change, and reset the mouth on stop/error/dispose.

Create the renderer with `antialias: window.innerWidth > 860`, `alpha: true`, no `preserveDrawingBuffer`, capped pixel ratio, conditional shadows, and the existing `Thanh.glb` model URL. Runtime quality changes update pixel ratio, shadows, and stage effects without rebuilding the renderer.

- [ ] **Step 5: Implement the React wrapper**

`LipSyncStage` keeps the renderer in a ref, creates it in one effect, uses `ResizeObserver`, and reports loading/error state without rebuilding the renderer when sliders move. Controller callbacks read current Zustand state through `useLipSyncLabStore.getState()`.

- [ ] **Step 6: Verify GREEN and cleanup**

Run:

```powershell
npm --workspace apps/web run test -- LipSyncStage.test.tsx mouthMorphController.test.ts mouthSignal.test.ts
npm --workspace apps/web run typecheck
```

Expected: tests and typecheck pass.

- [ ] **Step 7: Commit**

```powershell
git add apps/web/src/lib/three/disposeObject3D.ts apps/web/src/lab/lip-sync/three/LipSyncRenderer.ts apps/web/src/lab/lip-sync/components/LipSyncStage.tsx apps/web/tests/LipSyncStage.test.tsx
git commit -m "feat(web): render audio-driven local guide"
```

---

### Task 8: Complete the Lab Controls, Metrics, and Responsive Layout

**Files:**

- Modify: `apps/web/src/lab/lip-sync/LipSyncLab.tsx`
- Create: `apps/web/src/lab/lip-sync/components/AudioSourceToolbar.tsx`
- Create: `apps/web/src/lab/lip-sync/components/LipSyncControls.tsx`
- Create: `apps/web/src/lab/lip-sync/components/PerformancePanel.tsx`
- Create: `apps/web/src/lab/lip-sync/lipSyncLab.css`
- Modify: `apps/web/tests/LipSyncLab.test.tsx`

- [ ] **Step 1: Expand the failing component test**

Assert the page has:

- segmented source controls named `预置音频`, `本地文件`, and `音频 URL`;
- Play, Pause, Reset, and Back commands with Lucide icons and accessible labels;
- sliders for sensitivity, threshold, maximum open, attack, and release;
- a three-option quality control plus automatic-quality checkbox;
- live regions for playback error and metrics;
- no nested card containers.

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm --workspace apps/web run test -- LipSyncLab.test.tsx
```

Expected: FAIL because the controls are not rendered.

- [ ] **Step 3: Implement the toolbar and audio lifecycle**

`AudioSourceToolbar` creates one `AudioAnalysisSession` per selected source, disposes the prior session before replacement, and exposes the current session through a ref owned by `LipSyncLab`. File input accepts `audio/*`; URL submit validates `http:` or `https:`; preset uses `{ kind: 'preset' }` and the deterministic in-memory buffer.

- [ ] **Step 4: Implement controls and metrics**

Use native range inputs with visible current values and fixed width. Use a segmented control for source and quality. Use Lucide `ArrowLeft`, `Play`, `Pause`, `RotateCcw`, `Upload`, and `Link` icons. Every icon-only button has an `aria-label` and tooltip via `title`.

- [ ] **Step 5: Implement responsive CSS**

Desktop layout uses `235px minmax(420px, 1fr) 220px`; mobile stacks toolbar, controls, a stage with `min-height: 68vh`, and metrics. Avoid viewport-scaled font sizes, negative letter spacing, nested cards, horizontal overflow, and fixed controls that cover the model.

- [ ] **Step 6: Verify GREEN**

Run:

```powershell
npm --workspace apps/web run test -- LipSyncLab.test.tsx
npm --workspace apps/web run typecheck
```

Expected: component tests and typecheck pass.

- [ ] **Step 7: Commit**

```powershell
git add apps/web/src/lab/lip-sync apps/web/tests/LipSyncLab.test.tsx
git commit -m "feat(web): complete lip sync performance lab"
```

---

### Task 9: Apply Measured Renderer Optimizations to the Production Fallback

**Files:**

- Modify: `apps/web/src/components/DigitalHumanStage.tsx`
- Modify: `apps/web/tests/DigitalHumanStage.test.tsx`

- [ ] **Step 1: Add failing production renderer assertions**

Extend the Three.js mock so the test records constructor options, `setPixelRatio`, animation scheduling, resource disposal, and visibility listeners. Assert:

```ts
expect(rendererOptions).toMatchObject({ antialias: true, alpha: true });
expect(rendererOptions).not.toHaveProperty('preserveDrawingBuffer');
expect(setPixelRatio).toHaveBeenCalledWith(expect.any(Number));
expect(disposeObject3D).toHaveBeenCalled();
```

Simulate `document.hidden === true` and verify the frame loop stops scheduling renders until visibility returns.

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm --workspace apps/web run test -- DigitalHumanStage.test.tsx
```

Expected: FAIL because `preserveDrawingBuffer` is still enabled and cleanup does not dispose scene resources.

- [ ] **Step 3: Implement only measured optimizations**

Modify `DigitalHumanStage.tsx` to:

- remove `preserveDrawingBuffer: true`;
- use the medium quality profile's pixel-ratio cap;
- pause RAF on `visibilitychange` and resume exactly once;
- call `disposeObject3D(scene)` after removing the canvas;
- dispose shadow-map resources through renderer disposal;
- keep the XFYUN stream behavior unchanged;
- keep stage and model dimensions stable.

- [ ] **Step 4: Verify GREEN and regression suite**

Run:

```powershell
npm --workspace apps/web run test -- DigitalHumanStage.test.tsx layoutCss.test.js
npm --workspace apps/web run typecheck
```

Expected: tests pass and the fixed desktop split layout remains unchanged.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/components/DigitalHumanStage.tsx apps/web/tests/DigitalHumanStage.test.tsx
git commit -m "perf(web): optimize local digital human rendering"
```

---

### Task 10: Browser Acceptance and Performance Documentation

**Files:**

- Create: `apps/web/tests/phase3a.browser.test.js`
- Create: `docs/performance/phase-3a-test-procedure.md`
- Modify: `README.md`

- [ ] **Step 1: Add deterministic browser acceptance checks**

The browser test must navigate to `/lab/lip-sync`, load the preset, click Play, and assert:

- WebGL canvas pixel variance is nonzero;
- `mouthOpen` changes from zero within 200ms of reported audio start;
- audio completion returns mouth opening below 0.01;
- desktop `1440x900` and mobile `390x844` have no horizontal overflow or overlapping controls;
- changing each slider leaves stage bounds unchanged;
- navigating away disposes the audio context and WebGL canvas.

Use a test-only `window.__LIP_SYNC_DEBUG__` object exposing read-only current mouth value, audio-start timestamp, mouth-response timestamp, and metrics. Do not expose controller mutation methods.

- [ ] **Step 2: Run browser verification with the dev server**

Run the project and then execute the browser check through Playwright MCP or the repository's Playwright command if added:

```powershell
npm run dev
```

Expected at `http://localhost:5174/lab/lip-sync`: nonblank full-body model, audible sample after user click, responsive mouth, no overlap, and metrics updating.

- [ ] **Step 3: Perform repeatable performance runs**

Record three 60-second runs at desktop `1440x900` and three at mobile `390x844`. Capture browser/version, device, viewport, quality tier, average FPS, P95 frame time, response latency, draw calls, triangles, heap support/value, and whether automatic degradation occurred. Run one 10-minute stability session and record beginning/end heap when supported.

- [ ] **Step 4: Write the procedure and actual measured report**

`docs/performance/phase-3a-test-procedure.md` must contain:

1. exact startup command and URL;
2. browser/device prerequisites;
3. preset/file/URL test cases;
4. metric definitions;
5. the six measured 60-second result rows;
6. the 10-minute stability result;
7. deviations from 55 FPS desktop or 30 FPS mobile targets and the quality tier selected;
8. XFYUN concurrency note so the lab test does not occupy the online-avatar session.

- [ ] **Step 5: Run the full verification gate**

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: all commands exit 0. The existing Vite chunk-size warning may remain documented but no new warning is introduced by the lab route beyond the added Three.js/lab chunk.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/tests/phase3a.browser.test.js docs/performance/phase-3a-test-procedure.md README.md
git commit -m "test: document phase 3a acceptance results"
```

---

## Phase 3A Completion Gate

Do not start Phase 3B until all of the following are true:

- `/` still uses XFYUN first and local Three.js only as fallback.
- `/lab/lip-sync` supports all three audio source types.
- Mouth response is measured at or below 200ms.
- Desktop and mobile performance targets are either met or have a measured, documented quality-tier explanation.
- Audio and WebGL resources are disposed on route exit.
- Full tests, typecheck, lint, and build pass.
