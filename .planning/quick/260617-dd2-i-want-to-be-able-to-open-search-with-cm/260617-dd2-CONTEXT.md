# Quick Task 260617-dd2: Change search shortcut from cmd+k to cmd+f - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning

<domain>
## Task Boundary

Change the keyboard shortcut that opens search from cmd+k to cmd+f. The shortcut should be intercepted at the app level in the Tauri desktop app.

</domain>

<decisions>
## Implementation Decisions

### Scope of cmd+f rebind
- cmd+f should open search everywhere in the app (all views, globally)

### Browser/native conflict
- Intercept cmd+f and suppress the native browser find-in-page behavior entirely; open Taskflow search instead

### What happens to cmd+k
- Remove cmd+k entirely — clean break, no alias kept

### Claude's Discretion
- Exact mechanism for intercepting the native cmd+f (Tauri event hook vs. web-level keydown handler)
- Which component/hook currently registers cmd+k and how to update it

</decisions>

<specifics>
## Specific Ideas

No specific implementation references — standard keybinding update in the existing shortcut registration layer.

</specifics>
