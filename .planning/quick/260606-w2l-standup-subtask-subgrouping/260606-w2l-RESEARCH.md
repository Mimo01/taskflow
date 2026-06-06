# Quick Task 260606-w2l: Standup notes — sub-task sub-grouping - Research

**Researched:** 2026-06-06
**Domain:** Frontend data-join + rendering refactor (React/TS, no new deps)
**Confidence:** HIGH (codebase fully inspected; no external libraries involved)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Scope — everywhere applicable**: (1) Yesterday "Worked On" column rendering, (2) Copy-markdown export (`generateMarkdown`) mirrors the nesting, (3) audit Today column (already nests — verify, likely no change).
- **Nesting style**: inside a story group, render a sub-task sub-header (issue-type icon + key + summary, same row treatment as group/issue rows) with that sub-task's activity items indented one level beneath it. Reuse `IssueActivityGroup` header row + `pl-6 ml-2` indent. Sub-task header clickable (peek on body, full-page on key) like the story header.

### Claude's Discretion ("clean, understandable view")
- Story-level activity (commits/MRs keyed directly to the story, story worklogs, story transitions/comments) renders flat **directly under the story header, above the sub-task groups**.
- Only create a sub-task sub-group when that sub-task actually has activity — never an empty sub-task header.
- A story with no sub-task activity looks exactly as it does today (no regression).

### Markdown export
- Mirror hierarchy with 2-space indentation: story heading → story-level bullets → indented sub-task line → further-indented sub-task bullets. Slack/Jira-paste readable.

### Deferred Ideas
None.
</user_constraints>

## Summary

This is a self-contained refactor of `buildGroups` in `YesterdayColumn.tsx` plus the rendering in `IssueActivityGroup.tsx` and the markdown emitter. No new packages, no service-layer changes, no `fetchIssueMeta` change needed.

**The core problem** lives in `resolveRollup`/`ensureGroup`: every sub-item is attached to the *parent story group* and the originating sub-task key is discarded for every source except worklogs (worklogs already carry `issueKey` on the `SubItem` when origin ≠ group). To sub-group, `buildGroups` must (a) keep the existing story-group join, but (b) bucket each sub-item by its **origin key** within the group, splitting into "story-level" (origin === story, or origin is a non-subtask) vs. "per sub-task" (origin is a subtask rolled up to this story).

