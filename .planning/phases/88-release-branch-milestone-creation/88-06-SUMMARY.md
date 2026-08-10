---
phase: 88-release-branch-milestone-creation
plan: 06
subsystem: ui
tags: [react-query, gitlab, release-detail, write-path, milestone]

# Dependency graph
requires:
  - phase: 88-release-branch-milestone-creation
    provides: "Plan 88-01's releaseMilestone.ts pure helpers; Plan 88-02's gitlab.ts createMilestone; Plan 88-05's CreateBranchDialog/createBranchMutation/dialog-state precedent"
provides:
  - "CreateMilestoneDialog.tsx: presentational confirm dialog with format enforcement, read-only reference list, client-side duplicate blocking, and in-dialog server-error rendering"
  - "useReleaseDetail.ts: non-optimistic createMilestoneMutation sending title+due_date, invalidating the existing windowed gitlab-milestones key plus gitlab-branch prefix"
  - "ReleaseDetailSidebar.tsx: Create milestone action on the GitLab Milestone row's no-match state, gated on release date"
  - "ReleaseDetailPage.tsx: dialog open-state ownership, closes only on mutation success (D-15/D-16)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Duplicate-error precedence over format-error in the same validation slot, so a whitespace-variant duplicate is still caught even though the extra whitespace also fails the strict format regex (see Deviations)"
    - "MilestoneReferenceItem extends MilestoneLike with an optional due_date for reference-list sort, keeping releaseMilestone.ts free of a GitLabMilestone import while still allowing newest-first ordering of real milestone objects"

key-files:
  created:
    - taskflow/src/routes/dashboard/release-detail/CreateMilestoneDialog.tsx
    - taskflow/src/routes/dashboard/release-detail/CreateMilestoneDialog.test.tsx
  modified:
    - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts
    - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx
    - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx

key-decisions:
  - "D-15 held: createMilestoneMutation has no onMutate/optimistic write/rollback/toast; invalidates ['gitlab-milestones', activeGitlabProject, from, to] (byte-identical to the read query) plus ['gitlab-branch', activeGitlabProject] on success only"
  - "D-16 held: dialog closes ONLY inside the mutate() onSuccess callback; a failed mutation leaves the dialog open with the raw Error message rendered inline"
  - "D-04 held: mutationFn throws before calling createMilestone if version.releaseDate is absent; the write body carries only {title, due_date}, no description"
  - "D-05 held: no new milestone fetch introduced; the dialog's reference list is ownWindowMilestones, already computed by the hook from the existing windowed gitlab-milestones query"
  - "Duplicate-message precedence: when a title both fails strict format AND normalizes to a duplicate (e.g. extra internal whitespace), the duplicate message renders instead of the format message, so RELMS-04's whitespace-variant duplicate case is still visibly caught even though the same input also technically fails the anchored format regex"

patterns-established: []

requirements-completed: [RELMS-02, RELMS-03, RELMS-04]

# Metrics
duration: ~45min
completed: 2026-08-10
---

# Phase 88 Plan 06: Create GitLab Milestone Action Summary

**Added the create-GitLab-milestone write path — CreateMilestoneDialog (format enforcement + read-only reference list + duplicate blocking + in-dialog server error), a non-optimistic createMilestoneMutation, and sidebar Create-action wiring — but the plan's blocking live-GitLab checkpoint (Task 3) was reached and has NOT been performed or waived; it is presented here awaiting the developer's response.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-08-10T19:46:00Z
- **Completed:** 2026-08-10T20:53:00Z (2 auto tasks; checkpoint task not yet resolved)
- **Tasks:** 2 auto (committed) + 1 checkpoint (awaiting developer response)
- **Files modified:** 6 (2 new, 4 modified)

