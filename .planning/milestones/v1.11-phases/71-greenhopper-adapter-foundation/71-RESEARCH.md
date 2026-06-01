# Phase 71: GreenHopper Adapter Foundation - Research

**Researched:** 2026-05-28
**Domain:** Typed API client + adapter layer (TypeScript / vitest, in-app service module)
**Confidence:** HIGH

## Summary

Phase 71 is a code-only, no-UI phase that ships a new `src/services/jira/greenhopper/` folder containing four typed fetchers (`allData`, `data`, `details`, `transitions`), pure entity-map resolvers, and an `adaptIssue` function whose output is a drop-in `JiraIssue` superset. Every architectural question is already locked in 71-CONTEXT.md (D-01..D-12). The remaining work for the planner is purely concrete: (1) name the response-shape TypeScript types, (2) write the GH → `JiraIssue` field map, (3) define the `EntityMaps` interface, (4) script a redacting one-shot capture, (5) wire vitest tests against hybrid fixtures, and (6) re-export through `services/jira.ts` to honor the dual-file gotcha.

The repo already has two near-perfect analogs (`services/tempo/` and `services/aio/`, both shipping a private `client.ts` + `index.ts` barrel + colocated tests). The planner should mirror their layout almost line-for-line. Two correctness questions are non-obvious and need to land in the plan: (a) `customfield_10016` synthesis must call `discoverCustomFields` (or accept the resolved `storyPointsFieldKey`) — not assume the default — because the adapter is pure and cannot look it up itself; and (b) `apiFetch` currently only accepts a fixed union of `source` values, so `greenhopperFetch` must pass `'jira'` (the canonical, simplest choice — auth + 401 semantics are identical).

**Primary recommendation:** Model the folder on `services/tempo/`, hand `adaptIssue` the resolved `storyPointsFieldKey` plus `EntityMaps` so it stays pure, capture-script-under-`scripts/capture-greenhopper.ts` uses node-fetch (not the in-app `apiFetch`), and ship the vitest fixture-driven adapter test as the canonical proof of success criterion #4.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `adaptIssue(ghIssue, entityMaps)` returns a `JiraIssue` superset — drop-in for `src/services/jira.ts:139` (synthesize `fields.status`, `fields.assignee`, `fields.issuetype`, `fields.customfield_10016`, `fields.summary`, `fields.subtasks?`, `fields.parent?`) **plus** GH-only top-level props: `timeInColumn?`, `color`, `flagged`, `done`.
- **D-02:** `customfield_10016` synthesized from `estimateStatistic.statFieldValue.value` only when `estimateStatistic.statFieldId` matches the project's story-points field id (via `discoverCustomFields`); otherwise `null`.
- **D-03:** `fields.status.statusCategory.key` mapped from `entityData.statuses[id].status.statusCategory.key` to `'new' | 'indeterminate' | 'done'`; if GH `done === true` disagrees with resolved category, prefer GH `done`.
- **D-04:** New folder `src/services/jira/greenhopper/` — `client.ts` (private `greenhopperFetch`), `types.ts`, `allData.ts`, `data.ts`, `details.ts`, `transitions.ts`, `entityMaps.ts`, `adapter.ts`, `index.ts` barrel; colocated `*.test.ts` + `__fixtures__/`.
- **D-05:** Public surface re-exported through `src/services/jira.ts` (legacy dual-file). Phases 72-75 import `fetchAllData`, `fetchBacklogData`, `fetchIssueDetails`, `fetchGhTransitions`, `adaptIssue`, `buildEntityMaps` from `services/jira`.
- **D-06:** `client.ts` is NOT re-exported from `jira/greenhopper/index.ts`.
- **D-07:** Required resolvers (`resolveStatus`/`resolvePriority`/`resolveType`) return a fallback shim on miss + `console.warn` once-per-unique-id.
- **D-08:** Optional resolvers (`resolveEpic`/`resolveParent`) return `undefined` for missing id or missing entry.
- **D-09:** `buildEntityMaps(allDataResponse)` returns a single `EntityMaps` — pure, no caching.
- **D-10:** Hybrid fixtures. One redacted real-capture per endpoint under `__fixtures__/*.real.json`; capture script under `scripts/capture-greenhopper.ts`, committed; output committed.
- **D-11:** Handwritten TS edge fixtures next to tests: subtask w/ `parentId`, issue w/ resolved `epicId`, missing `statusId`, absent `statFieldValue.value`, `flagged: true`, `done: true`, multi-column-per-status.
- **D-12:** vitest. Adapter tests `import` real captures as JSON. Network never hit.

### Claude's Discretion

- Internal naming inside `greenhopper/` (`entityMaps.ts` vs `resolvers.ts`).
- Whether `greenhopperFetch` takes `rapidViewId` explicitly or via an options object.
- Exact `EntityMaps` field names (`statuses` vs `statusById`).
- Whether `console.warn` uses a `warnOnce(key)` helper or a `Set` guard.

### Deferred Ideas (OUT OF SCOPE)

