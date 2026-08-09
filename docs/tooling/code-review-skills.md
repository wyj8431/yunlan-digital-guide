# Code Review Skills

The canonical review contract is `cursor-skills/code-review/SKILL.md`. Cursor loads the compatibility entrypoint at `.cursor/skills/code-review/SKILL.md`.

## Commands

- `/review changed-files` reviews staged and unstaged diffs.
- `/review component-standards` reviews a component and its direct dependency chain.
- `/review performance-issues` reviews rendering, audio, WebSocket, and Three.js hot paths.

The skill may run these checks when relevant:

```powershell
npm run typecheck
npm run lint
npm --workspace apps/web run test -- <focused-test-file>
npm --workspace apps/web run test -- phase3a.browser.test.js
```

The skill does not expose provider credentials, signed URLs, microphone recordings, or raw vendor payloads in its report. Findings use the shared Markdown contract so they can be copied into a pull request or task record.

## Local Contract Check

Run this repository-only check before opening Cursor:

```powershell
npm run review:skills
```

This verifies the canonical Skill, compatibility entrypoints, three command names, and the shared
review output markers. It does not replace executing the commands in the Cursor desktop app.
