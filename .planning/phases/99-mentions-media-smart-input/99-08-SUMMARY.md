---
phase: 99-mentions-media-smart-input
plan: 08
subsystem: wiki-editor
tags: [tiptap, suggestion, slash-menu, settings-store]
requires: ["99-03", "99-06"]
provides:
  - "SLASH_ITEMS / filterSlashItems / SlashItem (Text, Blocks from INSERT_ITEMS, Insert)"
  - "WikiSlashSuggestion (/)"
  - "recentSlashItems + pushRecentSlashItem in settings store (v39 migration)"
  - "WIKI_OPEN_ATTACH_EVENT"
affects: [99-11 attach picker listener, 99-12 registration]
key-files:
  created:
    - taskflow/src/components/wiki-editor/suggestion/slash-items.ts
    - taskflow/src/components/wiki-editor/suggestion/slash-suggestion.ts
    - taskflow/src/components/wiki-editor/suggestion/slash.test.tsx
  modified:
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/stores/settings.store.test.ts
    - taskflow/src/components/wiki-editor/nodeviews/events.ts
key-decisions:
  - "Single-undo: the item's run() receives a Proxy of the editor whose chain() starts with deleteRange(range), so the /query deletion and the block change are one transaction without changing the InsertItem signature"
  - "Recent list is capped at 3 after dropping unknown ids, so a stale id never hides a valid recent"
requirements-completed: [BLOCK-05]
completed: 2026-11-17
---

# Phase 99 Plan 08: Slash menu Summary

`/` opens a grouped, filterable menu (Recent, Text, Blocks, Insert) on the shared suggestion factory; selecting an item removes `/query` and applies it in one transaction (one undo).

## Tasks

1. Recent items in the settings store (v39 migration, existing version-38 assertion updated) and `WIKI_OPEN_ATTACH_EVENT`: commit 3d743c51.
2. Slash items, extension and tests (16 tests): committed with this summary.

## Deviations from Plan

**1. [Rule 3 - Blocking] Mention and Emoticon tests assert on aria-controls, not popover count**
- The factory's renderer shell and the popover root both carry `data-suggestion`, so a count is unreliable when no rows render. Tests check the editor's `aria-controls` points at the mention or emoticon listbox.

**2. Task 1 pre-commit formatting**: biome formatting fix on the new store test before the hook passed.

## Known Stubs
None. `WikiSlashSuggestion` is not registered in the live editor (plan 12) and nothing listens for `WIKI_OPEN_ATTACH_EVENT` yet (plan 11), by design.

## Threat Flags
None. T-99-29 (unknown stored ids ignored, capped at 3, tested) and T-99-30 (v39 default migration, tested) mitigated.

## Self-Check: PASSED
