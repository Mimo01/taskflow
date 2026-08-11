# Phase 90: Per-MR Corrective Actions - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning

<domain>
## Phase Boundary

The `MrDriftSection` rows built in Phase 89 gain **two write actions**, attached to the BR and MS drift cells: retarget an MR to the release branch (`target_branch`) and assign the release milestone (`milestone_id`). Each applies immediately with no confirm dialog and no warning, shows its own per-cell status, and is retryable independently of the other.

**In scope:** the GitLab MR-update service call, the two mutations in `useReleaseDetail.ts`, the hover-revealed per-cell control in `MrDriftSection.tsx`, per-(MR × action) pending/error state, optimistic cache update with rollback, sort-freeze on the row list, header-count decrement, cache invalidation of the three channel queries, and the unavailable-state rendering for a missing release branch.

**Out of scope:** any third corrective action (P89 D-11 — keyless MRs get **no** action, and the planner must not invent one); merge-back verification (Phase 91); branch/milestone creation (Phase 88, done); a "fix all" / bulk affordance (explicitly excluded by the milestone goal); permission gating (team is all Developer+; a 403 surfaces as a normal `ApiError`); any change to the drift predicates, the union, the row anatomy, or the Issues table.

**Not present, do not build for it:** there is **no Releases-list aggregate drift count**. DRIFT-09 was built in Phase 89 then removed at UAT (`c681931e`); `ReleasesTab.tsx` has no project-wide open-MR query. Nothing in this phase propagates cross-page.

</domain>

<decisions>
## Implementation Decisions

### Action affordance

