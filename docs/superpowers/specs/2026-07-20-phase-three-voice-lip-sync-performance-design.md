# Phase Three Voice Input, Lip Sync, and Rendering Performance Design

**Date:** 2026-07-20

## Goal

Deliver the third phase of the Yunlan Ancient Town digital guide in two independently testable increments:

- **Phase 3A:** Build a local Three.js lip-sync and performance lab that satisfies the rendering-performance and audio-driven mouth-animation work orders.
- **Phase 3B:** Add phone-style voice input to the existing visitor page and connect XFYUN ASR, DeepSeek, and the existing XFYUN online avatar without disrupting text chat.

The production visitor page remains XFYUN-avatar-first. The local `Thanh.glb` model is an engineering and acceptance target, not a replacement for the production avatar in this phase.

## Source Requirements

This design combines these work orders with the current project:

- `网站学院-Threejs 3D虚拟客服项目-3D数字人渲染性能优化任务工单`
- `网站学院-Threejs 3D虚拟客服项目-数字人口型与音频同步工单`
- The phase checklist covering React 19, Vite, TypeScript, Koa, ASR, LLM, TTS, WebSocket delivery, viseme handling, and commercial avatar SDK integration.

The current stack is React 19.1, Vite 7, TypeScript 5.8, Three.js 0.178, Koa 2.16, an OpenAI-compatible DeepSeek integration, and XFYUN Avatar Web SDK 3.2.3.1002. The project keeps Vite 7 because downgrading to Vite 6 would add risk without improving the requested behavior.

## Confirmed Product Decisions

1. Phase 3 is split into 3A and 3B rather than delivered as one large integration.
2. The visitor page continues to use the XFYUN online avatar as its primary digital human.
3. The local Three.js lip-sync implementation lives on an independent `/lab/lip-sync` route.
4. Phase 3A accepts preset audio, local audio files, and audio URLs.
5. Phase 3A uses audio-energy-driven mouth movement rather than client-side phoneme recognition.
6. Rendering acceptance is tiered: desktop targets at least 55 FPS and mobile targets at least 30 FPS.
7. Zustand is introduced only for the lab's controls and measurements. Existing chat and XFYUN state are not migrated.
8. Phase 3B implements XFYUN ASR, DeepSeek, and XFYUN TTS provider adapters. The production route uses XFYUN avatar speech, while the local-avatar route consumes the separate XFYUN TTS audio.
9. Viseme data is optional. When it is unavailable, the client falls back to audio-energy mouth movement.
10. Voice input behaves like mobile dictation: tap the microphone, speak, see interim text in the question field, and automatically submit after about 1.2 seconds of silence.

## Architecture

The frontend uses a layered dual-track architecture.

### Production Visitor Track

The existing visitor route remains product-facing:

```text
Microphone
  -> streaming XFYUN ASR
  -> interim transcript in the question field
  -> final transcript after endpoint detection
  -> existing guide question flow
  -> DeepSeek answer text
  -> XFYUN avatar writeText
  -> XFYUN-managed speech and lip sync
```

The visitor route does not play a second server-generated TTS stream. This prevents duplicate speech because the XFYUN avatar already synthesizes and plays its own audio after `writeText`.

### Local Engineering Track

The `/lab/lip-sync` route provides a controlled Three.js environment:

```text
Preset audio / local file / audio URL
  -> reusable Web Audio source
  -> analyser and signal smoothing
  -> normalized mouth-open signal
  -> Thanh.glb morph-target adapter
  -> real-time metrics and performance report
```

`Thanh.glb` is suitable for this path because it contains `mouthOpen`, `jawOpen`, and 15 named viseme morph targets. `CesiumMan.glb` and `xbot.glb` do not expose equivalent facial morph targets and are not Phase 3A acceptance models.

### Shared Boundaries

The implementation should use focused modules with stable interfaces:

- `audio-source`: loads preset, file, URL, or streamed audio and exposes playback state.
- `audio-analyser`: converts audio frames into normalized energy features.
- `mouth-signal-filter`: applies thresholding, attack, release, sensitivity, and maximum-open mapping.
- `three-mouth-adapter`: maps normalized mouth signals or viseme frames to Three.js morph targets.
- `render-quality-controller`: applies desktop/mobile quality tiers and automatic degradation.
- `performance-monitor`: records FPS, frame-time percentiles, draw calls, triangles, response latency, and memory when supported.
- `voice-session-client`: owns microphone permission, ASR session events, endpoint detection, cancellation, and duplicate-submit protection.

The lab consumes these modules directly. Phase 3B may reuse the analyser and mouth adapter for local-avatar fallback without sharing lab UI state.

## Phase 3A: Lip-Sync and Performance Lab

### User Interface

