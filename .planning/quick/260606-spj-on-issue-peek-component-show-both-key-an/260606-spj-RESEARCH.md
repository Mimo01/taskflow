# Quick Task 260606-spj: Issue peek header + Merge Requests reposition - Research

**Researched:** 2026-06-06
**Domain:** React/TipTap Tauri Jira client — peek slide-over UI refactor
**Confidence:** HIGH (all findings verified by reading source)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Peek only.** Single-column layout (`PeekPanel` + `IssueDetailView layout="single-column"`).
  The full two-column issue page header and sidebar must remain **unchanged**.
- `MergeRequestsSection` lives inside `IssueDetailSidebar`, shared by BOTH layouts via `sidebarNode`.
  To move it down in peek without touching the full page, it must be **conditionally omitted from
  the sidebar in single-column mode** and rendered separately at the bottom of the single-column
  content. Two-column keeps it in the sidebar exactly as today.
- **MR position (peek):** bottom of the panel, below the description/content (out of the top fields
  block entirely; near/with the activity area).
- **Header content (peek):** issue-type icon + key + title (truncated with ellipsis). Keep existing
  "Open full page" + Close controls on the right. **No status pill.**

### Claude's Discretion
- Exact markup/spacing of the header, how the issue-type icon is sourced (reuse existing helper),
  precise bottom placement of the MR section. Watch the italic-truncate clip pitfall and avoid
  0-width/overflow clipping on the title.

### Deferred Ideas (OUT OF SCOPE)
- Any change to the full two-column page header or sidebar.
</user_constraints>

## Summary

Two surgical UI changes scoped to the peek (single-column) layout. Both are achievable with an
existing reusable icon component and a small data-plumbing refactor in `IssueDetailView`. No new
network fetches are needed — the issue object (with `fields.summary` and `fields.issuetype`) is
already loaded inside `IssueDetailView`, and the MR data is already computed inside
`IssueDetailSidebar`.

**Primary recommendation:**
1. **Header** — surface title/type into the peek header by lifting the header markup out of
   `PeekPanel` into `IssueDetailView`'s single-column branch (Option A below), which already has
   `issue`. Pass `onNavigateFull`/`onClose` (and current props) down so the existing controls move
   with it. Use `<IssueTypeIcon typeName={issue.fields.issuetype.name} />` for the icon.
2. **Merge Requests** — extract the MR-fetching logic from `IssueDetailSidebar` into a small reusable
   hook `useLinkedMRs(issueKey)`, add an `omitMergeRequests?: boolean` prop to `IssueDetailSidebar`,
   and render `<MergeRequestsSection>` separately at the bottom of the single-column content block.

---

## Finding 1: Issue-type icon source — REUSE `IssueTypeIcon`

**Component:** `IssueTypeIcon`
**Path:** `taskflow/src/components/ui/issue-type-icon.tsx` `[VERIFIED: read source]`
**Import:** `import { IssueTypeIcon } from '@/components/ui/issue-type-icon';`

**Prop shape:**
```ts
interface IssueTypeIconProps {
  typeName: string;            // e.g. issue.fields.issuetype.name  ("Bug" | "Story" | "Epic" | "Sub-task" | ...)
  className?: string;          // default 'w-3.5 h-3.5 shrink-0'
}
```
It is a pure lucide-icon switch on the type **name string** (Bug→red Bug, Story→green BookOpen,
Epic→purple BookOpen, Sub-task→blue CornerDownRight, default→blue CheckSquare). It needs **only the
type name string**, not the issue object or an icon URL. `[VERIFIED: read source lines 1-25]`

Already used widely (BacklogRow, StoryHeaderRow, DashboardInProgressCard, PinnedTabStrip, standup
sections) — this is the blessed mechanism. **Do not invent a new one and do not use Jira's
`issuetype.iconUrl`.**

The data is available as `issue.fields.issuetype.name` — `JiraIssueDetail.fields.issuetype` is typed
`{ id?: string; name: string; subtask: boolean }` (`services/jira.ts:1219`). `[VERIFIED]`

---

## Finding 2: Where title/type data is available — render header inside `IssueDetailView` (Option A)

**Current state:** `PeekPanel` receives only `issueKey` (no issue object). The issue is fetched
*inside* `IssueDetailView` via `useQuery(['jira-issue-detail', issueKey, jiraBaseUrl])`
(`IssueDetailView.tsx:103-118`), so `issue.fields.summary` and `issue.fields.issuetype` live there.
`[VERIFIED]`

