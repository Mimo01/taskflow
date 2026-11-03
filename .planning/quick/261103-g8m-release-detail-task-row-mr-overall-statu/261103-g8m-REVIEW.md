---
status: resolved
depth: quick
findings: { blocker: 0, warning: 2, info: 3 }
---
# Code Review 261103-g8m

Commits cbfa3cfe..86822781. Focus areas checked: the overlay sitting beside the popover triggers, keepMounted keeping fix state, the aggregate BR/MS marks, React Compiler, and one-line rows. All are sound.

- **WR-01 (FIXED 75efb45c):** the chip's aria-label did not include its visible label (WCAG 2.5.3). It now starts with the label.
- **WR-02 (WON'T FIX, by design):** a failed fix isn't shown on the row while the popover is closed. Per the planning decision, the row keeps the orange flag and the retry waits in the popover.
- **IN-01 (FIXED 75efb45c):** duplicate `p-1` on PopoverContent.
- **IN-02:** `stopPropagation` on the triggers is redundant, since the overlay is a sibling. Harmless; kept.
- **IN-03:** visually check the chip at the narrowest width (UAT).
- Note: package.json allows `@base-ui/react ^1.2.0`, but multiple triggers per Popover Root has only been checked on the installed 1.3.0.
