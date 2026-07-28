# Independent Navigation Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current in-place holographic overlays with full-page, URL-addressable tourism views for every navigation entry.

**Architecture:** Keep the existing Vite SPA and use the browser History API instead of adding a router dependency. `RootApp` owns the current route and browser history synchronization, while `App` keeps shared chat, voice, speech, and scenic-area state and renders either the Explore stage or a dedicated tourism page.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Playwright, CSS.

---

### Task 1: Define URL-to-view routing

**Files:**

- Modify: `apps/web/src/routing/appRoute.ts`
- Modify: `apps/web/tests/appRoute.test.ts`

- [ ] **Step 1: Write the failing route mapping tests**

```ts
import { pathForTourismView, resolveAppRoute } from '../src/routing/appRoute';

expect(resolveAppRoute('/')).toEqual({ kind: 'tourism', view: 'explore' });
expect(resolveAppRoute('/home')).toEqual({ kind: 'tourism', view: 'home' });
expect(resolveAppRoute('/guide')).toEqual({ kind: 'tourism', view: 'guide' });
expect(resolveAppRoute('/narration')).toEqual({ kind: 'tourism', view: 'narration' });
expect(resolveAppRoute('/map')).toEqual({ kind: 'tourism', view: 'map' });
expect(resolveAppRoute('/itinerary')).toEqual({ kind: 'tourism', view: 'itinerary' });
expect(resolveAppRoute('/voice')).toEqual({ kind: 'tourism', view: 'voice' });
expect(resolveAppRoute('/profile')).toEqual({ kind: 'tourism', view: 'profile' });
expect(resolveAppRoute('/lab/lip-sync')).toEqual({ kind: 'lip-sync-lab' });
expect(resolveAppRoute('/unknown')).toEqual({ kind: 'tourism', view: 'explore' });
expect(pathForTourismView('itinerary')).toBe('/itinerary');
```

- [ ] **Step 2: Run the route test and verify RED**

Run: `npm --workspace apps/web run test -- tests/appRoute.test.ts`

Expected: FAIL because tourism route objects and `pathForTourismView` do not exist.

- [ ] **Step 3: Implement the route table**

```ts
export type TourismView =
  'home' | 'guide' | 'explore' | 'itinerary' | 'profile' | 'narration' | 'map' | 'voice';

export type AppRoute = { kind: 'lip-sync-lab' } | { kind: 'tourism'; view: TourismView };

const VIEW_PATHS: Record<TourismView, string> = {
  explore: '/',
  home: '/home',
  guide: '/guide',
  narration: '/narration',
  map: '/map',
  itinerary: '/itinerary',
  voice: '/voice',
  profile: '/profile'
};
```

`resolveAppRoute` must normalize trailing slashes, preserve `/lab/lip-sync`, and fall back to Explore.

- [ ] **Step 4: Run the route test and verify GREEN**

Run: `npm --workspace apps/web run test -- tests/appRoute.test.ts`

Expected: all route tests pass.

### Task 2: Synchronize React with browser history

**Files:**

- Modify: `apps/web/src/RootApp.tsx`
- Modify: `apps/web/tests/RootApp.test.tsx`

- [ ] **Step 1: Write failing navigation and popstate tests**

Mock `App` as a component that prints `activeView` and invokes `onNavigate('map')`. Verify clicking it changes `window.location.pathname` to `/map`, rerenders the mock with `map`, and dispatching `PopStateEvent` after changing the URL to `/profile` rerenders with `profile`.

- [ ] **Step 2: Run the RootApp test and verify RED**

Run: `npm --workspace apps/web run test -- tests/RootApp.test.tsx`

Expected: FAIL because `RootApp` does not pass route props or subscribe to `popstate`.

- [ ] **Step 3: Implement reactive history navigation**

Use `useCallback`, `useEffect`, and `useState` in `RootApp`. Initialize state from `resolveAppRoute(window.location.pathname)`, add a `popstate` listener, and pass this callback to `App`:

```ts
const navigate = useCallback((view: TourismView) => {
  const pathname = pathForTourismView(view);
  if (window.location.pathname !== pathname) {
    window.history.pushState({}, '', pathname);
  }
  setRoute({ kind: 'tourism', view });
  window.scrollTo({ top: 0, behavior: 'auto' });
}, []);
```

