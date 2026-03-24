# Phase 34: Layout Customization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 34-layout-customization
**Areas discussed:** Sidebar customization, Dashboard widget system, Persistence & presets, Widget catalog

---

## Sidebar Customization

| Option | Description | Selected |
|--------|-------------|----------|
| All items customizable | Every nav item can be hidden/shown. Only Settings stays pinned. | ✓ |
| Only role-specific items | Dashboard, Epics, MRs stay fixed. Only Work section items togglable. | |
| Everything except Dashboard | Dashboard always visible, all others customizable. | |

**User's choice:** All items customizable
**Notes:** None

### Cross-role visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Any item available to any role | Developers can add PM items and vice versa. Roles become presets. | ✓ |
| Role still restricts available items | Customization only within your role's set. | |

**User's choice:** Any item available to any role
**Notes:** None

### Sidebar management location

| Option | Description | Selected |
|--------|-------------|----------|
| Settings > Appearance page | Toggle items on/off and drag to reorder in Settings. | ✓ |
| Context menu on sidebar | Right-click to hide, '+' to add back. | |
| Both — Settings + inline | Settings for full control, right-click as shortcut. | |

**User's choice:** Settings > Appearance page
**Notes:** None

### Drag-to-reorder

| Option | Description | Selected |
|--------|-------------|----------|
| Drag directly in sidebar | Items always draggable with grab handle on hover. | |
| Drag only in Settings | Sidebar static during normal use. Reorder in Settings list. | ✓ |
| Edit mode toggle | Button enters/exits edit mode with grab handles. | |

**User's choice:** Drag only in Settings
**Notes:** None

---

## Dashboard Widget System

### Grid approach

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed column grid with drag | 2-3 column grid, snap to cells, resize by spanning columns. | |
| Free-form drag + resize | Widgets placed anywhere, resized freely. react-grid-layout. | ✓ |
| Predefined layout templates | Pick from 3-4 layout templates. | |

**User's choice:** Free-form drag + resize
**Notes:** None

### Grid library

| Option | Description | Selected |
|--------|-------------|----------|
| react-grid-layout | Battle-tested library, handles collision/compaction/breakpoints. | ✓ |
| Build on @dnd-kit | Extend existing dep with custom resize. No new dep but custom code. | |

**User's choice:** react-grid-layout
**Notes:** None

### Add widgets

| Option | Description | Selected |
|--------|-------------|----------|
| 'Add widget' button with picker | '+' button opens dropdown/dialog with available widgets. | ✓ |
| Widget catalog in Settings | Manage widgets from Settings > Dashboard page. | |
| Both — inline + Settings | Quick-add from dashboard, full management in Settings. | |

**User's choice:** 'Add widget' button with picker
**Notes:** None

### Widget size constraints

| Option | Description | Selected |
|--------|-------------|----------|
| Per-widget min/max | Each widget type defines own min/max grid units. | ✓ |
| Uniform sizing | All widgets same size options (small/medium/large). | |

**User's choice:** Per-widget min/max
**Notes:** None

---

## Persistence & Presets

### Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Extend settings.store.ts | Add to existing store. Same persist/migration pattern. | ✓ |
| Separate layout.store.ts | New dedicated store for layout state. | |
| Both in one new store | New layout.store.ts with migrated sidebarCollapsed. | |

**User's choice:** Extend settings.store.ts
**Notes:** None

### Preset scope

| Option | Description | Selected |
|--------|-------------|----------|
| Presets set sidebar + dashboard together | One-click full reset to role default. | ✓ |
| Separate sidebar and dashboard presets | Independent preset actions. | |
| Presets for sidebar only | Dashboard always custom, only sidebar has presets. | |

**User's choice:** Presets set sidebar + dashboard together
**Notes:** None

### Role change behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Keep custom layout | Role change doesn't touch layout. Explicit preset apply. | ✓ |
| Prompt to apply preset | Ask user on role change whether to reset. | |
| Auto-apply preset | Role change resets layout automatically. | |

**User's choice:** Keep custom layout
**Notes:** None

---

## Widget Catalog

### Initial catalog size

| Option | Description | Selected |
|--------|-------------|----------|
| Current 3 panels only | SubtasksPanel, MrHealthPanel, SprintHealthPanel. | |
| Current 3 + Notifications | Add Recent Notifications widget. | |
| Current 3 + Notifications + Quick Stats | Add notifications and quick stats widgets. | |

**User's choice:** Other — "You decide, I want as much widgets as possible"
**Notes:** User wants maximum widget variety for dashboard customization.

### Duplicate widgets

| Option | Description | Selected |
|--------|-------------|----------|
| No duplicates | Each widget can only appear once. | |
| Allow duplicates | Same widget can be added multiple times. | ✓ |

**User's choice:** Allow duplicates
**Notes:** None

### Additional widget ideas (user-provided)

- **Custom JQL widget** — user enters a JQL query, widget shows matching issues. Enables power-user personalization.

---

## Claude's Discretion

- Widget picker UI design
- react-grid-layout column/breakpoint config
- Default grid positions
- Custom JQL validation/error handling
- Animation/transition style
- Settings sidebar items list styling
- Dev vs PM default preset contents

## Deferred Ideas

None — discussion stayed within phase scope