- Caching for `transitions.json` (Phase 72).
- Caching for `allData.json` / `data.json`.
- HTML sanitization for `details.json` `Section.html` (Phase 75).
- Network-log verification harness (Phases 73-75).
- Rich `details.json` adapter for operations / sprint / tabs (Phase 75).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GH-ADAPT-01 | GH client module under `services/jira/greenhopper/` with typed responses for `allData`/`data`/`details`/`transitions` | API response shapes (§ API Response Shapes), tempo/aio client patterns (§ Existing Pattern Excerpts) |
| GH-ADAPT-02 | Entity-map resolver helpers (`statusId`→`Status`, etc.) | `EntityMaps` interface (§ Entity Map Shape), resolver signatures, miss-behavior from D-07/D-08 |
| GH-ADAPT-03 | Issue adapter mapping GH `Issue` → existing app `JiraIssue` | Field-by-field mapping table (§ Adapter Mapping Table), D-01 superset, D-02 story-points gating |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `greenhopperFetch` (HTTP) | Frontend Server (Tauri renderer → host fetch) | — | Same tier as existing `apiFetch('jira', ...)` — no new tier introduced |
| `buildEntityMaps` | Frontend (pure function in renderer) | — | D-09: pure, no side effects, no I/O |
| `adaptIssue` | Frontend (pure function) | — | D-09 pattern; called per-issue by board/backlog consumers in 72-75 |
| Fixture capture script | Build/Tools (Node CLI, not bundled) | — | Run once at probe time; never ships in renderer bundle |
| Re-export surface (`services/jira.ts`) | Frontend | — | Matches the 60-import dual-file convention |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | repo-pinned | Adapter + response types | Already the project standard |
| vitest | `^4.0.18` | Adapter + fetcher unit tests | Already the project test runner (per `package.json` + `vitest.config.ts`) [VERIFIED: package.json] |
| Existing `apiFetch` from `src/lib/apiFetch.ts` | in-tree | HTTP wrapper with auth-disconnect side effects | Required by D-04 (`apiFetch('jira', ...)`); used by all existing service folders |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fetch` / built-in `fetch` | Node 18+ | Capture script HTTP outside the renderer | The in-app `apiFetch` runs inside the renderer & touches auth stores — unsuitable for a `tsx`/`ts-node` CLI capture |
| `tsx` or `node --import tsx` | dev-dep | Run `scripts/capture-greenhopper.ts` directly | Existing `scripts/` folder uses `.mjs` / `.cjs`; planner can pick `.ts` + `tsx` or `.mjs` to match existing convention |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Re-using `apiFetch('jira', ...)` source | New `'greenhopper'` source in the union | Would touch `markDisconnected` semantics and every consumer of the union — not justified; GH and Jira share host + PAT |
| Pure `adaptIssue(ghIssue, entityMaps)` (D-01) | Adapter that knows story-points field via closure | A closure-capturing factory `createAdapter({ storyPointsFieldKey, entityMaps })` is cleaner; either is fine — D-02 just requires the field-id check |
| Single `EntityMaps` object (D-09) | Per-domain maps passed individually | D-09 already locks one object — but the shape (`statuses` vs `statusById`) is Claude's discretion |

**Installation:** None — no new packages.

**Version verification:**
```bash
node -e "console.log(require('./taskflow/package.json').devDependencies.vitest)"
# → ^4.0.18 [VERIFIED: package.json]
```

## Package Legitimacy Audit

No new external packages are installed in this phase. Nothing to audit.

## API Response Shapes (TypeScript Types)

The planner can crib these verbatim into `src/services/jira/greenhopper/types.ts`. Source: `.planning/research/GREENHOPPER-API.md` [VERIFIED: in-repo research doc].

```ts
// Shared base — every issuesData entry extends this
export interface GhIssue {
  id: number;
  key: string;
  hidden: boolean;
  typeId: string;
  summary: string;
  priorityId: string;
  done: boolean;
  assignee?: string;            // username
  assigneeName?: string;        // display name
  avatarUrl?: string;
  hasCustomUserAvatar: boolean;
  color: string;                // hex
  flagged?: boolean;
  epicId?: number;
  epic?: string;                // epic issue key
  parentId?: number;            // present on sub-tasks
  parentKey?: string;
  estimateStatisticRequired: boolean;
  estimateStatistic: {
    statFieldId: string;
    statFieldValue: { value?: number; text?: string };
  };
  trackingStatistic: {
    statFieldId: string;
    statFieldValue: { value?: number; text?: string };
  };
  statusId: string;
  fixVersions: number[];
  projectId: number;
}

export interface GhBoardIssue extends GhIssue {
  timeInColumn: {
    enteredStatus: number;      // unix ms
    durationPreviously: number;
  };
}

export interface GhStatusEntity {
  statusUrl: string;
  statusName: string;
  status: {
    id: string;
    name: string;
    description: string;
    iconUrl: string;
    statusCategory: { id: string; key: string; colorName: string };
  };
}

export interface GhPriorityEntity { priorityName: string; priorityUrl: string }
export interface GhTypeEntity     { typeUrl: string; typeName: string }
export interface GhEpicEntity {
  epicField: {
    id: string; label: string; editable: boolean; renderer: string;
    epicKey: string; epicColor: string; text: string;
  };
}

export interface GhAllDataResponse {
  rapidViewId: number;
  statistics: { fieldConfigured: boolean; typeId: string; id: string; name: string };
  entityData: {
    statuses:   Record<string, GhStatusEntity>;
    priorities: Record<string, GhPriorityEntity>;
    types:      Record<string, GhTypeEntity>;
    epics:      Record<string, GhEpicEntity>;
  };
  columnsData: {
    rapidViewId: number;
    columns: Array<{ id: number; name: string; statusIds: string[] }>;
  };
  swimlanesData: {
    rapidViewId: number;
    swimlaneStrategy: string;
    parentSwimlanesData: {
      parentIssueIds: number[];
      inprogressCandidates: number[];
      doneCandidates: number[];
    };
  };
  issuesData: {
    rapidViewId: number;
    activeFilters: unknown[];
    issues: GhBoardIssue[];
  };
}

export interface GhBacklogResponse { issues: GhIssue[] }

export interface GhTransition {
  transitionId: number;
  name: string;
  toStatusId: number;
  fromStatusId?: number;        // absent when isGlobal
  hasScreen: boolean;
  hasConditions: boolean;
  hasValidators: boolean;
  isInitial: boolean;
  isGlobal: boolean;
}

export interface GhTransitionsResponse {
  projectAndIssueTypeToWorkflow: Record<string, Record<string, string>>; // projectId → typeId → workflowName
  workflowToTransitions: Record<string, GhTransition[]>;
}

