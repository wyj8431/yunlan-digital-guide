# Digital Human Visual Refresh Design

## Goal

Improve the right-side digital human from a placeholder SVG/image avatar into a real 3D guide stage for Yunlan Ancient Town. This phase should make the demo visibly read as a 3D digital-human product while leaving room to replace the temporary model with a custom character later.

## Direction

The visual direction is a full-stage Three.js scene: a local humanoid GLB model, transparent WebGL canvas over the scenic stage background, grounded platform, rotating halo, scan light, and restrained identity/status labels. The model is intentionally real 3D first; finer facial identity, VRM rigging, lip sync, and custom clothing can come in a later phase.

## Scope

- Keep `DigitalHumanStage` as the single owner for the right-side digital human presentation.
- Load `/models/Thanh.glb` with Three.js `GLTFLoader`.
- Fit the model into the stage with bounding-box normalization.
- Play the first GLB animation when available.
- Use the existing `speaking: boolean` prop for narration-state motion and copy.
- Keep loading, ready, and error states visible in DOM text.
- Use responsive CSS so the canvas remains the primary visual on desktop and mobile.

## Out Of Scope

- Custom GLB/VRM character production.
- Precise facial lip-sync or viseme timing.
- Backend TTS.
- ASR or streaming chat.
- Map and route visualization.

## Acceptance Criteria

- The stage exposes the label `云岚古镇年轻数字导游舞台`.
- The stage loads the local model asset `apps/web/public/models/Thanh.glb`.
- Ready state shows `3D 数字人模型`.
- Idle state shows `年轻导游` and `云岚古镇数字导游`.
- Speaking state shows `正在讲解云岚古镇`.
- The component renders a WebGL canvas and does not render SVG for the main character.
- The web package test and build commands pass.
