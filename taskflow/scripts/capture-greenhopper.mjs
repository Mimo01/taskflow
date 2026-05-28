#!/usr/bin/env node
// capture-greenhopper.mjs — One-shot redacting capture for GreenHopper endpoints.
//
// Usage:
//   JIRA_BASE_URL=https://jira.example.com \
//   JIRA_PAT=<pat> \
//   BOARD_ID=123 \
//   ISSUE_KEY=PROJ-1 \
//   PROJECT_ID=10000 \
//     node taskflow/scripts/capture-greenhopper.mjs
//
// Outputs four redacted fixtures under
//   taskflow/src/services/jira/greenhopper/__fixtures__/
//     allData.real.json
//     data.real.json
//     details.real.json
//     transitions.real.json
//
// Why not the in-app fetch wrapper (src/lib/api-fetch.ts):
//   The in-app HTTP wrapper runs inside the Tauri renderer, touches
//   useAuthStore, and calls markDisconnected on 401. This capture is a one-shot
//   Node CLI with no renderer/auth-store context — using the in-app wrapper
//   would mutate auth state on the dev machine on auth failure
//   (RESEARCH.md Pitfall 8). Use Node 18+ global fetch directly.
//
// Redaction rules per RESEARCH.md §Capture Script (D-10 locked):
//   issue.key                → PROJ-{n}   (stable across all four files)
//   issue.summary            → "Sample summary {n}"
//   issue.assignee           → "user{n}"
//   issue.assigneeName       → "User {n}"
//   issue.avatarUrl          → "https://example.invalid/avatar/{n}.png"
//   entityData.epics[*].epicField.text     → "Epic {n}"
//   entityData.epics[*].epicField.epicKey  → mirror keyMap PROJ-{n}
//   projectName              → "Sample Project"
//   projectAvatarUrl         → "https://example.invalid/project.png"
//   details operations[*].url query strings stripped (url.split('?')[0])
//   details Section.html and inlineEditableFields[*].editHtml
//     → '<!-- redacted by capture script -->' (whole-field replacement; never regex over HTML, Pitfall 7)
//
// Security: This script MUST NEVER log process.env.JIRA_PAT (T-71-01).
// Errors report status code only, never response body.

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TASKFLOW_ROOT = resolve(__dirname, '..');
const FIX_DIR = resolve(TASKFLOW_ROOT, 'src/services/jira/greenhopper/__fixtures__');

// ---- env validation -------------------------------------------------------
const REQUIRED_ENV = ['JIRA_BASE_URL', 'JIRA_PAT', 'BOARD_ID', 'ISSUE_KEY', 'PROJECT_ID'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  // NEVER echo the PAT value — only the variable names.
  console.error(`Missing required env: ${missing.join(', ')}`);
  console.error('Usage: JIRA_BASE_URL=... JIRA_PAT=... BOARD_ID=... ISSUE_KEY=... PROJECT_ID=... node taskflow/scripts/capture-greenhopper.mjs');
  process.exit(1);
}

const BASE = process.env.JIRA_BASE_URL.replace(/\/$/, '');
const BOARD_ID = process.env.BOARD_ID;
const ISSUE_KEY = process.env.ISSUE_KEY;
const PROJECT_ID = process.env.PROJECT_ID;

// ---- HTTP helper ----------------------------------------------------------
/**
 * GET helper. Throws with status code only on non-OK (never body — body may
 * carry sensitive data on 4xx/5xx).
 */
async function get(path) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${process.env.JIRA_PAT}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`${path} → ${res.status}`);
  }
  return res.json();
}

// ---- redaction state ------------------------------------------------------
/** Stable issue-key remap shared across all four captured payloads. */
const keyMap = new Map();
function redactIssueKey(realKey) {
  if (realKey == null) return realKey;
  if (!keyMap.has(realKey)) {
    keyMap.set(realKey, `PROJ-${keyMap.size + 1}`);
  }
  return keyMap.get(realKey);
}

function redactSummary(idx) {
  return `Sample summary ${idx}`;
}
function redactAssignee(idx) {
  return `user${idx}`;
}
function redactAssigneeName(idx) {
  return `User ${idx}`;
}
function redactAvatarUrl(idx) {
  return `https://example.invalid/avatar/${idx}.png`;
}

const REDACTED_HTML = '<!-- redacted by capture script -->';

// ---- per-payload redactors -----------------------------------------------
function redactIssueLike(issue, idx) {
  if (!issue || typeof issue !== 'object') return;
  if (typeof issue.key === 'string') issue.key = redactIssueKey(issue.key);
  if (typeof issue.summary === 'string') issue.summary = redactSummary(idx);
  if (typeof issue.assignee === 'string') issue.assignee = redactAssignee(idx);
  if (typeof issue.assigneeName === 'string') issue.assigneeName = redactAssigneeName(idx);
  if (typeof issue.avatarUrl === 'string') issue.avatarUrl = redactAvatarUrl(idx);
  // parentKey on sub-tasks references another issue — remap via keyMap so it
  // stays consistent with whichever PROJ-n the parent received.
  if (typeof issue.parentKey === 'string') issue.parentKey = redactIssueKey(issue.parentKey);
  // GH `epic` (string) is the epic issue key; mirror remap.
  if (typeof issue.epic === 'string') issue.epic = redactIssueKey(issue.epic);
}