// details.json — phase 71 only needs the typed shape; rich adapter is Phase 75.
export interface GhDetailsResponse {
  key: string; id: number; editable: boolean; canCreateComment: boolean;
  isSubtask: boolean; totalComments: number; flagged: boolean;
  projectName: string; projectAvatarUrl: string; isAssigned: boolean;
  primaryStatisticFieldId: string; trackingStatisticFieldId: string;
  sprint: {
    id: number; sequence: number; rapidViewId: number; name: string;
    state: 'ACTIVE' | 'CLOSED' | 'FUTURE';
    autoStartStop: boolean; synced: boolean;
  };
  operations: {
    issueKey: string;
    sections: Array<{
      groupId: string;
      operations: Array<{
        id: string; label: string; title: string;
        styleClass: string; url: string;
      }>;
    }>;
  };
  tabs: {
    // Discriminated union — phase 71 keeps it loose; Phase 75 narrows each tabId.
    defaultTabs: Array<{
      tabId: 'HEADER' | 'DETAILS' | 'DESCRIPTION' | 'COMMENT' | 'ATTACHMENT'
           | 'SUB_TASKS' | 'ISSUES_IN_EPIC' | 'THIRD_PARTY_TAB';
      [key: string]: unknown;
    }>;
  };
}
```

**Optional / nullable / polymorphic notes:**
- `GhIssue.assignee`, `assigneeName`, `avatarUrl`, `flagged`, `epicId`, `epic`, `parentId`, `parentKey` are all optional (absent for unassigned / no-epic / story rows).
- `estimateStatistic.statFieldValue.value` may be absent — D-02's gate handles this.
- `details.tabs.defaultTabs` is a polymorphic array (tab-id discriminated). Phase 71 keeps it loose because no consumer reads it yet — Phase 75 tightens.
- `GhTransition.fromStatusId` is **absent** when `isGlobal === true` (Phase 72 owner).

## Adapter Mapping Table (GH → JiraIssue superset)

`adaptIssue(gh, { storyPointsFieldKey, entityMaps })` produces a value assignable to `JiraIssue` at `src/services/jira.ts:139` plus GH-only top-level props per D-01.

| Target field (JiraIssue) | Source (GH) | Notes |
|--------------------------|-------------|-------|
| `id` | `String(gh.id)` | GH is `number`, `JiraIssue.id` is `string` — must coerce |
| `key` | `gh.key` | direct |
| `fields.summary` | `gh.summary` | direct |
| `fields.status.id` | `gh.statusId` | direct |
| `fields.status.name` | `entityMaps.statuses[gh.statusId]?.status.name` | resolver miss → `'Unknown'` per D-07 |
| `fields.status.statusCategory.key` | `entityMaps.statuses[gh.statusId]?.status.statusCategory.key` mapped to `'new' \| 'indeterminate' \| 'done'` | **D-03 override**: if `gh.done === true` AND resolved category ≠ `'done'`, force `'done'` |
| `fields.assignee` | `gh.assignee ? { displayName: gh.assigneeName ?? gh.assignee, avatarUrls: { '48x48': gh.avatarUrl ?? '' } } : null` | matches `JiraIssue.fields.assignee` shape |
| `fields.issuetype.name` | `entityMaps.types[gh.typeId]?.typeName` | resolver miss → `'Unknown'` |
| `fields.issuetype.subtask` | `gh.parentId !== undefined` | per `JiraIssue` doc-comment: prefer truth-by-shape, not name comparison |
| `fields.customfield_10016` | `gh.estimateStatistic.statFieldId === storyPointsFieldKey ? gh.estimateStatistic.statFieldValue.value ?? null : null` | **D-02 gate** — story-points field id must match; otherwise null |
| `fields.parent?` | `gh.parentId !== undefined ? { id: String(gh.parentId), key: gh.parentKey ?? '', fields: { summary: '' } } : undefined` | summary is unknown at adapter time — empty string is acceptable (existing `JiraIssue` allows it; consumers don't render it for boards) |
| `fields.subtasks?` | left undefined in Phase 71 | board/backlog already groups by `parentId` at the consumer level; subtask hydration belongs in `details.json` (Phase 75) |
| `fields.description?` | undefined | not present in `allData`/`data` — only in `details.json` |
| **GH-only top-level (D-01)** | | |
| `timeInColumn?` | `gh.timeInColumn` (present on `GhBoardIssue` only) | optional — undefined for backlog issues |
| `color` | `gh.color` | hex string |
| `flagged` | `gh.flagged ?? false` | normalize |
| `done` | `gh.done` | D-03 sentinel |

**Ambiguity flags requiring a default:**

1. `fields.parent.fields.summary` — GH doesn't include parent summary on the child row. Empty string is the pragmatic default (board does not render it). Plan should add a code comment.
2. `assignee.avatarUrls['48x48']` — GH provides `avatarUrl` only (single URL). Plan should write the single URL into the `'48x48'` slot (matches existing avatar cache lookup).
3. `epic` — GH gives `epicId` (numeric) + optional `epic` (key string). The existing `JiraIssue` does not have a top-level epic field; epic is consumed in 73 via `entityMaps`. Adapter does NOT synthesize an epic field on `fields` in Phase 71.

## Entity Map Shape

```ts
export interface EntityMaps {
  statuses:   Record<string, GhStatusEntity>;
  priorities: Record<string, GhPriorityEntity>;
  types:      Record<string, GhTypeEntity>;
  epics:      Record<string, GhEpicEntity>;
}

// Builder (pure, no side effects — D-09)
export function buildEntityMaps(allData: GhAllDataResponse): EntityMaps {
  return {
    statuses:   allData.entityData.statuses,
    priorities: allData.entityData.priorities,
    types:      allData.entityData.types,
    epics:      allData.entityData.epics,
  };
}

// Resolver signatures (D-07 / D-08)
export function resolveStatus(id: string, maps: EntityMaps): {
  id: string; name: string;
  statusCategory: { key: 'new' | 'indeterminate' | 'done' };
}; // never undefined — fallback shim on miss

export function resolvePriority(id: string, maps: EntityMaps): {
  id: string; name: string; iconUrl: string;
}; // fallback shim on miss

export function resolveType(id: string, maps: EntityMaps): {
  id: string; name: string;
}; // fallback shim on miss

export function resolveEpic(id: number | undefined, maps: EntityMaps): {
  id: string; key: string; name: string; color: string;
} | undefined; // undefined on missing id OR missing entry — D-08

