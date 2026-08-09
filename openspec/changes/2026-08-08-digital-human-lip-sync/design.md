## Context

Local server TTS is decoded and played in segments by the browser. The stage already has signal smoothing and a deterministic timeline fallback, but it needs the actual playback energy without coupling Three.js objects to application state.

## Goals / Non-Goals

**Goals:**

- Route each active local playback source through an `AnalyserNode`.
- Keep analyser ownership scoped to the speech session and clean it on stop, cancel, error, completion, hidden-tab pause, and unmount.
- Preserve a vendor-avatar-only audible path when the online driver is active.

**Non-Goals:**

- Phoneme or viseme inference from ASR/TTS text.
- Changes to vendor signing, provider credentials, or online avatar SDK behavior.
- Treating headless browser FPS as a GPU release benchmark.

## Decisions

- Use the existing Web Audio `AnalyserNode` and RMS filter instead of a custom FFT implementation.
- Attach the analyser to the `AudioBufferSourceNode` immediately before `start()` and expose only normalized energy and lifecycle callbacks to React.
- Prefer measured energy in `DigitalHumanStage`; fall back to the existing speech timeline when analysis is unavailable.
- Keep audio nodes and Three.js objects outside persistent UI stores and clear all stale session callbacks.

## Risks / Trade-offs

- Browser autoplay and Web Audio availability can prevent analysis; the timeline fallback keeps the guide usable.
- A single analyser per active segment adds small CPU overhead, traded for timing accuracy and deterministic cleanup.
- Real XFYUN and device GPU acceptance remain environment-gated and are tracked separately.