## Accomplishments
- `CreateMilestoneDialog.tsx` — presentational dialog copied from `BoardResolutionDialog`'s structure with the UI-SPEC-locked copy (`Create GitLab milestone` / `Recent milestones` / `Format: X.Y.Z (DD.MM.YYYY)` / `Cancel` / `Create milestone` / `Creating…`); prefills the title's date component from the Jira release date via `buildMilestoneTitle('', releaseDate)`; format validation via `isValidMilestoneTitle` (imported, never re-declared); client-side duplicate blocking via `findDuplicateMilestone` with normalized comparison and exact-typed title passthrough to `onConfirm`; read-only `Recent milestones` list sorted newest-first by `due_date`; in-dialog server-error rendering independent of the two client-side checks (D-08/D-16). Zero `useQuery`/`useMutation`/`readSecret`/`useAuthStore` calls (D-21). 8 tests covering every `<behavior>` case.
- `useReleaseDetail.ts` — `createMilestoneMutation` follows `createBranchMutation`'s non-optimistic shape via `createMilestone(baseUrl, token, projectId, { title, due_date })`; `due_date` is always the fetched Jira `version.releaseDate` (mutationFn throws before the write if absent, per D-04's "a dateless milestone would render as unmatched" rationale); `onSuccess` invalidates the exact existing `['gitlab-milestones', activeGitlabProject, milestoneWindow?.from, milestoneWindow?.to]` key (D-05 — no parallel milestone key introduced) plus `['gitlab-branch', activeGitlabProject]` so the branch row re-resolves once the new milestone changes the date-match; no `onMutate`, no optimistic write, no toast (D-15).
- `ReleaseDetailSidebar.tsx` — the GitLab Milestone row's `gitlabMatch.type === 'none'` branch now renders a `Create milestone` ghost button next to the existing "No milestone matched" text, disabled with title `Set a release date on this version first` when the version has no release date.
- `ReleaseDetailPage.tsx` — owns `createMilestoneOpen` dialog state; `onCreateMilestone` resets the mutation before opening (clears any stale error from a prior attempt); supplies `ownWindowMilestones` (the hook's already-computed ancestor-filtered windowed list) as the dialog's reference list — no new fetch; `onConfirm` calls `mutate(title, { onSuccess: () => setCreateMilestoneOpen(false) })` so the dialog closes only on success.
- Full `taskflow` suite (2185 tests, 2 skipped) passes; `tsc --noEmit` clean; `npm run check` at the documented 2-error `BacklogPage.tsx`/`BacklogRow.tsx` baseline — no new errors.

## Task Commits

Each auto task was committed atomically:

1. **Task 88-06-T1: CreateMilestoneDialog with format enforcement, reference list, and duplicate blocking** - `9c07a975` (feat)
2. **Task 88-06-T2: createMilestone mutation + sidebar Create action + page wiring** - `0e318a05` (feat)

Task 88-06-T3 (checkpoint) has no commit — see "Checkpoint Reached — Not Yet Resolved" below.

## Files Created/Modified
- `taskflow/src/routes/dashboard/release-detail/CreateMilestoneDialog.tsx` - New: props-driven confirm dialog (`open`, `onOpenChange`, `releaseDate`, `recentMilestones`, `activeGitlabProject`, `onConfirm`, `isPending`, `errorMessage`)
- `taskflow/src/routes/dashboard/release-detail/CreateMilestoneDialog.test.tsx` - New: 8 tests (prefill, reference-list ordering, format error, valid-enables, duplicate-blocks, server-error, pending, exact-title-passthrough)
- `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` - Added `createMilestone` import, `createMilestoneMutation`, added to the `as const` return object
- `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx` - Added `onCreateMilestone`/`canCreateMilestone` props, `Create milestone` button in the no-match branch of the GitLab Milestone `MetaRow`
- `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx` - Updated `renderSidebar` helper with the two new required props
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` - Added `CreateMilestoneDialog` import, `createMilestoneOpen` state, destructured `createMilestoneMutation`/`ownWindowMilestones`, wired dialog render + sidebar props

## Decisions Made
- When a typed title both fails the strict `X.Y.Z (DD.MM.YYYY)` format AND normalizes to a duplicate (the plan's own human-verify Step 4 scenario: "add stray whitespace inside the title and confirm the duplicate is STILL detected"), the component shows the duplicate message rather than the format message. An anchored format regex with a single required space cannot itself match a whitespace-padded duplicate, so without this precedence rule the duplicate detection would be invisible exactly in the scenario the plan explicitly requires it to work in.
- `MilestoneReferenceItem` (a local type extending `MilestoneLike` with an optional `due_date`) is used for the dialog's `recentMilestones` prop instead of the plan's literal `MilestoneLike[]` text, because `MilestoneLike` (deliberately, per Plan 88-01) carries no `due_date` field and the plan's own action text requires "Sort newest-first by `due_date` descending". Real `GitLabMilestone` objects (what `ownWindowMilestones` actually contains at runtime) always carry `due_date`, so this is a type-level widening only — no behavior or props-shape change from what Plan 88-01/88-02 already produce.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reworded two docstring/comment passages that tripped false-positive acceptance-criteria greps**
- **Found during:** Task 1 and Task 2 verification
- **Issue:** `CreateMilestoneDialog.tsx`'s file-header docstring mentioned "no useQuery/useMutation/readSecret", which made `grep -c "useQuery\|useMutation\|readSecret\|useAuthStore"` return 1 instead of the required 0; the docstring also mentioned "Recent milestones" a second time (docstring reference + the actual JSX label), making `grep -c "Recent milestones"` return 2. `useReleaseDetail.ts`'s explanatory comment above the mutation used the words "toast" and "description" in prose describing what the mutation does NOT do, tripping `grep -c "onMutate\|toast"` (returned 1) and the informational "no description in the same hunk" check.
- **Fix:** Reworded the `CreateMilestoneDialog.tsx` docstring to avoid the literal hook-name substrings (kept the intent: "no data fetching or credential/mutation hooks of its own"). The "Recent milestones" double-count is NOT fixable the same way — see item 2 below, it is a genuine locked-copy conflict, not a comment artifact. Reworded the `useReleaseDetail.ts` comment to avoid the literal words "toast" and "description" while preserving the same meaning ("no success notice"; "carries only title and due_date").
- **Files modified:** `CreateMilestoneDialog.tsx`, `useReleaseDetail.ts`
- **Verification:** All affected greps re-run individually and confirmed to return their exact expected values (0 for the hook-names/onMutate-toast checks); full suite and `tsc --noEmit` still green.
- **Committed in:** `9c07a975` (Task 1), `0e318a05` (Task 2)

**2. [Rule 1 - Bug] Documented, non-fixable acceptance-criteria conflict: "Recent milestones" appears twice by design**
- **Found during:** Task 1 verification
- **Issue:** The plan's own locked copywriting contract requires the exact substring "Recent milestones" to appear in TWO separate required strings: the `DialogDescription` (`"...Recent milestones are listed below for reference."`) and the reference-list label (`"Recent milestones"`). `grep -c "Recent milestones" CreateMilestoneDialog.tsx` therefore returns `2`, not the plan's stated acceptance criterion of `1`. This is the same class of conflict documented in Plan 88-05's Deviation #2 (`grep -c "Create branch"` there had an analogous locked-copy-vs-grep-count tension).
- **Fix:** Kept both locked strings verbatim (neither is paraphrased) since the UI-SPEC copywriting contract takes precedence over a grep count that the plan itself made structurally impossible to satisfy at exactly 1 while also satisfying the two required copy strings.
- **Files modified:** None (no code change — the two locked strings are both required as literally specified)
- **Verification:** Both `DialogDescription` text and the reference-list label are verbatim, exact matches to the plan's `<action>` text; `npm run test` confirms both render correctly.
- **Committed in:** `9c07a975` (Task 1)

**3. [Rule 1 - Bug] Duplicate-message precedence over format-message for whitespace-variant duplicates**
- **Found during:** Task 1 test-writing, cross-checked against the plan's own checkpoint Step 4
- **Issue:** A literal reading of the plan's validation-state bullets (format check, then separately duplicate check) does not specify precedence when both conditions are true simultaneously. Since `MILESTONE_TITLE_FORMAT_RE` is anchored with a single required space, ANY whitespace-variant duplicate (the exact scenario in the plan's own checkpoint Step 4: "add stray whitespace inside the title and confirm the duplicate is STILL detected") also fails the strict format check. Showing the format message instead of the duplicate message in this case would silently fail the plan's own required verification step.
- **Fix:** Duplicate detection takes rendering precedence: if `findDuplicateMilestone` finds a match, the duplicate message renders regardless of format validity; the format message only renders when there is no duplicate match. The submit button remains disabled in both cases (`isPending || !formatValid || duplicate !== null`), so no behavior change to submission — only which message displays.
- **Files modified:** `CreateMilestoneDialog.tsx`
- **Verification:** Test `blocks a normalized-duplicate title and shows the duplicate message (RELMS-04)` uses a double-space duplicate variant and asserts the duplicate message (not the format message) renders; button asserted disabled.
- **Committed in:** `9c07a975` (Task 1)

---

**Total deviations:** 3 (2 auto-fixed comment rewordings, 1 documented-but-not-fixable grep conflict, 1 precedence decision to satisfy the plan's own checkpoint scenario)
**Impact on plan:** All deviations are wording/precedence-only — no scope creep, no behavior change beyond making the plan's own Step 4 verification scenario actually work as specified.

## Checkpoint Reached — Not Yet Resolved

**Task 88-06-T3 ("Verify live milestone creation, duplicate blocking, and the milestone→branch unblock chain") has been reached but NOT performed and NOT waived.**

Per the plan's `<checkpoint_protocol>` and this execution's explicit instruction, the checkpoint has NOT been self-approved, and no live write has been attempted against the real GitLab instance. This differs from Plan 88-05's outcome (where the equivalent checkpoint WAS explicitly waived by the user with "I do not have any release to test it on, consider it approved") — that outcome has NOT been re-confirmed for this plan and must not be assumed.

**What this means concretely:**
- No live write was made against a real GitLab instance. The POST to `/projects/:id/milestones` has never actually fired outside of mocked-`apiFetch` unit tests (Plan 88-02).
- None of the 9 manual verification steps in the plan's `<how-to-verify>` block have been run.
- The following behaviors are therefore **unverified in practice** (covered only by automated tests with mocked fetch responses):
  1. **The actual GitLab POST succeeding** — `createMilestone`'s request shape, headers, and response parsing have only been exercised against `gitlab.test.ts`'s mocked fixtures (Plan 88-02), never a live server.
  2. **The created milestone carrying the exact typed title AND a `due_date` equal to the Jira release date** — unit-tested with a mocked response; never confirmed against a real GitLab project.
  3. **D-08/D-16 server-error rendering with a REAL GitLab rejection body** (e.g. an actual "Title has already been taken" 400 for a milestone dated outside the ±7-day client-visible window) — the dialog's error display is tested with a synthetic `errorMessage` prop only.
  4. **D-05 cache invalidation flipping the sidebar's GitLab Milestone row from unmatched to matched, and the branch row from `Create the milestone first` to an actionable state** — the mutation's `onSuccess` invalidation is implemented and grep-verified in source, but the resulting UI flip (the D-10 unblock chain) has never been observed against live server state.
  5. **The Releases list's missing-milestone warning icon clearing** for the affected row after creation.

**Recommendation for follow-up:** The next time a release exists with a release date and no matched milestone, run the 9-step verification from `88-06-PLAN.md`'s checkpoint (Task 88-06-T3) before relying on this write path in a real workflow. This gap should surface in `/gsd-progress` and `/gsd-audit-uat` rather than being treated as closed. This carries forward the same class of gap already flagged in Plan 88-05's SUMMARY for the create-branch write path — BOTH v1.14 GitLab writes (`createBranch`, `createMilestone`) remain live-unverified as of this plan.

## Issues Encountered
- Worktree had no `node_modules`; symlinked `taskflow/node_modules` to the main checkout's install (same workaround as Plans 88-01/88-02/88-03/88-05). Not committed (gitignored).
- Worktree branch initially pointed at a newer `main` commit (`ca59303f`, tracking-doc update) rather than the expected `88-05` base (`3ef9edfa`); the mandatory pre-flight base-drift check caught this and `git reset --hard` corrected it before any file was touched (working tree was clean, so this was safe).

## User Setup Required

None for the code itself. **Live-GitLab verification of this plan's write path remains outstanding** — see "Checkpoint Reached — Not Yet Resolved" above. The developer must run the 88-06-PLAN.md Task 88-06-T3 `<how-to-verify>` steps (or explicitly waive them) before this write path is considered production-verified.

## Next Phase Readiness
- The create-milestone write path is code-complete and unit-tested (8 dialog tests + the existing 17 `gitlab.test.ts` `createMilestone` cases from Plan 88-02) but has zero live-GitLab confirmation.
- Both v1.14 GitLab-write features shipped so far (create branch — Plan 88-05; create milestone — this plan) share the same unresolved live-verification gap. A combined live-verification pass covering both `88-05-PLAN.md`'s and `88-06-PLAN.md`'s checkpoints, run together against one real release, would be more efficient than resolving them separately.
- No code blockers for subsequent phases (89-91); this plan's files (`useReleaseDetail.ts`, `ReleaseDetailSidebar.tsx`, `ReleaseDetailPage.tsx`) are otherwise unchanged in structure from Plan 88-05's shape.

---
*Phase: 88-release-branch-milestone-creation*
*Completed: 2026-08-10*
