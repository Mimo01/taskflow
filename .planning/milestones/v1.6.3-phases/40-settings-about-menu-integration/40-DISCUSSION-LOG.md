# Phase 40: Settings, About & Menu Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 40-settings-about-menu-integration
**Areas discussed:** About dialog design, Menu bar integration, Updates settings section, Version history

---

## About Dialog Design

| Option | Description | Selected |
|--------|-------------|----------|
| Custom React modal | Shadcn Dialog with app icon, version, build date, commit SHA, platform/arch, live update status | ✓ |
| Native macOS About | Keep PredefinedMenuItem::about — limited, no update status, Windows/Linux get nothing | |
| Hybrid | Native About on macOS + separate custom dialog in Help menu | |

**User's choice:** Custom React modal
**Notes:** None

### Follow-up: Additional info

| Option | Description | Selected |
|--------|-------------|----------|
| Just the essentials | Version, build date, commit SHA, platform/arch, update status | ✓ |
| Add links | GitHub repo, documentation, report issue | |
| Add tech credits | "Built with Tauri, React, TypeScript" | |

**User's choice:** Just the essentials

---

## Menu Bar Integration

### macOS About trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Replace native with custom | Swap PredefinedMenuItem::about for custom MenuItemBuilder emitting event to React | ✓ |
| Keep native + add custom | Two About entries — confusing | |
| Remove menu item entirely | Only accessible from Settings — unconventional on macOS | |

**User's choice:** Replace native with custom

### Windows/Linux access

| Option | Description | Selected |
|--------|-------------|----------|
| Help menu only | Add 'About TaskFlow' to existing Help menu | ✓ |
| Settings page link | Non-standard | |
| Both Help menu + Settings | Redundant | |

**User's choice:** Help menu only

---

## Updates Settings Section

### Nav position

| Option | Description | Selected |
|--------|-------------|----------|
| After Notifications | Groups notification-adjacent preferences | |
| After Workflow | Near bottom, before Advanced | |
| Before Advanced (last non-debug) | System concern, before debug section | ✓ |

**User's choice:** Before Advanced (last non-debug)

### Section contents

| Option | Description | Selected |
|--------|-------------|----------|
| Just the requirements | Frequency dropdown, Check Now, current version | |
| Add auto-update toggle | Toggle for auto-download | |
| Add last checked timestamp | "Last checked: 2 hours ago" | ✓ |

**User's choice:** Add last checked timestamp

### Check Now UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline status text | Button text changes: Checking → Up to date / Update available. Resets after ~5s | ✓ |
| Toast notification | Result shown as toast | |
| Status below button | Muted text below, persistent | |

**User's choice:** Inline status text

---

## Version History

### Data source

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Releases API | Fetch from public repo, no auth, returns version/date/body | ✓ |
| Cached from update checks | Only shows discovered releases, not full history | |
| Bundled JSON + API | Ship baseline, supplement with API | |

**User's choice:** GitHub Releases API

### Display format

| Option | Description | Selected |
|--------|-------------|----------|
| Expandable list | Version rows with click-to-expand changelog | ✓ |
| Full scrollable list | All changelogs rendered inline | |
| Dialog per release | Modal per version click | |

**User's choice:** Expandable list

### Offline behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Empty state with retry | "Unable to load" + Retry button | ✓ |
| Show cached if available | Stale data with note | |
| Hide section entirely | Section disappears | |

**User's choice:** Empty state with retry

---

## Claude's Discretion

- Settings sidebar icon for Updates section
- Version history caching strategy
- Platform/arch detection method
- Loading skeleton design
- Release fetch page size

## Deferred Ideas

None
