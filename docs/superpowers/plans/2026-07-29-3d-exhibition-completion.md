# 3D Exhibition Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing West Lake exhibition into a complete first-person 3D hall with consistent materials, comprehensive collision, exhibit feedback, and a bounded West Lake scene.

**Architecture:** Keep React responsible for page and scene state while Three.js renderer classes own scene graphs, input, animation, and disposal. Expand collision as testable pure functions, centralize hall metadata and materials, and preserve the existing `/exhibition` route and video-center integration.

**Tech Stack:** React 19, TypeScript, Three.js, Vite, Vitest, React Testing Library, Playwright

---

## File Structure

| File                                             | Responsibility                                                    |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| `apps/web/src/exhibition/collision.ts`           | Player radius, room clamp, AABB overlap, axis-safe movement       |
| `apps/web/src/exhibition/exhibitionMaterials.ts` | Shared hall color and material factories                          |
| `apps/web/src/exhibition/exhibitionLayout.ts`    | Exhibit IDs, visible dimensions, placement, and colliders         |
| `apps/web/src/exhibition/ExhibitionRenderer.ts`  | Indoor scene, input state, raycasting, hover, animation, disposal |
| `apps/web/src/exhibition/westLakeScene.ts`       | Lake landscape, bounded movement, collision, disposal             |
| `apps/web/src/components/ExhibitionPage.tsx`     | React mode/state machine, details, navigation, error fallback     |
| `apps/web/src/styles.css`                        | Full-bleed exhibition controls and responsive safe areas          |
| `apps/web/tests/*Exhibition*`                    | Renderer and page regression tests                                |
| `apps/web/tests/exhibition.browser.test.js`      | Desktop canvas, layout, scene transition, and pixel verification  |

### Task 1: Collision Contract and Axis-Safe Movement

**Files:**

- Modify: `apps/web/src/exhibition/collision.ts`
- Modify: `apps/web/tests/exhibitionCollision.test.ts`

- [ ] **Step 1: Write failing tests for normalized diagonal movement, sliding, and frame clamping**

```ts
expect(resolveMovement({ x: 0, z: 0 }, { x: 1, z: 1 }, [], ROOM_BOUNDS, 0.4)).toEqual({
  x: 1,
  z: 1
});
expect(resolveMovement({ x: 0, z: 0 }, { x: 1, z: 1 }, [blockX], ROOM_BOUNDS, 0.4).z).toBe(1);
expect(clampFrameDelta(0.4)).toBe(0.1);
expect(normalizeMovement({ x: 1, z: 1 })).toEqual({ x: Math.SQRT1_2, z: Math.SQRT1_2 });
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm --workspace apps/web run test -- exhibitionCollision`

Expected: FAIL because `resolveMovement`, `clampFrameDelta`, and `normalizeMovement` are not exported.

- [ ] **Step 3: Implement the pure movement contract**

```ts
export const MAX_FRAME_DELTA_SECONDS = 0.1;
export function clampFrameDelta(delta: number) {
  return Math.min(MAX_FRAME_DELTA_SECONDS, Math.max(0, delta));
}
export function normalizeMovement(delta: Point2): Point2 {
  const length = Math.hypot(delta.x, delta.z);
  return length > 1 ? { x: delta.x / length, z: delta.z / length } : delta;
}
export function resolveMovement(
  point: Point2,
  delta: Point2,
  colliders: Collider[],
  bounds: Collider,
  radius: number
) {
  const target = clampToRoom({ x: point.x + delta.x, z: point.z + delta.z }, bounds, radius);
  if (canOccupy(target, colliders, radius)) return target;
  const xOnly = clampToRoom({ x: target.x, z: point.z }, bounds, radius);
  const zOnly = clampToRoom({ x: point.x, z: target.z }, bounds, radius);
  if (canOccupy(xOnly, colliders, radius)) return xOnly;
  if (canOccupy(zOnly, colliders, radius)) return zOnly;
  return point;
}
```

- [ ] **Step 4: Run collision tests**

Run: `npm --workspace apps/web run test -- exhibitionCollision`

Expected: PASS, including wall bounds, object overlap, diagonal normalization, and sliding.

