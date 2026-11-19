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

## UAT iterations (2026-11-19) — Approved

Rejected along the way: ghost "Drafts" + grey corner badge (badge/icon too big), shrinking all top-bar icons (siblings must not be edited), outline button, inline grey pill, muted inline count, "2 drafts" label variants, pen + count, label-only with count in tooltip, pen + badge (badge sits on the pen tip), FileText (badge on the folded corner).

**Final (ecdb37dc):** icon button identical to Search/Recent/Bell (w-8 h-8 rounded, hover/open bg-muted), `NotebookText` icon at w-5 h-5, bell-shaped badge (same size/position) in soft blue `bg-blue-200 text-blue-800 dark:bg-blue-500/55 dark:text-white`, capped 99+; hairline divider before the icon group; tooltip "N saved drafts"; list header "Drafts N". Sibling buttons unchanged.