**Good news on metadata (Focus #2):** `issueMeta` *does* contain entries for sub-task keys. `StandupNotesPage` builds `referencedKeys` from the raw sources' ORIGIN keys (worklog `issue.key`, jira activity `issueKey`, commit/MR extracted keys) and passes exactly those to `fetchIssueMeta`. So any sub-task that has activity is a referenced key and gets `{type, summary, isSubtask, parentKey, parentSummary}`. Sub-task headers will have real icons + summaries. The only gap is a theoretical race (meta not loaded yet) → fall back to bare key as summary and `issueType` undefined (IssueTypeIcon already handles empty type).

**Primary recommendation:** Refactor `buildGroups` to attach an `originKey` to every `SubItem` (instead of only worklogs), then add a post-pass that partitions each group's `subItems` into story-level + a `Map<subtaskKey, {meta, subItems}>`. Render story-level items first via the existing `IssueActivityGroup` sub-item list, then map sub-task sub-groups as indented `IssueActivityGroup`-style blocks. Mirror in markdown with 2-space indents.

## Architectural Responsibility Map

| Capability | Primary Tier | Rationale |
|------------|-------------|-----------|
| Sub-task attribution of activity | Frontend join (`buildGroups`) | All four sources already joined here; origin key is available at attach time |
| Sub-task display meta (icon/summary) | Already fetched (`fetchIssueMeta`) | Referenced keys include subtask keys — no service change |
| Nested rendering | Presentational (`IssueActivityGroup` / new wrapper) | Pure view concern |
| Markdown mirror | `generateMarkdown` (same module) | Consumes same `buildGroups` output |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| (quick) | Second-level grouping of activity under sub-tasks within story groups | `buildGroups` origin-key preservation + partition; `IssueActivityGroup` nested render; `generateMarkdown` indent |

## Standard Stack

No new packages. Existing in-repo primitives only:
- `IssueTypeIcon` (`@/components/ui/issue-type-icon`) — handles empty `typeName` gracefully (used today with `issueType ?? ''`).
- Lucide icons already imported in `IssueActivityGroup`.
- `formatDuration` (`@/services/jira/duration`).

No `npm install`. **Package Legitimacy Audit: N/A — no external packages.**

## Architecture Patterns

### Current data flow (relevant slice)
```
4 raw sources ──► buildGroups ──► issueMap: Map<rollupKey, IssueGroup>
                                   └─ IssueGroup.subItems: SubItem[]  (FLAT — origin lost except worklogs)
                                          │
                                          ▼
                           YesterdayColumn renders one <IssueActivityGroup> per group
                           generateMarkdown emits "### KEY: summary" + "- label" per subItem
```

### Proposed data shape (cleanest given existing code)

Two viable shapes — recommend **Option A** (minimal blast radius, keeps `SubItem` as the universal unit):

**Option A — tag every SubItem with `originKey`, partition at the end.**
1. In `SubItem` (IssueActivityGroup.tsx), the `issueKey?` field already exists for worklogs and already drives click-to-subtask. Generalize its population: set it on commit, mr-comment, approval, jira-comment, transition sub-items too — to the **origin key** whenever origin ≠ group key. (Keep semantics: `issueKey` present = "this row belongs to a different issue than the group".)
2. Add a derived structure for rendering/markdown. Extend `IssueGroup`:
   ```ts
   interface SubTaskSubGroup {
     issueKey: string;          // the subtask key
     summary: string;           // issueMeta[key].summary ?? key
     issueType?: string;        // issueMeta[key].type
     subItems: SubItem[];       // items whose origin === this subtask
   }
   interface IssueGroup {
     issueKey: string;          // story key (unchanged)
     summary: string;
     issueType?: string;
     totalSeconds: number;
     subItems: SubItem[];       // STORY-LEVEL only (origin === story or undefined)
     subTaskGroups: SubTaskSubGroup[];  // NEW — only non-empty subtasks
   }
   ```
3. Post-pass after all 4 sources are joined: iterate each group's collected items, partition by `originKey`:
   - origin undefined OR origin === group.issueKey → `group.subItems` (story-level).
   - origin is a subtask of this story (`issueMeta[origin].isSubtask && parentKey === group.issueKey`) → bucket into `subTaskGroups` keyed by origin.
   - Defensive: if origin ≠ group and meta is missing/not-a-subtask, treat as story-level (don't invent a sub-group). This preserves "no metadata → looks like today".

**Where to record `originKey`:** today the four loops attach sub-items at different times. Cleanest is to give each `SubItem` an `originKey` during attach (worklog already knows it; commits know `key`; MR events know `key`; jira activity knows `activity.issueKey`). Then run ONE partition pass at the end rather than threading buckets through every loop. This keeps the four source loops nearly unchanged — they just push to a single per-group `subItems` list with `originKey` set, and partitioning happens once.

> Note on the existing `issueKey` field vs a new `originKey`: `issueKey` on `SubItem` currently means "make this row clickable to that issue" and is only set when origin ≠ group. You can reuse it as the origin signal, OR add a distinct `originKey` and keep `issueKey` purely for click affordance. **Recommend a distinct `originKey`** to avoid coupling "is clickable" with "belongs to subtask" — a story-level worklog row may still want its click affordance. Set `issueKey` for clickability independently.

### Count aggregation decision (Focus #1)
Commits and MR-comments are currently aggregated **per group** (`commitCountByGroup`, `keyedCommentCounts` keyed by `group.issueKey`). For sub-grouping these must aggregate **per (group, originKey)** so "3 commits" on a subtask shows under the subtask, not lumped at story level. Change the aggregation map keys from `group.issueKey` to a composite `${group.issueKey}::${originKey}` (or nest a `Map<originKey, count>` inside each group). Worklogs already aggregate per-origin-issue (`perIssue` map) — that pattern is the template to follow for commits/MRs.

### Rendering pattern (Focus #3)
Extend, don't fork. Two clean approaches:

**Recommended:** Render story-level items with the existing `IssueActivityGroup` (unchanged), then render each `subTaskGroups[]` entry as its own nested block. The simplest is to make `IssueActivityGroup` accept an optional `subTaskGroups` prop and render them after its own sub-item list, each wrapped in `pl-6 ml-2` and itself a header-row + indented sub-items. The header row reuses the exact `div[role=button]` + inner `<button>` key pattern (Pitfall 1: nested-button HTML invalidity — the documented `div[role=button]` wrapper with an inner `<button>` for the key, `stopPropagation` on the key click).

Sub-task header click wiring: body → `onOpenIssue ?? onIssueClick` with the subtask key; key button → `onIssueClick(subtaskKey)`. Both handlers already plumb through (`onIssueClick`, `onMRClick` already passed; `onOpenIssue` is passed at the group level as `onClick`). You'll need to pass `onOpenIssue` (or the resolved open handler) down so sub-task headers get peek-on-body too — currently `IssueActivityGroup` only receives a pre-bound `onClick` for the story. Add an `onOpenIssue?: (key) => void` (or `onSubtaskOpen`) prop so each sub-task header can bind its own key.

Indent: sub-task block wrapper = `pl-6 ml-2` (matches `TodayInProgressSection` `IssueRow indented` and the existing sub-item list indent). Sub-task's own sub-items get a further `pl-6 ml-2` — net two levels of indent, consistent with the visual language.

### Today column audit (Focus, scope item 3)
`TodayInProgressSection` already nests subtasks under stories via `row.subtasks.map(... indented)` from `SprintRow`. It is sprint-membership-based, not activity-attribution-based, and is already two-level. **No change required** — note this explicitly in the plan. The markdown side (`generateTodayMarkdown`) is out of scope per the task (Yesterday recap is the target); only verify it isn't regressed.

### Markdown mirror (Focus #4)
In `generateMarkdown`, after `### KEY: summary`:
1. Emit story-level `group.subItems` as `- label` (unchanged).
2. For each `subTaskGroups` entry emit a sub-task line then its items, 2-space indented:
   ```
   ### ESHOP-1: Checkout revamp
   - 1 comment on ESHOP-1 Checkout revamp
   - To Do → Done
     - ESHOP-2: Wire up form
       - 1h · ESHOP-2 Wire up form
       - 2 commits
   ```
   Use `  - ` (2 spaces) for the sub-task header bullet and `    - ` (4 spaces) for its activity. This is the Slack/Jira-friendly nested-list convention.

   Note: the worklog label already embeds the key+summary (`1h · ESHOP-2 Wire up form`). Under the new nesting that's slightly redundant with the sub-task header line, but harmless and keeps the worklog label format stable (existing tests assert `1h · ESHOP-2 Wire up form`). Keep the label as-is to avoid churning tests; the sub-task header line is additive.

### Anti-patterns to avoid
- **Don't** create a separate `IssueGroup` per sub-task at the top level — that re-introduces the flat-story regression the rollup was built to fix.
- **Don't** rebuild `fetchIssueMeta` or add a second query — subtask meta is already present.
- **Don't** render an empty sub-task header — only push to `subTaskGroups` when items exist.

## Runtime State Inventory

Not applicable — pure code refactor, no stored data / service config / OS state / secrets / build artifacts touched.

## Common Pitfalls

### Pitfall 1: Nested-button invalid HTML
`IssueActivityGroup` already documents this: the header is `div[role=button]` because the inner key is a `<button>` and `<button>` inside `<button>` is invalid. Sub-task headers MUST follow the same `div[role=button]` + inner `<button>` + `stopPropagation` pattern. Reuse verbatim. (Source: IssueActivityGroup.tsx lines 90-116; mirrored in TodayInProgressSection.tsx IssueRow.)

### Pitfall 2: Map iteration order / stability
`buildGroups` returns `[...issueMap.values()]` — insertion order. Sub-task sub-groups built from a `Map` keyed by origin will also be insertion-ordered (seeded by whichever source touched the subtask first). This is non-deterministic across sources. **Recommend sorting `subTaskGroups` by `issueKey`** for stable render + stable tests (mirrors the `referencedKeys` `.sort()` already used in StandupNotesPage). React keys: use `subtask.issueKey` (stable), not array index, for the sub-group list. (The existing sub-item list intentionally uses array index — fine, static render — but new sub-group blocks should key by issueKey.)

### Pitfall 3: Story with no sub-task activity must look identical
If `subTaskGroups` is empty, the render path must collapse to exactly today's output (story header + flat sub-items). Guard the sub-group render behind `subTaskGroups.length > 0`. The markdown emitter likewise skips the nested block. Add an explicit regression test for "no subtask activity → unchanged output".

### Pitfall 4: Meta-not-loaded race
`issueMeta` arrives via its own query (`issueMetaQuery`), separate from the four data queries, and `YesterdayColumn` receives `issueMeta={issueMetaQuery.data ?? {}}`. During the window before meta loads, `resolveRollup` returns no `parentKey`, so subtasks are NOT rolled up (they appear as own top-level groups — existing behavior, see the "falls back to per-issue grouping" test). In that state there are no sub-groups to render — acceptable, and consistent with today. Once meta loads, `useMemo` re-runs (issueMeta is a dep) and nesting appears. No special handling needed; just ensure partition treats missing meta as story-level.

### Pitfall 5: Test impact
- `YesterdayColumn.test.ts` (`generateMarkdown`) — existing assertions like `1h · ESHOP-2 Wire up form` and `### ESHOP-1: Checkout revamp` must stay green. The current "subtask worklog under parent" test (lines 112-136) will now ALSO produce a nested `  - ESHOP-2: Wire up form` line — update that test to assert the new nesting, and add tests for commit/MR sub-task attribution + "no subtask activity unchanged".
- `TodayColumn.markdown.test.ts` — untouched (Today out of scope); just confirm still green.
- No component render tests exist for `IssueActivityGroup` directly; consider adding one for nested rendering, but markdown tests give the cheapest coverage of the join logic (they exercise `buildGroups` through its only export).

## Code Examples (shapes, not full impl)

### Partition pass (after the 4 source loops, before return)
```ts
// Each SubItem now carries originKey (set at attach). Partition per group.
for (const group of issueMap.values()) {
  const storyLevel: SubItem[] = [];
  const bySubtask = new Map<string, SubItem[]>();
  for (const item of group.subItems) {
    const origin = item.originKey;
    const meta = origin ? issueMeta?.[origin] : undefined;
    const belongsToSubtask =
      origin && origin !== group.issueKey && meta?.isSubtask && meta.parentKey === group.issueKey;
    if (belongsToSubtask) {
      (bySubtask.get(origin!) ?? bySubtask.set(origin!, []).get(origin!)!).push(item);
    } else {
      storyLevel.push(item);
    }
  }
  group.subItems = storyLevel;
  group.subTaskGroups = [...bySubtask.entries()]
    .map(([key, subItems]) => ({
      issueKey: key,
      summary: issueMeta?.[key]?.summary ?? key,   // graceful fallback
      issueType: issueMeta?.[key]?.type,
      subItems,
    }))
    .sort((a, b) => (a.issueKey < b.issueKey ? -1 : 1)); // Pitfall 2
}
```

### Markdown nested emit
```ts
for (const item of group.subItems) lines.push(`- ${item.label}`);
for (const st of group.subTaskGroups) {
  lines.push(`  - ${st.issueKey}: ${st.summary}`);
  for (const item of st.subItems) lines.push(`    - ${item.label}`);
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Quick run | `npx vitest run src/routes/standup-notes/YesterdayColumn.test.ts` |
| Full standup | `npx vitest run src/routes/standup-notes` |
| Lint/types | `npm run check` (biome + tsc — keep GREEN, see MEMORY) |

### Requirements → Test Map
| Behavior | Test Type | Command | Exists? |
|----------|-----------|---------|---------|
| Subtask worklog nests under subtask sub-group | unit (markdown) | `vitest run …/YesterdayColumn.test.ts` | extend existing |
| Commit/MR attributed to subtask nests | unit | same | ❌ Wave 0 add |
| Story with no subtask activity → unchanged | unit | same | ❌ Wave 0 add |
| No-meta → flat fallback (no nesting) | unit | same (exists, adjust) | ✅ exists |

### Wave 0 Gaps
- [ ] Extend `YesterdayColumn.test.ts`: nested subtask assertions + "no subtask activity unchanged" regression + commit/MR subtask attribution.

## Environment Availability
Not applicable — code-only change, all tooling (vitest, biome, tsc) already in repo.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Sub-task keys are always in `referencedKeys` (so meta available) because the four sources' origin keys feed `fetchIssueMeta` | Summary / Focus #2 | LOW — verified by reading StandupNotesPage `referencedKeys` memo; fallback to bare key handles any miss |
| A2 | Reusing/adding `originKey` on `SubItem` is cleaner than threading buckets through 4 loops | Architecture Pattern | LOW — implementer's call; both work |

## Open Questions
1. **Distinct `originKey` vs reuse `issueKey`?** — Recommend distinct `originKey` for partition + keep `issueKey` for click affordance. Implementer may consolidate if click semantics align; verify story-level worklog rows keep their click target.

## Sources
### Primary (HIGH)
- `taskflow/src/routes/standup-notes/YesterdayColumn.tsx` — `buildGroups`, `resolveRollup`, `ensureGroup`, `generateMarkdown`, render
- `taskflow/src/routes/standup-notes/IssueActivityGroup.tsx` — `SubItem`, header `div[role=button]` pattern, sub-item render
- `taskflow/src/routes/standup-notes/TodayInProgressSection.tsx` — `IssueRow indented` `pl-6 ml-2` nesting reference
- `taskflow/src/routes/standup-notes/StandupNotesPage.tsx` — `referencedKeys` → `fetchIssueMeta` wiring (confirms subtask meta availability)
- `taskflow/src/services/jira.ts` lines 776-835 — `StandupIssueMeta`, `fetchIssueMeta`
- `taskflow/src/routes/standup-notes/YesterdayColumn.test.ts` / `TodayColumn.markdown.test.ts` — test surface

## Metadata
- Standard stack: HIGH — no external deps
- Architecture: HIGH — all code read directly
- Pitfalls: HIGH — derived from in-code comments + existing tests
- Research date: 2026-06-06
- Valid until: stable (internal refactor, no moving external surface)