- [ ] **Step 5: Commit collision behavior**

```bash
git add apps/web/src/exhibition/collision.ts apps/web/tests/exhibitionCollision.test.ts
git commit -m "feat(web): harden exhibition collision movement"
```

### Task 2: Shared Hall Materials and Layout Metadata

**Files:**

- Create: `apps/web/src/exhibition/exhibitionMaterials.ts`
- Create: `apps/web/src/exhibition/exhibitionLayout.ts`
- Create: `apps/web/tests/exhibitionLayout.test.ts`
- Modify: `apps/web/src/exhibition/ExhibitionRenderer.ts`

- [ ] **Step 1: Write failing layout tests**

```ts
expect(HALL_DIMENSIONS).toEqual({ width: 16, depth: 20, height: 4.8 });
expect(EXHIBITION_LAYOUT.map((item) => item.id)).toEqual(
  expect.arrayContaining([
    'west-lake-map',
    'silk-and-tea',
    'west-lake-bicycle',
    'green-mobility-car',
    'west-lake-wall-art'
  ])
);
expect(EXHIBITION_LAYOUT.filter((item) => item.blocksMovement).every((item) => item.collider)).toBe(
  true
);
expect(assertMainAisleClear(EXHIBITION_LAYOUT, 2.4)).toBe(true);
```

- [ ] **Step 2: Verify layout tests fail**

Run: `npm --workspace apps/web run test -- exhibitionLayout`

Expected: FAIL because the layout module does not exist.

- [ ] **Step 3: Define typed placement metadata**

```ts
export type ExhibitLayoutItem = {
  id: string;
  kind: 'sand-table' | 'display-table' | 'bicycle' | 'shuttle' | 'wall-art' | 'plant';
  position: { x: number; y: number; z: number };
  size: { width: number; height: number; depth: number };
  interactive: boolean;
  blocksMovement: boolean;
  collider?: Collider;
};
export const HALL_DIMENSIONS = { width: 16, depth: 20, height: 4.8 } as const;
```

- [ ] **Step 4: Add shared material factories**

```ts
export function createHallMaterials() {
  return {
    wall: new THREE.MeshStandardMaterial({ color: '#edf0e8', roughness: 0.84 }),
    floor: new THREE.MeshStandardMaterial({ color: '#70877b', roughness: 0.9 }),
    wood: new THREE.MeshStandardMaterial({ color: '#4c352a', roughness: 0.76 }),
    metal: new THREE.MeshStandardMaterial({ color: '#355a51', roughness: 0.58, metalness: 0.28 }),
    water: new THREE.MeshPhysicalMaterial({
      color: '#73aeb2',
      roughness: 0.24,
      transparent: true,
      opacity: 0.78
    })
  };
}
```

- [ ] **Step 5: Make the renderer consume metadata and shared materials**

Register colliders only for `blocksMovement` items, mark interactive roots with their stable IDs, and reuse material instances across repeated geometry.

- [ ] **Step 6: Run layout and renderer tests**

Run: `npm --workspace apps/web run test -- exhibitionLayout ExhibitionRenderer`

Expected: PASS and scene root names remain `hall-shell`, `hall-lighting`, `exhibits`, and `greenery`.

- [ ] **Step 7: Commit the scene data split**

```bash
git add apps/web/src/exhibition/exhibitionMaterials.ts apps/web/src/exhibition/exhibitionLayout.ts apps/web/src/exhibition/ExhibitionRenderer.ts apps/web/tests/exhibitionLayout.test.ts
git commit -m "refactor(web): centralize exhibition layout and materials"
```

### Task 3: Input State, Hover Feedback, and Lifecycle

**Files:**

- Modify: `apps/web/src/exhibition/ExhibitionRenderer.ts`
- Modify: `apps/web/tests/ExhibitionRenderer.test.ts`

- [ ] **Step 1: Add failing renderer tests**

```ts
renderer.setInteractionEnabled(false);
window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
runFrame();
expect(renderer.getCameraPose()).toEqual(beforePose);
window.dispatchEvent(new Event('blur'));
expect(renderer.getPressedKeyCount()).toBe(0);
canvas.dispatchEvent(pointerMoveAt(200, 120));
expect(canvas.style.cursor).toBe('pointer');
```

