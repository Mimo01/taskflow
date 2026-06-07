---
phase: quick-260607-mhc
plan: 01
subsystem: ui
tags: [standup, react-query, jira, gitlab, effective-identity, watched-person]

requires:
  - phase: standup-notes (existing)
    provides: StandupNotesPage 2-column shell, four react-query data queries, TodayColumn MR/sprint queries
provides:
  - Pure resolveEffectiveIdentity(auth, watchedUser) helper + EffectiveIdentity/AuthIdentity types (unit-tested)
  - WatchedPersonPicker subtle header dropdown (server-side assignable-user search)
  - Effective-identity threading across StandupNotesPage queries + TodayColumn MR queries
  - "GitLab account not matched" hint when watching a teammate with no resolvable GitLab id
affects: [standup-notes]

tech-stack:
  added: []
  patterns:
    - "Effective-identity mapping: thread a single derived identity object through react-query keys so a person switch triggers a fresh fetch"
    - "Silent-fallback guard: watched person forces gitlabUserId/Username/Email=null so GitLab-keyed queries auto-disable instead of leaking my own data"

key-files:
  created:
    - taskflow/src/routes/standup-notes/effectiveIdentity.ts
    - taskflow/src/routes/standup-notes/effectiveIdentity.test.ts
    - taskflow/src/routes/standup-notes/WatchedPersonPicker.tsx
  modified:
    - taskflow/src/routes/standup-notes/StandupNotesPage.tsx
    - taskflow/src/routes/standup-notes/StandupPageHeader.tsx
    - taskflow/src/routes/standup-notes/TodayColumn.tsx
    - taskflow/src/routes/standup-notes/TodayColumn.test.tsx

key-decisions:
  - "Used the Popover primitive (not the base-ui Menu) for the picker because it hosts a text search input — a Menu hijacks typeahead/keyboard from the input. CONTEXT grants UI-detail discretion."
  - "Commits `enabled` guard widened to (id.gitlabUsername || id.gitlabName) so best-effort displayName commit matching runs for watched people (truth 3); a watched person has gitlabUsername=null but gitlabName=displayName."
  - "When watching an unmatched person, both reviewer/participating MR sections are hidden entirely (not just empty) so the empty UI never implies the MRs are mine."

patterns-established:
  - "resolveEffectiveIdentity: pure, unit-tested identity mapper — single source of the watched-person GitLab-id null guard"

requirements-completed: [STANDUP-WATCH-01]

duration: 8min
completed: 2026-06-07
---

# Quick 260607-mhc: Standup Watched-Person Picker Summary

