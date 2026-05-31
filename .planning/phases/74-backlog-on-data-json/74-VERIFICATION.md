---
phase: 74-backlog-on-data-json
verified: 2026-05-29T00:00:00Z
status: passed
score: 3/3 must-haves verified; human UAT resolved 2026-06-01 (74-HUMAN-UAT.md: 3/3 passed)
overrides_applied: 0
human_verification:
  - test: "Open the backlog in the dev/desktop app with DevTools Network panel open and confirm exactly ONE request to `/rest/greenhopper/1.0/xboard/plan/backlog/data.json?rapidViewId={boardId}` fires per board open (no paginated REST `/rest/api/2/search` fan-out)."
    expected: "Network log shows 1× `data.json` call per backlog open; zero REST `/search` calls for the backlog sections; rendering is populated by that single response."
    why_human: "SC-1 explicitly requires verification 'in the network log' — only runtime DevTools inspection can confirm the on-wire request count."
  - test: "Exercise the backlog feature surface end-to-end: (a) right-click an issue and move it to a sprint, (b) move an issue back to the backlog, (c) create a new story from the backlog toolbar, (d) filter by epic / assignee, (e) scroll through a large backlog (virtualized rows render and recycle correctly)."
    expected: "All five behaviors work against the new data source; the move dialog resolves both source and destination sprint names (including for issues currently in a CLOSED sprint per BL-02)."
    why_human: "GH-BACKLOG-02 / SC-2 is a behavioral parity check across visual UX, dialog content, and virtualization — cannot be confirmed from static grep."
  - test: "Hard refresh the backlog after a mutation (move to sprint, edit field, create issue) and confirm the new state is reflected immediately without manual reload."
    expected: "Cache-invalidation paths (5 production mutation sites wired to `invalidateGhBacklogData`) successfully refresh the `['gh-backlog', boardId]` cache so the UI never goes stale."
    why_human: "Mutation freshness is a runtime React-Query behavior that depends on the active boardId and the actual sequence of cache reads — not directly observable from source."
---

# Phase 74: Backlog on `data.json` — Verification Report

**Phase Goal:** Replace the paginated REST backlog fetch with a single `data.json` call (opening the backlog issues exactly one `data.json` request).

**Verified:** 2026-05-29
**Status:** human_needed (all technical / code-side checks pass; SC-1 network log and SC-2 behavioral parity require runtime UAT)
**Re-verification:** No — initial verification (post REVIEW-FIX commits c9a0cf19, ef4d6ac0)

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria + REQUIREMENTS GH-BACKLOG-01/02)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Opening the backlog issues exactly one `data.json` request (SC-1 / GH-BACKLOG-01) | ✓ VERIFIED (code) / ? UNCERTAIN (network log) | `BacklogPage.tsx:234` calls `useGhBacklogData(boardId ?? null)` — exactly one hook; `useGhBacklogData.ts:75-80` issues one `useQuery({queryKey: ['gh-backlog', boardId], queryFn: () => fetchBacklogData(...)})`; `services/jira/greenhopper/data.ts:31` targets `/plan/backlog/data.json?rapidViewId={boardId}`. **Static grep finds zero remaining `fetchBacklogIssues` / `fetchBacklogSprintStories` / `fetchBacklogView` references in production source.** Network log verification deferred to human (see human_verification[0]). |
| 2 | Move-to-sprint, create story, filter (epic/label/assignee), virtualized rendering all work on the new data source (SC-2 / GH-BACKLOG-02) | ✓ VERIFIED (code) / ? UNCERTAIN (UX parity) | `BacklogPage.tsx` imports `ConfirmSprintMoveDialog`, `addIssuesToSprint`, `moveIssuesToBacklog`, `useVirtualizer` (`@tanstack/react-virtual`), and `UnifiedFilterBar`. `requestMoveToSprint` (line 577) resolves `fromSprintName` via `lookupSprintNameById` which (post-BL-02 fix ef4d6ac0) reads from raw `backlog.sprints` so CLOSED-sprint names still resolve. ACTIVE/FUTURE-only `sprintSections` (line 302) is consistent with the reverse-index restriction (BL-01 fix c9a0cf19). Filter/virtualization wiring is unchanged from pre-cutover (filter store + virtualizer survive). UX parity deferred to human (see human_verification[1]). |
| 3 | Old REST backlog-fetch path is deleted (SC-3 / GH-CUT-01) | ✓ VERIFIED | `grep -rE "fetchBacklogIssues\|fetchBacklogSprintStories\|fetchBacklogView\|BacklogViewData" src/` excluding tests returns ZERO production hits. `services/jira/backlog.ts` (59 lines) exports only `fetchSprintList` (still used by `FieldsSection.tsx` sprint picker per D-09a). `services/jira.ts` no longer re-exports the deleted symbols. `npm run check:legacy-backlog` exits 0 ("OK"). |