The lab is a compact engineering workspace with four areas:

- Top toolbar: back navigation, audio-source selector, play/pause, and reset.
- Parameter panel: sensitivity, noise threshold, maximum opening, attack, release, and render quality.
- Full-height Three.js stage: `Thanh.glb`, audio-energy timeline, and current mouth signal.
- Metrics panel: FPS, mouth-response latency, P95 frame time, draw calls, triangles, JavaScript heap when available, and active quality tier.

Controls use Zustand so changes are observable and reproducible during acceptance. Zustand does not own Three.js objects, audio nodes, or animation-frame handles; those remain in lifecycle-managed controllers and refs.

### Audio Analysis

The first implementation uses the browser's Web Audio API and `AnalyserNode`. It does not implement a custom FFT or speech-recognition algorithm.

Each animation frame:

1. Read time-domain or frequency-domain samples.
2. Calculate a normalized energy value.
3. Suppress values below the configured noise threshold.
4. Apply sensitivity and clamp to the configured maximum opening.
5. Apply separate attack and release smoothing to prevent chatter and snapping.
6. Send the normalized value to `three-mouth-adapter`.

When playback stops, the filter releases naturally to zero. A stopped or failed source must not leave the mouth open.

### Three.js Mouth Mapping

The default mapping drives `jawOpen` and `mouthOpen`. When a `viseme.batch` source is available, the adapter blends named viseme targets and uses the energy signal only as a fallback.

Morph transitions use weighted interpolation. A new target fades in while the prior target fades out; hard switching is not allowed. The mouth adapter must coexist with body animation and must not replace or reload the model when mouth state changes.

### Rendering Performance

The quality controller exposes low, medium, and high tiers. It may adjust:

- renderer pixel ratio;
- antialiasing and shadow quality;
- decorative stage effects;
- performance-monitor sampling frequency;
- animation update frequency for nonessential effects.

Automatic degradation occurs only after a sustained low-FPS window, not after a single slow frame. Recovery uses hysteresis so the page does not oscillate rapidly between tiers.

Production code should remove `preserveDrawingBuffer` unless a measured requirement needs it, avoid unnecessary shadow updates, cap device pixel ratio by tier, pause animation when the page is hidden, dispose of Three.js and audio resources, and avoid recreating the model or renderer during parameter changes.

## Phase 3B: Phone-Style Voice Input

### Interaction

The question field gains a microphone icon button.

1. First tap requests microphone permission and starts a streaming ASR session.
2. Interim recognition text appears in the existing question field.
3. About 1.2 seconds of detected silence finalizes the transcript.
4. A nonempty final transcript is submitted automatically through the existing guide question flow.
5. Tapping the microphone while recording cancels the current session and prevents submission.
6. The UI moves through idle, listening, recognizing, thinking, and avatar-speaking states without changing layout dimensions.

The browser does not create a voice-message bubble and the application does not persist the user's recording.

### Session Protocol

The voice session uses typed events. Binary audio chunks may travel as WebSocket binary frames while control and result messages use JSON.

Client-to-server events:

```text
session.start
input_audio.chunk*
session.cancel?
```

Server-to-client events:

```text
session.created
transcript.partial*
transcript.final
answer.delta*
answer.final
response.done
error
```

For the production XFYUN-avatar mode, `answer.final` is passed to the existing XFYUN `writeText` client. No server TTS audio is played.

For the local-avatar mode, the protocol additionally emits:

```text
audio.chunk*
viseme.batch?
```

The absence of `viseme.batch` is valid and activates client-side audio-energy fallback.

Every event carries a session ID and sequence number. The client accepts one final transcript and one final answer per session so reconnects or duplicated messages cannot submit the same question twice.

### Provider Boundaries

Koa owns provider adapters rather than embedding vendor calls in the WebSocket route:

- `SpeechRecognitionProvider` for XFYUN streaming ASR.
- Existing guide service for DeepSeek-backed answers.
- `SpeechSynthesisProvider` for XFYUN TTS in local-avatar mode.

Provider credentials remain server-side. The frontend receives only session-safe configuration and never receives ASR, TTS, or LLM secrets.

### Runtime Prerequisites

- The XFYUN account must have separate streaming ASR and TTS products enabled; avatar SDK credentials alone are not assumed to grant those APIs.
- Microphone capture requires a secure browser context (`https` or localhost) and explicit user permission.
- Raw microphone chunks are relayed to XFYUN for recognition but are not written to application storage, logs, or analytics.
- The existing XFYUN avatar limit of one concurrent online session remains in effect and must be reflected in manual test setup.

## Error Handling and Degradation

