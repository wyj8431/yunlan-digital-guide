# Living Wuzhen Travel OS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the seven dedicated tourism routes as distinct solar-punk travel experiences with richer, task-oriented content while preserving all existing application integrations.

**Architecture:** Keep routing and shared state in `RootApp` and `App`. Split dedicated-page rendering into a scene shell plus focused page sections in `TourismPage.tsx`; keep the data source as `ScenicAreaSummary`, `RouteCard`, latest AI answer, and live voice state. Use one namespaced CSS system with route-specific compositions and local image assets.

**Tech Stack:** React 19, TypeScript, Lucide React, native CSS, Vitest, Testing Library, Playwright, Vite.

---

### Task 1: Lock content and interaction contracts

**Files:**

- Modify: `apps/web/tests/TourismPage.test.tsx`
- Modify: `apps/web/tests/layoutCss.test.js`

- [ ] Add failing tests for the new home departure modes, guide decision prompts, narration chapters, map node semantics, itinerary timeline, in-page voice toggle, and profile travel record.
- [ ] Run focused tests and confirm they fail because the new structures and copy do not exist.

### Task 2: Build the seven route scenes

**Files:**

- Modify: `apps/web/src/components/TourismPage.tsx`
- Modify: `apps/web/src/components/TourismNav.tsx`

- [ ] Add a shared page shell and route-specific semantic sections.
- [ ] Preserve map and guide `onAsk` behavior and narration handoff to Explore.
- [ ] Change Voice so its toggle remains on `/voice`, exposing transcript and error feedback before the user leaves.
- [ ] Render fallback content from scenic-area data when AI route cards or latest answer are absent.
- [ ] Run component tests and confirm they pass.

### Task 3: Replace the visual system

**Files:**

- Modify: `apps/web/src/styles.css`

- [ ] Replace the current dedicated-page CSS block with local-image backgrounds and shared color/material tokens.
- [ ] Implement the sunrise observatory, question constellation, story waveform, canal map, flowing itinerary, voice ripple field, and travel passport compositions.
- [ ] Add responsive compositions at 1100px, 760px, and 480px.
- [ ] Add focus states, reduced-motion rules, stable dimensions, and fixed-navigation clearance.
- [ ] Run the CSS contract test and typecheck.

### Task 4: Verify behavior and visual quality

**Files:**

- Modify only when verification exposes a defect.

- [ ] Run `npm --workspace apps/web run test`.
- [ ] Run `npm --workspace apps/web run build`.
- [ ] Start or reuse the web and server processes.
- [ ] Capture every route at desktop and representative routes at `390x844`.
- [ ] Check horizontal overflow, route navigation, Back behavior, map/guide actions, and voice toggle behavior.
- [ ] Run the Impeccable detector once over changed UI targets and fix all material findings.
