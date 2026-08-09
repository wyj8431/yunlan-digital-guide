---
id: digital-human-lip-sync
title: Audio-driven local digital-human lip sync
status: implementation-complete-pending-provider-acceptance
---

# Goal

Drive the local Three.js digital human from the audio that is actually being played by the local
server-TTS fallback. Keep the online XFYUN/MOFA avatar as the only audio owner when enabled.

# Requirements

1. Preset, file, and URL audio sources remain available in `/lab/lip-sync`.
2. Local server-TTS playback routes through `AnalyserNode` when the browser supports Web Audio.
3. `DigitalHumanStage` uses smoothed RMS energy before its estimated timeline fallback.
4. Stop, cancel, error, hidden-tab pause, chunk switch, and unmount return the mouth to closed and
   disconnect audio resources.
5. Online avatar speech does not trigger a second browser or server playback.
6. Response latency is measured from the first audio-energy threshold crossing to the first mouth
   opening above `0.01`.

# Acceptance

- Focused unit tests pass for analysis routing, signal smoothing, stage lifecycle, and speech playback.
- `/lab/lip-sync?phase3a-debug=1` has a nonblank canvas, no mobile horizontal overflow, and response
  latency below 200ms in a browser run.
- A real local-TTS run is recorded separately using `docs/integration/phase-3a-local-tts-lip-sync.md`.
- GPU performance is measured on the target desktop and mobile devices; headless browser FPS is not
  treated as a release benchmark.
