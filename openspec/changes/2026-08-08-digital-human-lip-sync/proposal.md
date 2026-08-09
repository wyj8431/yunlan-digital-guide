## Why

The local Three.js fallback currently needs a reliable mouth signal that reflects the audio users actually hear. A speech timeline alone can drift from decoded TTS chunks, while online avatar sessions must remain protected from duplicate browser playback.

## What Changes

- Add a playback-scoped Web Audio analyser bridge for local TTS.
- Drive the local stage from measured smoothed RMS energy with a timeline fallback.
- Close the mouth and release resources on every interruption and lifecycle boundary.
- Document and test the single-audio-owner rule for online avatar drivers.

## Capabilities

### New Capabilities

- `digital-human-lip-sync`: Audio-driven local mouth motion, cleanup, and audio ownership.

### Modified Capabilities

- None.

## Impact

The web speech hook, local digital-human stage, speech-sync protocol, focused tests, and acceptance documentation are affected. No provider credentials or new runtime dependency are required.
