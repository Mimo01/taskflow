---
phase: 40-settings-about-menu-integration
plan: "01"
subsystem: about-dialog
tags: [about, dialog, menu, tauri, rust]
dependency_graph:
  requires: []
  provides: [AboutDialog, menu-about-event]
  affects: [taskflow/src/main.tsx, taskflow/src-tauri/src/lib.rs]
tech_stack:
  added: []
  patterns: [controlled-dialog, menu-event-listener, zustand-selector]
key_files:
  created:
    - taskflow/src/components/about/AboutDialog.tsx
  modified:
    - taskflow/src-tauri/src/lib.rs
    - taskflow/src/main.tsx
decisions:
  - "Used DialogFooter with explicit Button rather than showCloseButton prop — gives more control over button styling and matches UpdateDialog pattern"
  - "Kept menu-about id consistent between app_menu and help_menu items — both emit same event to frontend"
metrics:
  duration: "2min"
  completed: "2026-03-25"
---

# Phase 40 Plan 01: About Dialog and Native Menu Wiring Summary

**One-liner:** Custom React About dialog wired to native macOS/Windows/Linux menu bar via Tauri menu-about event, displaying version, build date, commit SHA, platform, and live update status.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create AboutDialog component and wire Rust menu events | b6f31e4 | AboutDialog.tsx, lib.rs, main.tsx |

## What Was Built

**AboutDialog.tsx** (`taskflow/src/components/about/AboutDialog.tsx`):
- Controlled dialog (`open`/`onClose` props) using the existing `@base-ui/react/dialog`-backed Dialog primitives
- App icon centered at top (`/app-icon.svg`, 64x64)
- "Taskflow" heading with `text-lg font-semibold text-center` (per UI-SPEC typography contract)
- Metadata rows for Version, Build Date, Commit SHA, Platform — each row has `text-sm font-semibold` label and `text-sm text-muted-foreground` value
- Platform derived from `navigator.platform` (Mac → macOS, Win → Windows, else Linux)
- Update status row: reads from `useUpdateStore` — `CheckCircle` (green) for up-to-date, `ArrowUpCircle` (yellow) for update available with version
- `max-w-sm` dialog width per UI-SPEC, `showCloseButton={false}` with explicit Close button in footer

**lib.rs** changes:
- Replaced `PredefinedMenuItem::about(handle, Some("About TaskFlow"), None)?` with `MenuItemBuilder::new("About TaskFlow").id("menu-about").build(handle)?` in the macOS app menu
- Added a second `about_help_item` with same id `"menu-about"` after a separator in the Help menu (Windows/Linux visibility)
- Added `"menu-about"` to the `on_menu_event` match arm alongside existing menu event handlers

**main.tsx** changes:
- Import added: `import { AboutDialog } from './components/about/AboutDialog'`
- State added: `const [aboutOpen, setAboutOpen] = useState(false)`
- Listener added to the existing listeners array: `listen('menu-about', () => setAboutOpen(true))`
- Render added after KeyboardShortcutsPanel: `<AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />`

## Deviations from Plan

None — plan executed exactly as written. The only TypeScript error (`Settings.tsx` importing `./UpdatesSection`) is a pre-existing error from parallel Plan 02 execution and is unrelated to this plan.

## Known Stubs

None — all metadata fields source from real `buildInfo` constants and live `useUpdateStore` state. No hardcoded placeholder values.

## Self-Check: PASSED

- [x] `taskflow/src/components/about/AboutDialog.tsx` — exists and exports `AboutDialog`
- [x] `taskflow/src-tauri/src/lib.rs` — contains `MenuItemBuilder::new("About TaskFlow")` (2 occurrences), no `PredefinedMenuItem::about`
- [x] `taskflow/src/main.tsx` — contains `listen('menu-about'`, `aboutOpen`, `<AboutDialog`
- [x] Commit b6f31e4 — verified via git log
