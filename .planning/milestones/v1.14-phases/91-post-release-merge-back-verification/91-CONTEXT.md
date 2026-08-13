# Phase 91: Post-Release Merge-Back Verification - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Once a Jira fix version is marked **released**, the release detail page states — as an advisory verdict, never a blocker — whether that release actually landed in the GitLab project's default branch. Detection prefers the tracking MR's merged state and falls back to comparing the `v<version>` tag's content against the default branch.

**In scope:** the tracking-MR lookup and the `repository/compare` call in `services/gitlab.ts`, the queries in `useReleaseDetail.ts`, a pure verdict-resolution module with unit tests, a new "Merged back" row in the sidebar Details block, and softening the existing `released` branch-row wording so it stops asserting an unverified merge.

**Out of scope:** any manual override or confirmation control (**MERGE-03 descoped — see D-11**); a Releases-list per-row indicator (D-06); any write action — this phase is read-only, unlike Phases 88 and 90; branch/milestone creation (Phase 88, done); MR drift detection or per-MR fixes (Phases 89/90, done); anything that blocks, gates, or marks a release as unfinished in a way the user must clear.

**Not present, do not build for it:** there is no Releases-list aggregate drift count (DRIFT-09 built in P89, removed at UAT `c681931e`) and no cross-page propagation. Nothing in this phase writes to Jira or GitLab, and nothing persists to disk.

</domain>

<decisions>
## Implementation Decisions

### Detection — evidence chain

