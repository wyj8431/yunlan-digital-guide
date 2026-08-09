## Purpose

Drive the local Three.js digital human from the audio that is actually being played by local server TTS while preserving a single audio owner for online avatar sessions.

## ADDED Requirements

### Requirement: Measured audio drives local mouth motion

The local digital-human stage SHALL route locally played TTS audio through a playback-scoped `AnalyserNode` when Web Audio is available, and SHALL prefer smoothed RMS energy over an estimated speech timeline for mouth motion.

#### Scenario: Local TTS audio is available

- **WHEN** a local TTS segment starts playing and Web Audio is supported
- **THEN** the stage receives measured audio energy and opens the mouth from that signal within the normal response-latency budget

#### Scenario: Web Audio is unavailable

- **WHEN** a local TTS segment plays without an available analyser
- **THEN** the stage uses its timeline fallback and remains usable

### Requirement: Interrupted playback closes and releases the mouth signal

The local playback owner SHALL disconnect analyser resources and return the mouth to its closed state on stop, cancel, error, hidden-tab pause, chunk switch, completion, or unmount.

#### Scenario: Playback is cancelled during a segment

- **WHEN** the active speech session is cancelled
- **THEN** stale audio callbacks are ignored, analyser resources are disconnected, and the mouth returns to closed

#### Scenario: The guide route unmounts

- **WHEN** the stage or speech hook unmounts while audio is active
- **THEN** pending sources and analyser resources are cleaned up without affecting a later session

### Requirement: Online avatar owns audible speech

The online XFYUN/MOFA avatar driver SHALL remain the sole audible response owner when enabled; local browser or server playback SHALL not be started for the same answer.

#### Scenario: Online avatar speech is enabled

- **WHEN** an answer is sent to the online avatar driver
- **THEN** the avatar may speak and no duplicate browser or server TTS response is played