export function resolveParent(
  parentId: number | undefined,
  parentKey: string | undefined,
): { id: string; key: string } | undefined; // undefined unless both provided — D-08
```

**Populating the maps:**
- `entityMaps.statuses`   ← `allData.entityData.statuses`
- `entityMaps.priorities` ← `allData.entityData.priorities`
- `entityMaps.types`      ← `allData.entityData.types`
- `entityMaps.epics`      ← `allData.entityData.epics`

(`data.json` and `details.json` do **not** carry entity maps — consumers must combine a `data.json` fetch with the `allData.json` entity maps the board already loaded, or call `allData.json` once at session start for backlog. That's a Phase 73/74 concern, not 71.)

**`warnOnce` helper (D-07 / Claude's discretion):** A 6-line module-level `Set<string>` guard is simpler than a separate helper. Recommend:
```ts
const seenMissing = new Set<string>();
function warnOnce(kind: string, id: string) {
  const key = `${kind}:${id}`;
  if (seenMissing.has(key)) return;
  seenMissing.add(key);
  console.warn(`[greenhopper] missing ${kind} id="${id}" — using Unknown fallback`);
}
```

## Capture Script

**Endpoints to capture (one shot, single board):**
1. `GET {base}/rest/greenhopper/1.0/xboard/work/allData.json?rapidViewId={boardId}`
2. `GET {base}/rest/greenhopper/1.0/xboard/plan/backlog/data.json?rapidViewId={boardId}`
3. `GET {base}/rest/greenhopper/1.0/xboard/issue/details.json?rapidViewId={boardId}&issueIdOrKey={someIssueKey}&loadSubtasks=true`
4. `GET {base}/rest/greenhopper/1.0/xboard/work/transitions.json?projectId={projectId}`

**Inputs (env-driven, no committed secrets):**
- `JIRA_BASE_URL`, `JIRA_PAT`, `BOARD_ID`, `ISSUE_KEY`, `PROJECT_ID`.

**Anonymization (per D-10) — required redactions:**

| Field path | Replacement |
|------------|-------------|
| Every `issue.key` (and `details.json` `key`, `transitions` issue refs if any) | `PROJ-{n}` (stable numbering across all four files via shared map) |
| Every `issue.summary` (and `details.json` `summary` if present) | `'Sample summary {n}'` |
| `issue.assignee` (username) | `'user{n}'` |
| `issue.assigneeName` (display) | `'User {n}'` |
| `issue.avatarUrl` | `'https://example.invalid/avatar/{n}.png'` |
| `entityData.epics[*].epicField.text` | `'Epic {n}'` |
| `entityData.epics[*].epicField.epicKey` | mirror the `PROJ-{n}` mapping |
| `details.json` `operations[*].url` query strings | strip query (`url.split('?')[0]`) |
| Any `details.json` tab `html` field carrying summary/description/comment text | replace `html` with the literal `'<!-- redacted by capture script -->'` |
| `projectName`, `projectAvatarUrl` | `'Sample Project'`, `'https://example.invalid/project.png'` |

**Outputs (committed):**
- `src/services/jira/greenhopper/__fixtures__/allData.real.json`
- `src/services/jira/greenhopper/__fixtures__/data.real.json`
- `src/services/jira/greenhopper/__fixtures__/details.real.json`
- `src/services/jira/greenhopper/__fixtures__/transitions.real.json`

**Why not use `apiFetch`:** `apiFetch` runs inside the Tauri renderer, touches `useAuthStore`, and calls `markDisconnected` on 401. A capture script is a one-shot Node CLI with no renderer/auth-store context. Use global `fetch` (Node 18+) directly with `Authorization: Bearer ${pat}` and `Content-Type: application/json`.

**Precedent:** There are no existing capture/probe scripts in `scripts/` — the v1.8 AIO probe and v1.9 Tempo probe were ad-hoc, with their findings recorded in `*-PROBE-RESULT.md` files. This is the first committed capture script. The planner should add a brief README pointer in `scripts/capture-greenhopper.ts` explaining the workflow ("run once when GH response shape may have drifted; re-commit fixtures").

## Existing Pattern Excerpts

### `services/tempo/client.ts` — exact pattern to copy

```ts
// src/services/tempo/client.ts (lines 13-55)
import { apiFetch } from '../../lib/apiFetch';

export const TEMPO_API_PATH = '/rest/tempo-timesheets/3';

