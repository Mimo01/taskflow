---
phase: quick-261102-fkr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
  - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx
  - taskflow/src/services/gitlab.ts
autonomous: true
requirements: [QUICK-261102-fkr]

must_haves:
  truths:
    - "Each 'Not covered by tasks above' row shows a reason pill (No task / Not in version / Not evaluated) in place of the bare AlertTriangle key glyph (D: reason pill)"
    - "Each row shows the MR author (avatar + name; avatar never drops at narrow width) and its reviewers (avatar stack, all reviewers, no +N cap) (D: author+reviewers)"
    - "Each row shows one MR state pill: Draft / Open / Merged / Closed / Locked, Draft taking precedence for an opened draft MR (D: state+draft badge)"
    - "The section header shows the h4, a total row count, and reason-summary chips (e.g. '2 no linked task · 1 not in fix version'), counted over the rows actually shown (D: header count + chips)"
    - "Each row stays one line at every container width; columns drop rather than wrap"
    - "No branches, labels or dates are added to the section (not selected by user)"
    - "Existing behaviour preserved: secondaryRows [] renders no section; secondary-key-flagged/none/unevaluated testids, titles and key links unchanged; BR/MS action cells unchanged; primary table unchanged"
  artifacts:
    - path: "taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx"
      provides: "secondaryReason helper, SecondaryReasonPill, MrAuthorCell, MrReviewersCell, MrStatePill, updated SecondaryHeaderStrip and section header"
      contains: "secondary-reason-pill"
    - path: "taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx"
      provides: "Tests for reason pills, author/reviewers, state+draft pill, header count + chips; WR-06 header test updated to the new column set"
      contains: "secondary-reason-chip"
    - path: "taskflow/src/services/gitlab.ts"
      provides: "GitLabMR.reviewers[] typed with optional avatar_url (already present in raw GitLab JSON)"
      contains: "avatar_url?: string"
  key_links:
    - from: "UnifiedTaskTable secondary section"
      to: "filteredSecondaryRows"
      via: "header counts derived from the same filtered array the rows render from"
      pattern: "filteredSecondaryRows"
    - from: "MrSubLine (secondary rows)"
      to: "CachedAvatar"
      via: "author.avatar_url and reviewers[].avatar_url"
      pattern: "CachedAvatar"
---

<objective>
Make the release-detail "Not covered by tasks above" section nicer and more informative, per the locked decisions in 261102-fkr-CONTEXT.md:
- Row info: MR author (avatar/name) and reviewers; MR state with a Draft badge (Open / Draft / Merged / Closed).
- Section presentation: header with the count plus reason-summary chips ("N no linked task · M not in fix version"); rows get a reason pill instead of the bare key glyph.
- Do NOT add source/target branches, labels, or updated date.

Purpose: the uncovered-MR list currently shows only key + title + BR/MS, so the user cannot tell at a glance who owns an MR, whether it is still open/draft, or why it ended up here.
Output: updated UnifiedTaskTable.tsx + tests; one optional type field on GitLabMR.reviewers.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261102-fkr-in-release-detail-make-not-covered-by-ta/261102-fkr-CONTEXT.md
@taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
@taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx
@taskflow/src/routes/dashboard/release-detail/driftDetection.ts

Repo layout: `.planning/` and git at the outer `/Users/mimo/Documents/Projects/taskflow`; src, npm, vitest, biome run from the inner `/Users/mimo/Documents/Projects/taskflow/taskflow`.

<interfaces>
Existing code the executor builds on (no exploration needed):

