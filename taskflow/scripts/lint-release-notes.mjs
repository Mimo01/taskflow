#!/usr/bin/env node
// lint-release-notes.mjs — lint release notes read from stdin.
// Usage: printf '<notes>' | node scripts/lint-release-notes.mjs [--warn-only] [--allow-wordy-notes]
//   --warn-only          always exit 0 (errors are printed as warnings)
//   --allow-wordy-notes  errors are downgraded to warnings
// Exit 1 when there are errors. Format rules: docs/RELEASE-NOTES.md

import { readFileSync } from 'node:fs';
import { lintReleaseNotes } from '../src/lib/release-notes/lint.ts';

const flags = new Set(process.argv.slice(2));
const downgrade = flags.has('--warn-only') || flags.has('--allow-wordy-notes');

const notes = readFileSync(0, 'utf8').trim();
const { errors, warnings } = lintReleaseNotes(notes);

for (const w of warnings) console.error(`warning: ${w}`);

if (errors.length > 0) {
  for (const e of errors) console.error(`${downgrade ? 'warning' : 'error'}: ${e}`);
  if (!downgrade) {
    console.error('Release notes do not follow the format. See taskflow/docs/RELEASE-NOTES.md (override: --allow-wordy-notes).');
    process.exit(1);
  }
}