export async function tempoFetch(
  baseUrl: string,
  token: string,
  path: string,
  operation: string,
  apiPath: string = TEMPO_API_PATH,
  init?: { method?: string; body?: string },
): Promise<Response> {
  const url = `${baseUrl.replace(/\/$/, '')}${apiPath}${path}`;
  return apiFetch(
    'tempo',
    url,
    {
      method: init?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      ...(init?.body !== undefined ? { body: init.body } : {}),
    },
    operation,
  );
}
```

**Note:** `apiFetch`'s `source` parameter is a fixed union `'jira' | 'gitlab' | 'aio' | 'updater' | 'tempo'` ([VERIFIED: src/lib/apiFetch.ts:23]). `greenhopperFetch` must pass `'jira'` per D-04 — auth + 401-disconnect semantics are identical to Jira REST. Adding a `'greenhopper'` source would force a union widening with no behavioral benefit.

### `services/aio/index.ts` — barrel pattern (client NOT exported)

```ts
// src/services/aio/index.ts
export * from './cycles';
export * from './issue-runs';
export * from './issue-steps';
export * from './projects';
export * from './types';
// client.ts is intentionally NOT exported — it is internal to aio/.
```

### `services/jira/fields.ts` — story-points discovery (used by D-02)

```ts
// src/services/jira/fields.ts (excerpt lines 17-67)
export async function discoverCustomFields(baseUrl, token): Promise<{
  storyPointsFieldKey: string;
  // ...
}> {
  const defaults = { storyPointsFieldKey: 'customfield_10016', /* ... */ };
  try {
    const response = await apiFetch('jira',
      `${baseUrl.replace(/\/$/, '')}/rest/api/2/field`,
      { headers: { Authorization: `Bearer ${token}` } }, 'Load Fields');
    if (!response.ok) return defaults;
    const fields = await response.json();
    const result = { ...defaults };
    for (const f of fields) {
      const custom = f.schema?.custom ?? '';
      if (custom === 'com.atlassian.jira.plugin.system.customfieldtypes:float'
          && (f.name === 'Story Points' || f.name === 'story_points'))
        result.storyPointsFieldKey = f.id;
      // ...
    }
    return result;
  } catch { return defaults; }
}
```

**Adapter wiring:** `adaptIssue` must take `storyPointsFieldKey` as an argument — not call `discoverCustomFields` itself — to honor D-09 purity. The board/backlog hook resolves `storyPointsFieldKey` once at session start (existing pattern in `jira.ts`) and threads it into `adaptIssue` calls. Recommend a tiny adapter factory:

```ts
// Adapter shape recommendation (Claude's discretion under D-09)
export function createAdapter(opts: { storyPointsFieldKey: string; entityMaps: EntityMaps }) {
  return (gh: GhIssue | GhBoardIssue): JiraIssue & {
    timeInColumn?: GhBoardIssue['timeInColumn']; color: string; flagged: boolean; done: boolean;
  } => { /* ... */ };
}
// or — equally valid — a 3-arg function: adaptIssue(gh, entityMaps, storyPointsFieldKey)
```

### `services/jira.ts` re-export style

```ts
// src/services/jira.ts (lines 23-28)
import { isResponseLikeError } from './jira/client';
// ...
export { addIssuesToSprint } from './jira/sprints';
export * from './jira-changelog';
export * from './jira-watchers';
```

Phase 71 adds, near the bottom of `jira.ts`:

```ts
export {
  fetchAllData,
  fetchBacklogData,
  fetchIssueDetails,
  fetchGhTransitions,
  adaptIssue,
  buildEntityMaps,
  resolveStatus,
  resolvePriority,
  resolveType,
  resolveEpic,
  resolveParent,
} from './jira/greenhopper';

export type {
  GhIssue, GhBoardIssue, GhAllDataResponse, GhBacklogResponse,
  GhDetailsResponse, GhTransitionsResponse, GhTransition,
  EntityMaps,
} from './jira/greenhopper';
```

## Architecture Patterns

### System Architecture Diagram

```
                ┌──────────────────────────────┐
                │  scripts/capture-greenhopper │  (one-shot, Node CLI)
                │  fetch + redact + write JSON │
                └─────────────┬────────────────┘
                              │  commits redacted fixtures
                              ▼
   src/services/jira/greenhopper/__fixtures__/{allData,data,details,transitions}.real.json
                              │
                              │  imported by *.test.ts
                              ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │  src/services/jira/greenhopper/                                 │
   │                                                                 │
   │  client.ts ──► greenhopperFetch (wraps apiFetch('jira', ...))   │
   │     ▲                                                           │
   │     │ used by                                                   │
   │  allData.ts  data.ts  details.ts  transitions.ts                │
   │     │           │          │            │                       │
   │     └─► fetchAllData  fetchBacklogData  fetchIssueDetails …     │
   │                                                                 │
   │  types.ts ──► response shapes + EntityMaps                      │
   │                                                                 │
   │  entityMaps.ts ──► buildEntityMaps, resolveStatus/Priority/…    │
   │                                                                 │
   │  adapter.ts ──► adaptIssue(gh, entityMaps, storyPointsFieldKey) │
   │                                                                 │
   │  index.ts (barrel — NOT client.ts)                              │
   └──────────────┬──────────────────────────────────────────────────┘
                  │ re-exported via
                  ▼
   src/services/jira.ts ──► consumed by Phases 72-75 (board/backlog/detail)
```

### Recommended Project Structure

```
src/services/jira/greenhopper/
├── client.ts            # greenhopperFetch (private — not in barrel)
├── client.test.ts
├── types.ts             # GhIssue, GhAllDataResponse, …, EntityMaps
├── allData.ts           # fetchAllData(baseUrl, token, boardId)
├── allData.test.ts
├── data.ts              # fetchBacklogData(baseUrl, token, boardId)
├── data.test.ts
├── details.ts           # fetchIssueDetails(baseUrl, token, boardId, issueKey, loadSubtasks)
├── details.test.ts
├── transitions.ts       # fetchGhTransitions(baseUrl, token, projectId)
├── transitions.test.ts
├── entityMaps.ts        # buildEntityMaps + resolvers + warnOnce
├── entityMaps.test.ts
├── adapter.ts           # adaptIssue (+ optional createAdapter factory)
├── adapter.test.ts
├── index.ts             # public barrel — exports everything except client.ts
└── __fixtures__/
    ├── allData.real.json
    ├── data.real.json
    ├── details.real.json
    └── transitions.real.json

