---
name: code-review
description: Review changed frontend and full-stack files in the Yunlan digital guide with project-aware correctness, security, performance, and lifecycle checks.
---

# Yunlan Code Review

Use this skill for a read-only review unless the user explicitly asks for fixes. Inspect the current diff first, then read the relevant callers, types, tests, and configuration before reporting a finding.

## Commands

- `/review changed-files`: review `git diff` and `git diff --staged`; prioritize regressions introduced by the current change.
- `/review component-standards`: review a component, hook, or module and its direct dependency chain for React, TypeScript, accessibility, and lifecycle issues.
- `/review performance-issues`: review rendering, audio, WebSocket, Three.js, and data-flow hotspots for avoidable work, leaks, duplicate work, and unstable state.

## Review Sequence

1. Establish scope from the working tree, commit, or requested files. Do not report unrelated pre-existing changes as findings.
2. Trace changed exports to their callers. Check state transitions, async cancellation, error paths, and cleanup on unmount or retry.
3. Run the smallest relevant checks when practical: `npm run typecheck`, targeted Vitest files, and the relevant browser acceptance test.
4. Check that credentials, signed URLs, raw microphone audio, and provider payloads stay server-side.
5. Report only actionable findings. Order them by severity: P0, P1, P2, P3.
6. On Windows PowerShell, run one native command per terminal call. Do not combine `cd`, `git`, and
   `npm` with Bash-style `&&` chains.

## Project Rules

- React effects must clean timers, animation frames, event listeners, WebSocket sessions, audio nodes, and Three.js resources.
- The online avatar owns its own speech. Do not add browser or server playback when `SpeechDriver` is `xfyun` or `mofa`.
- Local Three.js mouth movement may use audio energy or a typed viseme timeline, but it must reset closed on stop, cancel, error, hidden-tab pause, and unmount.
- Do not reload a GLB, renderer, or scene when a runtime control changes. Cap pixel ratio and pause hidden-tab rendering.
- WebSocket sessions must reject late events, deduplicate final answers, and expose recoverable text-input fallback.
- TypeScript changes must preserve discriminated unions and avoid `any` at provider boundaries.
- New behavior needs a focused unit or browser test for the changed state transition.
- Do not suggest downgrading Vite 7 to Vite 6 without a demonstrated compatibility problem.

## Output Contract

Return Markdown findings using this exact shape:

```markdown
## Findings

- [P1][category] `path/to/file.ts:42` - Concrete problem and user-visible impact.
  - Evidence: the relevant branch, call chain, or missing test.
  - Minimal fix: the smallest safe change.

## Open Questions

- State only questions that block confidence in the review.

## Checks

- `command`: passed, failed, or not run, with the reason.
```

If there are no findings, say so explicitly and list residual test gaps under `Checks`.
