# Phase 40: Settings, About & Menu Integration - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can view version info, control update preferences, browse release history, and access an About dialog from the menu bar. This phase builds the settings UI and About dialog on top of Phase 38's service layer and Phase 39's update UX. CI pipeline belongs in Phase 41.

</domain>

<decisions>
## Implementation Decisions

### About dialog design
- **D-01:** Custom React modal using shadcn Dialog — not the native macOS About dialog. Full control over layout and theming.
- **D-02:** Dialog shows: app icon, "TaskFlow" title, version, build date, commit SHA, platform/arch, and live update status from `update.store.ts`.
- **D-03:** Update status display: "Up to date" (checkmark) when idle, "Update available (x.y.z)" when available. Reads from update store state.
- **D-04:** Just the essentials — no links, no tech credits, no extras. Clean and focused.
- **D-05:** Single "Close" button to dismiss.

### Menu bar integration
- **D-06:** Replace the native `PredefinedMenuItem::about` in `lib.rs` with a custom `MenuItemBuilder` that emits a `menu-about` event to React. React catches the event and opens the custom About dialog.
- **D-07:** On Windows/Linux, About is accessible via the Help menu ("About TaskFlow" item). The Help menu already exists in `lib.rs` — add the item there.
- **D-08:** On macOS, the "About TaskFlow" item stays in the app submenu (standard macOS position) but triggers the custom dialog instead of the native one.

### Updates settings section
- **D-09:** New "Updates" section added to Settings sidebar, positioned after Workflow and before Advanced (last non-debug section).
- **D-10:** Section contains: current version display, check frequency dropdown (1h/6h/12h/24h/manual — reads/writes existing `updateCheckInterval` in settings store), "Check Now" button, and last checked timestamp.
- **D-11:** "Check Now" button uses inline status text: button text changes to "Checking..." (with spinner) → "Up to date" or "Update available (x.y.z)". Resets to "Check Now" after ~5 seconds. If update found, clicking opens the update dialog from Phase 39.
- **D-12:** Last checked timestamp shown as relative time ("Last checked: 2 hours ago") below the frequency dropdown.

### Version history
- **D-13:** Data sourced from GitHub Releases API on the public repo. No auth needed for public repos. Returns version tag, published date, and markdown body.
- **D-14:** Expandable list UI: scrollable list of version rows showing version + date. Click to expand and show rendered markdown changelog inline (using existing react-markdown). Current version gets a "(current)" badge. Compact by default.
- **D-15:** When GitHub API is unreachable (network error, rate limit), show "Unable to load version history" empty state with a Retry button. Consistent with existing ApiError + ErrorState patterns.
- **D-16:** Version history placed below the update controls in the Updates settings section — one cohesive section.

### Claude's Discretion
- Exact Settings sidebar icon choice for Updates section
- Version history fetch caching/staleTime strategy (TanStack Query)
- How to detect platform/arch at runtime (Tauri APIs vs navigator.platform)
- Loading skeleton for version history while fetching
- Number of releases to fetch (page size)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing settings infrastructure
- `taskflow/src/routes/settings/Settings.tsx` — Settings shell with sidebar nav and section switching; new Updates section added here
- `taskflow/src/stores/settings.store.ts` — Settings store with existing `updateCheckInterval` field
- `taskflow/src/lib/build-info.ts` — Build-time metadata (version, commitSha, buildDate)

### Update infrastructure (Phase 38/39)
- `taskflow/src/stores/update.store.ts` — Update state machine (status, availableVersion, changelog)
- `taskflow/src/hooks/useUpdatePolling.ts` — Update polling hook with manual check capability
- `taskflow/src/services/updater.ts` — Updater service with check() and downloadAndInstall()
- `taskflow/src/components/update/UpdateDialog.tsx` — Existing update dialog (Phase 39)

### Menu bar (Rust)
- `taskflow/src-tauri/src/lib.rs` — Menu bar setup with PredefinedMenuItem::about to replace, Help menu to extend, and event emission pattern

### UI patterns
- `taskflow/src/components/ui/dialog.tsx` — Shadcn dialog for About modal
- `taskflow/src/components/ui/stale-data-banner.tsx` — Error state pattern reference

### Requirements
- `.planning/REQUIREMENTS.md` — UI-01, UI-02, UI-03, UI-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `dialog.tsx`: Shadcn Dialog primitive — use for About modal
- `react-markdown`: Already in deps — reuse for changelog rendering in version history
- `build-info.ts`: Version, commitSha, buildDate already available as constants
- `update.store.ts`: Live update status (idle/checking/available/etc.) for About dialog status display
- `settings.store.ts`: `updateCheckInterval` field and `setUpdateCheckInterval` action already exist
- `useUpdatePolling.ts`: Polling hook — can expose manual check trigger for "Check Now"

### Established Patterns
- Settings sections as separate component files (ConnectionsSection, AppearanceSection, etc.)
- Zustand store selectors for reactive state
- TanStack Query for data fetching with configurable staleTime/refetchInterval
- Menu events emitted from Rust, caught in React via `listen()` from `@tauri-apps/api/event`

### Integration Points
- `Settings.tsx` SECTIONS array — add "updates" entry with icon
- `lib.rs` app_menu — replace `PredefinedMenuItem::about` with custom `MenuItemBuilder`
- `lib.rs` help_menu — add "About TaskFlow" item
- `lib.rs` on_menu_event — handle new `menu-about` event
- `main.tsx` or `AppLayout` — listen for `menu-about` event, open About dialog

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 40-settings-about-menu-integration*
*Context gathered: 2026-03-25*
