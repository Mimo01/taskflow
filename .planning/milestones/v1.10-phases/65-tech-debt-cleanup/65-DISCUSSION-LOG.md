# Phase 65: Tech Debt Cleanup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 65-tech-debt-cleanup
**Areas discussed:** CLEAN-02 error/empty detection, CLEAN-07 AIO resilience approach, pending tauri-storage.ts fix

---

## CLEAN-02: Error/empty detection

| Option | Description | Selected |
|--------|-------------|----------|
| Show ErrorState always on error | `isError` alone — show ErrorState whenever request fails, regardless of cache | ✓ |
| Show error only if no data | `isError && (!data \|\| data.length === 0)` — preserves stale empty state silently | |
| Show both: error banner + empty state | Separate dismissible error strip + empty state together | |

**User's choice:** Show ErrorState always on error
**Notes:** Simplest, most honest. Bug was `isError && !data` — `![]` is false so errors after successful-empty fetch were silently swallowed.

---

## CLEAN-07: AIO resilience approach

### Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch from /config at startup | Call AIO /config endpoint when integration loads, merge into map. /config already exists in cycles.ts | ✓ |
| Settings override — user-editable ID map | UI field for custom ID→status mappings. More explicit but adds UI complexity | |
| Documented code constant | Comment above AIO_STATUS_MAP explaining how to add custom entries. Zero runtime complexity | |

**User's choice:** Fetch from /config at startup

### Map storage

| Option | Description | Selected |
|--------|-------------|----------|
| Module-level cache in aioUtils.ts | Fetch once, cache in module variable. normalizeStatusById reads it. No store changes | ✓ |
| Zustand AIO settings store | Persist fetched map across restarts. Requires store version bump | |
| Per-request, no cache | Fetch /config on every normalizeStatusById call | |

**User's choice:** Module-level cache in aioUtils.ts

### Init timing

| Option | Description | Selected |
|--------|-------------|----------|
| When AIO integration first activates | Call from AIO initialization path when credentials confirmed + integration enabled | ✓ |
| On first normalizeStatusById call (lazy) | Defer fetch until first call site needs it | |
| App startup, always | Run at boot regardless of AIO being enabled | |

**User's choice:** When AIO integration first activates

**Follow-up (free-text):** User clarified "I don't want a static map of statuses" — confirmed the intent is zero hardcoded entries. The current `AIO_STATUS_MAP` constant is removed entirely; map is built purely from the /config response at runtime. If /config is unavailable, map is empty and all IDs degrade to 'notRun'.

---

## Pending tauri-storage.ts fix

| Option | Description | Selected |
|--------|-------------|----------|
| Fold into phase 65 | Include as 8th cleanup item in phase plans | |
| Commit separately before phase 65 starts | Standalone commit now, then phase 65 proceeds clean | ✓ |
| Leave it — not phase 65's concern | Stay uncommitted; handle later | |

**User's choice:** Commit separately before phase 65 starts
**Notes:** Fix is a Zustand JSON stringify bug (createJSONStorage stores state as JSON-encoded string; previous code wrote a plain object, corrupting the store on next read).

---

## Claude's Discretion

- CLEAN-01: Standard `useEffect` cleanup for `closeTimer` — `return () => { if (closeTimer.current) clearTimeout(closeTimer.current); }`
- CLEAN-03: Add `key` props to unkeyed `<></>` fragments at WorklogsPage lines 1050/1129/~1240
- CLEAN-04: Move `DatePreset` type to `tempo/types.ts`, update 2 import sites
- CLEAN-05: Delete stale `workload` mock line from Sidebar.test.tsx:79
- CLEAN-06: Add `51: 'NOT_EXECUTED'` and `52: 'IN_PROGRESS'` to TESTCASE_STATUS_MAP in cycles.ts
- AIO init call site: planner identifies existing AIO initialization pathway

## Deferred Ideas

None — discussion stayed within phase scope.
