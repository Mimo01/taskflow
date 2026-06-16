---
phase: quick-260616-ktv
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/stores/settings.store.ts
  - taskflow/src/stores/settings.store.test.ts
autonomous: true
requirements: [MYTASK-01]
must_haves:
  truths:
    - "An existing-user persisted store lacking a my-tasks sidebar item gains { id: 'my-tasks', visible: true } after migration"
    - "A store that already contains my-tasks is left unchanged (no duplicate)"
    - "settings.store persist version is 27"
    - "npm run check stays GREEN"
  artifacts:
    - path: "taskflow/src/stores/settings.store.ts"
      provides: "appendMyTasksItemIfMissing helper + v27 migration block"
      contains: "appendMyTasksItemIfMissing"
    - path: "taskflow/src/stores/settings.store.test.ts"
      provides: "unit coverage for the v27 my-tasks migration helper"
      contains: "appendMyTasksItemIfMissing"
  key_links:
    - from: "settings.store.ts migrate() if (version < 27)"
      to: "appendMyTasksItemIfMissing"
      via: "Array.isArray(s.sidebarItems) guard then reassign s.sidebarItems"
      pattern: "appendMyTasksItemIfMissing\\(s\\.sidebarItems"
---

<objective>
Close milestone-audit BLOCKER MYTASK-01: the "My Tasks" sidebar entry is invisible for existing users because settings.store.ts (version 26) has no migration injecting the `my-tasks` SidebarItem into persisted `sidebarItems` arrays. Sidebar.tsx builds visibleIds from persisted sidebarItems and filters SIDEBAR_NAV_ITEMS against it, so the entry never appears for stores already past v9.

Mirror the existing `appendStandupNotesItemIfMissing` helper exactly (v23 migration). Add `appendMyTasksItemIfMissing`, bump version 26→27, add the guarded `if (version < 27)` block.

Purpose: Existing users see "My Tasks" in the sidebar without resetting settings.
Output: One new helper, one version bump, one migration block, unit coverage, updated stale version-assertion test.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@taskflow/src/stores/settings.store.ts
@taskflow/src/stores/settings.store.test.ts
@taskflow/src/components/app/sidebar-items.ts

# Verified facts (do not re-discover):
# - SidebarItem shape is { id: string; visible: boolean } (sidebar-items.ts:21-24).
# - The `my-tasks` nav item id is 'my-tasks' (sidebar-items.ts:44-50).
# - Existing helpers (appendAioItemIfMissing v16, appendWorklogsItemIfMissing v21,
#   appendStandupNotesItemIfMissing v23) ALL: guard with items.some(i => i.id === ID),
#   and APPEND at the end via [...items, { id: ID, visible: true }]. Match this exactly —
#   append at the end, do NOT splice into a specific position.
# - Each sidebar migration block is guarded by `if (Array.isArray(s.sidebarItems)) { ... }`.
# - settings.store.test.ts:482-490 asserts version === 26 — this WILL break on the bump and
#   MUST be updated to 27.
# - The inline migrate() function is NOT exported (Phase 55 note at test.ts:261-265), so prior
#   migration tests assert outcomes indirectly. This plan exports the new helper to allow direct
#   unit testing of the append logic.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add appendMyTasksItemIfMissing helper and v27 migration</name>
  <files>taskflow/src/stores/settings.store.ts</files>
  <action>
    Add an EXPORTED helper `appendMyTasksItemIfMissing(items: SidebarItem[]): SidebarItem[]` immediately after `appendStandupNotesItemIfMissing` (around line 236). Mirror that helper exactly: if `items.some((i) => i.id === 'my-tasks')` return `items` unchanged; otherwise return `[...items, { id: 'my-tasks', visible: true }]`. Append at the END like every existing sidebar helper — do not splice into a position. Mark it `export function` (the existing siblings are unexported, but exporting this one enables direct unit testing in Task 2; this is the only deviation from the precedent).

    Bump the persist `version: 26` to `version: 27` (line 351).

    Add a new migration block AFTER the `if (version < 26)` block and BEFORE `return persisted as SettingsState;` (around line 457), mirroring the v23 standup-notes block exactly:
      if (version < 27) {
        if (Array.isArray(s.sidebarItems)) {
          s.sidebarItems = appendMyTasksItemIfMissing(s.sidebarItems as SidebarItem[]);
        }
      }

    Do not touch getDefaultSidebarItems (fresh stores already get my-tasks from SIDEBAR_NAV_ITEMS). Do not reorder existing migration blocks.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit -p tsconfig.json 2>&1 | tail -5; grep -n "appendMyTasksItemIfMissing\|version: 27\|if (version < 27)" src/stores/settings.store.ts</automated>
  </verify>
  <done>tsc passes; grep shows the exported helper, version: 27, and the if (version < 27) block all present.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Unit test the migration helper and fix stale version assertion</name>
  <files>taskflow/src/stores/settings.store.test.ts</files>
  <behavior>
    - appendMyTasksItemIfMissing([]) returns an array containing { id: 'my-tasks', visible: true }.
    - Given an existing-user array WITHOUT my-tasks (e.g. [{id:'dashboard',visible:true},{id:'backlog',visible:false}]), the helper appends { id: 'my-tasks', visible: true } and preserves the original items and their order.
    - Given an array that ALREADY contains { id: 'my-tasks', visible: false }, the helper returns it unchanged (same length, no duplicate, visible stays false).
  </behavior>
  <action>
    Import `appendMyTasksItemIfMissing` from './settings.store' alongside the existing `useSettingsStore` import (line 18).

    Add a new `describe('settings.store — my-tasks migration (quick 260616-ktv)', () => { ... })` block with the three `it` cases from <behavior>. Assert on the helper's pure return value (no renderHook/act needed — it's a pure function). For the "already present" case, assert the returned array length equals input length and that the my-tasks item's visible flag is unchanged.

    Fix the now-stale version assertion: in the 'persist version is 26 ...' test (test.ts:482-490), update both the `it(...)` description and `expect(version).toBe(26)` to expect 27. Update the comment to reference Phase quick-260616-ktv adding the my-tasks migration. Do NOT weaken it to toBeGreaterThanOrEqual — keep an exact-match assertion at 27 so future drift is caught.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/stores/settings.store.test.ts 2>&1 | tail -20</automated>
  </verify>
  <done>vitest passes all settings.store.test.ts cases including the three new my-tasks helper tests and the updated version===27 assertion.</done>
</task>

</tasks>

<verification>
- `cd taskflow && npm run check` is GREEN (biome check + tsc).
- `cd taskflow && npx vitest run src/stores/settings.store.test.ts` passes.
- Migration is idempotent: a store already containing my-tasks is not duplicated.
</verification>

<success_criteria>
- appendMyTasksItemIfMissing exists, exported, matches the append-at-end precedent of the three sibling helpers.
- persist version is 27 with a guarded if (version < 27) block calling the helper.
- Existing-user stores (past v9, no my-tasks) gain the item; stores with it are untouched.
- npm run check stays GREEN; the stale version===26 test is updated to 27.
</success_criteria>

<output>
Create `.planning/quick/260616-ktv-my-tasks-sidebar-migration/260616-ktv-SUMMARY.md` when done
</output>
