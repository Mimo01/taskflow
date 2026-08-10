# Phase 89: Three-Channel Drift Detection - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning

<domain>
## Phase Boundary

On the release detail page, every merge request relevant to a release is discovered through three channels — **A** Jira-key linkage to the fix version's issues, **B** the GitLab milestone, **C** targeting the release branch — unioned into one MR-first list where each MR retains which channel(s) found it. Each open MR is evaluated against three drift conditions (target branch ≠ release branch, release milestone not assigned, Jira task not in the fix version), and the aggregate is surfaced as a per-row count on the Releases list.

**In scope:** the three discovery fetches and their union, per-MR provenance in the data model, the three drift predicates, state classification (merged/closed excluded from evaluation), the new MR-first section on the release detail page, the aggregate drift count on Releases-list rows, the `GitLabMR` type extensions the above require, and the deletion of the superseded `fetchRecentProjectMRs` / `buildWrongMilestoneMap` heuristic.

**Out of scope:** any corrective write — retarget, assign-milestone (Phase 90); merge-back verification (Phase 91); branch/milestone creation (Phase 88, done); permission gating (team is all Developer+, a 403 surfaces as a normal `ApiError`); changing the Issues table's layout or interactions beyond re-sourcing its MR cell.

</domain>

<decisions>
## Implementation Decisions

### List shape and placement

- **D-01 (user):** The reconciled union lives in a **new MR-first section on the release detail page**, below the existing Issues table. The Issues table's structure and interactions are **not** rewritten. Two tables answering two different questions: Issues = "is every task covered by an MR?", the new section = "is every MR that claims this release wired up correctly?".
- **D-02 (user):** `UnmatchedMRsSection.tsx` is **absorbed into** the new section, not kept beside it. It is already a proto version of this list (MRs in the milestone with no linked Jira task) and its row markup — `!iid` button, Jira-key linkification via `extractTicketKeys`, `CachedAvatar`, state badge — is the starting point. Accepted consequence: an MR that matches a fix-version issue appears in both tables.
- **D-03 (user):** The list is **flat, drift-first** — flagged MRs sorted to the top, clean MRs below. No state group headers (they cost vertical space). Ordering within each partition is the planner's call; make it deterministic.
- **D-04 (user, hard constraint):** The section must be **compact and easily readable**. This governs every rendering decision below and outranks completeness of information.

### Superseding the existing wrong-milestone heuristic