function redactAllData(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  // Project header (some GH builds put these at root; defensive).
  if (typeof obj.projectName === 'string') obj.projectName = 'Sample Project';
  if (typeof obj.projectAvatarUrl === 'string') {
    obj.projectAvatarUrl = 'https://example.invalid/project.png';
  }

  // entityData.epics[*].epicField — must remap epicKey via keyMap and text → "Epic {n}".
  const epics = obj?.entityData?.epics;
  if (epics && typeof epics === 'object') {
    let epicIdx = 1;
    for (const id of Object.keys(epics)) {
      const e = epics[id];
      if (e && typeof e === 'object' && e.epicField && typeof e.epicField === 'object') {
        if (typeof e.epicField.text === 'string') {
          e.epicField.text = `Epic ${epicIdx}`;
        }
        if (typeof e.epicField.epicKey === 'string') {
          e.epicField.epicKey = redactIssueKey(e.epicField.epicKey);
        }
      }
      epicIdx += 1;
    }
  }

  // issuesData.issues[*]
  const issues = obj?.issuesData?.issues;
  if (Array.isArray(issues)) {
    issues.forEach((iss, i) => redactIssueLike(iss, i + 1));
  }

  return obj;
}

function redactBacklogData(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (typeof obj.projectName === 'string') obj.projectName = 'Sample Project';
  if (typeof obj.projectAvatarUrl === 'string') {
    obj.projectAvatarUrl = 'https://example.invalid/project.png';
  }
  if (Array.isArray(obj.issues)) {
    obj.issues.forEach((iss, i) => redactIssueLike(iss, i + 1));
  }
  // Some backlog payloads carry epics too.
  const epics = obj?.entityData?.epics;
  if (epics && typeof epics === 'object') {
    let epicIdx = 1;
    for (const id of Object.keys(epics)) {
      const e = epics[id];
      if (e && typeof e === 'object' && e.epicField && typeof e.epicField === 'object') {
        if (typeof e.epicField.text === 'string') e.epicField.text = `Epic ${epicIdx}`;
        if (typeof e.epicField.epicKey === 'string') {
          e.epicField.epicKey = redactIssueKey(e.epicField.epicKey);
        }
      }
      epicIdx += 1;
    }
  }
  return obj;
}

function redactDetails(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  // Top-level key + summary + project header
  if (typeof obj.key === 'string') obj.key = redactIssueKey(obj.key);
  if (typeof obj.summary === 'string') obj.summary = redactSummary(1);
  if (typeof obj.projectName === 'string') obj.projectName = 'Sample Project';
  if (typeof obj.projectAvatarUrl === 'string') {
    obj.projectAvatarUrl = 'https://example.invalid/project.png';
  }

  // operations.sections[*].operations[*].url — strip query strings
  const sections = obj?.operations?.sections;
  if (Array.isArray(sections)) {
    for (const section of sections) {
      const ops = section?.operations;
      if (Array.isArray(ops)) {
        for (const op of ops) {
          if (op && typeof op.url === 'string') {
            op.url = op.url.split('?')[0];
          }
        }
      }
    }
  }

  // Walk every nested value and replace `html` / `editHtml` fields wholesale.
  // Whole-field replacement (Pitfall 7) — never regex over HTML.
  const walk = (node) => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (node && typeof node === 'object') {
      for (const k of Object.keys(node)) {
        const v = node[k];
        if ((k === 'html' || k === 'editHtml') && typeof v === 'string') {
          node[k] = REDACTED_HTML;
          continue;
        }
        walk(v);
      }
    }
  };
  walk(obj);

  return obj;
}

function redactTransitions(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  // transitions.json is mostly numeric ids + transition names + workflow names;
  // RESEARCH redaction table does not require name redaction (workflow/transition
  // names are configuration metadata, not PII). Keep as-is, but defensively
  // remap any embedded issue keys if present (some GH builds include them).
  const walk = (node) => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (node && typeof node === 'object') {
      for (const k of Object.keys(node)) {
        const v = node[k];
        if (k === 'issueKey' && typeof v === 'string') {
          node[k] = redactIssueKey(v);
          continue;
        }
        if (k === 'key' && typeof v === 'string' && /^[A-Z][A-Z0-9_]+-\d+$/.test(v)) {
          node[k] = redactIssueKey(v);
          continue;
        }
        walk(v);
      }
    }
  };
  walk(obj);
  return obj;
}

// ---- main -----------------------------------------------------------------
async function main() {
  // Endpoints per RESEARCH §Capture Script
  const allDataPath =
    `/rest/greenhopper/1.0/xboard/work/allData.json?rapidViewId=${encodeURIComponent(BOARD_ID)}`;
  const dataPath =
    `/rest/greenhopper/1.0/xboard/plan/backlog/data.json?rapidViewId=${encodeURIComponent(BOARD_ID)}`;
  const detailsPath =
    `/rest/greenhopper/1.0/xboard/issue/details.json?rapidViewId=${encodeURIComponent(BOARD_ID)}&issueIdOrKey=${encodeURIComponent(ISSUE_KEY)}&loadSubtasks=true`;
  const transitionsPath =
    `/rest/greenhopper/1.0/xboard/work/transitions.json?projectId=${encodeURIComponent(PROJECT_ID)}`;

  // Fetch allData first so the shared keyMap is seeded with the canonical
  // board issues before backlog/details/transitions reuse those mappings.
  const allData = redactAllData(await get(allDataPath));
  const data = redactBacklogData(await get(dataPath));
  const details = redactDetails(await get(detailsPath));
  const transitions = redactTransitions(await get(transitionsPath));

  const writes = [
    ['allData.real.json', allData],
    ['data.real.json', data],
    ['details.real.json', details],
    ['transitions.real.json', transitions],
  ];

  for (const [name, payload] of writes) {
    const outPath = resolve(FIX_DIR, name);
    writeFileSync(outPath, JSON.stringify(payload, null, 2));
    // Path only — never echo payload or PAT.
    const rel = outPath.startsWith(TASKFLOW_ROOT) ? outPath.slice(TASKFLOW_ROOT.length + 1) : outPath;
    console.log(`wrote ${rel}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