scripts/
└── capture-greenhopper.ts   # one-shot CLI, env-driven, with redaction map
```

### Pattern 1: Private-client + barrel + colocated tests

**What:** Service folder under `src/services/<name>/` with a `client.ts` that's imported by sibling files but not re-exported, plus an `index.ts` barrel.
**When to use:** Every new service the project ships (matches `aio/`, `tempo/`, `jira/`).
**Example:** see "`services/aio/index.ts`" excerpt above.

### Pattern 2: Pure adapter + pure resolvers

**What:** `adaptIssue` and resolvers are pure — no I/O, no closure over fetch state.
**When to use:** Any data-shape translation layer. Enables vitest tests to be fixture-only.
**Example:**
```ts
export function adaptIssue(
  gh: GhIssue | GhBoardIssue,
  entityMaps: EntityMaps,
  storyPointsFieldKey: string,
): JiraIssue & { timeInColumn?: ...; color: string; flagged: boolean; done: boolean } {
  const status = resolveStatus(gh.statusId, entityMaps);
  // D-03 override
  const categoryKey: 'new' | 'indeterminate' | 'done' =
    gh.done && status.statusCategory.key !== 'done' ? 'done' : status.statusCategory.key;
  // D-02 gate
  const storyPoints =
    gh.estimateStatistic.statFieldId === storyPointsFieldKey
      ? gh.estimateStatistic.statFieldValue.value ?? null
      : null;
  return { /* ... */ };
}
```

### Anti-Patterns to Avoid

- **Importing `client.ts` through `index.ts`** — violates D-06 + breaks the established convention.
- **Re-exporting GH surface from `services/jira/index.ts` (barrel) but NOT `services/jira.ts`** — would mean 60 callers must change import paths; D-05 requires the dual-file re-export.
- **Calling `discoverCustomFields` inside `adaptIssue`** — makes the adapter impure + async + un-testable from JSON fixtures.
- **Using the in-app `apiFetch` from the capture script** — would touch the renderer auth store on 401.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP request with PAT | A new fetch wrapper | `apiFetch('jira', ...)` via `greenhopperFetch` | Auth-disconnect + concurrency limiting are already centralized |
| Story-points field id | Hard-code `'customfield_10016'` | Existing `discoverCustomFields` (jira/fields.ts) resolves it at session start | Field id varies per Jira instance — was already the lesson in v1.2 |
| JSON fixture load helper | A custom loader | `import fixture from './__fixtures__/allData.real.json'` (vitest resolves JSON natively) | vitest 4 + tsconfig already handle `resolveJsonModule` |
| "Warn once" set | A new logger module | A 6-line module-level `Set<string>` | Single use site, no need to abstract |
| Capture redaction | Trying to redact inside `apiFetch` interceptors | Standalone Node script over global `fetch` | Capture is dev-only; never bundled |

**Key insight:** Phase 71 is mostly pattern-replication. Almost every "should we…?" question has a direct answer in `services/tempo/` or `services/aio/`.

## Runtime State Inventory

Not applicable — Phase 71 is greenfield code addition with no rename, refactor, or data migration. No runtime state is modified.

## Common Pitfalls

### Pitfall 1: jira.ts dual-file gotcha
**What goes wrong:** Planner adds re-exports to `services/jira/index.ts` (the modular barrel) but NOT to `services/jira.ts`. Phases 72-75 then fail to import `fetchAllData` from `services/jira` because the 60-import convention reads from the legacy file.
**Why it happens:** Two files with overlapping names; intuition says "barrel = `index.ts`".
**How to avoid:** D-05 is explicit — re-export through `src/services/jira.ts`. Planner should include a verification step: `grep -n "from './jira/greenhopper'" src/services/jira.ts` must show all six functions.
**Warning signs:** Phase 72-75 plans contain `from 'services/jira/greenhopper'` (wrong) instead of `from 'services/jira'` (right).
**Source:** memory `project_jira_ts_dual_file.md` — "all 60 imports use legacy jira.ts, not jira/ modules".

### Pitfall 2: GH `done` flag vs `statusCategory` disagreement
**What goes wrong:** Adapter trusts `statusCategory.key` and ignores `gh.done`, producing a card stuck in non-done category that visually behaves as undone on the board even though GH considers it complete.
**Why it happens:** Workflow admins sometimes leave a "verified" status in the `indeterminate` category but mark it `done: true` on GH issues.
**How to avoid:** D-03 mandates GH `done` wins. Adapter test must include a fixture where `gh.done === true` and `statusCategory.key === 'indeterminate'`, asserting the output category is `'done'`.

### Pitfall 3: Missing entity-map entry on production data
**What goes wrong:** An issue references a `statusId` not in `entityData.statuses` (e.g., a status removed from the workflow but still on a stale issue) and the adapter throws / produces `undefined.name`.
**How to avoid:** D-07's fallback shim + `warnOnce`. Test must cover this.
**Warning signs:** Console fills with `[greenhopper] missing status id="…"` warnings → real data drift signal.

### Pitfall 4: Story-points field-id mismatch
**What goes wrong:** Adapter pulls `estimateStatistic.statFieldValue.value` unconditionally; on a project where `statFieldId` is "time tracking" or "issue count", the number leaks in as story points.
**How to avoid:** D-02 gate — `if (gh.estimateStatistic.statFieldId === storyPointsFieldKey)`. Test must include a fixture where `statFieldId === 'timetracking'` and assert `customfield_10016 === null`.

### Pitfall 5: ID collisions across projects (multi-project boards)
**What goes wrong:** GH `Issue.id` is numeric and globally unique in Jira, but `statusId` / `typeId` / `priorityId` are strings shared across projects. A board spanning two projects with the same status name but different IDs is fine; the trap is assuming names are unique. Adapter must key entirely by id, never by name.
**How to avoid:** Resolver signatures take id only; never look up by name.

### Pitfall 6: Multi-column-per-status (GH `columnsData.columns[*].statusIds[]`)
**What goes wrong:** Multiple GH columns reference the same `statusId`. Phase 71 itself does NOT consume column data, but the adapter must not collapse status info per-column. D-11 explicitly calls out a handwritten fixture for this.
**Why it matters for Phase 71:** Establishes a fixture template Phases 73 (sprint board) can reuse.

### Pitfall 7: Capture script leaks PII via `details.json` HTML
**What goes wrong:** `details.json` `Section.html` contains rendered comment threads, attachment names, mentions of real users. Substring redaction over HTML is fragile.
**How to avoid:** D-10 — replace the entire `html` field with a literal placeholder string, not regex-redact. Same for `editHtml`.

### Pitfall 8: `apiFetch` source-union widening
**What goes wrong:** Planner adds `'greenhopper'` to the `apiFetch` `source` union to "match" the new folder, forcing changes to `markDisconnected` and every type signature.
**How to avoid:** Pass `'jira'` per D-04 — auth model is identical (same host, same PAT).

## Code Examples

Verified patterns from existing in-repo modules.

### Common Operation 1 — Typed fetcher (mirrors `services/aio/projects.ts`)

```ts
// src/services/jira/greenhopper/allData.ts
import { greenhopperFetch } from './client';
import type { GhAllDataResponse } from './types';