**Score:** 3/3 truths verified at the source-code level. Truths 1 and 2 carry human-verification subpoints (network log + UX parity).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/services/jira/greenhopper/useGhBacklogData.ts` | Hook + imperative twin + invalidator targeting `['gh-backlog', boardId]` | ✓ VERIFIED | 116 lines; exports `useGhBacklogData`, `getGhBacklogData`, `invalidateGhBacklogData`; all three target the same cache key and call `fetchBacklogData(/plan/backlog/data.json)`. |
| `taskflow/src/routes/dashboard/BacklogPage.tsx` | Single hook call, adapter chain, ACTIVE/FUTURE filter, mutation invalidation via `invalidateGhBacklogData` | ✓ VERIFIED | One `useGhBacklogData(boardId ?? null)` at line 234; `buildEntityMaps → createAdapter` chain present; ACTIVE/FUTURE sprint filtering at lines 268 and 302; uses `invalidateGhBacklogData(queryClient, boardId)` not legacy keys. |
| `taskflow/src/components/app/Sidebar.tsx` | Prefetch collapsed to single `getGhBacklogData` warm-up | ✓ VERIFIED | Lines 172-189: `/backlog` branch chains `fetchBoardId → getGhBacklogData` only (no per-section legacy fetchers); D-08a null-boardId guard present. |
| `taskflow/src/services/jira/backlog.ts` | Trimmed to only `fetchSprintList` | ✓ VERIFIED | 59 lines total; only `export async function fetchSprintList` remains. |
| `taskflow/src/services/jira.ts` (dual-file) | Re-exports new hook trio; legacy symbols deleted | ✓ VERIFIED | Re-exports `useGhBacklogData`, `getGhBacklogData`, `invalidateGhBacklogData` (lines 2342-2354); zero hits for the four deleted legacy symbols. |
| `taskflow/package.json` | `check:legacy-backlog` npm script wired | ✓ VERIFIED | Script entry present; `npm run check:legacy-backlog` exits 0 ("OK"). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `BacklogPage` | `useGhBacklogData` | direct hook call | ✓ WIRED | `BacklogPage.tsx:234` |
| `useGhBacklogData` | `fetchBacklogData` (`data.json`) | `useQuery({queryFn: () => fetchBacklogData(...)})` | ✓ WIRED | `useGhBacklogData.ts:77`; `data.ts:31` targets the canonical endpoint |
| `Sidebar` prefetch | `getGhBacklogData` | `fetchBoardId().then(getGhBacklogData)` | ✓ WIRED | `Sidebar.tsx:172-189`; warmed key matches BacklogPage read key |
| Mutation sites (5×) | `invalidateGhBacklogData` | imported from `@/services/jira` | ✓ WIRED | `main.tsx`, `RecentItemsPopover.tsx`, `FieldsSection.tsx`, `useFieldMutation.ts`, `useIssueMutations.ts`, `BacklogPage.tsx` — verified via grep, zero remaining legacy `['jira-backlog-*']` keys in production |
| Sprint move dialog | `lookupSprintNameById` (raw `backlog.sprints`) | post-BL-02 fix | ✓ WIRED | `BacklogPage.tsx:567-575` reads from `backlog.sprints` (full list incl. CLOSED), confirmed in commit `ef4d6ac0` |
| Reverse index (issueId → sprintId) | excludes CLOSED | post-BL-01 fix | ✓ WIRED | `BacklogPage.tsx:264-268` filters `s.state !== 'ACTIVE' && s.state !== 'FUTURE'` continue, confirmed in commit `c9a0cf19` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `BacklogPage` | `backlog` (GhBacklogResponse) | `useGhBacklogData(boardId)` → `useQuery` → `fetchBacklogData` → GH `/plan/backlog/data.json` | Yes — real `greenhopperFetch` request | ✓ FLOWING |
| `BacklogPage` sprint sections | `sprintSections` | derived from `backlog.sprints` via `.filter(s => s.state === 'ACTIVE' || s.state === 'FUTURE')` | Yes | ✓ FLOWING |
| Sidebar prefetch warm | `['gh-backlog', boardId]` cache | `getGhBacklogData.ensureQueryData` (same key as the hook) | Yes — warmed cache is read by BacklogPage on mount | ✓ FLOWING |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| GH-BACKLOG-01 | 74-01, 74-02, 74-03, 74-06 | Backlog view fetches the flat issue list via a single `data.json` call (replaces paginated REST + per-issue lookups) | ✓ SATISFIED (code) / ? NEEDS HUMAN (network log) | Single `useGhBacklogData(boardId)` call in `BacklogPage.tsx:234` resolving to `fetchBacklogData → /plan/backlog/data.json`; old paginated REST fetchers deleted. Network log confirmation deferred. |
| GH-BACKLOG-02 | 74-03, 74-04, 74-05, 74-06 | Existing backlog features (move-to-sprint, create story, filter by epic/label/assignee, virtualized rendering) work unchanged on the new data source | ✓ SATISFIED (code) / ? NEEDS HUMAN (UX) | All feature wiring present in `BacklogPage.tsx` (ConfirmSprintMoveDialog, addIssuesToSprint/moveIssuesToBacklog, UnifiedFilterBar, useVirtualizer); BL-01/BL-02 fixes ensure correctness for closed-sprint edge cases. Runtime parity deferred. |

No orphaned requirements: ROADMAP Phase 74 declares GH-BACKLOG-01 and GH-BACKLOG-02 only. GH-CUT-01 is correctly attributed to 74-06 (cutover gate) and verified at the codebase level.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Legacy backlog symbols absent from production source | `npm run check:legacy-backlog` | exit 0, output "OK" | ✓ PASS |
| `useGhBacklogData` exported from `services/jira` barrel | `grep -nE "useGhBacklogData" src/services/jira.ts` | 1 match (re-export) | ✓ PASS |
| Single hook call in BacklogPage | `grep -cE "useGhBacklogData\(" src/routes/dashboard/BacklogPage.tsx` | 1 invocation | ✓ PASS |
| Sidebar prefetch single fetcher | `grep -cE "getGhBacklogData\(" src/components/app/Sidebar.tsx` | 1 invocation | ✓ PASS |
| `backlog.ts` trimmed to `fetchSprintList` only | `grep -nE "^export (async )?function" src/services/jira/backlog.ts` | 1 export (`fetchSprintList`) | ✓ PASS |
| Cache-key migration complete | `grep -rE "jira-backlog-issues\|jira-backlog-sprint-stories" src/ --include="*.ts" --include="*.tsx" \| grep -v test` | 0 production hits | ✓ PASS |

### Probe Execution

No phase-specific probe scripts under `scripts/*/tests/probe-*.sh` were declared in this phase's plans. The static-grep guard `npm run check:legacy-backlog` serves as the cutover probe and is reported in the spot-check table above (exit 0).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/routes/dashboard/SprintBoardTab.tsx` | 723 | `useExhaustiveDependencies` warning | ℹ️ Info | Pre-existing, deferred (out of phase scope) per 74-06 SUMMARY |
| `src/services/jira/greenhopper/transitions.ts` | 315 | `useExhaustiveDependencies` warning | ℹ️ Info | Pre-existing, deferred |
| `src/services/jira/greenhopper/useGhAllData.ts` | 48 | `useExhaustiveDependencies` warning | ℹ️ Info | Pre-existing, deferred |
| `src/services/jira/greenhopper/useGhBacklogData.ts` | 56 | `useExhaustiveDependencies` warning | ℹ️ Info | Intentional — comment documents `[jiraBaseUrl]` re-reads secret on instance change (WR-05) |

No TBD/FIXME/XXX debt markers in phase-modified files. No empty handlers, no hollow-prop stubs, no static `return []` fallbacks substituting for the data fetch.

### Human Verification Required

See frontmatter `human_verification` for the three items routed to HUMAN-UAT.md:

1. **Network-log confirmation of single `data.json` request (SC-1).** Only runtime DevTools inspection can satisfy the "verified in the network log" clause of SC-1.
2. **Backlog feature parity sweep (SC-2 / GH-BACKLOG-02).** Move-to-sprint dialog (with closed-sprint name resolution), move-to-backlog, create story, epic/assignee filters, virtualization.
3. **Mutation-driven cache invalidation freshness.** Confirm post-mutation UI reflects new state without manual reload across the five swapped sites.

### Gaps Summary

No code-side gaps. All three success criteria are satisfied at the source level:

- SC-1 (single `data.json` call): single hook + single endpoint, deleted legacy fan-out.
- SC-2 (feature parity): all feature surfaces wired on the new data source; BL-01/BL-02 closed-sprint correctness fixes applied pre-verification.
- SC-3 (old REST path deleted): four legacy symbols absent from production source; CI guard installed and green.

Both REVIEW BLOCKERs (BL-01 reverse-index restriction; BL-02 raw-sprints name resolution) are reflected in the current tree at the expected source locations. The full vitest suite reported 1656 passed at the last execution recorded in the 74-06 SUMMARY.

The only remaining verification work is the **runtime behavioral checks** that cannot be satisfied by grep/static inspection — routed to the human via the frontmatter above.

---

_Verified: 2026-05-29_
_Verifier: Claude (gsd-verifier)_