- [ ] **Step 2: Verify focused tests fail**

Run: `npm --workspace apps/web run test -- ExhibitionRenderer`

Expected: FAIL because interaction gating, blur cleanup, and hover state are absent.

- [ ] **Step 3: Implement the explicit interaction API**

```ts
setInteractionEnabled(enabled: boolean) {
  this.interactionEnabled = enabled;
  if (!enabled) {
    this.pressedKeys.clear();
    document.exitPointerLock?.();
  }
}
```

Add `blur`, `pointerlockchange`, and pointer-hover listeners; select only the nearest valid exhibit; restore the previous material emissive/color state when hover leaves.

- [ ] **Step 4: Replace per-frame movement with normalized axis-safe resolution**

Use `clampFrameDelta`, `normalizeMovement`, and `resolveMovement`. Compute horizontal forward/right vectors from yaw only, so pitch never changes ground movement.

- [ ] **Step 5: Verify renderer lifecycle**

Run: `npm --workspace apps/web run test -- ExhibitionRenderer exhibitionCollision`

Expected: PASS; all new listeners are removed exactly once and no frame remains scheduled after disposal.

- [ ] **Step 6: Commit interaction behavior**

```bash
git add apps/web/src/exhibition/ExhibitionRenderer.ts apps/web/tests/ExhibitionRenderer.test.ts
git commit -m "feat(web): add exhibition interaction states and hover feedback"
```

### Task 4: Complete the Bounded West Lake Scene

**Files:**

- Modify: `apps/web/src/exhibition/westLakeScene.ts`
- Create: `apps/web/tests/WestLakeScene.test.ts`

- [ ] **Step 1: Write failing scene-structure and movement tests**

```ts
expect(sceneRoots).toEqual(
  expect.arrayContaining([
    'lake-water',
    'su-causeway',
    'arch-bridge',
    'trees',
    'leifeng-pagoda',
    'distant-mountains'
  ])
);
expect(renderer.getCameraPose().position).toMatchObject({ y: 1.65 });
expect(renderer.getCameraPose().position.x).toBeGreaterThanOrEqual(
  LAKE_BOUNDS.minX + PLAYER_RADIUS
);
expect(renderer.getCameraPose().position.x).toBeLessThanOrEqual(LAKE_BOUNDS.maxX - PLAYER_RADIUS);
```

- [ ] **Step 2: Verify West Lake tests fail**

Run: `npm --workspace apps/web run test -- WestLakeScene`

Expected: FAIL because the scene does not expose the required structure and bounded movement contract.

- [ ] **Step 3: Build named low-poly scene groups**

Create one water group, a `>=1.6m` causeway, one arch bridge, instanced/shared tree geometry, a layered pagoda, and two or three mountain silhouettes. Spawn the camera where at least lake water and the pagoda are visible.

- [ ] **Step 4: Add lake collision and movement**

Reuse the collision helpers with independent `LAKE_BOUNDS`. Register water exclusion zones and bridge/rail colliders; keep the causeway and bridge deck walkable.

- [ ] **Step 5: Add reduced-motion and disposal handling**

Stop decorative water/tree animation under `prefers-reduced-motion`, while preserving camera input. Remove media-query listeners, input listeners, animation frames, geometry, material, and canvas on disposal.

- [ ] **Step 6: Run scene tests**

Run: `npm --workspace apps/web run test -- WestLakeScene exhibitionCollision`

Expected: PASS for named scene roots, bounds, obstacle blocking, reduced motion, and disposal.

- [ ] **Step 7: Commit the West Lake scene**

```bash
git add apps/web/src/exhibition/westLakeScene.ts apps/web/tests/WestLakeScene.test.ts
git commit -m "feat(web): complete bounded west lake scene"
```

### Task 5: React Scene State and Accessible Controls

**Files:**