- **D-05 (user):** Channel A **replaces** GGX-WARN-01. `fetchRecentProjectMRs` (project's latest 100 MRs, page-capped, scanned client-side) and `buildWrongMilestoneMap` are **deleted**; the Issues table's MR / "Wrong milestone" / "Missing MR" cell is re-sourced from the three-channel union. One source of truth, one fetch fewer, and MRs older than the latest 100 stop being silently missed.
- **D-06 (Claude's discretion):** The Issues table's MR cell keeps its **current visual treatment** — the same `!iid` link, state colors, "Wrong milestone" and "Missing MR" affordances at `IssuesSection.tsx:136-216`. Only the data source changes. Do not redesign that cell in this phase; its tests should keep passing on re-sourced data.

### Row anatomy

- **D-07 (user):** Drift renders as **three fixed status columns — BR / MS / TASK** — each showing `✓`, `⚠`, or `—` on every row. Chosen over inline chips and a single tooltip chip because the columns are vertically scannable and give Phase 90 obvious per-action anchors.
- **D-08 (user):** The row carries **`!iid` · Jira key · title · author avatar · state badge · BR/MS/TASK**. This is the fullest of the presented options; combined with D-04 it puts the title under width pressure — see D-20 for the layout constraint that follows.
- **D-09 (user):** Channel provenance (A / B / C) is **not** a visible row element. It lives in the data model (DRIFT-04 requires it) and is exposed **only in a tooltip** — hovering the MR's id or flags reveals which channel(s) found it. Zero row cost.

### Drift predicates and state classification

- **D-10 (user, supersedes DRIFT-08's literal reading):** **Merged and closed** MRs are shown in the list (muted, with their state badge) but are **never evaluated** — all three columns render `—`. **Draft MRs are treated as open**: fully evaluated and counted. DRIFT-08 names draft alongside merged/closed; the user overrode that. Rationale: a draft still has a target branch and a milestone and fixing them early is cheap. Downstream agents must not "correct" this back toward the requirement text.
  - Reconciliation note: two answers in the discussion conflicted on drafts (a preview showed drafts muted, the specific draft question said flag-and-count). The specific answer wins and was confirmed to the user without objection.
- **D-11 (user):** An MR with **no parseable Jira key is flagged** in the TASK column. Every MR must trace to a ticket — this is a convention the user is enforcing, not an oversight. **Accepted consequence, stated to the user and reaffirmed:** the drift count carries a permanent floor of untraceable MRs (dependency bumps, chores) for which Phase 90 offers **no corrective action**. The planner must not invent one and must not silently exempt keyless MRs.
- **D-12 (Claude's discretion):** The TASK predicate is two-part — an MR fails it when it has no extractable Jira key **or** its extracted key is absent from the fix version's issue set. Both render the same `⚠`; the tooltip should distinguish them ("no linked task" vs "KEY-9 not in this fix version") since only the latter is actionable.

### Aggregate count

- **D-13 (user):** The number counts **MRs with ≥1 flag**, not total flags. "3 drift" = 3 rows need attention, so the number always matches the count of orange rows on screen.
- **D-14 (user):** The **Releases-list row count covers branch + milestone drift only** — not the task check. Rationale: a single fully-paginated `state=opened` project-wide MR fetch yields `target_branch` and `milestone` for every MR, so every row's count derives from **one request regardless of row count** (P88 D-18 fetch-once pattern). The task check needs per-version Jira issue keys, which the list page does not load. **The detail-page count may legitimately exceed the row count**; the planner should make the row indicator's tooltip say what it covers so the discrepancy doesn't read as a bug.
- **D-15 (Claude's discretion):** The row drift count sits **beside the existing P88 branch/milestone icons** in `ReleasesTab.tsx` — the comment at `ReleasesTab.tsx:558-561` already reserves that spot ("placed before the task-count span so a future Phase 89 aggregate drift count can append after them without a redesign"). Honor it; do not restructure the row.

### Fetching

- **D-16 (user):** Detail-page channel queries run **eagerly on mount**, as their own scoped queries, matching the six queries `useReleaseDetail` already fires (staleTime 5min, `gcTime: Infinity` per v1.7 stale-while-revalidate). The user explicitly chose this over routing the detail page through the shared project-wide open-MR fetch. The planner may still share a cache entry where it is trivially free, but must not make drift lazy or click-to-load.
- **D-17 (locked, from P88 D-18):** **Every channel fetch is fully paginated with no page cap.** Channel C in particular (`?target_branch=<release branch>`) must loop until a short page. A single capped page plus client-side filtering silently under-reports and is the specific failure mode the roadmap probe exists to catch.
- **D-18 (Claude's discretion):** With **no matched milestone** (P88 D-10 — no milestone means no derivable branch name, so Channels B and C have nothing to query), the section renders **Channel A results only**, with BR and MS columns as `—` and a one-line reason above the table. Chosen over disabling or hiding the section: partial signal beats a blank surface, and flagging every MR "no milestone" when no milestone exists would be pure noise. The existing "No GitLab milestone matched" alert at `IssuesSection.tsx:64` stays as-is and is not extended to cover this.

### Structural constraints inherited from Phases 87–88

- **D-19:** New data goes in the single hook `release-detail/useReleaseDetail.ts` (P87 D-07); section components stay **presentational and props-driven** (P87 D-08); the union + the three predicates + the count go in a **React-free module with unit tests** (P87 D-09, P88 D-12) — this is the phase's primary test target; new GitLab calls go through `apiFetch('gitlab', ...)` in `services/gitlab.ts` (P87 D-12a), never raw `fetch`.
- **D-20 (Claude's discretion — layout, follows from D-04 + D-08):** With five variable-width cells plus three status columns, **do not use a `<table>` for the MR list.** A table synchronizes column widths across rows, which is exactly the "all rows truncate at the same point" failure. Use `div` + flex rows: `flex-none` on `!iid`, key, avatar, state badge and the three status columns (explicit px widths — narrow columns collapse to 0 in this codebase's WebKit/Tauri webview), `flex-1 min-w-0` on the title. The status columns need explicit px sizing for the same reason `CachedAvatar` does.

### Claude's Discretion

The user delegated **D-18** explicitly ("you decide") and did not opine on **D-06, D-12, D-15, D-20** — all are Claude's recorded calls and are **locked for downstream agents**, not open questions to re-ask. The planner may adjust implementation detail where evidence contradicts a call, but must record the deviation.

**D-01, D-02, D-03, D-04, D-05, D-07, D-08, D-09, D-10, D-11, D-13, D-14, D-16 are user decisions and are hard.** D-10 and D-11 in particular override the literal text of DRIFT-08 and the natural reading of DRIFT-07 — do not "fix" the code back toward the requirement wording.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase / milestone context
- `.planning/ROADMAP.md` §Phase 89 — goal, the four success criteria, and the **probe**: verify whether any release branch in the team's GitLab history has ever carried >100 MRs targeting it (or build a synthetic >100-MR fixture) so the fully-paginated Channel C fetch is proven complete, not just theoretically correct
- `.planning/REQUIREMENTS.md` — DRIFT-01…09. **Read with D-10 and D-11 in hand:** DRIFT-08's inclusion of "draft" is overridden (drafts are evaluated and counted), and DRIFT-07 is read to include keyless MRs as flagged.
- `.planning/phases/88-release-branch-milestone-creation/88-CONTEXT.md` — **D-09** (branch name = `release/<X.Y.Z>` from the milestone title, date suffix stripped), **D-10** (no matched milestone ⇒ no derivable branch name; the D-18 degraded state here depends on it), **D-18** (fetch-once, fully paginated, no per-row queries), **D-19** (row indicator form)
- `.planning/phases/87-release-detail-decomposition/87-CONTEXT.md` — D-07 single hook, D-08 presentational sections, D-09 pure module + tests, D-11 query-key cache contract, D-12a `apiFetch`
- `.planning/PROJECT.md` §Current Milestone — v1.14 goal

### Code this phase extends
- `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` — the single data layer (374 LOC). All three channel queries land here. Note the existing token effect, the `enabled` guard shape, and `releaseBranchName` / `matchedMilestone` / `gitlabMatch` which Channels B and C consume.
- `taskflow/src/routes/dashboard/release-detail/UnmatchedMRsSection.tsx` — **absorbed** into the new MR section (D-02); source of the row markup and the `extractTicketKeys` linkification
- `taskflow/src/routes/dashboard/release-detail/IssuesSection.tsx` — L136-216 is the MR cell to **re-source** (D-05/D-06); L64 alert stays unchanged; L224 renders `UnmatchedMRsSection` and must be rewired
- `taskflow/src/routes/dashboard/release-detail/releaseSummaries.ts` — `matchIssuesToMRs` (L114) is Channel A's nucleus; **`buildWrongMilestoneMap` (L150) is deleted** per D-05. Union + predicates + count go in this module or a sibling, with tests.
- `taskflow/src/routes/dashboard/release-detail/releaseBranch.ts` — `deriveReleaseBranchName` supplies Channel C's query parameter and the BR predicate's expected value
- `taskflow/src/services/gitlab.ts` — `GitLabMR` (L~425, **lacks `target_branch` and `draft`** — see gaps), `GitLabMRDetail` (L446, has both, the shape to copy from), `fetchMilestoneMRs` (L1434, the fully-paginated loop to model Channel C on), **`fetchRecentProjectMRs` (L1557 — delete per D-05)**, `fetchProjectMRs` (L1338, single capped page — do not reuse as-is)
- `taskflow/src/services/linkEngine.ts` — `extractTicketKeys` / `linkMRToTask` (title first, source branch as fallback); the key-extraction contract behind Channel A and the TASK predicate
- `taskflow/src/routes/dashboard/ReleasesTab.tsx` — L197 `['gitlab-release-branches', …]` query, L246-280 the per-row drift derivation to extend, L558-585 the reserved indicator slot (D-15)

### Consumers that must not regress
- `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx`, `ReleaseDetailSidebar.test.tsx`, `releaseSummaries.test.ts`
- `taskflow/src/routes/dashboard/ReleasesTab.test.tsx` — asserts the P88 `row-missing-branch` / `row-branch-present` / `row-missing-milestone` testids
- `taskflow/src/routes/dashboard/UpcomingReleasesTimeline.tsx` + `.test.tsx` — shares the `gitlab-milestones` cache prefix

No external ADRs or design specs exist for this phase.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `UnmatchedMRsSection.tsx` (102 LOC) — row markup, state→color mapping, `CachedAvatar`, key linkification. The new section is this generalized, not a greenfield component.
- `fetchMilestoneMRs` (`gitlab.ts:1434`) — the correct fully-paginated `while(true)` + `data.length < perPage` loop **plus its label-color enrichment pass**. Channel C's fetch should be this with `target_branch=` swapped for `milestone=`.
- `linkMRToTask` / `extractTicketKeys` — already handles dash and space-separated keys, case normalization, and the title→branch fallback. Channel A and the TASK predicate both build on it; do not re-implement key extraction.
- `releaseSummaries.test.ts` + `releaseBranch.test.ts` — established pure-module test harness.
- `statusPillClass` (`lib/statusStyles.ts`) — note: its `min-w`/`text-center` collapse on a bare inline span; it needs a flex parent wrapper.

### Established Patterns
- All GitLab/Jira calls go through `apiFetch('gitlab'|'jira', …)` — 15s timeout, disconnect-marking on 401, redacted devtools instrumentation. Raw `fetch` is a defect.
- Query keys are a cross-component cache contract. `['gitlab-milestones', projectId, 'all']` and `['gitlab-release-branches', projectId]` are shared with `ReleasesTab` / `UpcomingReleasesTimeline` — do not alter them.
- Invalidate at **project granularity**, not a windowed key (the CR-02 lesson at `useReleaseDetail.ts:237-246`): TanStack invalidates by key prefix and the list page caches a different window than the detail page.
- Never `?? 0` a project id into a URL (the WR-10 lesson at `useReleaseDetail.ts:196`) — throw instead of silently hitting project 0.
- React Compiler is on: no manual `useMemo`/`useCallback`/`React.memo`.
- Quality gate is `npm run check`. **Baseline is 2 pre-existing biome formatting errors** in `BacklogPage.tsx`/`BacklogRow.tsx`, not a clean run. Gate on zero *new* errors; do not fix the Backlog files here.

### Integration Points
- `useReleaseDetail` already exposes `matchedMilestone`, `gitlabMatch`, `releaseBranchName`, `defaultBranch`, `fixVersionIssues`, `gitlabToken`, `activeGitlabProject` — every input the three channels need is already resolved in the hook.
- `ReleasesTab.tsx:246-280` already computes per-row `branchMissing` / `branchPresent` / `milestoneMissing` from one project-wide branch fetch; the D-14 row drift count is a fourth field derived the same way from one project-wide open-MR fetch.
- `ReleasesTab.tsx:558-561` carries an explicit comment reserving the slot for this phase's count.

### Gaps this phase must fill
- **`GitLabMR` has neither `target_branch` nor `draft`** — only `GitLabMRDetail` does (`gitlab.ts:446-448`). DRIFT-03, DRIFT-05 and D-10 all depend on these being present on the *list* type. GitLab returns both on list endpoints; the interface just never declared them. This is the first thing the planner should wire.
- **No branch-targeted MR query exists** — nothing in `gitlab.ts` passes `target_branch`.
- **No project-wide open-MR fetch exists** for the D-14 row counts. `fetchProjectMRs` (L1338) is a **single capped page** and `fetchRecentProjectMRs` (L1557) is explicitly `page=1` only — neither is safe to reuse; a new fully-paginated fetch is required.
- **No provenance concept** anywhere — the union type carrying per-MR channel membership (DRIFT-04) is entirely new.

</code_context>

<specifics>
## Specific Ideas

- **"Compact and easily readable"** was volunteered mid-discussion, unprompted, as a constraint on the whole section (D-04). The user then chose the *fullest* row (author + state badge + three status columns), so compactness has to come from layout discipline, not from dropping fields — hence D-20's flex-row prescription.
- The user chose to **delete a working heuristic** (`fetchRecentProjectMRs` + `buildWrongMilestoneMap`) rather than run it alongside the new channels. They preferred one source of truth over zero-regression-risk coexistence. Downstream agents should not resurrect it as a fallback.
- The user **knowingly accepted a permanent floor** in the drift count by flagging keyless MRs (D-11) after the consequence — no corrective action exists in Phase 90 — was stated explicitly. This is a convention they want enforced, not a metric they want minimized.
- The user picked **independent scoped queries over a shared project-wide fetch** on the detail page (D-16), even though the shared fetch was presented as cheaper. Correctness/independence of each channel read beat request economy.
- Two answers conflicted on draft MRs; the resolution (drafts evaluated and counted) was stated back to the user and not contested.

</specifics>

<deferred>
## Deferred Ideas

- **Per-MR corrective actions** (retarget, assign milestone) — Phase 90. D-07's three status columns exist partly to give those actions an anchor; the planner should leave the columns extensible so Phase 90 can attach a control per cell without a redesign.
- **A corrective action for keyless MRs** — D-11 flags them with nothing to do about them. If that noise becomes a problem, the answer is a Phase 90-style action (link an issue) or an opt-out, not a change to the predicate.
- **Making the detail page reuse the project-wide open-MR fetch** — presented and declined (D-16). Worth revisiting if request volume becomes a real complaint.
- **Fixing DRIFT-08's wording in `REQUIREMENTS.md`** (draft is now evaluated, not excluded) — same class as P88's still-open correction of RELMS-03's `1.1.0` format. Doc-only; not code, so not done here.
- **Virtualizing the MR list** — not discussed. Existing virtualized-list precedent exists (backlog, notifications), but note the known 0-width-column defect in the position-absolute-row table; D-20's flex rows are the safer default until a real length problem appears.

### Reviewed Todos (not folded)
- `priority-stripe-rest-rank.md` — matched only on the generic keywords "phase" and "jira". It concerns the sprint-board priority stripe and `issueDisplayUtils.ts`; no overlap with release drift detection. Not folded.

</deferred>

---

*Phase: 89-Three-Channel Drift Detection*
*Context gathered: 2026-08-10*
