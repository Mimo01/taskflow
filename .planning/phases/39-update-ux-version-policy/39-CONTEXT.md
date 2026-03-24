# Phase 39: Update UX + Version Policy - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Users experience a complete update lifecycle — from notification through download, installation, and post-update changelog — and the app enforces minimum version requirements via a two-tier policy (soft nag + hard block). This phase builds the UX layer on top of Phase 38's updater service and state machine. Settings UI, About dialog, and version history belong in Phase 40.

</domain>

<decisions>
## Implementation Decisions

### Update prompt dialog
- **D-01:** Modal dialog (shadcn dialog.tsx) appears when an update is detected. Shows current version, available version, and rendered markdown changelog.
- **D-02:** Changelog rendered with react-markdown (already in deps for Jira wiki markup). Full markdown support — headings, lists, code blocks.
- **D-03:** Two action buttons: "Update Now" and "Later".
- **D-04:** When user clicks "Later", dialog dismisses but reappears on the next update check cycle (polling interval). Not once-per-session, not once-per-version — tied to polling interval.

### Download & install flow
- **D-05:** Clicking "Update Now" transitions the same dialog to show download progress — progress bar with percentage, bytes downloaded / total bytes.
- **D-06:** Dialog is non-dismissable (blocking) during download. User cannot interact with the app until download completes or is cancelled.
- **D-07:** After download completes, dialog shows a 10-second auto-restart countdown. User can cancel the countdown to defer restart.
- **D-08:** On download error, dialog shows error message with "Retry" and "Cancel" buttons.

### What's New dialog
- **D-09:** "What's New" dialog appears on first launch after an update. Triggered by comparing stored `lastSeenVersion` (persisted in settings store) with current app version.
- **D-10:** Same modal dialog style as update prompt. Shows version number heading + rendered markdown changelog. Single "Got it" dismiss button.
- **D-11:** Changelog content comes from the update metadata stored before restart (body field from Tauri updater response).

### Force-update policy
- **D-12:** version-policy.json hosted on public GitHub repo (raw.githubusercontent.com URL). Contains `softMinimum`, `hardMinimum`, and optional `message` fields.
- **D-13:** Policy checked on the same interval as update checks (piggybacks on existing polling). No additional network requests — fetched alongside update check.
- **D-14:** Soft minimum: persistent top-of-app banner (similar to stale-data-banner.tsx pattern). Warning icon, message text, "Update Now" button, dismiss (X) button. Dismissible once per session — reappears on next launch.
- **D-15:** Hard minimum: full-screen centered overlay covering the entire app. No dismiss button, no close. Shows version info, why update is required, and "Update Now" button. Prevents all app interaction.
- **D-16:** Fail-open: if version-policy.json is unreachable (network error, 404, parse error), neither banner nor overlay appears. App continues normally.

### Claude's Discretion
- Progress bar component implementation details (CSS/Tailwind)
- Exact countdown timer UI for auto-restart
- How to persist changelog across restart for What's New dialog (settings store vs temp file)
- version-policy.json fetch implementation (tauri-plugin-http vs Tauri fetch)
- Semver comparison library choice (or manual comparison)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Tauri updater (Phase 38 foundation)
- `taskflow/src/services/updater.ts` — Update service with check() and downloadAndInstall() methods
- `taskflow/src/stores/update.store.ts` — Update state machine (idle/checking/available/downloading/ready/error)
- `taskflow/src/hooks/useUpdatePolling.ts` — TanStack Query polling hook for update checks
- `taskflow/src/stores/settings.store.ts` — Settings store with updateCheckInterval field

### UI patterns
- `taskflow/src/components/ui/dialog.tsx` — Shadcn dialog component to use for update/what's-new dialogs
- `taskflow/src/components/ui/stale-data-banner.tsx` — Banner pattern to follow for soft minimum nag banner

### Build config
- `taskflow/src-tauri/tauri.conf.json` — Updater endpoint URL configuration

### Requirements
- `.planning/REQUIREMENTS.md` — UPD-02, UPD-03, UPD-04, POL-01, POL-02, POL-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `dialog.tsx`: Shadcn Dialog primitive — use for update prompt, downloading state, ready-to-restart, and What's New dialogs
- `stale-data-banner.tsx`: Top-of-page dismissible banner with retry/dismiss buttons — template for soft minimum nag banner
- `react-markdown`: Already in deps for Jira wiki markup rendering — reuse for changelog rendering
- `update.store.ts`: Full state machine with setChecking/setAvailable/setDownloading/setProgress/setReady/setError transitions
- `updaterService.downloadAndInstall()`: Accepts onProgress callback for download progress events
- `settings.store.ts`: Persisted Zustand store — natural place for `lastSeenVersion` field

### Established Patterns
- Non-persisted Zustand stores for ephemeral state (update.store, debug-log.store)
- Persisted Zustand stores with LazyStore for user preferences (settings.store)
- TanStack Query for polling with configurable refetchInterval
- Developer Tools request logging for all external calls

### Integration Points
- `useUpdatePolling` hook (AppLayout) — where update check triggers dialog display
- `update.store.ts` status field — drives dialog state transitions (available → downloading → ready)
- `settings.store.ts` — add lastSeenVersion for What's New trigger, add softNagDismissed (session-only) state
- AppLayout — mount soft minimum banner and hard minimum overlay at root level

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

*Phase: 39-update-ux-version-policy*
*Context gathered: 2026-03-24*
