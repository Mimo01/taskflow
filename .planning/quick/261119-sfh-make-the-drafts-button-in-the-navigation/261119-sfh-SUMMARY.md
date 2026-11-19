# Quick 261119-sfh: Drafts trigger as ghost button Summary

Restyled the TopBar Drafts trigger from a bordered rounded-full pill to a ghost button matching Search/Bell/Recent, with a neutral corner count badge capped at 99+.

## Changes
- `taskflow/src/components/app/DraftsChip.tsx`: trigger classes now `relative flex items-center gap-1.5 h-8 px-2 rounded text-sm hover:bg-muted transition-colors`, plus `bg-muted text-foreground` while open. PenLine is `w-5 h-5`. Count is an aria-hidden corner badge (`absolute -top-1 -right-1 bg-muted-foreground text-background ...`), showing `99+` above 99. aria-label, data-active, aria-haspopup, tooltip and popover are unchanged. Header comment updated.
- `taskflow/src/components/app/DraftsChip.test.tsx`: two new tests (99+ cap with no red class; ghost at rest, bg-muted when open, no border/rounded-full).

## Verification
vitest DraftsChip + TopBar: 31 passed. biome check on both files: clean. tsc --noEmit: clean.

## Commits
- 08132ed7: feat(quick-261119-sfh): restyle Drafts trigger as ghost button with neutral count badge

## Deviations
- Worktree HEAD was at 02466a34, so it was reset to base 7e951d2f per instructions.
- Ran `biome check --write` on the one touched test file only, to fix formatting.
