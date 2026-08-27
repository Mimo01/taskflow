# Quick Task 260827-eaj: Add a settings option to open links in a user-selectable browser - Context

**Gathered:** 2026-08-27
**Status:** Ready for planning

<domain>
## Task Boundary

In the app there are quite a few 'open in browser' links. Also descriptions/comments/so on can contain links that are opened in external browser on clicking them. Add a settings option to open links in a user-selectable browser.

</domain>

<decisions>
## Implementation Decisions

### Scope of links affected
- The selected-browser preference applies to ALL external links app-wide: dedicated "open in browser" buttons/menu items AND links clicked inside rendered descriptions/comments (wiki content, TipTap-rendered HTML, etc.).

### Browser list source
- Claude's discretion — must work cross-platform (macOS, Windows, Linux, since this is a Tauri app). Research phase should determine the most feasible detection approach (auto-detect installed browsers vs. manual path entry) given Tauri's plugin ecosystem and OS APIs, and the planner should pick the simplest approach that reliably works on all three platforms. A "System Default" option should always be available regardless of approach.

### Fallback behavior
- If the selected browser can't be launched, silently fall back to opening with the OS default browser. No toast/notification on fallback — fail quietly and just get the link open.

</decisions>

<specifics>
## Specific Ideas

No specific UI mockups or exact settings copy specified — implement as a new setting under wherever app preferences/settings currently live (e.g. a "Browser" or "Links" section), following existing settings UI patterns in the app.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>
