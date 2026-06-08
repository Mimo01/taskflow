# Quick Task 260608-cwq: Standup Notes — Per-Worklog Flat Display — Research

**Researched:** 2026-06-08
**Domain:** Standup notes page, YesterdayColumn, Tempo worklog rendering
**Confidence:** HIGH (all findings from direct codebase inspection)

---

## Summary

The standup notes page aggregates multiple Tempo worklogs for the same issue into a single sub-item showing summed duration. The grouping happens in `buildGroups()` inside `YesterdayColumn.tsx`. The fix is entirely in that one function: stop summing, emit one `SubItem` per raw worklog instead. The `comment` field on `TempoWorklog` is already fetched and available — it just isn't passed through today.

**Primary recommendation:** Modify the worklog accumulation block in `buildGroups()` (lines 307–339) to push one `SubItem` per `TempoWorklog` entry rather than accumulating into a per-issue map. Pass `worklog.comment` as a second field on `SubItem` and render it in `SubItemList` inside `IssueActivityGroup`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Show duration + description only (no author, no timestamp)
- Flat list under each issue — each worklog appears as its own row directly under the issue, no sub-grouping
- Show placeholder text "(no description)" when a worklog has no description field

### Claude's Discretion
- Exact visual styling/spacing of the individual worklog rows (padding, font size, color) — follow existing UI patterns
</user_constraints>

---

## Where the Grouping Happens

**File:** `taskflow/src/routes/standup-notes/YesterdayColumn.tsx`
**Function:** `buildGroups()` — lines ~307–339

The current logic builds a `worklogByGroup` map:

```typescript
// Current (groups multiple worklogs per issue into one sum)
const worklogByGroup = new Map<string, Map<string, { seconds: number; summary: string }>>();
for (const worklog of tempoData ?? []) {
  const group = ensureGroup(worklog.issue.key, ...);
  group.totalSeconds += worklog.timeSpentSeconds;
  const perIssue = worklogByGroup.get(group.issueKey) ?? new Map(...);
  const entry = perIssue.get(worklog.issue.key) ?? { seconds: 0, summary: ... };
  entry.seconds += worklog.timeSpentSeconds;  // ← SUMMING HERE
  perIssue.set(worklog.issue.key, entry);
  worklogByGroup.set(group.issueKey, perIssue);
}
for (const [groupKey, perIssue] of worklogByGroup) {
  for (const [issueKey, { seconds, summary }] of perIssue) {
    group.subItems.push({
      kind: 'worklog',
      label: `${formatDuration(seconds)} · ${issueKey} ${summary}`,  // ← single aggregated row
      ...
    });
  }
}
```

The `group.totalSeconds` stat line accumulation (for the header "X hours logged") should be kept — only the per-sub-item aggregation needs to change.

---

## Data Shape Available

`TempoWorklog` type (`src/services/tempo/types.ts`) has:

| Field | Type | Notes |
|-------|------|-------|
| `timeSpentSeconds` | `number` | Duration — always present |
| `comment` | `string \| undefined` | Worklog description — **already fetched**, just not rendered |
| `issue.key` | `string` | Issue key |
| `issue.summary` | `string \| undefined` | Issue summary |
| `tempoWorklogId` | `number \| undefined` | Unique ID — can serve as React key |
| `jiraWorklogId` | `number \| undefined` | Alternative unique ID |

The `comment` field is the description the user wants displayed. It is optional — use `"(no description)"` fallback per the locked decision.

---

## Integration Points — What Needs to Change

### 1. `SubItem` type — add optional `description` field
**File:** `src/routes/standup-notes/IssueActivityGroup.tsx`

```typescript
export interface SubItem {
  // ... existing fields ...
  /** Worklog description text; present on 'worklog' sub-items only. */
  description?: string;
}
```

### 2. `buildGroups()` — replace aggregation with flat per-worklog push
**File:** `src/routes/standup-notes/YesterdayColumn.tsx`

Replace the `worklogByGroup` map accumulation entirely. New approach:
- Keep `group.totalSeconds += worklog.timeSpentSeconds` for the stat line
- Push one `SubItem` per worklog with `description: worklog.comment ?? undefined`
- The `label` becomes just the duration: `formatDuration(worklog.timeSpentSeconds)`
- Keep `issueKey` (for subtask click-through) and `originKey` (for partition pass)

```typescript
// New: one sub-item per raw worklog entry
for (const worklog of tempoData ?? []) {
  const group = ensureGroup(worklog.issue.key, worklog.issue.summary, worklog.issue.issueType?.name);
  group.totalSeconds += worklog.timeSpentSeconds;  // stat line unchanged

  const rollupKey = group.issueKey;
  const originKey = worklog.issue.key;
  group.subItems.push({
    kind: 'worklog',
    label: `${formatDuration(worklog.timeSpentSeconds)}`,
    description: worklog.comment || undefined,
    issueKey: originKey !== rollupKey ? originKey : undefined,
    originKey,
  });
}
```

Note: the old `worklogByGroup` map and its post-loop emission block are **deleted** entirely.

### 3. `SubItemList` render — show description line under duration
**File:** `src/routes/standup-notes/IssueActivityGroup.tsx`

For `kind === 'worklog'` items, render a second line for the description. Follow the existing pattern used by `transition` items which have a special render branch. The label (duration) stays on the main line; description goes on a subordinate `text-xs text-muted-foreground` line.

```tsx
// Inside SubItemList, the plain div render branch:
<div key={i} className="flex items-start gap-2 py-1.5 px-2">
  <SubIcon className="size-4 shrink-0 text-muted-foreground mt-0.5" />
  <div className="flex-1 min-w-0">
    <span className="text-sm text-foreground">{item.label}</span>
    {item.kind === 'worklog' && (
      <p className="text-xs text-muted-foreground truncate">
        {item.description ?? '(no description)'}
      </p>
    )}
  </div>
</div>
```

The clickable button branches (MR click, issue click) also need the same two-line layout for worklog items. Since worklogs with `issueKey` set (subtask click-through) fall into the `isClickableIssue` branch, that branch must also be updated to render description.

### 4. Markdown export — no change needed
`generateMarkdown()` reads `item.label` directly. The label already included `issueKey summary` suffix in the old code. With the new code, `label` is just the duration — this changes the markdown output. Consider whether to append the description to the label string for markdown purposes, or keep markdown as duration-only. Given the context decision ("show duration + description"), it would be natural to include the description in markdown too. This is a minor discretion call — include it as `${formatDuration(seconds)} · ${worklog.comment ?? '(no description)'}`.

---

## Pitfalls

### Partition pass still works
The sub-task partition pass (lines 494–519) operates on `item.originKey` to decide whether an item belongs at story-level or sub-task level. Since `originKey` is still set per worklog, this logic is unaffected.

### `tempoWorklogId` as React key
The current `SubItemList` uses array index as key (with a biome suppression comment). With multiple worklogs per issue, index is still stable within a single render, so nothing breaks. However, using `worklog.tempoWorklogId ?? worklog.jiraWorklogId ?? i` as a key on the `SubItem` would be cleaner — achievable by adding an optional `id` field to `SubItem`. Low priority.

### `items.length === 0` guard in `SubItemList`
No change needed — still correct.

---

## Sources

- `src/routes/standup-notes/YesterdayColumn.tsx` — direct inspection [VERIFIED: codebase]
- `src/routes/standup-notes/IssueActivityGroup.tsx` — direct inspection [VERIFIED: codebase]
- `src/services/tempo/types.ts` — direct inspection [VERIFIED: codebase]
- `src/services/tempo/worklogs.ts` — direct inspection [VERIFIED: codebase]
