# Phase 18: App Icon + Multi-Page Settings - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Two deliverables: (1) new abstract/geometric app icon on all platforms (macOS Dock, Windows taskbar, Linux), and (2) Settings restructured from a single scrollable page into a sidebar-nav multi-section layout. Creating/editing credentials, changing role, and all existing settings fields remain — they are reorganized, not redesigned. No new routes — Settings uses internal `useState` nav.

</domain>

<decisions>
## Implementation Decisions

### Settings sidebar structure
- 5 sidebar items: **Connections**, **Appearance**, **Notifications**, **Workflow**, **Role**
- Role gets its own sidebar item (not folded into Connections or Appearance)
- Settings opens to **Connections** by default (no last-visited persistence)
- Navigation is internal `useState` — no URL sub-routing, no new React Router routes

### Connections section
- Jira and GitLab displayed as **two separate cards**, each with their own fields, status badge, and test button
- Credential fields are **read-only with masked token** (shown as ••••••) — clicking Edit reveals an inline form
- Test connection button shows an **inline status indicator**: spinner while testing, then green checkmark or red × with error message inline — no toast, no modal
- RoleSection moves into its own **Role** sidebar section (not Connections)

### Appearance section
- Three density tiers: **Compact / Default / Comfortable**
- Density affects: list rows (tasks, MRs, backlog items), sidebar navigation, sprint board cards — Claude applies consistently across all list/card surfaces beyond these too
- Implementation: `data-density="compact|default|comfortable"` attribute on `<html>` — same pattern as existing `data-theme`; Tailwind targets it via variant selectors
- Theme toggle stays here (existing ThemeSection)

### Notifications section
- Existing NotificationSettingsSection content: poll interval + per-event OS notification toggles (Jira mentions, GitLab MR notes)
- No changes to notification content — just relocated into the sidebar structure

### Workflow section
- Contains: stale MR threshold (existing StaleMrThresholdSection), debug mode (existing DebugModeSection)
- Sprint board preferences (new): collapse parent stories by default toggle, show subtasks in My Tasks toggle — Claude decides column order approach based on existing board capabilities

### Icon design
- Visual direction: **node graph / network** — connected nodes evoke tasks linked to MRs; fits the "unified" concept
- Color palette: **dark background + blue/indigo accent** — matches app's dark-mode default; native on dark Dock backgrounds
- Creation method: Claude generates a **programmatic SVG** of the node-graph design, exports to PNG at 1024×1024 — fully reproducible, no external tool dependency
- Icon is **full-bleed square** — no baked-in rounded corners; macOS applies its own squircle mask; Windows/Linux handle their own masking
- After PNG is ready, run `tauri icon` CLI to generate all platform sizes into `src-tauri/icons/`

### Claude's Discretion
- Exact node-graph composition (number of nodes, edge angles, stroke weights)
- Exact blue/indigo hex values and background shade
- SVG-to-PNG export toolchain (node canvas, sharp, Rust svg2png, or similar)
- Sprint board column order preference UI (if added, based on existing board column data)
- Exact spacing values for each density tier
- DebugModeSection placement within Workflow (could be at bottom, behind an "Advanced" label)

</decisions>

<specifics>
## Specific Ideas

- Node-graph icon: dark background (near-black), 4–6 nodes connected by lines, blue/indigo accent for nodes and edges — should read clearly at 32×32 after Tauri rescaling
- Inline test-connection feedback: no toasts; result appears directly below/beside the test button and clears on next edit
- Masked token field: show last 4 chars of token if possible (e.g., ••••••••abc1) so user can identify which credential is set

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Settings.tsx` — current single-page layout; all 6 section components exist and work; restructuring is layout-only for most sections
- `settings.store.ts` — all settings values already persisted; new fields (density, sprint board prefs) need to be added to the store with defaults
- `src-tauri/icons/` — all Tauri icon slots exist (32x32.png, 128x128.png, icon.icns, icon.ico, etc.); just need new artwork dropped in before `tauri icon` runs
- `tauri.conf.json` — icon array already configured; no changes needed there
- Existing sections to keep as-is (just moved): `ThemeSection`, `NotificationSettingsSection`, `StaleMrThresholdSection`, `DebugModeSection`, `RoleSection`
- `TokenSection` — needs redesign into two separate cards (Jira card + GitLab card) with read-only masked display + Edit inline form + test-connection button

### Established Patterns
- `data-theme` on `<html>` — exact pattern to follow for `data-density`
- `useSettingsStore` for all persisted settings — new density and sprint board pref fields go here
- No `createContext`/`useContext` anywhere — prop threading only
- Zustand persist middleware with Tauri Store backend — bump store `version` + `migrate` when adding new persisted fields

### Integration Points
- `AppLayout` / sidebar — Settings link already exists; no routing changes needed
- `app.css` / `index.css` — add density CSS rules targeting `[data-density="compact"]` etc.
- `settings.store.ts` — add: `density: 'compact' | 'default' | 'comfortable'`, `sprintCollapseByDefault: boolean`, `showSubtasksInMyTasks: boolean`, plus setters

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 18-app-icon-multi-page-settings*
*Context gathered: 2026-03-15*
