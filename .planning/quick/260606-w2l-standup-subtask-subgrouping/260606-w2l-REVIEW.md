---
phase: 260606-w2l-standup-subtask-subgrouping
reviewed: 2026-06-06T00:00:00Z
depth: quick
files_reviewed: 3
files_reviewed_list:
  - taskflow/src/routes/standup-notes/IssueActivityGroup.tsx
  - taskflow/src/routes/standup-notes/YesterdayColumn.tsx
  - taskflow/src/routes/standup-notes/YesterdayColumn.test.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# 260606-w2l: Code Review Report

**Reviewed:** 2026-06-06  
**Depth:** quick (standard depth applied — full file reads performed)  
**Files Reviewed:** 3  
**Status:** issues_found

## Summary

This change adds sub-task sub-grouping to the standup "Yesterday" column. The core partition pass logic is correct: origin-key tagging is applied consistently across all four data sources (worklogs, Jira activity, commits, MR events), the `bySubtask` Map correctly accumulates per-origin items, and the resulting `subTaskGroups` array is sorted by issueKey ascending. Empty-sub-group guards are in place at both the component (`subItems.length > 0`) and the partition pass level (only non-empty subtasks appear in `bySubtask`). Regression for stories with no sub-task activity is handled correctly — the `origin === group.issueKey` branch routes them to `storyLevel` regardless.

Three issues merit attention: one timezone-sensitive test that will fail in environments east of UTC+9, one ARIA descendant-interactivity violation introduced by the new sub-task header, and one incomplete sort comparator. Two dead-code items round out the findings.

---

## Warnings

### WR-01: `getColumnHeading` tests are timezone-flaky

**File:** `taskflow/src/routes/standup-notes/YesterdayColumn.test.ts:336,345`

**Issue:** Both "section header label" tests pin fake time to `new Date('2026-05-26T09:00:00Z')` — a UTC instant. `getColumnHeading` computes `calYesterdayLocal` using `new Date()` then local-calendar getters (`getFullYear()`, `getMonth()`, `getDate()`). In a timezone east of UTC+9 (e.g. UTC+10 or UTC+12), `T09:00:00Z` is already the next local calendar day (2026-05-27 locally), so `calYesterdayLocal` becomes `2026-05-26` — making the "Yesterday" test pass for the wrong date and the "day name" test assert "Saturday" instead of "Friday". The tests will produce false passes or outright failures depending on the CI runner's system timezone.

**Fix:** Either pin the fake time to local noon to eliminate the boundary (`new Date('2026-05-26T12:00:00')` without the Z suffix, relying on local time), or set `TZ=UTC` in the Vitest config / test environment so behavior is deterministic:

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    env: { TZ: 'UTC' },
  },
});
```

Or in the tests themselves, use a midday UTC time well away from the day boundary:

```ts
vi.setSystemTime(new Date('2026-05-26T12:00:00.000Z')); // safe for all timezones UTC-12..UTC+12
```

---

### WR-02: ARIA descendant-interactivity violation in sub-task sub-group header

**File:** `taskflow/src/routes/standup-notes/IssueActivityGroup.tsx:204-229`

**Issue:** The new sub-task header uses `div[role=button]` (interactive ARIA role) wrapping a child `<button>` (line 218). The ARIA in HTML specification §4 prohibits interactive-role elements from owning interactive descendants. This is distinct from the HTML nesting rule (which applies only to `<button>` elements), and the `biome-ignore` comment incorrectly frames the issue as "nested buttons are invalid HTML" — it is actually an ARIA widget constraint that applies to the `role=button` div regardless of the host element type. Screen readers (NVDA, JAWS, VoiceOver) may swallow or double-announce the inner button, or the outer role may suppress the inner button's activation entirely. The parent group header at line 162-188 has the same pattern, but that was pre-existing; the sub-task header is new to this change.

**Fix:** Adopt the same pattern as the parent header: use the `div[role=button]` outer shell for the body-click (peek), and for the key navigation button, place it outside the `div[role=button]` in the DOM flow (e.g. as a sibling in a `flex` row, not a descendant). If layout requires the button to appear visually inside the header row, use absolute/relative positioning or restructure so the header row is a flex container whose children are the icon, key button, and summary span — making the entire row clickable via wrapping overlay rather than nesting roles.

---

### WR-03: Incomplete sort comparator for sub-task groups (returns non-zero for equal keys)

**File:** `taskflow/src/routes/standup-notes/YesterdayColumn.tsx:458`

**Issue:** `(a.issueKey < b.issueKey ? -1 : 1)` returns `1` when `a.issueKey === b.issueKey`, incorrectly treating them as `a > b`. Since `issueKey` is a Map key, duplicates cannot occur at runtime — but if this comparator is ever copied or the data source changes, the sort is silently wrong for equal values and may break sort stability guarantees on some engines.

**Fix:**
```ts
.sort((a, b) => (a.issueKey < b.issueKey ? -1 : a.issueKey > b.issueKey ? 1 : 0));
```

---

## Info

### IN-01: `mr-open` SubItemKind variant is dead code

**File:** `taskflow/src/routes/standup-notes/IssueActivityGroup.tsx:27,87`

**Issue:** `'mr-open'` appears in the `SubItemKind` union (line 27) and the `subItemIcon` switch (line 87), but `buildGroups()` in `YesterdayColumn.tsx` never pushes a sub-item with `kind: 'mr-open'`. MR open events fall through the non-approval branch and become comment-count entries. The variant is unreachable through any current code path.

**Fix:** Either remove `'mr-open'` from `SubItemKind` and the switch (if MR-open tracking is genuinely deferred), or add a `// TODO: MR-open kind reserved for future MR open events` note so the intent is clear. Removing it now gives a compile-time guarantee the type union matches what is emitted.

---

### IN-02: `generateMarkdown` sub-task nesting is not tested for the worklog sub-item click-target (`issueKey` field)

**File:** `taskflow/src/routes/standup-notes/YesterdayColumn.test.ts:112-139`

**Issue:** The "groups a subtask worklog under its parent story" test (line 112) correctly verifies the markdown nesting (`  - ESHOP-2: Wire up form`, `1h · ESHOP-2 Wire up form`). However, it does not assert that the worklog sub-item's `issueKey` field (the click-to-subtask affordance set at YesterdayColumn.tsx line 287) is set to `'ESHOP-2'` when the item is partitioned into a sub-task sub-group. This is a pure rendering concern tested only indirectly — if someone accidentally strips the `issueKey` field during a future refactor, the markdown test would still pass but the click affordance would silently break in the UI.

**Fix:** Add a unit test for `buildGroups` directly (or expose it for testing), or extend the existing markdown test to verify that the sub-item label is correctly nested (4-space indented in `generateMarkdown`) rather than flat — the current test already partially covers this at line 135-137, so this is a low-priority gap.

---

_Reviewed: 2026-06-06_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
