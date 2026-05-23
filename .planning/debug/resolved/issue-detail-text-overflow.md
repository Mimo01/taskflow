---
slug: issue-detail-text-overflow
status: resolved
trigger: on issue detail when there is too long text it should break
created: 2026-05-18
updated: 2026-05-18
---

## Symptoms

- **Expected:** Long text in the description field should wrap/break to the next line within its container
- **Actual:** Page scrolls horizontally instead of the text wrapping
- **Error messages:** None
- **Timeline:** Always been broken — never worked correctly
- **Reproduction:** Any long text in the description field on issue detail triggers it

## Current Focus

hypothesis: Missing `min-w-0` on the `flex-1` left column in IssueDetailPage + missing `break-words` on WikiRenderer article
test: visual verification with long text in description
expecting: text wraps within left column, no horizontal scroll
next_action: done
reasoning_checkpoint: In a flexbox row, `flex-1` items have `min-width: auto` by default, which means the item will refuse to shrink below its content's intrinsic size. Without `min-w-0`, a wide WikiRenderer output (long URL, code block, wide table) expands the left column past available width, causing the outer page to scroll horizontally. The `overflow-auto` on the left column only creates a scrollbar for its *own* content, it does not prevent the flex item from expanding. Fix: `min-w-0` on the flex item forces it to respect the flex layout boundary. Secondary fix: `break-words` on the prose article ensures unbreakable strings wrap at the word/character level.
tdd_checkpoint: ~

## Evidence

- timestamp: 2026-05-18T00:00:00Z
  file: taskflow/src/routes/dashboard/IssueDetailPage.tsx
  line: 371
  note: Left column is `flex-1 overflow-auto` with no `min-w-0`. Default flex min-width:auto means the item expands to fit content rather than being bounded by the available width.

- timestamp: 2026-05-18T00:00:00Z
  file: taskflow/src/routes/dashboard/WikiRenderer.tsx
  line: 724
  note: Article has `max-w-none` (correct) but no `break-words`. Long unbreakable tokens (URLs, long identifiers) have no fallback wrapping instruction at the container level.

## Eliminated

- WikiRenderer prose CSS: `@tailwindcss/typography` applies `overflow-wrap: break-word` to prose text elements, but this only applies to typography children, not to the container itself when the flex layout allows the container to grow unbounded.
- `overflow-auto` on the left column: this creates a local scroll context but does NOT cap the flex item's minimum width — the item still grows to accommodate content, pushing the outer layout wider.

## Resolution

root_cause: The left column flex item in IssueDetailPage (`flex-1 overflow-auto`, line 371) was missing `min-w-0`. In flexbox, `min-width: auto` (the default) prevents a flex item from shrinking below its content's intrinsic size. When WikiRenderer produces content with wide unbreakable tokens, the left column expands beyond the available viewport width, causing horizontal scroll at the outer layout level.
fix: (1) Added `min-w-0` to the left column div in IssueDetailPage.tsx line 371. (2) Added `break-words` to the WikiRenderer article element for belt-and-suspenders coverage of long unbreakable strings.
verification: Long text/URL in description field stays contained within the left column without horizontal scroll; other content layout (sidebar resize, overflow tables) unaffected.
files_changed: taskflow/src/routes/dashboard/IssueDetailPage.tsx, taskflow/src/routes/dashboard/WikiRenderer.tsx