- `DriftRow` (driftDetection.ts L48): `{ mr: GitLabMR; channels: Set<Channel>; evaluated: boolean; br: DriftMark; ms: DriftMark; task: DriftMark; taskReason: TaskDriftReason; taskKeys: string[]; flagged: boolean }`, with `TaskDriftReason = 'no-linked-task' | 'not-in-fix-version' | null`. Unevaluated rows (merged/closed/locked) always have `taskReason: null` and must never be described as drift (T-91.1-14).
- `GitLabMR` (services/gitlab.ts ~L515): `state: 'opened' | 'closed' | 'merged' | 'locked'`, `draft: boolean`, `author: { id; name; username; avatar_url: string }`, `reviewers: Array<{ id; name; username }>`. Objects are raw GitLab JSON cast to the type (`data as GitLabMR[]`), and GitLab's MR list returns `reviewers[].avatar_url`, so the type just under-declares it.
- `CachedAvatar` (`@/components/ui/cached-avatar`): props `{ url: string | null | undefined; name; size?: 16|18|20|22|24|32|40; className? }`, renders initials when url is falsy. Already imported in UnifiedTaskTable.tsx.
- `Badge` (`@/components/ui/badge`), `variant="outline"`, already imported.
- UnifiedTaskTable.tsx column constants L79-84: `COL_KEY`, `COL_SUMMARY`, `COL_PERSON = 'flex-none w-[8.75rem] min-w-0 @max-[860px]:w-9'`, `COL_STATE`, `COL_MR`. TaskRow L920-940 is the reference author/avatar pattern: `CachedAvatar size={20}` + name in `<span className="line-clamp-1 @max-[860px]:sr-only">` (avatar stays, name collapses).
- TaskMrCell L741-752: inline `stateBadgeClass` ternary (merged green / opened blue / else gray), rendered as `<Badge variant="outline" className="pointer-events-none text-[10px] ...">{mr.state}</Badge>`. The primary-table tests assert the raw text 'opened' there; the primary cell must keep rendering `mr.state` verbatim.
- Header orange-badge pattern L1036-1043: `Badge variant="outline" className="text-xs tabular-nums gap-1 text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700"`.
- `SecondaryHeaderStrip` L421, `MrSubLine` L445 (only the secondary section renders it now; primary rows render no sub-line), secondary section render L1191-1261 (`keyCell` branches: flagged / none / unevaluated).
- The `<section>` at L1019 is the `@container`; rows and strips are descendants, so `@max-[...]:` variants on row cells work (never style the container itself).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Secondary rows get reason pill, author, reviewers and state+draft pill</name>
  <files>taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx, taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx, taskflow/src/services/gitlab.ts</files>
  <behavior>
    - Row with taskReason 'no-linked-task' renders `data-testid="secondary-reason-pill"` with `data-reason="no-linked-task"` and text "No task"; 'not-in-fix-version' renders "Not in version" (orange) with title "PROJ-9 is not in fix version 33.5.0"-style full sentence; an unevaluated row (evaluated:false, taskReason null, any keys incl. none) renders "Not evaluated" (muted gray, no orange class) with title "Not evaluated (MR is merged)".
    - secondary-key-flagged no longer contains the AlertTriangle svg (`querySelector('svg')` is null); its textContent/title/link behaviour is unchanged (existing D-13 tests keep passing untouched).
    - Author cell shows the author's name text and a CachedAvatar (role img / initials) for `author: { name: 'Alice', avatar_url: '' }`.
    - Reviewers cell: reviewers [Bob, Carol] renders 2 avatars and a title "Reviewers: Bob, Carol"; all reviewers render even with 5 (no "+N" text anywhere in the cell); empty reviewers renders a muted em dash with title "No reviewers".
    - State pill (`data-testid="secondary-mr-state"`): opened+draft:false → "Open"; opened+draft:true → "Draft"; merged → "Merged"; closed → "Closed"; locked → "Locked".
    - The secondary header strip labels Reason, Key, Merge request, Author, Reviewers, State, BR, MS, and still has no Assignee / Status / MR / Summary label (update the WR-06 describe: rename "labels only the four columns" to the new eight-column set; keep the "does not label Assignee, Status or MR" assertions as they are).
    - Primary table untouched: its MR cell still shows raw 'opened' and no author name (existing tests pass unchanged).
  </behavior>
  <action>
Implements the "Row info" and "reason pill" locked decisions of 261102-fkr-CONTEXT.md. Write the new tests first in a new `describe('261102-fkr: secondary row info', ...)` block in UnifiedTaskTable.test.tsx, reusing the existing `makeMR`/`makeRow`/`renderSection` helpers and scoping queries with `within(screen.getByTestId('secondary-section'))`. Then implement; RED and GREEN go in ONE commit (the pre-commit hook runs the full vitest suite and blocks red commits).

In services/gitlab.ts, widen only the reviewers element type to `{ id: number; name: string; username: string; avatar_url?: string }` with a one-line comment that GitLab returns it on the list endpoint. Change nothing else in that file.

