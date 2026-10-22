# Quick Task 261022-h1q: Cmd+Shift+F opens global search; Cmd+F searches current page content only - Context

**Gathered:** 2026-10-22
**Status:** Ready for planning

<domain>
## Task Boundary

1. Rebind the existing command palette (global search) from Cmd+F to Cmd+Shift+F (handler in `src/main.tsx` ~line 247, registry entry `open-palette` in `src/lib/shortcuts.ts`; shortcuts panel + palette hint glyphs come from `displayKeys`).
2. New Cmd+F = find-in-page: searches only the actual page content — NOT the sidebar menu, NOT the pinned-tabs bar.

Native browser find is NOT usable: Tauri's macOS WKWebView has no built-in find bar (that UI belongs to Safari), Tauri exposes no find API, and native find would cover the whole window incl. sidebar/pinned bar. The app already suppresses native Cmd+F in a capture-phase listener. → Custom implementation.

</domain>

<decisions>
## Implementation Decisions

### Matching (user-locked)
- Case-insensitive
- Live: highlights recompute as the user types AND when the searched content changes (MutationObserver, debounced)
- Accent/diacritic-insensitive: "cafe" matches "café", "zluty" matches "žlutý" (normalize NFD + strip combining marks, with an index map back to original text offsets — normalization can change string length, so map per character)

### Find bar UI (Claude's discretion)
- Small floating bar anchored top-right of the searched region (like Chrome/VS Code), does not shift layout
- Input, "n/m" match counter (or "No results"), prev/next buttons, close button
- Enter = next, Shift+Enter = prev, Esc = close (clears highlights); Cmd+F while open re-focuses + selects input text
- Current match gets a stronger highlight and is scrolled into view (block: 'center' / 'nearest')
- Use the app's existing design tokens/primitives (Tailwind v4, existing Button/Input style), theme-aware

### Search scope (Claude's discretion)
- Default scope: the route content area `<main>` in `src/main.tsx` (excludes sidebar + pinned bar)
- Topmost layer wins: if a modal dialog (role="dialog"/aria-modal) or the Peek panel is open, search inside the topmost one instead
- Exclude the find bar itself, hidden elements (display:none/visibility hidden, `hidden`, aria-hidden subtrees), script/style, and form-control values (inputs/textarea are not text nodes — fine to skip)

### Virtualized lists (Claude's discretion)
- Rendered text only — generic DOM search. Off-screen rows in virtualized tables (Backlog etc.) are not matched; accepted limitation

### Highlighting
- Prefer CSS Custom Highlight API (`CSS.highlights`, `::highlight(name)`) — no DOM mutation, so it never fights React reconciliation. WKWebView supports it (Safari 17.2+). Two highlights: all matches + current match.

</decisions>

<specifics>
## Specific Ideas

- Keep the old palette shortcut entry in shortcuts.ts updated (⌘⇧F) and add a new entry for "Find in page" (⌘F) so the shortcuts panel and palette hints stay correct.
- Cmd+Shift+F must not collide with existing mod+shift+* nav bindings (checked: F is free).

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>