**A subtle "Showing: <name>" header picker lets a user view any Jira teammate's full standup (Yesterday + Today) by threading a derived effective identity through the existing react-query keys, with a hard guard that GitLab-ID-keyed MR sections never fall back to the logged-in user's data.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-07T16:23Z (local)
- **Completed:** 2026-06-07T14:32:08Z
- **Tasks:** 3
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments
- Pure `resolveEffectiveIdentity` helper with the critical correctness guard (gitlabUserId/Username/Email forced null for any watched person), backed by 5 unit tests including an explicit non-inheritance assertion.
- `WatchedPersonPicker` — subtle, group-hover ChevronDown trigger; Popover-hosted debounced search using server-side `fetchAssignableUsers` (token read inside the queryFn, no client-side filtering); "Me" row + teammate rows.
- Effective identity threaded through all five StandupNotesPage queries (schedule/tempo/jira/commits/mr-events) plus the copy-markdown handler, and through TodayColumn's reviewer/participating MR queries + client-side sprint filter.
- Watched-but-unmatched state renders a muted "GitLab account not matched for {name} — MRs hidden" hint with both MR sections suppressed.
- Selection is transient React state (reset on every mount). The gitlabName/gitlabEmail self-heal backfill effect was deliberately left keyed on the auth store (heals my own profile, not the watched person's).

## Task Commits

1. **Task 1 (RED): failing tests for resolveEffectiveIdentity** - `47803cfc` (test)
2. **Task 1 (GREEN): effective-identity helper + WatchedPersonPicker** - `a050dce9` (feat)
3. **Task 2: thread effective identity through standup page + mount picker** - `39a7de22` (feat)
4. **Task 3: thread effective identity into TodayColumn + not-matched hint** - `ae20b96e` (feat)

_Task 1 followed TDD: RED (`47803cfc`, test fails — module missing) → GREEN (`a050dce9`, 5/5 pass)._

## Files Created/Modified
- `effectiveIdentity.ts` - Pure `resolveEffectiveIdentity(auth, watchedUser)` + `EffectiveIdentity`/`AuthIdentity` types; watched branch forces all GitLab fields to null.
- `effectiveIdentity.test.ts` - 5 unit tests (me-passthrough, Jira field mapping, key→null, critical GitLab-null guard, isWatched flag).
- `WatchedPersonPicker.tsx` - Subtle header dropdown; Popover + debounced server-side assignable-user search; Me + teammate rows.
- `StandupNotesPage.tsx` - watchedUser state, `resolveEffectiveIdentity` → `id.*` threaded through every query + copy-markdown; picker props passed to header; watched props passed to TodayColumn.
- `StandupPageHeader.tsx` - 5 new props; renders `<WatchedPersonPicker>` left of the sync-status/Refresh group.
- `TodayColumn.tsx` - 3 new props (watchedGitlabUserId/watchedDisplayName/isWatched); MR queries + sprint filter use them; not-matched hint; MR sections hidden when watching an unmatched person.
- `TodayColumn.test.tsx` - Updated all 5 render calls with the new required props.

## Decisions Made
- **Popover over Menu for the picker** — the picker hosts a search `Input`; the base-ui Menu primitive would intercept typeahead/keyboard. Mirrors the existing FieldsSection assignee popover (Input-in-Popover) pattern. CONTEXT allowed UI-detail discretion.
- **Commits enabled guard widened** — see Deviations (Rule 2).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Commits query `enabled` guard widened for watched people**
- **Found during:** Task 2 (threading identity through the commits query)
- **Issue:** The original commits `enabled` required `!!gitlabUsername`. A watched person has `id.gitlabUsername === null` (forced by the guard) but `id.gitlabName === displayName`, so the unmodified guard would have disabled commit matching entirely for watched people — defeating truth 3 (best-effort displayName commit matching).
- **Fix:** Changed the guard to `(!!id.gitlabUsername || !!id.gitlabName)`. `fetchUserCommits` already accepts an empty username plus a name for git-author matching.
- **Files modified:** taskflow/src/routes/standup-notes/StandupNotesPage.tsx
- **Verification:** `npm run check` clean; standup suite 70/70; logic matches plan truth 3.
- **Committed in:** `39a7de22` (Task 2 commit)

**2. [Rule 2 - Missing Critical] Hide MR sections (not just empty) when watching an unmatched person**
- **Found during:** Task 3
- **Issue:** Plan required the watched MR sections not render in a way that implies they belong to me. Leaving the sections mounted with their disabled-query empty state still reads as "my MRs are empty".
- **Fix:** Gated both `TodayMrsSection` and `TodayParticipatingSection` on `!showNotMatchedHint` in addition to `!!gitlabBaseUrl`, and surfaced the explicit "not matched" hint instead.
- **Files modified:** taskflow/src/routes/standup-notes/TodayColumn.tsx
- **Verification:** `npm run check` clean; standup suite 70/70.
- **Committed in:** `ae20b96e` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 2 - missing critical correctness)
**Impact on plan:** Both align directly with the plan's stated truths (truth 3 commit matching, truth 4 no-fallback). No scope creep.

## Issues Encountered
- **Worktree had no `taskflow/node_modules`** — the dev/test toolchain could not resolve (`@vitejs/plugin-react` missing). Symlinked `taskflow/node_modules` → the main checkout's `node_modules` (gitignored, untracked, not committed). Resolved; all gates ran.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None. The "not matched" hint is intentional UX (a watched person legitimately has no resolvable GitLab id), not a data stub.

## Next Phase Readiness
- Feature complete and fully gated (`npm run check` GREEN, 70/70 standup tests). Ready for live UAT: default load shows me; picker searches server-side; selecting a teammate refetches both columns; MR sections show the hint and no MRs; selecting "Me" / reload restores my data.

## Self-Check: PASSED

- All created files present (effectiveIdentity.ts, effectiveIdentity.test.ts, WatchedPersonPicker.tsx).
- All task commits present (47803cfc, a050dce9, 39a7de22, ae20b96e).
- `npm run check` GREEN (466 files); `vitest run src/routes/standup-notes/` 70/70.

---
*Phase: quick-260607-mhc*
*Completed: 2026-06-07*
