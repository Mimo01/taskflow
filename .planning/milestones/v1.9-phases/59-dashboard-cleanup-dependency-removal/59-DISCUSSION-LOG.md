# Phase 59: Dashboard Cleanup + Dependency Removal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 59-Dashboard Cleanup + Dependency Removal
**Areas discussed:** Dashboard placeholder, Cleanup breadth, Store migration

---

## Dashboard Placeholder

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal stub | Replace index.tsx with a bare-bones component: just a centered message or empty div. Compiles clean, no imports, no logic. Phase 60 replaces it entirely. | ✓ |
| Redirect to /tasks | Route /dashboard redirects to /tasks so the app stays usable. Phase 60 then swaps the redirect for the real page. | |
| Remove /dashboard route entirely | Drop the route from routes.tsx. Navigating to /dashboard falls through to not-found until Phase 60 adds it back. | |

**User's choice:** Minimal stub

---

### Dashboard Placeholder — stub content

| Option | Description | Selected |
|--------|-------------|----------|
| Truly empty — just a div | `export default function Dashboard() { return <div />; }` — compiles, routes, shows nothing. Phase 60 overwrites it. | ✓ |
| Placeholder text | A centered 'Dashboard coming soon' message so it's obvious the route works but content is pending. | |
| You decide | Claude picks the approach that makes Phase 60 easiest to implement. | |

**User's choice:** Truly empty — just a div
**Notes:** No placeholder text; Phase 60 follows immediately.

---

## Cleanup Breadth

### WikiRenderer.tsx and DiscussionThreads.tsx entries

| Option | Description | Selected |
|--------|-------------|----------|
| Clean them in Phase 59 | Remove the '/workload' lookup entries now alongside the route/sidebar cleanup. Phase 59 is already touching these files' siblings — cleaner to do it all at once. | ✓ |
| Defer to Phase 63 | QUAL-02 covers dead code sweep. WikiRenderer/DiscussionThreads lookups are benign stale entries — defer to the cleanup pass. | |

**User's choice:** Clean in Phase 59

---

### main.tsx pathname branch

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 59 — clean it now | It's a dead branch once the route is gone. Remove it with the rest of the workload cleanup. | ✓ |
| Phase 63 — defer | It's harmless dead code. The dead code sweep will catch it. | |

**User's choice:** Phase 59 — clean it now

---

## Store Migration

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit delete in migration | Add v19 migration guard: `delete (persisted as any).dashboardLayout` — clean state, no ghost key sitting in Tauri Store indefinitely. | |
| Implicit drop | Zustand strips extra keys naturally when the store shape no longer includes the field. No explicit migration needed — simpler code, same runtime behavior. | |
| You decide | Claude picks the approach consistent with how prior migrations were done. | ✓ |

**User's choice:** You decide (Claude's discretion)

---

## Claude's Discretion

- **Store migration approach:** Implicit drop — bump to v19 with no explicit `delete dashboardLayout` in migration body. All 18 prior migrations only add fields, never delete. Zustand's LazyStore ignores extra persisted keys. A bare version bump guard is sufficient.

## Deferred Ideas

None — discussion stayed within phase scope.
