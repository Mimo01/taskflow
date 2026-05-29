#!/usr/bin/env node
/**
 * check-legacy-backlog-keys.mjs — Phase 74 D-09 static guard.
 *
 * Walks `taskflow/src/**\/*.{ts,tsx}` and fails (exit 1) if any of the
 * following four banned tokens appear OUTSIDE test files, __tests__/
 * directories, and the scripts/ directory itself:
 *
 *   - 'jira-backlog-issues'         (legacy React Query cache key)
 *   - 'jira-backlog-sprint-stories' (legacy React Query cache key)
 *   - fetchBacklogIssues            (legacy REST fetcher)
 *   - fetchBacklogSprintStories     (legacy REST fetcher)
 *
 * Phase 74 D-09a EXPLICITLY KEEPS the legacy sprint-list fetcher
 * (issue-detail FieldsSection.tsx still uses it); that symbol is NOT in
 * the banned list above.
 *
 * Plan 01 ships this script as informational only — legacy code still
 * lives in BacklogPage.tsx / Sidebar.tsx / backlog.ts / jira.ts during
 * Wave 0, so a run will report several hits today. Plan 06 wires it into
 * package.json + CI / pre-commit after the deletions land.
 *
 * Usage:
 *   node taskflow/scripts/check-legacy-backlog-keys.mjs
 *   echo $?    # 0 == clean; 1 == one or more banned tokens found
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TASKFLOW_ROOT = path.resolve(HERE, '..');
const SRC_ROOT = path.join(TASKFLOW_ROOT, 'src');

const BANNED_TOKENS = [
  'jira-backlog-issues',
  'jira-backlog-sprint-stories',
  'fetchBacklogIssues',
  'fetchBacklogSprintStories',
];

const SOURCE_EXTS = new Set(['.ts', '.tsx']);

/** True if the path is under __tests__/, a *.test.* file, or scripts/. */
function isExcluded(absPath) {
  const norm = absPath.replace(/\\/g, '/');
  if (norm.includes('/__tests__/')) return true;
  if (norm.includes('/scripts/')) return true;
  const base = path.basename(absPath);
  if (base.includes('.test.')) return true;
  return false;
}

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

async function main() {
  // Guard against accidental invocation outside the taskflow repo.
  try {
    const s = await stat(SRC_ROOT);
    if (!s.isDirectory()) throw new Error('src is not a directory');
  } catch (err) {
    console.error(`check-legacy-backlog-keys: cannot read ${SRC_ROOT}: ${err.message}`);
    process.exit(2);
  }

  const hits = [];

  for await (const file of walk(SRC_ROOT)) {
    if (!SOURCE_EXTS.has(path.extname(file))) continue;
    if (isExcluded(file)) continue;

    const text = await readFile(file, 'utf8');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const token of BANNED_TOKENS) {
        if (line.includes(token)) {
          const rel = path.relative(TASKFLOW_ROOT, file);
          hits.push({ file: rel, line: i + 1, token });
        }
      }
    }
  }

  if (hits.length > 0) {
    for (const h of hits) {
      console.error(`${h.file}:${h.line} — ${h.token}`);
    }
    console.error(`\n${hits.length} legacy backlog token hit(s) found.`);
    process.exit(1);
  }

  console.log('OK');
  process.exit(0);
}

main().catch((err) => {
  console.error(`check-legacy-backlog-keys: ${err.stack ?? err.message}`);
  process.exit(2);
});