export async function fetchAllData(
  baseUrl: string,
  token: string,
  boardId: number,
): Promise<GhAllDataResponse> {
  const response = await greenhopperFetch(
    baseUrl,
    token,
    `/work/allData.json?rapidViewId=${boardId}`,
    'Load Sprint Board (allData)',
  );
  if (!response.ok) throw response;
  return (await response.json()) as GhAllDataResponse;
}
```

### Common Operation 2 — Adapter test using real-capture fixture

```ts
// src/services/jira/greenhopper/adapter.test.ts
import { describe, it, expect } from 'vitest';
import allData from './__fixtures__/allData.real.json';
import { buildEntityMaps } from './entityMaps';
import { adaptIssue } from './adapter';
import type { GhAllDataResponse } from './types';

describe('adaptIssue (real capture)', () => {
  const typed = allData as unknown as GhAllDataResponse;
  const maps = buildEntityMaps(typed);

  it('produces a JiraIssue-shaped object for every issue', () => {
    for (const gh of typed.issuesData.issues) {
      const out = adaptIssue(gh, maps, 'customfield_10016');
      expect(out.id).toBe(String(gh.id));
      expect(out.key).toBe(gh.key);
      expect(out.fields.status.id).toBe(gh.statusId);
      expect(out.fields.issuetype.subtask).toBe(gh.parentId !== undefined);
      expect(out.done).toBe(gh.done);
    }
  });
});
```

## State of the Art

Not relevant — this phase is in-tree convention work, not external-ecosystem-tracking. The "state of the art" is the existing `services/tempo/` and `services/aio/` folders, both shipped within the last six months.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `apiFetch`'s `source` union does NOT need `'greenhopper'` added — `'jira'` is correct per D-04 | Existing Pattern Excerpts | If wrong, GH 401s would not trigger Jira disconnect — but they should, since same PAT |
| A2 | `vitest` natively imports `.json` fixtures with `resolveJsonModule` | Code Examples | If wrong, fixtures need a small loader helper — trivial fix |
| A3 | `details.json` `tabs.defaultTabs` discriminated union can be left loose in Phase 71 (Phase 75 narrows) | API Response Shapes | If wrong, Phase 75 has more work — no Phase 71 impact |
| A4 | Adapter setting `fields.parent.fields.summary = ''` is acceptable to existing consumers | Adapter Mapping Table | If a board card renders parent summary, it would show empty — Phase 73 verification catches this |
| A5 | Capture script should use Node global `fetch` (Node 18+), not `apiFetch` | Capture Script | If Node version is <18 in dev env, planner needs to add `node-fetch` — verify via `node --version` |

## Open Questions

1. **Should `adaptIssue` be a 3-arg function or a factory (`createAdapter`)?**
   - What we know: D-09 requires purity; both are pure.
   - What's unclear: Call-site ergonomics in Phases 73-74.
   - Recommendation: Ship `adaptIssue(gh, entityMaps, storyPointsFieldKey)` AND a thin `createAdapter({...})` factory. Adapter is one line of factory code; either ergonomic suits a caller.

2. **Where does Phase 73 board get `storyPointsFieldKey` from?**
   - What we know: `discoverCustomFields` already runs at session start and caches into settings.
   - What's unclear: Not Phase 71's problem; the adapter signature just takes it as a string.
   - Recommendation: Document in `adapter.ts` JSDoc that the caller is responsible for resolving the key.

3. **Capture script: commit it as `.ts` (needs `tsx`) or `.mjs` (matches existing `scripts/bump-version.mjs`)?**
   - What we know: Existing scripts are `.mjs` + `.cjs`.
   - What's unclear: Whether `tsx` is already a dev-dep.
   - Recommendation: Plan should `grep '"tsx"' package.json`. If absent, ship as `.mjs` and inline the redaction map; do not add a new dev-dep for a one-shot tool.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 18+ (global `fetch`) | Capture script | likely ✓ | check at planning time | `node-fetch` v3 |
| vitest | Tests | ✓ | `^4.0.18` [VERIFIED: package.json] | — |
| TypeScript | Source + types | ✓ | repo-pinned | — |
| Live Jira instance + PAT | Capture script only | dev-machine-dependent | — | Use handwritten edge fixtures only (D-11 covers this) — but success criterion #4 requires at least one real capture, so capture must run once before Phase 71 ships |

**Missing dependencies with no fallback:** None blocking — the capture script runs on a developer machine pointed at the team's live Jira, which is the same setup used during the v1.8 AIO probe and v1.9 Tempo probe.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest `^4.0.18` |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `npm test -- src/services/jira/greenhopper` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| GH-ADAPT-01 | `fetchAllData` returns typed `GhAllDataResponse` | unit | `npm test -- src/services/jira/greenhopper/allData.test.ts` | ❌ Wave 0 |
| GH-ADAPT-01 | `fetchBacklogData` returns typed `GhBacklogResponse` | unit | `npm test -- src/services/jira/greenhopper/data.test.ts` | ❌ Wave 0 |
| GH-ADAPT-01 | `fetchIssueDetails` returns typed `GhDetailsResponse` | unit | `npm test -- src/services/jira/greenhopper/details.test.ts` | ❌ Wave 0 |
| GH-ADAPT-01 | `fetchGhTransitions` returns typed `GhTransitionsResponse` | unit | `npm test -- src/services/jira/greenhopper/transitions.test.ts` | ❌ Wave 0 |
| GH-ADAPT-02 | `buildEntityMaps` produces all four maps from `allData` | unit | `npm test -- src/services/jira/greenhopper/entityMaps.test.ts` | ❌ Wave 0 |
| GH-ADAPT-02 | `resolveStatus` returns shim + warns once on miss (D-07) | unit | same as above | ❌ Wave 0 |
| GH-ADAPT-02 | `resolveEpic` returns undefined on missing id or entry (D-08) | unit | same as above | ❌ Wave 0 |
| GH-ADAPT-03 | `adaptIssue` produces `JiraIssue` shape for every real-capture issue | unit | `npm test -- src/services/jira/greenhopper/adapter.test.ts` | ❌ Wave 0 |
| GH-ADAPT-03 | `adaptIssue` honors D-02 story-points gate | unit | same as above | ❌ Wave 0 |
| GH-ADAPT-03 | `adaptIssue` honors D-03 (`done === true` overrides category) | unit | same as above | ❌ Wave 0 |
| GH-ADAPT-03 | Re-exports present in `services/jira.ts` (D-05) | static | `grep -n "from './jira/greenhopper'" src/services/jira.ts` | manual / lint-style |

### Sampling Rate

- **Per task commit:** `npm test -- src/services/jira/greenhopper` (fast, < 5s — only new files)
- **Per wave merge:** `npm test` (full suite — confirms no regression in `services/jira.ts` consumers)
- **Phase gate:** Full suite green + biome lint green (`project_biome_state.md` baseline: 0 errors / 0 warnings) before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `src/services/jira/greenhopper/{client,allData,data,details,transitions,entityMaps,adapter}.test.ts` — eight new test files; vitest auto-discovers via existing `vitest.config.ts`
- [ ] `src/services/jira/greenhopper/__fixtures__/{allData,data,details,transitions}.real.json` — captured before tests can pass; produced by `scripts/capture-greenhopper.ts`
- [ ] `scripts/capture-greenhopper.ts` (or `.mjs`) — must run successfully on a dev machine with `JIRA_BASE_URL`/`JIRA_PAT`/`BOARD_ID`/`ISSUE_KEY`/`PROJECT_ID` env

*(Framework install: none — vitest already present.)*

## Security Domain

**Applicable ASVS categories** for this phase (read-only API client + pure adapter, no UI):

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (indirect) | Reuses existing Bearer PAT via `apiFetch('jira', ...)` — no new auth path |
| V3 Session Management | no | No session state introduced |
| V4 Access Control | no | Read-only proxy; access is enforced server-side by Jira |
| V5 Input Validation | yes | TypeScript types validate response shape; runtime `as` casts must be confined to fetcher boundaries |
| V6 Cryptography | no | No new crypto |
| V14 Configuration | yes | Capture script must NOT commit `.env` / PAT |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PII leakage via committed fixtures | Information Disclosure | D-10 redaction map (mandatory); CI grep for known team-member display names before merge |
| PAT in capture-script output | Information Disclosure | Script must never echo `process.env.JIRA_PAT`; output file paths are whitelisted to `__fixtures__/` |
| Response-shape drift causing runtime errors | Denial of Service (board crash) | D-07 fallback shims; resolver miss → warn + Unknown rather than throw |
| 401 cascade collapsing Jira auth state | Availability | Reuse `apiFetch('jira', ...)` so existing `markDisconnected` semantics apply consistently |

## Project Constraints (from CLAUDE.md)

No `./CLAUDE.md` present at repo root [VERIFIED: filesystem check]. Memory-derived constraints applied:

- **`jira.ts` dual-file gotcha:** 60 imports use legacy `jira.ts`; re-export GH surface there per D-05.
- **Biome lint baseline:** 0 errors, 0 warnings — Phase 71 plan must include a biome lint pass.
- **No `git stash` for diff/compare:** verification steps must use file copies or `git diff`, not `git stash`.
- **Visual bugs: inspect DOM first** — not applicable; no UI in Phase 71.

## Sources

### Primary (HIGH confidence)

- `.planning/research/GREENHOPPER-API.md` — authoritative endpoint + response shape reference [VERIFIED: in-repo]
- `taskflow/src/services/jira.ts` lines 139-173 (`JiraIssue`), 183-191 (`JiraTransition`) [VERIFIED: read]
- `taskflow/src/services/jira/client.ts`, `tempo/client.ts`, `aio/client.ts` — existing client-wrapper patterns [VERIFIED: read]
- `taskflow/src/services/jira/fields.ts` — `discoverCustomFields` [VERIFIED: read]
- `taskflow/src/services/{tempo,aio}/index.ts` — barrel pattern (no client re-export) [VERIFIED: read]
- `taskflow/vitest.config.ts`, `taskflow/package.json` — vitest 4.0.18 confirmed [VERIFIED: read]
- `taskflow/src/lib/apiFetch.ts` line 23 — `source` union [VERIFIED: read]
- `.planning/phases/71-greenhopper-adapter-foundation/71-CONTEXT.md` — locked D-01..D-12 [VERIFIED: read]
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` [VERIFIED: read]