### Options evaluated

| Option | Approach | Verdict |
|--------|----------|---------|
| **A (RECOMMENDED)** | Move the header bar markup from `PeekPanel` into `IssueDetailView`'s single-column branch (line ~652), where `issue` is already in scope. Pass `onNavigateFull` + `onClose` down as new optional props on `IssueDetailView`. | ✅ Zero duplicate fetch, single source of truth, header naturally reflows when `issueKey` swaps. |
| B | Lift the issue query into `PeekPanel` and pass `issue` down. | ❌ Duplicates the query ownership; `IssueDetailView` still needs its own fetch for all the other sections, or a big prop-drill refactor. Larger blast radius. |
| C | Read the `['jira-issue-detail', issueKey, jiraBaseUrl]` cache from `PeekPanel` via `queryClient.getQueryData`. | ❌ Works but fragile (key must stay in sync; null on cold cache → header flicker; PeekPanel would need `jiraBaseUrl` from the store too). Cache-sharing is already the established pattern *within* `IssueDetailView` per its header comment, but reading it from a sibling adds coupling. |

### Recommended seam (Option A)

`IssueDetailView` already exposes optional props and a `layout` discriminator. Add:
```ts
export interface IssueDetailViewProps {
  // ...existing...
  onNavigateFull?: (key: string) => void;  // NEW — only used in single-column
  onClosePeek?: () => void;                 // NEW — only used in single-column
}
```
In the **single-column branch** (`IssueDetailView.tsx:652-663`), render the header bar (currently
`PeekPanel.tsx:73-93`) at the top of the `flex flex-col h-full` container, using `issue.fields`:
```tsx
<div className="flex items-center gap-2 h-10 px-4 border-b border-border shrink-0">
  {/* Left: icon + key + title (min-w-0 so title can truncate) */}
  <div className="flex items-center gap-2 min-w-0 flex-1">
    <IssueTypeIcon typeName={issue.fields.issuetype.name} />
    <span className="text-xs font-mono text-muted-foreground shrink-0">{issueKey}</span>
    <span className="text-sm font-medium truncate pr-0.5">{issue.fields.summary}</span>
  </div>
  {/* Right: existing controls — unchanged markup, just relocated */}
  <div className="flex items-center gap-1 shrink-0">
    <Button variant="ghost" size="sm" onClick={() => onNavigateFull?.(issueKey)} className="gap-1">
      <ExternalLink className="size-3.5" /> Open full page
    </Button>
    <Button variant="ghost" size="icon" aria-label="Close preview" onClick={onClosePeek}>
      <X className="size-4" />
    </Button>
  </div>
</div>
```
Then `PeekPanel` drops its own header bar and just renders `<IssueDetailView>` with the two new
callbacks wired through. `PeekPanel` keeps the resize handle, width, and Escape hotkey.

**Note on the loading/error state:** `IssueDetailView` returns early (skeleton / error) when `!issue`
(`lines 600-617`) *before* reaching the single-column branch. The header (which needs `issue`) will
not render during load — acceptable since the body is a skeleton anyway. If a header is desired during
load, the early-return skeleton branch would need the bare key-only header; **recommend keeping it
simple** (no header during skeleton). Confirm with planner if a persistent header is required while
loading.

---

## Finding 3: Move `MergeRequestsSection` to the bottom (single-column only)

**Current state:** MR data (`projectMRs` query, `linkedMRs` filter, `mrsLoading`, `gitlabConnected`,
`gitlabBaseUrl`) is all computed **inside** `IssueDetailSidebar` (`IssueDetailSidebar.tsx:74-108`),
which renders `FieldsSection → LinkedIssuesSection → MergeRequestsSection` (`lines 127-152`). The
sidebar is shared by both layouts via `sidebarNode` (`IssueDetailView.tsx:585-596`). `[VERIFIED]`

### Recommended refactor: extract `useLinkedMRs` hook + `omitMergeRequests` prop

