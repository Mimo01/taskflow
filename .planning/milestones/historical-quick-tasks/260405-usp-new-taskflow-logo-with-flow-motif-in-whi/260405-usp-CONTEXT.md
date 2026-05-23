# Quick Task 260405-usp: New Taskflow logo with flow motif - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Task Boundary

Create a new logo for the Taskflow app incorporating a 'flow' motif. Replace the current logo in the app icon and main sidebar. The logo should use white, orange (#f97316), and blue (#0ea5e9) — the existing brand colors. Multiple iterations expected with user steering.

</domain>

<decisions>
## Implementation Decisions

### Logo Style
- Abstract symbol — standalone graphic representing flow + tasks, optimized for small sizes (sidebar 32x32, favicon, app icon)

### Flow Representation
- Curved wave/swoosh — smooth flowing curves suggesting motion and fluidity

### Background Treatment
- White background — clean white consistent with macOS/iOS icon guidelines, matching current approach

### Claude's Discretion
- Specific SVG geometry and composition details
- Number of variants per iteration round

</decisions>

<specifics>
## Specific Ideas

- App is called "Taskflow" — the word "Taskflow" text is already displayed separately in the sidebar next to the icon
- Current colors: blue (#0ea5e9), orange (#f97316), white (#ffffff), gray (#94a3b8 for accents)
- User wants to keep orange and blue as primary colors, white background
- Current icon uses macOS squircle clip path (824x824 centered in 1024x1024, rx=185)
- Iterative design process — present multiple options, user will steer direction

</specifics>

<canonical_refs>
## Canonical References

- `taskflow/src/components/app/AppIcon.tsx` — Inline SVG component used in sidebar (32x32)
- `taskflow/public/app-icon.svg` — Public SVG file
- `taskflow/app-icon-source.svg` — Source SVG (1024x1024)
- `taskflow/src-tauri/icons/icon.icns` — macOS app icon
- `taskflow/src-tauri/icons/icon.ico` — Windows app icon
- `taskflow/src-tauri/icons/icon.png` — PNG app icon
- `taskflow/index.html` — favicon reference (currently vite.svg)

</canonical_refs>
