# Phase 87: Release Detail Decomposition - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning

<domain>
## Phase Boundary

`taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` (1518 LOC) is decomposed into a `taskflow/src/routes/dashboard/release-detail/` folder mirroring the existing `issue-detail/` precedent, with **zero user-visible behavior change**.

This is a pure structural refactor. It is the foundation phase for v1.14 — Phases 88–91 (release branch/milestone creation, three-channel drift detection, per-MR corrective actions, merge-back verification) will land their new UI into the files created here.

**In scope:** moving existing code into new files, extracting the data layer and derived computations into a hook + pure module, unit tests for the extracted pure functions.

**Out of scope:** any new feature, any change to rendered output, layout, data, or interactions. No new GitLab/Jira API surface. No speculative scaffolding for Phases 88–91.

</domain>

<decisions>
## Implementation Decisions

### Split Granularity

- **D-01:** Per-section split, ~8 files in `release-detail/`. One file per JSX section, matching the `issue-detail/` convention. Target files (names are guidance, not a contract):
  - `ReleaseHeader.tsx` — back/breadcrumb header + name/status heading (page L653–700)
  - `DescriptionsSection.tsx` — Jira + GitLab description blocks, incl. the "neither has a description" branch (L701–751)
  - `LabelSummarySection.tsx` — label summary from milestone MRs (L752–776)
  - `IssuesSection.tsx` — Issues heading, progress bar, milestone warning, issues table with MR matching (L777–972)
  - `UnmatchedMRsSection.tsx` — unmatched MRs block (L973–1065)
  - `ReleaseDetailSidebar.tsx` — right sidebar: Details metadata + MR-state / issue-status / story-point distribution blocks (L1104–1304)
  - `EditReleaseModal.tsx` — the ~180-LOC edit modal (L1305–1480)
  - `MetaRow.tsx`, `ReleaseDetailSkeleton.tsx` — the two locals currently at file bottom
- **D-02:** Do **not** split `IssuesSection` further (no separate IssuesTable / IssueRow / ProgressBar / MilestoneWarning files) in this phase. Phase 89/90 may split it when they add drift UI.
- **D-03:** Action buttons block (L1066–1103) stays in the page shell unless it reads more naturally inside `ReleaseHeader` — planner's call.
- **D-04:** The page shell `ReleaseDetailPage.tsx` **stays at `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx`**, not inside `release-detail/`. This mirrors `IssueDetailContent.tsx`, which sits in `dashboard/` while its sections live in `issue-detail/`. No router change.
- **D-05:** Sections are imported by **direct path**. `release-detail/index.ts` stays thin (or is omitted) — `issue-detail/index.ts` exports only 2 symbols. No full re-export barrel.
- **D-06:** Target: page shell lands in the ~150–250 LOC range after the split. This is a health indicator, not a hard gate.

### Data & Derived Logic

- **D-07:** All 6 `useQuery` calls move into a single co-located hook `release-detail/useReleaseDetail.ts`, which returns one object the page destructures. Queries currently in the page: `fixVersions`, `issueCounts`, `milestones`, `fixVersionIssues`, `milestoneMRs`, `recentProjectMRs`. Rationale: they are interdependent (the milestone window derives from the version release date), and Phases 88–91 need one obvious place to add branch/milestone/drift queries.
- **D-08:** Sections are **presentational** — props-driven, no data fetching of their own.
- **D-09:** The ~7 derived computations extract into a **pure, React-free module** (e.g. `release-detail/releaseSummaries.ts`): `labelSummary`, `labelCoverage`, `mrStateCounts`, `issueStatusCounts`, `storyPoints`, `hasStoryPoints`, `milestoneWindow`, `issueStoryPoints`. Called from `useReleaseDetail`. This gives the phase real unit-test targets (see D-13).
- **D-10:** Hooks are **co-located in `release-detail/`**, not `src/hooks/`. Matches `issue-detail/useAuthBlob.ts` and `issue-detail/useFieldMutation.ts`; `src/hooks/` is reserved for cross-feature hooks like `useResizable`.
- **D-11:** Query keys, `staleTime`, `enabled` guards, and fetch behavior must be carried over **verbatim**. A changed query key silently breaks cache sharing with `ReleasesTab` / `UpcomingReleasesTimeline` — verify against those consumers.

### Local Helpers & Duplicates

