# Quick Task 261112-cmy: Dev-mode devtools log of desktop notifications that would be dispatched - Context

**Gathered:** 2026-11-12
**Status:** Ready for planning

<domain>
## Task Boundary

In dev mode (macOS, unsigned bundle) OS desktop notifications can't be seen, so log to the webview devtools console what would be dispatched. Dispatch site: `taskflow/src/hooks/useNotificationPolling.ts` (loop ~L237-249) calling `tryDispatchOsNotification` in `taskflow/src/services/notifications.ts:893`.

</domain>

<decisions>
## Implementation Decisions

### Gating
- Dev only (`import.meta.env.DEV`); zero output in production builds.
- Log only when the Desktop notifications setting is enabled (mirror real dispatch conditions). Nothing logged when the toggle is off.

### Real send
- Keep attempting the real OS notification in dev; log the result (`sent` / `denied` / `error`) alongside the payload.

### Skipped items
- Also log items skipped by the already-known guard (`existingIds`), clearly marked as skipped.

### Claude's Discretion
- Console format. Suggested: one collapsed group per poll (e.g. `[notifications] 2 dispatched, 1 skipped`) containing per-item entries with title, body, result/skip reason and the full item object. Exact title/body strings must be the same strings passed to the OS (extract one helper so they can't drift).

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Keep it out of prod (no new settings UI).

</specifics>
