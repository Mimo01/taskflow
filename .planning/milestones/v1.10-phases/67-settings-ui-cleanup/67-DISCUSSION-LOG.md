# Phase 67: Settings UI Cleanup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 67-settings-ui-cleanup
**Areas discussed:** Toggle row design, Cleanup depth, Test strategy

---

## Toggle row design

| Option | Description | Selected |
|--------|-------------|----------|
| Checkbox + label only | Simple: [☐] Dashboard. Same section headers. Matches how other settings rows look. | ✓ |
| Switch toggle + label | Replace checkbox with a toggle switch component — feels more intentional as a visibility control. | |
| You decide | Keep checkbox + label, Claude picks the exact styling details. | |

**User's choice:** Checkbox + label only

---

**Section headers question:**

| Option | Description | Selected |
|--------|-------------|----------|
| Keep section headers | Groups the 9 items into their existing sections — easier to scan. | ✓ |
| Flat list, no headers | All items in one simple list — simpler since there's no reordering anyway. | |

**User's choice:** Keep section headers

---

## Cleanup depth

**reorderSidebarItem removal:**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, remove it | Zero callers after SidebarItemsList is cleaned up. No migration needed. | ✓ |
| Leave it in the store | Keep the dead action for now. Less diff, but leaves orphaned code. | |

**User's choice:** Yes, remove it

---

**@dnd-kit/* package removal:**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, uninstall them | No other file in src/ imports dnd-kit after this change. | ✓ |
| Leave them installed | Packages stay unused. Avoids touching package.json + lock file. | |

**User's choice:** Yes, uninstall them

---

## Test strategy

**Drag-handle test handling:**

| Option | Description | Selected |
|--------|-------------|----------|
| Delete drag tests, rewrite row test | Remove two drag tests; rewrite row structure test to assert [checkbox][label] order. Keep section headers + toggle tests. | ✓ |
| Delete drag tests only | Drop the two drag-handle tests. Don't add new assertions. | |
| You decide | Claude picks the most appropriate test coverage. | |

**User's choice:** Delete drag tests, rewrite row test

---

**Settings.test.tsx mock cleanup:**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, remove the mock | Once the action is gone from the store type, the mock becomes stale. | ✓ |
| Leave the mock | Extra mock properties in test setup don't break anything. | |

**User's choice:** Yes, remove the mock

---

## Claude's Discretion

- Exact CSS classes for the simplified row (hover state, gap, padding) — match existing settings row patterns
- Doc-comment update for SidebarItemsList.tsx — replace stale "Sortable checkbox list … dnd-kit" header
- Commit ordering within the plan — planner decides based on type-safe incremental ordering

## Deferred Ideas

None — discussion stayed within phase scope.