**Step 1 — extract the hook.** New file `taskflow/src/routes/dashboard/issue-detail/useLinkedMRs.ts`
containing the `gitlab-project-mrs` `useQuery` + the `linkedMRs` filter currently at
`IssueDetailSidebar.tsx:74-108`. It needs:
```ts
// imports the hook needs (all already used in IssueDetailSidebar today):
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiFetch';
import type { GitLabMR } from '@/services/gitlab';
import { extractTicketKeys } from '@/services/linkEngine';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';

export function useLinkedMRs(issueKey: string) {
  const { gitlabBaseUrl, gitlabConnected, activeGitlabProject } = useAuthStore();
  // ...the existing projectMRs query (lines 75-99) + linkedMRs filter (lines 102-108)...
  return { linkedMRs, mrsLoading, gitlabConnected: !!gitlabConnected, gitlabBaseUrl: gitlabBaseUrl || '' };
}
```
`IssueDetailSidebar` then calls `const mr = useLinkedMRs(issueKey)` instead of inlining the query.

**Step 2 — add an omit prop to `IssueDetailSidebar`:**
```ts
interface IssueDetailSidebarProps {
  // ...existing...
  omitMergeRequests?: boolean;   // NEW
}
```
Guard the render: `{!omitMergeRequests && <MergeRequestsSection {...mr} />}` (`line 146-151`).

**Step 3 — render MR at the bottom in single-column.** In `IssueDetailView`:
- Pass `omitMergeRequests` to the sidebar **only** when `layout === 'single-column'`. Simplest:
  create the `sidebarNode` (line 585) with the flag derived from layout, OR pass two variants.
  Since `sidebarNode` is built once and used in both branches, the cleanest is to make the flag a
  prop of the node based on layout. Recommended: build `sidebarNode` with
  `omitMergeRequests={layout === 'single-column'}` — two-column passes `false` so it is unaffected.
- In `IssueDetailView`, call `const mr = useLinkedMRs(issueKey)` at the top level (alongside the
  other queries) so both the sidebar (two-column) and the new bottom slot (single-column) can share
  it. **OR** keep the hook inside the sidebar for two-column and call it once more in
  `IssueDetailView` for the single-column bottom render. Because the query key is identical
  (`['gitlab-project-mrs', gitlabBaseUrl, activeGitlabProject]`), TanStack Query **dedupes** — a
  second call is cheap and returns cached data. `[VERIFIED: query key is issue-independent]`
- In the single-column branch (`lines 652-663`), render the MR section at the bottom of the content
  block (after `issueDetailContentNode`/`activitySectionNode`, per the "near/with the activity area"
  decision):
  ```tsx
  <div className="p-4">
    {issueDetailContentNode}
    {activitySectionNode}
    <div className="px-2 pt-2">  {/* or its own bordered block per discretion */}
      <MergeRequestsSection {...mr} />
    </div>
  </div>
  ```

**Why a hook over duplicating the query:** the MR query key contains **no issue key**
(`['gitlab-project-mrs', gitlabBaseUrl, activeGitlabProject]`) — it fetches the project's recent 20
MRs and filters client-side by `issueKey`. So calling `useLinkedMRs(issueKey)` in two places is
fully deduped by TanStack Query (same key → one network request). The hook avoids prop-drilling the
4 MR values through `IssueDetailView`.

**Alternative (placement prop only, no hook):** pass MR data up via a render-prop or lift just the
query into `IssueDetailView`. More plumbing than the hook; the hook is cleaner. Recommend the hook.

---

## Finding 4: Pitfalls & test impact

### Code pitfalls
- **Title truncation needs `min-w-0`.** The title `<span className="truncate">` must sit inside a
  flex parent that has `min-w-0` (and `flex-1`), or the flex child refuses to shrink and the
  ellipsis never triggers / overflows the controls. `[project memory: virtualized-table-0-width,
  statuspill-needs-flex-parent]`
- **Italic-truncate clip.** If the title is ever rendered italic, the trailing glyph gets clipped by
  `overflow:hidden` from `truncate` — add `pr-0.5`. The summary here is not italic, but the existing
  `MergeRequestsSection` author/branch spans use `truncate`; no change needed there.
  `[project memory: feedback_italic_truncate_clip]`
- **Dual-file barrel gotcha.** `src/routes/dashboard/IssueDetailSidebar.tsx` is a **re-export barrel**
  (`export { extractSprintName, IssueDetailSidebar } from './issue-detail';`). The **real** component
  is `src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx` — edit that one. `[VERIFIED]`
- **Don't break two-column.** All sidebar changes must be gated so `layout === 'two-column'` renders
  MRs in the sidebar exactly as today (`omitMergeRequests` defaults to `false`/undefined).