### Secondary (MEDIUM confidence)

None — every claim in this research is grounded in an in-repo file or the locked context.

### Tertiary (LOW confidence)

None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — vitest + apiFetch + folder pattern all already in tree
- Architecture: HIGH — directly mirrors `services/tempo/` and `services/aio/`
- Adapter mapping: HIGH — both source shape (GREENHOPPER-API.md) and target shape (`JiraIssue`) are read from authoritative sources
- Pitfalls: HIGH — `jira.ts` dual-file gotcha is a documented memory; D-03 / D-07 catch the rest
- Capture script details: MEDIUM — no in-repo precedent for a redacting capture script (this is the first); approach is sound but the planner should treat it as a "first time we do this" task

**Research date:** 2026-05-28
**Valid until:** 2026-06-27 (30 days — stack is internal-tooling-only, very stable)

## RESEARCH COMPLETE

The planner has everything required to write task-level plans without re-deriving anything. The GH response types are listed verbatim and ready to drop into `types.ts`. The GH→`JiraIssue` field map is complete with every ambiguity flagged. The `EntityMaps` shape, resolver signatures (with D-07/D-08 miss behavior), and `buildEntityMaps` body are spelled out. The capture script's endpoint list, redaction map, and rationale-for-not-using-`apiFetch` are documented. Two existing folders (`services/tempo/`, `services/aio/`) are explicitly identified as line-for-line analogs to mirror, and the dual-file `jira.ts` re-export block is pre-written. Eight Wave 0 test files are enumerated with their commands and req-ID coverage. Five assumptions are tracked for `/gsd-discuss-phase`-style confirmation if the planner wants user sign-off, none of which are blocking.