In UnifiedTaskTable.tsx:
1. Add column constants next to L79-84 with explicit px widths (WebKit zero-width-column rule): `COL_REASON` (fixed width that fits "Not in version" at text-[10px], e.g. `w-[6.5rem]`, `flex items-center` so the pill has a flex parent), `COL_REVIEWERS` (fits four 18px avatars overlapped, e.g. `w-[4.5rem]`, hidden `@max-[640px]`), `COL_MR_STATE` (e.g. `w-[4rem]`, flex parent, hidden `@max-[400px]`). The author column reuses `COL_PERSON` so the name collapses to sr-only below 860px and the avatar never drops (same as TaskRow). Update the WR-06 comment block above the constants to describe the new secondary shape (Reason / Key / Merge request / Author / Reviewers / State / BR / MS).
2. Extract the merged/opened/else class ternary from TaskMrCell into a module-level `mrStateBadgeClass(state)` and have TaskMrCell call it (its rendered `{mr.state}` text stays raw). Add `mrStateLabel(mr)` returning Draft when `mr.state === 'opened' && mr.draft`, else Open / Merged / Closed / Locked. Draft pill uses a muted gray outline (dashed border is fine) distinct from the blue Open.
3. Add `export function secondaryReason(row: DriftRow): 'no-linked-task' | 'not-in-fix-version' | 'unevaluated'` — 'not-in-fix-version' and 'no-linked-task' map straight from `row.taskReason`; anything else (taskReason null, i.e. unevaluated merged/closed/locked) is 'unevaluated'. Never return a drift reason for an unevaluated row (T-91.1-14).
4. Add small components: `SecondaryReasonPill` (Badge outline, text-[10px], `data-testid="secondary-reason-pill"`, `data-reason`, colours: not-in-fix-version orange like the header badges, no-linked-task amber/neutral-but-visible, unevaluated gray/muted; `title` gives the full sentence, built from `row.taskKeys` and `versionName` for not-in-fix-version, and must never interpolate an undefined key); `MrAuthorCell` (CachedAvatar size 20 with `url={mr.author.avatar_url || null}` + name span `line-clamp-1 @max-[860px]:sr-only`); `MrReviewersCell` (flex row of overlapping CachedAvatar size 18 for EVERY reviewer, each wrapped/class'd with a `ring-1 ring-background rounded-full` so overlaps read, `title` and `aria-label` "Reviewers: a, b"; empty → muted em dash with title "No reviewers"; never render a "+N" overflow, the column clips via overflow-hidden only); `MrStatePill` (`data-testid="secondary-mr-state"`).
5. Extend `MrSubLine` with an optional `reasonCell?: React.ReactNode` prop and a `showMeta?: boolean` flag (or equivalent) so that, when used by the secondary section, it renders: reasonCell, keyCell, summary (iid + linkified title, unchanged), MrAuthorCell, MrReviewersCell, MrStatePill, then the existing BR/MS cells. Keep `data-testid="drift-row"`, the row's `group/row`, padding/density classes and one-line layout (`truncate` summary, all other cells `flex-none`). Since the author is now visible, drop the row-level `title={author — state}` attribute.
6. In the secondary section map (L1195-1259), remove the `<AlertTriangle className="size-3" />` from the not-in-fix-version keyCell (the reason pill replaces it) and pass `reasonCell={<SecondaryReasonPill row={row} versionName={versionName} />}`. Keep every keyCell testid, className, title and the keyLink button exactly as they are otherwise. AlertTriangle stays imported (header badges use it).
7. Update `SecondaryHeaderStrip` to label the same columns with the same constants, in row order: Reason, Key, Merge request, Author, Reviewers, State, BR, MS. Use the label "State" (not "Status") and "Author" (not "Assignee") so the WR-06 negative assertions still hold. Header cells must use the identical width/hide classes as row cells so they align at every width.

Do not add branches, labels or dates (not selected). Do not touch TaskRow, the primary strip, or driftDetection.ts. Do not run biome --write across src; format only the touched files.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx && npx tsc --noEmit -p . && npx biome check src/routes/dashboard/release-detail/UnifiedTaskTable.tsx src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx src/services/gitlab.ts</automated>
  </verify>
  <done>New 261102-fkr row tests pass alongside all pre-existing UnifiedTaskTable tests (D-13, WR-04, WR-06 negative assertions, primary MR-cell tests unchanged); tsc clean; biome check reports no diagnostics on the three touched files; no AlertTriangle inside secondary-key-flagged.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Section header with count and reason-summary chips</name>
  <files>taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx, taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx</files>
  <behavior>
    - With rows [no-linked-task, no-linked-task, not-in-fix-version, unevaluated]: `data-testid="secondary-count"` reads "4"; `secondary-reason-chip-no-linked-task` reads "2 no linked task"; `secondary-reason-chip-not-in-fix-version` reads "1 not in fix version"; `secondary-reason-chip-unevaluated` reads "1 not evaluated".
    - A reason with zero rows renders no chip (e.g. only no-linked-task rows → no not-in-fix-version chip, no unevaluated chip).
    - The h4 text is still exactly "Not covered by tasks above" (existing `queryByText('Not covered by tasks above')` test keeps working), and secondaryRows [] still renders no section.
    - Counts follow the active filter: with a label filter that keeps only one secondary row, the count reads "1" and only that row's reason chip shows.
  </behavior>
  <action>
Implements the "Header with count + reason summary" locked decision of 261102-fkr-CONTEXT.md. Write the tests first (append to the Task 1 describe block or a sibling `describe('261102-fkr: secondary header', ...)`), one commit for RED+GREEN.

In the secondary section (L1191-1193), replace the bare h4 with a `flex flex-wrap items-center gap-x-2 gap-y-1` header row (mirroring the Issues header at L1020) containing: the unchanged h4 "Not covered by tasks above"; a muted `tabular-nums` count span `data-testid="secondary-count"` holding `filteredSecondaryRows.length` (styled as a small neutral count, e.g. Badge outline or muted text); then the reason chips. Compute the three counts once with `secondaryReason` from Task 1 over `filteredSecondaryRows` (the same array the rows render, so header and rows never disagree). Render a chip only when its count is > 0, in the order no-linked-task, not-in-fix-version, unevaluated, using `data-testid="secondary-reason-chip-{reason}"` and text "{n} no linked task" / "{n} not in fix version" / "{n} not evaluated". Chips reuse the reason pill colours from Task 1 (Badge outline, text-xs tabular-nums) and are separated by a muted middle dot `·` rendered as an `aria-hidden` span between chips, so the chips' own textContent stays clean. Chips are informational spans, not buttons (no filtering was requested). The header row sits above SecondaryHeaderStrip with a small bottom margin (e.g. mb-1). Keep the section's `data-testid="secondary-section"`, `mt-4 pt-4 border-t` wrapper.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx && npx tsc --noEmit -p . && npx biome check src/routes/dashboard/release-detail/UnifiedTaskTable.tsx src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx</automated>
    <human-check>Open a release detail page that has uncovered MRs (npm run tauri dev): header shows count + chips; each row is one line with reason pill, key, title, author avatar+name, reviewer avatars, state pill, BR/MS; narrow the window — name collapses to avatar under 860px, reviewers drop under 640px, nothing wraps.</human-check>
  </verify>
  <done>Header count and per-reason chips render from filteredSecondaryRows, zero-count chips are omitted, h4 text unchanged; full UnifiedTaskTable test file passes; tsc clean; biome check clean on touched files.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| GitLab API → UI | MR author/reviewer names, avatar URLs and state come from GitLab JSON and are rendered |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-fkr-01 | Tampering/XSS | Author/reviewer names, titles | mitigate | Render as React text children and `title` attributes only; no dangerouslySetInnerHTML |
| T-fkr-02 | Info disclosure | Avatar URLs | accept | Fetched through existing CachedAvatar/avatar cache path already used for GitLab avatars on MergeRequestDetailPage |
| T-fkr-03 | Repudiation/misreport | Reason pill/chips for unevaluated MRs | mitigate | `secondaryReason` maps taskReason null to 'unevaluated', never to a drift reason (T-91.1-14); covered by tests |
</threat_model>

<verification>
- `npx vitest run src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx` passes (inner taskflow/ dir).
- `npx tsc --noEmit -p .` clean.
- `npx biome check` on the touched files only reports nothing new (biome baseline elsewhere drifts; do not gate on a repo-wide count).
- `grep -n "AlertTriangle" src/routes/dashboard/release-detail/UnifiedTaskTable.tsx` shows uses only in the import, header badges and banners, not inside the secondary-key-flagged branch.
</verification>

<success_criteria>
- Secondary rows show reason pill, author, reviewers, and state/draft pill on one line, with no branches/labels/dates added.
- Section header shows count + reason-summary chips derived from the displayed rows.
- All pre-existing UnifiedTaskTable tests still pass; new tests cover every locked decision.
</success_criteria>

<output>
Create `.planning/quick/261102-fkr-in-release-detail-make-not-covered-by-ta/261102-fkr-SUMMARY.md` when done
</output>