- Modify: `apps/web/src/components/ExhibitionPage.tsx`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/tests/ExhibitionPage.test.tsx`

- [ ] **Step 1: Write failing state-transition tests**

```tsx
expect(screen.getByText('点击画面开始漫游')).toBeInTheDocument();
act(() => rendererState.selectExhibit?.('west-lake-bicycle'));
expect(rendererState.setInteractionEnabled).toHaveBeenCalledWith(false);
fireEvent.keyDown(window, { key: 'Escape' });
expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
fireEvent.click(screen.getByRole('button', { name: '进入西湖沙盘' }));
expect(screen.getByTestId('scene-transition')).toBeInTheDocument();
```

- [ ] **Step 2: Verify page tests fail**

Run: `npm --workspace apps/web run test -- ExhibitionPage`

Expected: FAIL because the explicit interaction and transition states are not implemented.

- [ ] **Step 3: Implement page states**

Use `idle | exploring | detail-open | scene-transition | render-error`. Retain the active renderer in a ref, call `setInteractionEnabled(false)` while the dialog is open, close details on Escape, and block repeated scene-switch clicks.

- [ ] **Step 4: Refine safe-area CSS**

Keep the top bar, hint, return control, service entry, and detail panel outside the central `60%` observation area at desktop sizes. At narrow widths, stack the detail panel below the top bar without overlaying commands.

- [ ] **Step 5: Run page and CSS tests**

Run: `npm --workspace apps/web run test -- ExhibitionPage layoutCss`

Expected: PASS for controls, dialog, scene transitions, error fallback, and layout selectors.

- [ ] **Step 6: Commit React integration**

```bash
git add apps/web/src/components/ExhibitionPage.tsx apps/web/src/styles.css apps/web/tests/ExhibitionPage.test.tsx
git commit -m "feat(web): refine exhibition scene states and controls"
```

### Task 6: Desktop Browser and Performance Acceptance

**Files:**

- Modify: `apps/web/tests/exhibition.browser.test.js`
- Modify: `docs/integration/digital-human-3d-video.md`

- [ ] **Step 1: Extend browser acceptance assertions**

```js
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 }
]) {
  await page.setViewportSize(viewport);
  await page.goto('/exhibition');
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(await nonBackgroundPixelRatio(page.locator('canvas'))).toBeGreaterThan(0.2);
  await assertNoOverlap(page, ['.exhibition-topbar', '.exhibition-hint', '.exhibition-service']);
}
```

- [ ] **Step 2: Add movement and scene-transition checks**

Hold movement keys against room boundaries and major exhibits, assert camera telemetry remains within bounds, click the sand table, verify lake scene named state, return to the hall, and assert only one canvas remains.

- [ ] **Step 3: Add repeated-entry resource check**

Navigate into and out of `/exhibition` five times, asserting a single active canvas and no new console errors. Record sampled FPS and require indoor average `>=45` and lake average `>=40` on the configured desktop runner.

- [ ] **Step 4: Run focused browser acceptance**

Run: `npm --workspace apps/web run test -- exhibition.browser`

Expected: PASS at both desktop viewports with nonblank canvas, no UI overlap, bounded movement, scene return, and no canvas leak.

- [ ] **Step 5: Document controls and fallback**

Document pointer lock, WASD/arrows, Escape behavior, exhibit selection, West Lake transition, WebGL fallback, reduced motion, and the focused browser test command.

- [ ] **Step 6: Run the complete quality gate**

Run: `npm run typecheck && npm run test && npm run build && npm run lint`

Expected: all commands exit `0`; any unrelated pre-existing failure is reported separately and not hidden.

- [ ] **Step 7: Commit acceptance coverage**

```bash
git add apps/web/tests/exhibition.browser.test.js docs/integration/digital-human-3d-video.md
git commit -m "test(web): verify complete 3d exhibition experience"
```

## Plan Self-Review

- Spec coverage: room dimensions, materials, input, collision, hover, scene states, West Lake landmarks, performance, reduced motion, disposal, and desktop acceptance map to Tasks 1-6.
- Type consistency: `Point2`, `Collider`, `resolveMovement`, `ExhibitLayoutItem`, `setInteractionEnabled`, and renderer pose APIs retain one spelling and owner.
- Scope: no mobile joystick, external commercial models, multiplayer, editor, or photorealistic terrain is introduced.
- Placeholder scan: no TBD, TODO, or unspecified implementation step remains.
