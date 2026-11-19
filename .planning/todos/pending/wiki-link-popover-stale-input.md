---
type: todo
status: pending
created: 2026-11-19
origin: phase-98 verification (98-VERIFICATION.md, v1.15 close)
priority: medium
---

# Wiki editor: link popover keeps stale input between opens

`src/components/wiki-editor/toolbar/LinkPopover.tsx:28-29` sets the URL field and error once at mount and never resets them on reopen.

- After a rejected `javascript:alert(1)` and Esc, the next ⌘K shows the bad text and the error again. Typing appends to it, so the next URL is rejected too.
- Opening on an existing link shows the old text, not that link's URL.

Likely cause of the "second ⌘K did not apply" note in 98-HUMAN-UAT test 9. Fix: reset the field and error each time the popover opens (seed from the current link's href), plus a test that reopens it.