- Microphone permission denied: keep text input active and show a concise permission error.
- Unsupported or unavailable microphone API: keep text input active and disable only the microphone action.
- ASR failure: keep usable interim text, do not auto-submit uncertain text, and allow a new recording.
- Empty transcript: return to idle without sending a question.
- WebSocket interruption: terminate the current recording and reject late events from the abandoned session.
- DeepSeek failure: reuse the existing guide error state.
- XFYUN avatar failure: retain answer text and use the existing local-avatar or text-only fallback.
- TTS failure in local mode: retain answer text; if audio exists without visemes, use energy fallback; otherwise remain silent.
- Audio decode or cross-origin URL failure in the lab: stop playback, close the mouth, and explain which source failed.
- WebGL context loss: stop measurement and present a restart action rather than continuing with invalid FPS data.

Failures in `/lab/lip-sync` must not affect the production visitor route. Voice-input failure must not disable text chat.

## Acceptance Criteria

### Phase 3A Functionality

- Preset audio, local file, and audio URL sources load and play correctly.
- Audio analysis emits a continuous mouth signal during playback.
- `Thanh.glb` opens and closes its mouth with no obvious hard cuts or noise-driven chatter.
- Sensitivity, threshold, maximum opening, attack, and release settings update at runtime.
- Audio completion, cancellation, and source errors always return the mouth to closed.
- Lip-sync modules coexist with body animation.

### Phase 3A Performance

- Mouth response begins within 200 milliseconds of audio playback.
- Desktop Chrome and Edge average at least 55 FPS during a 60-second acceptance run.
- Mobile averages at least 30 FPS with quality degradation enabled.
- A 10-minute run has no crash, persistent visual flashing, or clear unbounded memory growth.
- The report records device, browser, viewport, quality tier, average FPS, P95 frame time, response latency, draw calls, triangle count, and memory support status.

### Phase 3B Voice Input

- Tapping the microphone starts recognition and presents a stable recording state.
- Interim transcript text appears in the question field.
- Approximately 1.2 seconds of silence finalizes and automatically submits a nonempty transcript.
- Cancelling during recording never submits a question.
- A session cannot submit the same final transcript twice.
- The production page has one audible response, produced by the XFYUN avatar.
- Text chat remains usable after microphone denial, ASR failure, socket interruption, or avatar failure.
- User audio is not persisted by the application.

## Testing Strategy

- Unit tests for energy normalization, thresholding, attack/release smoothing, clamping, and natural close.
- Unit tests for morph-target discovery, signal mapping, viseme blending, and missing-target fallback.
- Unit tests for quality-tier transitions and hysteresis.
- Zustand store tests for parameter updates and reset behavior.
- React tests for microphone states, interim text, cancellation, auto-submit, and permission errors.
- WebSocket protocol tests for event order, session IDs, sequence numbers, cancellation, and duplicate finals.
- Koa integration tests with mock ASR, DeepSeek, and optional TTS providers.
- Browser tests for desktop and mobile layout, audio-source switching, WebGL output, no overlap, and cleanup.
- Manual real-provider checklist for XFYUN ASR, DeepSeek, XFYUN avatar speech, and one-session concurrency.
- Repeatable performance runs that produce a checked-in report without embedding credentials or raw user audio.

## Deliverables

- React 19 and TypeScript source for `/lab/lip-sync`.
- Reusable audio source, analyser, smoothing, Three.js mouth adapter, quality controller, and performance monitor.
- Zustand configuration store scoped to the lab.
- Phone-style microphone control on the production question field.
- Koa WebSocket voice-session endpoint and typed event contracts.
- XFYUN ASR and TTS adapters plus the existing DeepSeek integration.
- Parameter defaults and quality-tier configuration.
- Unit, integration, React, browser, and protocol tests.
- Setup, configuration, real-provider integration, failure-recovery, and performance-report documentation.
- One concise work-order reference comment in each key module where traceability is required; no repeated narrative comments.

## Out of Scope

- Replacing the production XFYUN avatar with the local model.
- Client-side phoneme recognition from arbitrary audio.
- Guaranteed phoneme-level visemes when the TTS provider does not supply timing data.
- Persisting user recordings or building a voice-message history.
- Migrating existing application state to Zustand.
- Requiring 60 FPS on every mobile or VR device.
- Downgrading Vite 7 to Vite 6.

## Delivery Order

1. Establish Phase 3A measurement baselines and test fixtures.
2. Build audio source, analysis, smoothing, and mouth-adapter modules test-first.
3. Build the lab UI, Zustand controls, quality controller, and performance report.
4. Validate 3A acceptance independently.
5. Define and test Phase 3B session contracts with mock providers.
6. Add the phone-style microphone interaction and streaming ASR adapter.
7. Connect final transcripts to the existing DeepSeek guide flow and XFYUN avatar speech.
8. Verify degradation paths, real-provider behavior, and final performance regression.
