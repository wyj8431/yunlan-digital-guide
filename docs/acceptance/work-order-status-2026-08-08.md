# Work-Order Status

## Completed In Repository

- Local Three.js lip-sync lab with preset, file, and URL sources.
- RMS analysis, thresholding, sensitivity, max-open, attack/release smoothing, morph mapping, and
  quality tiers.
- Production local-TTS analyser bridge with cleanup and timeline fallback.
- Cursor review Skill files, commands, shared output contract, and project-specific rules.
- Typecheck, lint, production build, focused tests, and browser canvas/layout smoke checks.

## Current Environment Gates

- Real XFYUN credentials are configured in the local `.env` and are never recorded in this repository.
- Real TTS smoke test passed: `POST /api/speech/synthesize` returned `200 audio/mpeg` with non-empty audio.
- Real ASR smoke test passed with a repository WAV sample and returned non-empty text.
- Phase 3A browser lip-sync acceptance passed with the configured local services.
- OpenSpec validation is available through the pinned `npm run openspec:validate` script using
  `@fission-ai/openspec@1.8.0`; the change now passes `doctor` and `validate`.
- The repository-only Cursor Skill contract check is available through `npm run review:skills`.

## External Acceptance Remaining

- Cursor recognizing and executing the three review commands in its actual desktop build.

The previously captured `/review component-standards` screenshot was produced before the latest
remediation pass. Its seven findings were addressed in `App.tsx`, `DigitalHumanStage.tsx`,
`useSpeechSynthesis.ts`, and `ExhibitionPage.tsx`; typecheck, lint, and the affected 34-test suite
now pass. Re-run all three Cursor commands against the current working tree before closing this gate.

## Product References

- Figma workspace: https://www.figma.com/files/team/1656316849219657021/folder/622739109?fuid=1656316846032677675
- NotebookLM notebook: https://notebook.google.com/notebook/ea284cd3-84eb-435a-b6e6-561cec05e6d0

The repeatable Phase 3A benchmark completed successfully with three 60-second desktop sessions, three
60-second mobile sessions, and one 10-minute stability session. The run emitted non-blocking scenic API
proxy warnings because the API server was intentionally not started for the local lab benchmark; detailed
metric JSON was not retained by the terminal capture.

The full frontend suite now passes after aligning the home-entry, responsive CSS, and exhibition collision
tests with the current implementation. No in-repository test failures remain for these work orders.