- **D-12:** `fetchVersionIssueCounts` and `fetchFixVersionIssues` (raw Jira REST `fetch` calls currently inline in the route file, L68–143) **move into the shared service layer** — `taskflow/src/services/jira.ts`. Every other Jira call in the app goes through the service layer; a route file holding REST plumbing is the actual smell here. **Important:** land them in the legacy `jira.ts`, not `services/jira/` modules — all ~60 imports use `jira.ts` (see `.planning` memory: jira.ts dual-file gotcha).
- **D-12a (resolved 2026-08-10, user decision, supersedes D-12's "behavior must be identical" clause for these two functions only):** RESEARCH.md §7 found a real conflict — the two fetchers use raw `@tauri-apps/plugin-http` `fetch`, but **all 33** existing functions in `jira.ts` use the instrumented `apiFetch('jira', ...)` wrapper (15s `AbortController` timeout, `markDisconnected` on 401, redacted devtools instrumentation). **The user chose: convert both to `apiFetch()`.** Consequences the plan MUST state explicitly rather than introduce silently:
  - Both functions gain a 15-second timeout they did not have (previously unbounded).
  - Both gain automatic disconnect-marking on a 401 response.
  - `fetchVersionIssueCounts`' silent `Promise.allSettled` → `{total: 0}` fallback and `fetchFixVersionIssues`' `Failed to fetch issues: status ${status}` error string are otherwise preserved; follow the `fetchFixVersions` (jira.ts L1099–1134) pattern for the `apiFetch` call/`response.ok`/`ApiError`-on-401/403 shape only where it does not change the existing fallback semantics.
  - The `versionId` `/^\d+$/` guard is preserved verbatim.
  - `ReleasesTab.test.tsx` mocks `@tauri-apps/plugin-http`'s `fetch` directly; because `apiFetch` calls through to that same underlying fetch, **no test-mock rewrite is required** (RESEARCH.md §8).
- **D-12b (structural correction from RESEARCH.md §1/§9, supersedes D-01's implied sibling layout):** `IssuesSection` and `UnmatchedMRsSection` are **not** sibling JSX blocks — they share one `<section>` wrapper (L778–1064). `UnmatchedMRsSection.tsx` may exist as its own file, but it must be rendered **as a child from inside `IssuesSection`'s JSX**, not as a sibling in the page shell. Rendering it as a sibling moves it outside the `<section>` wrapper and changes DOM/CSS structure — a direct violation of zero-user-visible-change. RESEARCH.md flags this as the phase's single highest-risk extraction trap.
- **D-13:** Local `MetaRow` becomes a **private `release-detail/MetaRow.tsx`** — NOT shared with `issue-detail/MetaRow.tsx`. Rationale: if the two implementations differ at all, sharing changes rendered output somewhere, which violates "zero user-visible change." Planner should still diff the two and record the delta in the plan; if they are byte-identical the executor may share them, but a divergence is a reason to keep the copy, not to reconcile it in this phase. Dedupe is a follow-up cleanup, noted as deferred.

### Refactor Safety Net

- **D-14:** Safety net = **unit tests on the extracted pure functions + typecheck + manual UAT**. No full-page characterization test in this phase.
  - `releaseSummaries.ts` gets a real test file covering edge cases: empty MR list, MRs with no labels, `labelCoverage` when zero MRs carry labels, `mrStateCounts` across open/merged/closed/draft, `storyPoints` when the SP field is absent/null on some issues, `milestoneWindow` date arithmetic at month boundaries.
  - Page-level correctness is verified by `npm run check` (biome + tsc) plus a manual click-through of the release detail page. **Baseline correction (RESEARCH.md, verified 2026-08-10):** `tsc --noEmit` is clean, but `biome check ./src` has **2 pre-existing formatting errors** in `BacklogPage.tsx` and `BacklogRow.tsx` — unrelated to this phase. The gate is **zero NEW errors relative to that 2-error baseline**, not a clean 0-error run. Do not fix the Backlog files in this phase (out of scope, D-16).
  - Rationale: proportionate for a mechanical split; and the derived logic is exactly what Phases 89/90 build on, so that is where test value is highest.
- **D-15:** Existing suites must pass with zero regressions, specifically `ReleasesTab.test.tsx` and `UpcomingReleasesTimeline.test.tsx` (they share query state / release-linking code paths). No test currently covers `ReleaseDetailPage` itself.

### Forward Fit

- **D-16:** **Mirror today's structure only.** Zero speculative files, no placeholder components, no seams carved "for Phase 88/89/90." Phases 88–91 add their own files when they add their features. This keeps the phase diff purely mechanical and reviewable.

### Claude's Discretion

The user delegated every implementation choice in this discussion ("you decide" on 9 of 10 questions). The decisions above are Claude's recorded calls — they are **locked for downstream agents**, not open questions to re-ask. Where the planner finds evidence that a specific call is wrong (e.g. a query key that cannot move without breaking a consumer, or a section boundary that reads badly in the actual JSX), it may adjust the file-level detail and record the deviation — but D-16 (no forward-shaping) and the zero-user-visible-change constraint are hard.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The file being decomposed
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` — the 1518-LOC monolith; the entire subject of this phase

### Structural precedent to mirror
- `taskflow/src/routes/dashboard/issue-detail/` — the folder convention this phase copies (~40 files, one per section/hook)
- `taskflow/src/routes/dashboard/IssueDetailContent.tsx` (535 LOC) — the page-shell precedent for D-04: shell in `dashboard/`, sections in the subfolder
- `taskflow/src/routes/dashboard/issue-detail/index.ts` — the thin-barrel precedent for D-05 (2 exports only)
- `taskflow/src/routes/dashboard/issue-detail/useAuthBlob.ts`, `.../useFieldMutation.ts` — co-located feature hook precedent for D-10
- `taskflow/src/routes/dashboard/issue-detail/MetaRow.tsx` — the near-duplicate referenced in D-13

### Consumers and shared code that must not regress
- `taskflow/src/services/releaseLinker.ts` + `releaseLinker.test.ts` — `matchGitLabToFixVersion`, date-only matching
- `taskflow/src/services/gitlab.ts` — `fetchMilestoneMRs`, `fetchProjectMilestonesInRange`, `fetchRecentProjectMRs`, `updateMilestone`
- `taskflow/src/services/jira.ts` — destination for the two extracted fetchers (D-12)
- `taskflow/src/routes/dashboard/ReleasesTab.tsx` + `ReleasesTab.test.tsx` — shares release/milestone query state
- `taskflow/src/routes/dashboard/UpcomingReleasesTimeline.tsx` + `.test.tsx` — same
- `taskflow/src/routes/dashboard/ReleasesSkeleton.tsx` — existing skeleton, check for overlap with the local `ReleaseDetailSkeleton`

### Phase / milestone context
- `.planning/ROADMAP.md` §Phase 87 — goal and success criteria
- `.planning/REQUIREMENTS.md` — FOUND-01 (the sole requirement for this phase); RELBR-*/RELMS-*/DRIFT-*/MRFIX-*/MERGE-* describe what lands in these files in Phases 88–91 (read for context only — **do not implement**)
- `.planning/PROJECT.md` §Current Milestone — v1.14 goal

No external ADRs or design specs exist for this phase; it is an internal refactor.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `issue-detail/` folder structure — the direct template for `release-detail/`; copy its conventions rather than inventing new ones
- `IssueDetailContent.tsx` — worked example of a page shell delegating to section files
- Shared UI primitives already imported by the page: `Badge`, `Button`, `CachedAvatar`, `Input`, `Progress`, `Skeleton`, `Textarea`, `statusPillClass`, `useResizable` — all stay as-is, just move with their consuming section

### Established Patterns
- Feature-scoped hooks co-locate with their feature; `src/hooks/` is for cross-feature hooks only
- Barrels stay thin — `issue-detail/index.ts` exports 2 symbols despite ~40 files in the folder
- `npm run check` (biome check + tsc) is the quality gate and its baseline is GREEN — do not regress it. Note `biome lint` ≠ `biome check`.
- `services/jira.ts` (legacy single file) is the live module — all imports point there, not at `services/jira/`

### Integration Points
- Route entry for `/release/:versionId` — unaffected by D-04 (page shell does not move)
- `useOutletContext` / `useParams` / `useNavigate` wiring, `useBreadcrumbStore` seeding, `usePinnedTabsStore` pin toggle, `useSettingsStore`, `useAuthStore`, `readSecret` (GitLab token) — all currently in the page body; they stay in the shell or move into `useReleaseDetail`, planner's call, but their behavior is frozen
- React Query cache is shared with `ReleasesTab` and `UpcomingReleasesTimeline` — query keys are a cross-component contract (D-11)

</code_context>

<specifics>
## Specific Ideas

- The user explicitly rejected forward-shaping: the split must mirror what exists today, even knowing Phases 88–91 will grow these files. Reviewability of *this* diff was chosen over convenience for *later* diffs.
- The user delegated all remaining implementation choices, signalling low ceremony is wanted here — this is understood as plumbing work, not a design exercise.

</specifics>

<deferred>
## Deferred Ideas

- **Dedupe `MetaRow` across `issue-detail/` and `release-detail/`** — deliberately not done here (D-13) because sharing risks a visual delta. Worth a standalone cleanup task once both call sites are stable.
- **Full characterization test for `ReleaseDetailPage`** — considered and declined for this phase (D-14). If Phase 89/90 make the page significantly more stateful, a page-level test becomes worth its cost then.
- **Further splitting `IssuesSection`** (IssuesTable / IssueRow / ReleaseProgressBar / MilestoneWarning) — deferred to whichever of Phases 89/90 actually needs the seam.

### Reviewed Todos (not folded)
- `priority-stripe-rest-rank.md` (Priority stripe: color by Jira priority-scheme rank via REST `/priority`) — matched only on the generic keyword "phase" (score 0.4). Unrelated to release detail decomposition; remains a pending todo.

</deferred>

---

*Phase: 87-Release Detail Decomposition*
*Context gathered: 2026-08-10*