### Test impact (MUST update)
- **`taskflow/src/components/app/PeekPanel.test.tsx`** — **WILL BREAK** with Option A. It currently:
  - Mocks `IssueDetailView` (lines 12-18) and asserts the **header key text** via
    `screen.getByText('PROJ-1')` / `getByText('PROJ-2')` (lines 57, 62) — these come from
    PeekPanel's own header. If the header moves into `IssueDetailView`, the mock no longer renders the
    key, so these assertions fail.
  - Asserts `getByRole('button', { name: /open full page/i })` (line 71) and
    `/close preview/i` (line 89) — these buttons move into `IssueDetailView`.
  - **Fix:** either (a) move these header assertions to a new/updated test that renders
    `IssueDetailView` in single-column with a mocked issue, or (b) update the `IssueDetailView` mock
    in PeekPanel.test to render the header controls + key so PeekPanel-level wiring (onNavigateFull
    pass-through, Escape, resize) is still covered. PEEK-02/03/07 (body marker, no dialog role,
    Escape) remain valid. Plan must budget for rewriting PEEK-04 and PEEK-06.
- **No test file exists** for `IssueDetailView`, `IssueDetailSidebar`, or `MergeRequestsSection`
  (`IssueDetailSidebar.test.ts` / `IssueDetailContent.test.tsx` MR asserts do NOT exist —
  `IssueDetailContent.test.tsx` only asserts subtask/summary content, no MR/header). So the MR move
  has **no existing test to break**; consider adding a light test asserting MRs render at the bottom
  in single-column and in the sidebar in two-column. `[VERIFIED: grep]`
- Run `npm run check` (biome + tsc) after — baseline is GREEN. `[project memory: project_biome_state]`

---

## Architectural Responsibility Map

| Capability | Tier | Rationale |
|------------|------|-----------|
| Peek header (icon+key+title+controls) | Frontend / `IssueDetailView` single-column branch | Issue object already loaded there; avoids duplicate fetch |
| Issue-type icon | UI component (`IssueTypeIcon`) | Existing pure presentational component |
| MR fetch + link filter | `useLinkedMRs` hook (extracted) | Shared by both render locations; query is issue-independent + deduped |
| MR placement | `IssueDetailView` layout branches | Layout decides sidebar vs. bottom; sidebar gated by `omitMergeRequests` |

## Don't Hand-Roll

| Problem | Use Instead |
|---------|-------------|
| Issue-type icon | `IssueTypeIcon` (`@/components/ui/issue-type-icon`) — do NOT use `iconUrl` or a new switch |
| MR fetch/filter | Extract existing logic into `useLinkedMRs`; do NOT add a second/duplicate network call |
| Truncation | Tailwind `truncate` + `min-w-0` flex parent; do NOT measure widths in JS |

## Assumptions Log

| # | Claim | Risk if Wrong |
|---|-------|---------------|
| A1 | No persistent header is needed during the skeleton/loading state (header only after `issue` resolves). | Low — if a key-only header is wanted while loading, add it to the early-return skeleton branch. Confirm with planner. |
| A2 | MR section's exact bottom placement (own bordered block vs. plain) is discretionary per CONTEXT. | None — explicitly Claude's discretion. |

## Open Questions

1. **Persistent header during load?** See A1 — recommend no header during skeleton for simplicity.
   Planner/user to confirm if a key-only header should persist while the issue loads.

## Sources

### Primary (HIGH confidence — read source)
- `taskflow/src/components/ui/issue-type-icon.tsx` — icon component + prop shape
- `taskflow/src/components/app/PeekPanel.tsx` — current header bar (lines 73-93)
- `taskflow/src/routes/dashboard/IssueDetailView.tsx` — issue query (103-118), sidebarNode (585), single-column branch (652-663), two-column (621-647)
- `taskflow/src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx` — MR query/filter (74-108), render (127-152)
- `taskflow/src/routes/dashboard/issue-detail/MergeRequestsSection.tsx` — presentational props
- `taskflow/src/components/app/PeekPanel.test.tsx` — header assertions that will break
- `taskflow/src/services/jira.ts:1212-1219` — `JiraIssueDetail.fields.issuetype` / `summary` shape
- Project memory: italic-truncate clip, 0-width flex, statuspill flex parent, dual-file barrel, biome GREEN

## Metadata
**Confidence:** HIGH across all findings (direct source verification). **Valid until:** stable (internal code).
</content>
</invoke>
