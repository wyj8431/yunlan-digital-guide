# OpenSpec Project Convention

This directory is the versioned source of truth for work-order requirements and acceptance tasks.
It follows the `spec-driven` schema used by `@fission-ai/openspec` and remains readable as plain Markdown.

Each change contains:

- `spec.md`: user-visible behavior, boundaries, and acceptance criteria.
- `tasks.md`: ordered implementation and verification tasks.

Before implementation, update `tasks.md` and mark only verified tasks as complete. A task is not
complete when it has only been designed or unit-tested; provider credentials and browser checks are
tracked separately as external prerequisites.

## Local Checks

```powershell
npm run typecheck
npm run lint
npm run build
npm test
npx --yes @fission-ai/openspec@1.8.0 validate --all --no-interactive
```

Do not store API keys, signed URLs, microphone recordings, or raw provider payloads in this directory.