- **D-01 (user):** The control is **hover-revealed inside the existing 28px drift cell**. No trailing button column, no permanent extra row width — P89 D-04 (compact and easily readable) and D-08's already-pressured title are unchanged by this phase. The cell's own glyph is what swaps; nothing is added beside it.
- **D-02 (user):** **Row hover reveals, cell hover emphasizes.** Hovering anywhere on the row swaps *every* actionable cell on that row from `⚠` to its action icon at once; the specific cell under the pointer additionally gets a background/ring. Row-level reveal makes the actions discoverable; cell-level emphasis makes a 28px target aimable.
- **D-03 (Claude's discretion):** **Distinct icon per action** — `GitBranch` in the BR cell, `Milestone` in the MS cell (both lucide, both already in the app's vocabulary). Each carries a tooltip naming the exact change: `Retarget to release/33.7.0`, `Assign milestone 33.7.0`. Column position plus icon plus tooltip; no generic wrench.
- **D-04 (Claude's discretion):** The control is **focus-reachable**. It must be a real `<button>` to be clickable at all, so `:focus-visible` shares the same reveal rule as row-hover — one extra selector. Tab order within a row: `!iid` → Jira key → title keys → BR fix → MS fix.
- **D-05:** Only a **flagged** (`⚠`) cell is actionable. `ok` (`✓`) and `na` (`—`) cells are inert — there is no "change it anyway" affordance. The TASK column is **never** actionable (P89 D-11).

### Pending, failure, and retry

- **D-06 (user):** In flight, the cell shows a **`Loader2` spinner**, resolving to `✓` when the server settles. Note the deliberate nuance vs. MRFIX-01/02's "optimistic": the *cache* write is still optimistic-with-rollback, but the **cell glyph is pessimistic** — it does not claim `✓` until the PUT returns. The user chose visible in-flight feedback over an instant checkmark. Downstream agents must not "correct" this to an immediate optimistic `✓`.
- **D-07 (Claude's discretion):** On failure the cell renders **`⚠` in red** (vs. the normal orange) and its tooltip carries the GitLab error message. **Clicking again retries.** Nothing is rendered outside the row — no error line beneath, no summary above, no toast. Chosen because it is the only option that keeps a failure from reflowing the list (P89 D-04) and keeps the message at its anchor.
- **D-08 (Claude's discretion):** **Failure state is sticky and local.** It lives in component state keyed by `(mr.id, action)`, *not* in the query cache, so a background refetch (5min staleTime / window refocus) cannot wipe it — the same class of problem as the P78 drag flicker gate. It clears only on a successful retry. **No auto-expiry timer** (avoids the IN-01 uncleared-`setTimeout` hazard).
- **D-09 (Claude's discretion):** **Per-cell locking, not per-row.** While one action is in flight, that cell ignores further clicks (so a double-click cannot double-fire) but the other cell on the same row stays live and may fire concurrently. The two PUTs send **disjoint fields**, so they do not clobber each other. This is the truest reading of MRFIX-03's "independent"; no per-row queue is to be built.
- **D-10 (hard, carried from 88-REVIEW.md WR-01):** GitLab's validation-error body is **object-keyed** (e.g. `{"message":{"target_branch":["can't be blank"]}}`) and the existing code renders it as `[object Object]` in both P88 create dialogs. D-07 puts that string straight into a tooltip. This phase **must** ship a real message extractor that flattens the object-keyed form, or the failure affordance is worthless. This is the one place the carried-forward WR-01 becomes blocking.

### Post-success behavior

- **D-11 (Claude's discretion):** **The sort freezes.** Row order (P89 D-03: flagged-first) is captured on load and held for the life of the mounted list; a fixed row turns `✓` **in place** and does not jump to the clean partition. Re-sorts on next mount/navigation. Rationale: wrong-branch and missing-milestone co-occur constantly, so a live re-sort would move the row out from under the pointer between the user's two fixes. Implementation is a held-order ref, the P78 drag-gate pattern.
- **D-12 (Claude's discretion):** The `MR Drift` **header badge decrements immediately** on success — it is derived from the same rows, so it follows the optimistic cache update.
- **D-13 (Claude's discretion):** On success, invalidate **all three channel queries at project granularity** — `['gitlab-all-project-mrs', projectId]`, `['gitlab-milestone-mrs', projectId]`, `['gitlab-branch-mrs', projectId]`. Both writes change channel membership (a retargeted MR newly qualifies for Channel C; a milestone-assigned MR newly qualifies for Channel B), so a narrower invalidation leaves provenance stale. Invalidate **by project, never by the windowed key** — the CR-02 lesson at `useReleaseDetail.ts:237-246`. There is **no cross-page invalidation** to fire (see `<domain>`).

### Unavailable states

- **D-14 (Claude's discretion, satisfies MRFIX-04):** When the release branch does not exist, the BR cell **stays flagged `⚠` and becomes inert** — no icon swaps in on hover, and the tooltip explains the blocker and points at the P88 create-branch control already on the page. Rejected: abstaining to `—` (hides a real problem and shrinks the drift count exactly when the release is least ready) and a visibly-disabled control (a dead affordance that can never fire in this state).
- **D-15 (locked upstream by P89 D-18):** With **no matched milestone**, BR and MS both already render `—` under the degraded banner. No actions exist there and none are to be added.

### The approval-reset side effect

- **D-16 (user, hard):** The roadmap probe asks whether MR-approval / protected-branch rules are actually configured on the team's project, making retarget's documented approval-reset a real consequence. **The answer does not change the UI either way.** No confirm dialog, no warning, no tooltip line — the no-dialog decision stands regardless of probe outcome. A positive probe result is a **fact to record in the phase docs**, not a dialog to add. Downstream agents must not reintroduce friction on retarget citing probe evidence.

### Claude's Discretion

The user delegated **D-03, D-04, D-07, D-08, D-09, D-11, D-12, D-13, D-14** explicitly ("you decide"). All are recorded calls and **locked for downstream agents**, not open questions to re-ask. The planner may adjust implementation detail where evidence contradicts a call, but must record the deviation.

**D-01, D-02, D-06, D-16 are user decisions and are hard.** D-06 in particular reads *against* the literal "optimistic update" wording of MRFIX-01/02 at the glyph level — do not "fix" the cell back to an instant `✓`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase / milestone context
- `.planning/ROADMAP.md` §Phase 90 — goal, the four success criteria, and the **probe**: verify via a live MR with approvals whether MR-approval / protected-branch rules are actually configured on the team's project. Read with **D-16** in hand — the probe's outcome is documentation, not a UI change.
- `.planning/REQUIREMENTS.md` — MRFIX-01…04. Read with **D-06** in hand: "optimistic update" governs the cache, not the cell glyph.
- `.planning/phases/89-three-channel-drift-detection/89-CONTEXT.md` — **D-03** (flagged-first sort, the thing D-11 freezes), **D-04** (compact and readable — governs D-01), **D-07** (the three 28px BR/MS/TASK cells this phase attaches to), **D-10** (merged/closed never evaluated ⇒ never actionable), **D-11** (keyless MRs flagged with **no** corrective action — hard), **D-18** (degraded no-milestone state ⇒ D-15), **D-20** (flex rows, explicit px on narrow cells — the control must not break this)
- `.planning/phases/88-release-branch-milestone-creation/88-CONTEXT.md` — **D-09** (branch name derivation), **D-10** (no milestone ⇒ no derivable branch)
- `.planning/phases/88-release-branch-milestone-creation/88-REVIEW.md` — **WR-01**, the open `[object Object]` error-body defect that **D-10 makes blocking here**
- `.planning/phases/87-release-detail-decomposition/87-CONTEXT.md` — D-07 single hook, D-08 presentational sections, D-12a `apiFetch`
- `.planning/PROJECT.md` §Current Milestone — v1.14 goal; the "no fix all", "no confirm dialog" framing originates here

### Code this phase extends
- `taskflow/src/routes/dashboard/release-detail/MrDriftSection.tsx` — `DriftMarkCell` (L54) is the exact component that becomes conditionally interactive; the header row (L128-149) and the row body (L162-250) are otherwise untouched. Section stays **presentational and props-driven** (P87 D-08): the actions arrive as props.
- `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` — the two new mutations land here. **Model them on `createBranchMutation` (L215) and `createMilestoneMutation` (L268)** — the P88 mutation + invalidation shape already in this file. The three channel query keys to invalidate are at **L352** (`gitlab-all-project-mrs`), **L367** (`gitlab-milestone-mrs`), **L385** (`gitlab-branch-mrs`). Note the CR-02 project-granularity comment at L237-246.
- `taskflow/src/services/gitlab.ts` — **no MR-update function exists**; `PUT /api/v4/projects/:id/merge_requests/:iid` is entirely new. **Model it on `updateMilestone` (L997)** — the `apiFetch` + throw-on-`!ok` + 401/403→`ApiError` + error-body-message shape. That function's `body?.message ?? status` line is precisely the WR-01 defect D-10 must fix.
- `taskflow/src/routes/dashboard/release-detail/driftDetection.ts` — `DriftRow` (L45) already carries `mr`, `br`, `ms`, `flagged`; `countFlaggedMRs` (L291) is what D-12's badge reads. **No predicate changes in this phase.**

### Consumers that must not regress
- `taskflow/src/routes/dashboard/release-detail/MrDriftSection.test.tsx` — asserts the `drift-row` / `drift-br` / `drift-ms` / `drift-task` testids and the `⚠`/`✓`/`—` glyphs
- `taskflow/src/routes/dashboard/release-detail/driftDetection.test.ts`, `useReleaseDetail.test.tsx`

No external ADRs or design specs exist for this phase.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`DriftMarkCell` (`MrDriftSection.tsx:54`)** — already a 28px `flex-none` cell with a `title` tooltip and three glyph states. Adding a fourth/fifth state (`pending`, `error`) and an optional `onClick` is a local change, not a rewrite.
- **`createBranchMutation` / `createMilestoneMutation` (`useReleaseDetail.ts:215, 268`)** — the established P88 mutation shape in this exact file: `useMutation` + `onSuccess` invalidations at project granularity. Copy the shape.
- **`updateMilestone` (`gitlab.ts:997`)** — the only existing GitLab write with a PUT + JSON body + structured error handling. The new `updateMergeRequest` is this with a different URL and body.
- **`statusPillClass` / `Badge`** — already used in the row; note the memory-recorded caveat that `min-w`/`text-center` collapse on a bare inline span.

### Established Patterns
- All GitLab calls go through `apiFetch('gitlab', …)` — 15s timeout, disconnect-marking on 401, redacted devtools instrumentation. Raw `fetch` is a defect.
- Optimistic-write precedent app-wide is **`StatusPopover`** (`onMutate` snapshot → `setQueryData` → `onError` rollback → `onSettled` invalidate), described in PROJECT.md Key Decisions as "loading feedback and error recovery without toast/modal clutter" — the exact ethos D-07 follows.
- Invalidate at **project granularity**, never a windowed key (CR-02, `useReleaseDetail.ts:237-246`).
- Never `?? 0` a project id into a URL (WR-10, `useReleaseDetail.ts:196`) — throw instead.
- React Compiler is on: no manual `useMemo`/`useCallback`/`React.memo`. **D-11's held sort order must therefore be a `useRef`/state snapshot, not a memo** — a memo is not a stability guarantee under the compiler.
- Quality gate is `npm run check`. **Baseline is 2 pre-existing biome formatting errors** in `BacklogPage.tsx`/`BacklogRow.tsx`, not a clean run. Gate on zero *new* errors; do not fix the Backlog files here.
- Narrow columns collapse to 0 in this codebase's WebKit/Tauri webview — the 28px cells keep their explicit px sizing when they become buttons (P89 D-20).

### Integration Points
- `useReleaseDetail` already resolves every input both writes need: `matchedMilestone` (→ `milestone_id`), `releaseBranchName` (→ `target_branch`), `activeGitlabProject`, `gitlabToken`, plus the branch-existence signal behind D-14.
- `DriftRow.mr.iid` + `mr.project_id` are the write targets; `GitLabMR` already declares `target_branch`, `draft`, and `milestone: {id,title}|null` (P89 probe-confirmed present on the *list* endpoint) — **no type work is required** for the optimistic cache patch.
- The optimistic patch is a field-level edit on cached `GitLabMR` objects across up to three query caches; the row list re-derives from them via `buildDriftRows`.

### Gaps this phase must fill
- **No MR-update service function** anywhere in `gitlab.ts`.
- **No structured GitLab error-message extractor** — WR-01's `[object Object]` (see D-10).
- **No per-cell interaction/pending/error state model** — `MrDriftSection` is currently fully stateless.
- **No held-sort-order mechanism** — the list currently re-derives order on every render.

</code_context>

<specifics>
## Specific Ideas

- The user answered "you decide" on nine of thirteen questions, having given firm answers on the four that change what they will actually see: the affordance being **hover-revealed inside the cell** (not a button column), the **row-hover-reveals / cell-hover-emphasizes** split, the **spinner before the checkmark**, and **no warning on retarget regardless of the probe**. Treat the delegated calls as settled; do not re-open them.
- The **spinner choice (D-06) is the one place the user preferred honesty over the requirement's literal "optimistic"**. They wanted to see that something was happening. The cache write stays optimistic; only the glyph waits.
- **"No warning" survived a direct challenge.** D-16 was asked as a leading question — "if approvals really do reset, does that change your mind?" — with a confirm-dialog option on the table. The user held the line. This is a reaffirmed decision, not an unexamined default.
- P89 built the three 28px columns **explicitly so this phase could attach a control per cell without a redesign** (89-CONTEXT `<deferred>`). D-01 collects on that: the phase adds zero row width.

</specifics>

<deferred>
## Deferred Ideas

- **A corrective action for keyless MRs** ("link an issue") — carried over from P89 D-11, which knowingly accepted a permanent floor of untraceable MRs in the drift count. Still out of scope; still not to be invented by the planner.
- **A bulk / "fix all flagged" action** — excluded by the milestone goal ("no fix all"). If the per-row flow proves tedious at real drift volumes, that is the phase-92-shaped answer, not an addition here.
- **Restoring a Releases-list aggregate drift count** — DRIFT-09, built in P89 and removed at UAT (`c681931e`). If it ever returns, D-13's invalidation set grows to include the list page's MR query.
- **Keyboard-complete rows** — D-04 makes the two new controls focus-reachable, but the rest of the row (and the app's other row surfaces: peek, drag-to-rank) is not. A coherent keyboard story is its own piece of work.
- **An undo affordance after a successful fix** — not discussed. With no confirm dialog and a hover-revealed target, a misfire is recoverable only in GitLab. Worth revisiting if it happens in practice.
- **Closing WR-01 in the P88 create dialogs** — D-10 requires the error extractor for *this* phase's tooltip. Applying it back to `CreateBranchDialog` / `CreateMilestoneDialog` is a natural, cheap follow-on but is not required by MRFIX-01…04.

### Reviewed Todos (not folded)
- `priority-stripe-rest-rank.md` — matched on the generic keywords "status" and "phase" only. It concerns the sprint-board priority stripe and `issueDisplayUtils.ts`; no overlap with per-MR corrective actions. Same false positive declined in Phase 89. Not folded.

</deferred>

---

*Phase: 90-Per-MR Corrective Actions*
*Context gathered: 2026-08-11*