- **D-01 (user):** When the release branch is already deleted and no tracking MR is found, the content-comparison fallback compares the **`v<version>` tag** against the default branch. The tag is the surviving artifact — Phase 88's live probe found only `release/33.7.0` alive across 265 milestones, so **branch-deleted is the normal case**, and `repository/compare` has no branch ref to work with. When there is no tag either, the verdict is `couldn't-verify` (D-08) — Phase 88 established tags are an incomplete record, so tag-absence is **never** evidence a release did not ship.
- **D-02 (Claude's discretion):** A tracking MR that is **closed but not merged** is *not* negative evidence — it falls through to the tag comparison. `merged` is the **only** positive MR signal; every other MR state defers to content. Rationale: a closed MR is routinely how a superseded or retargeted MR ends, and treating it as "not merged" would put a confident wrong verdict on a release that shipped.
- **D-03 (user-supplied fact — RESOLVES THE ROADMAP PROBE):** The team's GitLab project uses **merge commits** (Settings → Merge requests → Merge method), not squash and not rebase/fast-forward. The roadmap probe-gated this phase on exactly this question because squash/rebase rewrite SHAs and make commit-based comparison (and the branch endpoint's `merged` field) unreliable — GitLab issue #36963. **The probe does not need to run.** Phase 90's `probe.sh` never executed in any environment (no live PAT reachable); this fact was supplied directly by the user instead.
- **D-04 (Claude's discretion):** Despite D-03, comparison is **diff-based, not commit-based** — treat an empty diff between the tag and the default branch as "landed", rather than counting commits. Correct under all three merge methods at identical cost, and it will not silently start producing false negatives if the project's merge method is ever changed. Do not "simplify" this to a commit count citing D-03.
- **D-05 (Claude's discretion):** The check runs **automatically, for released fix versions only, on page load** — MERGE-01's exact trigger. Unreleased versions fire **zero** extra GitLab calls (the common case; an unreleased version is unmerged by definition and reporting so is pure noise). Not lazy/on-demand: the verdict should be a passive signal, not something the user has to remember to fetch.

### Placement

- **D-06 (Claude's discretion):** **Detail page only.** No Releases-list per-row indicator. Per-row detection is a 1–2 call fan-out per released row — the exact shape P88 D-18 was engineered to avoid — and P89's list-level drift count was built then removed at UAT. If it earns a place later it needs a batched strategy, not a per-row query.
- **D-07 (Claude's discretion):** The verdict is a **new "Merged back" row in the sidebar Details block**, directly below the existing `Release Branch` row (P88 D-20 precedent: branch/milestone status live as Details rows). **Not** folded into the Release Branch row — that row already carries branch existence across seven `BranchState` kinds and has a different meaning for unreleased versions. **No release-level banner** — P88 D-20 rejected a banner as too heavy, and MERGE-03 forbids anything reading as blocking.
- **D-08 (Claude's discretion, follow-on to D-07):** The existing `released` branch-state wording **must be softened**. `ReleaseDetailSidebar.tsx` currently renders *"`release/33.7.0` was merged and deleted; tagged v33.7.0"* — an assertion made with **no evidence**, and precisely the claim MERGE-01 asks us to verify. That row must report only what it knows (the branch is absent; a tag exists) and leave the merge verdict to the new row. This is a required change, not an optional polish.

### Verdict states and wording

- **D-09 (Claude's discretion):** **"No evidence either way" is its own visible state.** Four outcomes: `merged` / `likely-not-merged` / `couldn't-verify` / hidden. Collapsing `couldn't-verify` into `likely-not-merged` would put a soft accusation on every old release that shipped fine and simply has no tag — a real chunk of the project's history. The app admits the gap rather than implying a problem.
- **D-10 (Claude's discretion):** **Factual one-line verdict text naming the real default branch, with the evidence in the hover tooltip.** Matches the one-line density of the Details block; the advisory tone is carried by the word *"Likely"*, not by hedging prose. Shape:

  ```
  Merged back    ✓ Merged into develop · 21 Jul
                   ⤷ tooltip: via !4821, merged 21.07.2026
  Merged back    ⚠ Likely not merged into develop
                   ⤷ tooltip: v33.7.0 has 12 commits not in develop
  Merged back    ? Couldn't verify
                   ⤷ tooltip: no tracking MR and no v33.7.0 tag found
  ```

  Rejected: multi-line explanatory sentences (2–3× the vertical space in a block built from one-line rows) and glyph-only (a once-per-release fact is too easy to miss as a bare mark). The default branch name is always the **fetched** `project.default_branch` (P88 D-14) — never a hardcoded `main`/`develop`.
- **D-11 (Claude's discretion):** The row is **hidden entirely** when the check cannot be attempted — version not released, or no matched milestone so no version/branch is derivable. No dead `—` row the user must learn to ignore; P89 D-18's degraded banner already explains the no-milestone case.

### The manual override — DESCOPED

- **D-12 (user, hard — descopes MERGE-03):** There is **no manual override control of any kind**. The user's decision, given twice: first *"I dont want to store anything"*, then, when the consequence for MERGE-03 was stated explicitly with a session-only alternative on the table, *"no override control at all"*.

  **MERGE-03 is therefore DESCOPED, not satisfied.** Downstream agents — planner, verifier, milestone auditor — must record it as an intentional descope, the same handling as DASH-06 (P84 UAT) and DRIFT-09 (P89 UAT), and must **not** treat its absence as a gap or invent a confirmation affordance to close it. Nothing in this phase persists to a Zustand/Tauri store, to Jira, or to GitLab.
- **D-13 (Claude's discretion, follow-on to D-12):** The negative wording **stays as locked in D-10** (`⚠ Likely not merged into develop`) and is not softened further into pure measurement. Because the tooltip names exactly what was compared, a verdict the user disagrees with is *visibly* wrong rather than mysteriously wrong — which is most of what an override would have bought. A pure-observation reading ("12 commits in v33.7.0 not in develop", no judgement) would push interpretation onto the user on every visit and under-deliver MERGE-01's "user sees whether it merged".

### Structural constraints inherited from Phases 87–90

- **D-14:** New queries go in the single hook `release-detail/useReleaseDetail.ts` (P87 D-07); section components stay **presentational and props-driven** (P87 D-08); verdict resolution is a **pure, React-free module with unit tests** (P87 D-09) — model it on `releaseBranch.ts`'s `resolveBranchState` discriminated union, which is the closest analog by far. New GitLab calls go in `services/gitlab.ts` via `apiFetch('gitlab', …)` (P87 D-12a) — raw `fetch` is a defect.
- **D-15:** This phase is **read-only**. It adds no writes, so P90's optimistic-patch/rollback/sticky-failure machinery does not apply. Cache invalidation, where needed at all, is at **project granularity, never a windowed key** (P88 CR-02, `useReleaseDetail.ts:237-246`). Never `?? 0` a project id into a URL (WR-10) — throw instead.

### Claude's Discretion

The user delegated **D-02, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-13** explicitly ("you decide"). All are recorded calls and **locked for downstream agents** — not open questions to re-ask. The planner may adjust implementation detail where evidence contradicts a call, but must record the deviation.

**D-01, D-03, D-12 are user decisions and are hard.** D-12 in particular reads *against* the literal text of MERGE-03 and the roadmap's third success criterion — that is intentional and must not be "fixed" back.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase / milestone context
- `.planning/ROADMAP.md` §Phase 91 — goal, the three success criteria, and the **probe**. Read with **D-03** in hand: the probe (GitLab merge-strategy setting) is **RESOLVED** — the answer is *merge commit*, supplied directly by the user. Do not re-probe. Read success criterion 3 with **D-12** in hand: the manual override is descoped.
- `.planning/REQUIREMENTS.md` — MERGE-01, MERGE-02, MERGE-03. **MERGE-03 is descoped by D-12.**
- `.planning/phases/88-release-branch-milestone-creation/88-CONTEXT.md` — **D-09** (branch name = version component only), **D-10** (no matched milestone ⇒ nothing derivable), **D-13** (404-as-missing pattern for branch checks), **D-14** (`fetchProject` / `default_branch`, added explicitly to serve *this* phase), **D-18** (the fetch-once page-cap trap), **D-20** (branch/milestone status as sidebar Details rows — the precedent D-07 follows)
- `.planning/phases/89-three-channel-drift-detection/89-CONTEXT.md` — **D-18**, the degraded no-milestone banner that makes D-11's hidden row safe
- `.planning/phases/90-per-mr-corrective-actions/90-CONTEXT.md` — **D-13** (project-granularity invalidation), and the general read/write split: P90 owns writes, this phase adds none
- `.planning/phases/87-release-detail-decomposition/87-CONTEXT.md` — D-07 single hook, D-08 presentational sections, D-09 pure module + tests, D-11 query-key cache contract, D-12a `apiFetch`
- `.planning/PROJECT.md` §Current Milestone — v1.14 goal; §Constraints — the **no-server** constraint that makes any shared override state impossible, feeding D-12

### Code this phase extends
- `taskflow/src/routes/dashboard/release-detail/releaseBranch.ts` — **the closest analog for the new verdict module.** `BranchState` (L92) + `resolveBranchState` (L137) are the exact discriminated-union + strict-precedence pattern to copy. `findReleaseTag` (L117) already resolves the `v<version>` tag D-01 compares against, and `extractVersionFromMilestoneTitle` (L43) yields the bare version.
- `taskflow/src/routes/dashboard/release-detail/releaseBranch.test.ts` — the established pure-module unit-test harness; the new module's tests belong beside it
- `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` — the two new queries land here. Note `project`/`defaultBranch` (L147-153), the `releasedVersion` flag (L181), `matchedVersionNumber` (L182), the existing `gitlab-release-tags` query (L186-197, currently gated on `needsTagLookup` — **D-01 likely widens that gate**), and `resolveBranchState`'s call site (L199-209).
- `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx` — `MetaRow label="Release Branch"` (L206) is where the new row goes beneath; **L253-266 is the `released` branch-state block whose wording D-08 requires softening**
- `taskflow/src/services/gitlab.ts` — `GitLabBranch` (L411, note it carries `merged`), `fetchBranch` (L1192 — the 404-as-missing template), `searchProjectTags` (L352), `fetchProject` (L235, carries `default_branch`), `fetchBranchTargetedMRs` (L1696 — MRs *targeting* a branch; this phase needs the **inverse**, MRs *sourced from* the release branch), `flattenGitLabError` (L1056)

### Consumers that must not regress
- `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx` — asserts the existing branch-row states; D-08's wording change lands here
- `taskflow/src/routes/dashboard/release-detail/releaseBranch.test.ts`, `useReleaseDetail.test.tsx`
- `taskflow/src/routes/dashboard/ReleasesTab.tsx` — unchanged by D-06, but shares the `gitlab-milestones` / `jira-fix-versions` cache

### External API reference
- GitLab `GET /projects/:id/repository/compare?from=<default_branch>&to=<tag>` — the D-01/D-04 fallback. The researcher must confirm the response shape (`commits`, `diffs`, `compare_same_ref`) and which field is authoritative for "no content difference", plus behaviour when a ref does not exist.
- GitLab issue **#36963** — why the branch endpoint's `merged` field is an unreliable negative signal under squash/rebase. Context for D-04 even though D-03 says the project uses merge commits.

No external ADRs or design specs exist for this phase.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`resolveBranchState` + `BranchState`** (`releaseBranch.ts:92,137`) — a discriminated union resolved in strict precedence order, with every precedence rule justified in a comment. The new verdict resolver is this pattern applied to a different question; it should be a **sibling function/module**, not a new `BranchState` kind (the two answer different questions and D-07 keeps them in separate rows).
- **`findReleaseTag`** (`releaseBranch.ts:117`) — already does whole-name, `v`-optional, case-insensitive tag matching. D-01's compare ref comes straight from it; no new matching logic.
- **`searchProjectTags` + the `gitlab-release-tags` query** (`useReleaseDetail.ts:186`) — the tag is already fetched, but only when `needsTagLookup` (released **and** branch confirmed absent). D-01's fallback needs the tag in more cases; widening the gate is cheaper than a second query.
- **`fetchBranch`** (`gitlab.ts:1192`) — the 404-as-a-valid-answer template. A missing tag or ref in `compare` needs the same treatment: a "no such ref" response is data, not an error.
- **`MetaRow`** (`release-detail/MetaRow.tsx`) + the `RowAction` helper in the sidebar — the row primitive D-07's new row uses.

### Established Patterns
- All GitLab calls go through `apiFetch('gitlab', …)` — 15s timeout, disconnect-marking on 401, redacted devtools instrumentation. Raw `fetch` is a defect.
- Derived/pure logic lives in a React-free module with unit tests; hooks own queries; section components are presentational and props-driven.
- Query keys are a cross-component cache contract. Invalidate at **project** granularity, never a windowed key (CR-02).
- React Compiler is on — no manual `useMemo`/`useCallback`/`React.memo` (the one `useMemo` in `useReleaseDetail.ts:317` is a deliberate query-key-stability exception, not a precedent to copy casually).
- Quality gate is `npm run check`. **The biome baseline has drifted to ~16 pre-existing diagnostics across 5 files** (recorded in `deferred-items.md` during Phase 90) — do **not** hardcode a count. Gate on **no NEW files flagged**, and do not fix unrelated pre-existing files here.
- Narrow columns/cells collapse to 0 width in this codebase's WebKit/Tauri webview — any fixed-width element needs explicit px sizing.

### Integration Points
- `useReleaseDetail` already resolves every input this phase needs: `version.released`, `matchedMilestone`, `releaseBranchName`, `matchedVersionNumber`, `defaultBranch` (P88 D-14 added it **for this phase**), `branchState`, `activeGitlabProject`, `gitlabToken`.
- The new row renders from props threaded through `ReleaseDetailPage` → `ReleaseDetailSidebar`, exactly as `branchState` / `defaultBranch` already are.
- D-05's "released versions only" gate maps directly onto the existing `releasedVersion` flag (`useReleaseDetail.ts:181`) as the queries' `enabled` guard.

### Gaps this phase must fill
- **No `repository/compare` call anywhere in the codebase** (`grep` confirms zero hits) — entirely new API surface.
- **No way to find MRs sourced FROM a branch.** `fetchBranchTargetedMRs` finds MRs *targeting* a branch; the tracking-MR lookup needs `source_branch=release/X` with `state=all`, which does not exist.
- **No merge-back verdict model** — nothing today distinguishes "branch absent because merged" from "branch absent for any other reason"; `resolveBranchState` currently just assumes the former (D-08).

</code_context>

<specifics>
## Specific Ideas

- **The user shut down the override decisively and twice.** Asked where to persist it, they answered *"I dont want to store anything"*; told plainly that this descopes MERGE-03 and offered a session-only middle ground plus a "maybe you only meant the Jira/GitLab write-back" escape hatch, they answered *"no override control at all"*. This is a reaffirmed decision, not an unexamined default. **Do not reintroduce a confirm/dismiss/acknowledge affordance in any form.**
- **The user supplied the merge-method fact directly rather than waiting on another probe.** Phase 90's probe never ran in any environment; asking the person who administers the project resolved in one turn what two phases of probe-gating did not. Worth repeating for future probe-gated phases whose question is a settings value the user simply knows.
- **The existing "was merged and deleted" wording is the bug this phase exists to fix.** It was added in Phase 88 as a UAT-driven improvement and is right about the branch but unverified about the merge. Downstream agents should treat D-08 as a correction to a real (if invisible) inaccuracy, not cosmetic rewording.
- **The user delegated 10 of 13 calls**, holding firm only on the three that change what they see or what the app claims: the tag as evidence, the merge method, and no override. Consistent with Phases 87/88/90 — low ceremony, domain facts held tightly.

</specifics>

<deferred>
## Deferred Ideas

- **A manual override / confirmation, in any persisted form** — MERGE-03, descoped by D-12. If the advisory later proves wrong often enough to annoy, the local-Tauri-Store route (`pinned-tabs.store.ts` / `tempo-filters.store.ts` pattern, keyed by fix-version id) is the shape it would take. Not this phase.
- **A Releases-list merge-back indicator** — declined in D-06 on fan-out cost. Would need a batched detection strategy first. Note this is the third list-level release signal to be considered and dropped (P88 D-17 shipped one, P89 DRIFT-09 was removed at UAT, this is declined up front).
- **Linking the verdict out to GitLab's compare view or the tracking MR** — raised and set aside; the tooltip names the evidence but nothing is clickable. A cheap, natural follow-on.
- **The released-version-with-a-surviving-branch case** (drift in the other direction — shipped but never cleaned up) — noted as a possible signal, not discussed, not in scope.
- **Closing `flattenGitLabError` back into the P88 create dialogs** — still carried from P90's deferred list; this phase adds no writes so it does not become blocking here either.
- **Correcting RELMS-03's `1.1.0` milestone format in `REQUIREMENTS.md`** — still outstanding from P88 D-01. Documentation-only.

### Reviewed Todos (not folded)
- `priority-stripe-rest-rank.md` — matched on generic keywords only ("status", "phase", "jira", "rank", "sprint"). It concerns the sprint-board priority stripe and `issueDisplayUtils.ts`; zero overlap with merge-back verification. The same false positive was declined in Phases 89 and 90. Not folded.

</deferred>

---

*Phase: 91-Post-Release Merge-Back Verification*
*Context gathered: 2026-08-11*
