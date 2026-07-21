# Digital Human Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder-looking SVG/image avatar with a real Three.js 3D digital-human stage.

**Architecture:** Keep the digital-human presentation inside `apps/web/src/components/DigitalHumanStage.tsx`. Load a public humanoid GLB from `apps/web/public/models/Thanh.glb` with `GLTFLoader`, render it in a full-stage WebGL canvas, and keep the existing `speaking: boolean` contract.

**Tech Stack:** React 19, TypeScript, Three.js, GLTFLoader, local GLB asset, CSS responsive stage styling, Vitest, React Testing Library.

---

### Task 1: Lock The 3D Stage Contract With A Test

**Files:**

- Create/modify: `apps/web/tests/DigitalHumanStage.test.tsx`

- [x] **Step 1: Write a component test**

Assert the stage has the accessible label `云岚古镇年轻数字导游舞台`, shows the ready status `3D 数字人模型` after model loading, keeps idle identity `年轻导游`, keeps idle caption `云岚古镇数字导游`, keeps speaking caption `正在讲解云岚古镇`, renders a canvas, and does not render SVG.

- [x] **Step 2: Run the test and verify the contract**

Run:

```powershell
npm --workspace apps/web run test -- DigitalHumanStage.test.tsx
```

Expected: PASS after the GLB loader mock resolves.

### Task 2: Rebuild The Guide As A Real 3D Model

**Files:**

- Modify: `apps/web/src/components/DigitalHumanStage.tsx`
- Add: `apps/web/public/models/Thanh.glb`

- [x] **Step 1: Load a humanoid GLB model**

Use Three.js `GLTFLoader` to load `/models/Thanh.glb`, fit it into the stage with `Box3`, enable shadows, and play the first bundled animation when available.

- [x] **Step 2: Preserve narration feedback**

Use `speaking` to add subtle model motion and switch visible status/caption text between idle and narration states.

- [x] **Step 3: Handle model states**

Render loading, ready, and error text: `正在加载3D数字人`, `3D 数字人模型`, and `模型加载失败`.

### Task 3: Polish The Full-Stage 3D Presentation

**Files:**

- Modify: `apps/web/src/styles.css`

- [x] **Step 1: Remove stale avatar layout rules**

Delete old image-avatar mobile rules and make `.model-stage`, `.model-host`, and `.model-status` responsive.

- [x] **Step 2: Make the canvas the primary visual**

Use a full-stage WebGL canvas with environmental background, stage ring, scan light, identity badge, and status badge without framing the 3D model as an image card.

- [x] **Step 3: Run web tests and build**

Run:

```powershell
npm --workspace apps/web run test
npm --workspace apps/web run build
```

Expected: all tests pass and build exits with code 0.
