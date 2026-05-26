# Phase 65: Tech Debt Cleanup - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix 7 specific carried debt items across `WorklogsPage.tsx`, `cycles.ts`, `aioUtils.ts`, `Sidebar.test.tsx`, and `tempo-filters.store.ts`. Plus commit the pending `tauri-storage.ts` / `tauri-storage.test.ts` fix separately before phase work begins.

No new UI surfaces. No behavior changes visible to users except bug fixes (error state visibility, AIO in-progress status rendering).

Pre-condition: commit the pending `tauri-storage.ts` fix as a standalone commit before starting phase 65 work.

</domain>

<decisions>
## Implementation Decisions

### CLEAN-02: WorklogsPage error state condition
- **D-01:** Replace `isError && !data` with `isError` alone. Show `ErrorState` whenever a fetch fails, regardless of what's in React Query's cache. If a previous successful-empty result is cached, the error takes precedence and is shown. No separate error banner — replace the view entirely.

### CLEAN-07: AIO status map — fully dynamic
- **D-02:** Remove the hardcoded `AIO_STATUS_MAP` constant entirely. Do not keep a static seed map.
- **D-03:** When the AIO integration activates (credentials confirmed, AIO toggled on), call the existing `/config` endpoint (`GET /rest/aio-tcms/1.0/project/{jiraProjectId}/config`) and build the status map at runtime from the response.
- **D-04:** Cache the built map at module scope in `aioUtils.ts` (a module-level variable alongside where `AIO_STATUS_MAP` currently lives). `normalizeStatusById` reads the runtime map.
- **D-05:** If `/config` fails or is unavailable, the map is empty — all IDs fall back to `'notRun'` via the existing unknown-ID fallback in `normalizeStatusById`. No crash, no hardcoded entries.
- **D-06:** The existing `/config` fetch function in `cycles.ts` (line ~430) should be used or adapted as the source. Do not duplicate the HTTP call.

### Pending tauri-storage.ts fix
- **D-07:** The uncommitted changes to `taskflow/src/lib/tauri-storage.ts` and the new `taskflow/src/lib/tauri-storage.test.ts` must be committed as a standalone commit before phase 65 work begins. Phase 65 plans should NOT include this file — it's pre-committed prior state.

### Claude's Discretion
- CLEAN-01 (useEffect cleanup for closeTimer), CLEAN-03 (keyed fragments), CLEAN-04 (DatePreset move), CLEAN-05 (stale test mock removal), CLEAN-06 (TESTCASE_STATUS_MAP entries) — all clear-cut from requirements; no implementation choice needed beyond what REQUIREMENTS.md specifies.
- The AIO integration activation hook (where to call `initializeAioStatusMap`) should use whatever the existing AIO initialization pathway is — the planner should identify the call site.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Cleanup (CLEAN-01 through CLEAN-07) — exact acceptance criteria for each item including line numbers and target files

### Source files to modify
- `taskflow/src/routes/worklogs/WorklogsPage.tsx` — CLEAN-01 (line ~306 closeTimer), CLEAN-02 (line ~951 error condition), CLEAN-03 (lines 1050/1129/~1240 unkeyed fragments), CLEAN-04 (line 53 DatePreset export)
- `taskflow/src/services/aio/cycles.ts` — CLEAN-06 (line 335 TESTCASE_STATUS_MAP), CLEAN-07 (line ~430 /config fetch to reuse)
- `taskflow/src/lib/aioUtils.ts` — CLEAN-07 (remove hardcoded AIO_STATUS_MAP, add module-level cache + init function)
- `taskflow/src/services/tempo/types.ts` — CLEAN-04 (target location for DatePreset)
- `taskflow/src/stores/tempo-filters.store.ts` — CLEAN-04 (update import to types.ts)
- `taskflow/src/components/app/Sidebar.test.tsx` — CLEAN-05 (line 79 stale workload mock)
- `taskflow/src/lib/tauri-storage.ts` — pre-commit only; not a phase 65 plan item
- `taskflow/src/lib/tauri-storage.test.ts` — pre-commit only; not a phase 65 plan item

### Prior state reference
- `.planning/STATE.md` — notes verify with `npm run build` (not just `tsc`); react-grid-layout CSS imports fail silently in TypeScript

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `/config` fetch function in `cycles.ts:~430` — already implements the AIO HTTP call pattern; reuse or adapt for CLEAN-07 dynamic map initialization
- `normalizeStatusById` in `aioUtils.ts:70` — already has unknown-ID fallback to `'notRun'`; just needs to read the runtime map instead of the static constant
- `ErrorState` component at `taskflow/src/components/ui/error-state.tsx` — already imported in WorklogsPage; used in CLEAN-02

### Established Patterns
- AIO HTTP requests use Bearer PAT auth; base path is `aio-tcms-api/1.0` (confirmed in v1.8 probe, see STATE.md)
- Type moves follow: define in `services/*/types.ts`, import from there — stores must not import from route components
- Build verification: `npm run build` required to catch CSS/import issues that `tsc` misses

### Integration Points
- AIO integration activation path: researcher should identify where credentials are confirmed and integration is enabled — that's where `initializeAioStatusMap()` gets called
- `TESTCASE_STATUS_MAP` in `cycles.ts` is file-private (no export); `AIO_STATUS_MAP` in `aioUtils.ts` is exported — CLEAN-07 adds an exported init function alongside the existing export

</code_context>

<specifics>
## Specific Ideas

- CLEAN-07: The user explicitly does not want any static/hardcoded status entries. The final implementation should have zero hardcoded ID→status mappings; everything comes from the live `/config` response.
- The module-level cache in `aioUtils.ts` can be a `let` variable initialized to an empty `Record<number, string>` and populated by an exported `initializeAioStatusMap(jiraProjectId: string)` function.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 65-Tech Debt Cleanup*
*Context gathered: 2026-05-23*
