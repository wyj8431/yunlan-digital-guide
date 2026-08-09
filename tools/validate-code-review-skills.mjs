import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const requiredFiles = [
  'cursor-skills/code-review/SKILL.md',
  '.cursor/skills/code-review/SKILL.md',
  '.cursor/commands/review-changed-files.md',
  '.cursor/commands/review-component-standards.md',
  '.cursor/commands/review-performance-issues.md'
];
const commands = [
  '/review changed-files',
  '/review component-standards',
  '/review performance-issues'
];

const errors = [];
const contents = new Map();

for (const relativePath of requiredFiles) {
  try {
    contents.set(relativePath, await readFile(resolve(root, relativePath), 'utf8'));
  } catch {
    errors.push(`Missing required file: ${relativePath}`);
  }
}

const canonical = contents.get('cursor-skills/code-review/SKILL.md') ?? '';
for (const command of commands) {
  if (!canonical.includes(command)) {
    errors.push(`Canonical Skill is missing command: ${command}`);
  }
}

for (const field of ['## Findings', '## Open Questions', '## Checks', 'P0', 'P1', 'P2', 'P3']) {
  if (!canonical.includes(field)) {
    errors.push(`Canonical Skill is missing output contract marker: ${field}`);
  }
}

for (const relativePath of requiredFiles.slice(1)) {
  const content = contents.get(relativePath) ?? '';
  if (!content.includes('cursor-skills/code-review/SKILL.md')) {
    errors.push(`${relativePath} must reference cursor-skills/code-review/SKILL.md`);
  }
}

if (errors.length > 0) {
  console.error('Code-review Skill contract failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
console.log(`Cursor code-review Skill contract passed: ${requiredFiles.length} files, ${commands.length} commands.`);
}