- [ ] **Step 4: Run the RootApp test and verify GREEN**

Run: `npm --workspace apps/web run test -- tests/RootApp.test.tsx`

Expected: RootApp history tests pass.

### Task 3: Render dedicated tourism pages

**Files:**

- Create: `apps/web/src/components/TourismNav.tsx`
- Create: `apps/web/src/components/TourismPage.tsx`
- Create: `apps/web/tests/TourismPage.test.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/DigitalHumanStage.tsx`

- [ ] **Step 1: Write the failing dedicated-page test**

Render `TourismPage` with `view="map"`, test scenic data, and callbacks. Assert it has `data-tourism-page="map"`, contains the map heading and a Back to Explore button, and does not contain `.holo-view-panel`.

- [ ] **Step 2: Run the page test and verify RED**

Run: `npm --workspace apps/web run test -- tests/TourismPage.test.tsx`

Expected: FAIL because `TourismPage` does not exist.

- [ ] **Step 3: Implement reusable navigation**

`TourismNav` receives `activeView: TourismView` and `onNavigate(view)`. It renders the existing five bottom navigation entries and uses `aria-current="page"` only for the active route.

- [ ] **Step 4: Implement the full-page view component**

`TourismPage` receives scenic-area data, route cards, latest answer, voice state, and callbacks for ask, voice toggle, and navigation. Reuse the existing Home, Guide, Narration, Map, Itinerary, Voice, and Profile content. Actions that need the digital human call `onNavigate('explore')` after starting their operation.

- [ ] **Step 5: Replace App overlay state with route props**

Change the App signature to:

```ts
type AppProps = {
  activeView?: TourismView;
  onNavigate?: (view: TourismView) => void;
};

export function App({ activeView = 'explore', onNavigate = () => {} }: AppProps) {
```

For `activeView === 'explore'`, render the existing three-column stage. For every other view, render `TourismPage` as the page body. Remove `.holo-view-panel` rendering entirely. Pass `onNavigate` to `DigitalHumanStage` and `TourismNav`.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `npm --workspace apps/web run test -- tests/TourismPage.test.tsx tests/App.test.tsx tests/DigitalHumanStage.test.tsx`

Expected: all focused component tests pass.

### Task 4: Style and verify complete page navigation

**Files:**

- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/tests/layoutCss.test.js`

- [ ] **Step 1: Add a failing CSS contract test**

Assert the stylesheet contains `.tourism-page`, `.tourism-page-content`, `.tourism-page-back`, and responsive rules that constrain the page to `max-width: 100%` without relying on `.holo-view-panel` for page layout.

- [ ] **Step 2: Run the CSS test and verify RED**

Run: `npm --workspace apps/web run test -- tests/layoutCss.test.js`

Expected: FAIL because the dedicated page classes are absent.

- [ ] **Step 3: Add full-page holographic styling**

Create a viewport-filling `.tourism-page` using the current Wuzhen background and holographic colors. Give `.tourism-page-content` a readable responsive width, provide a visible icon-based back button, preserve the bottom navigation, and add mobile rules for `390x844` without horizontal overflow.

- [ ] **Step 4: Run automated verification**

Run:

```powershell
npm --workspace apps/web run typecheck
npm --workspace apps/web run test
npm --workspace apps/web run build
```

Expected: all commands exit with code 0.

- [ ] **Step 5: Run Playwright navigation verification**

From `/`, click all five bottom navigation entries and all four stage tools. Verify each click changes `window.location.pathname`, the new page fills the viewport, browser Back returns to the previous route, refreshing `/map` restores the map page, and desktop plus `390x844` viewports have no horizontal overflow.

- [ ] **Step 6: Run the design detector**

Run:

```powershell
node "C:\Users\魏宇杰\.codex\skills\impeccable\scripts\detect.mjs" --json "apps/web/src/App.tsx" "apps/web/src/RootApp.tsx" "apps/web/src/components/TourismNav.tsx" "apps/web/src/components/TourismPage.tsx" "apps/web/src/styles.css"
```

Expected: no blocking findings.
