# Quick Task 261119-ol5: Add dev tools tab with editor logs - Context

**Gathered:** 2026-11-19
**Status:** Ready for planning

<domain>
## Task Boundary

Add a new "Editor" tab to Developer Tools (taskflow/src/routes/dev-tools/) showing logs from the wiki editor
(taskflow/src/components/wiki-editor/), so the developer can see what went wrong when users hit editor errors.

</domain>

<decisions>
## Implementation Decisions

### Content in log entries
- Routine events (editor open/mount, mode switch, save attempt, save success) log metadata only — no document text.
- Failure events (failed/unsafe saves such as "Couldn't save safely" / gap-keeper rejections, thrown errors, lazy-load failure) attach the wiki markup involved (original + produced markup where available) plus error message/stack.

### Storage / export
- In-memory only, exactly like the existing dev tools stores (debug-log.store, notification-dispatch-log.store). Capped entry count.
- NO copy button, NO file export, NO persistence. Nothing beyond what the other tabs do.
- The page's existing "Clear Logs" button must clear the editor log too.

### Claude's Discretion
- Exact event set and entry shape; tab name ("Editor"); visual layout should mirror existing tabs (LogsTab / NotificationsTab expandable cards).
- Whether logging is gated on devToolsEnabled — follow whatever the existing stores do.

</decisions>

<specifics>
## Specific Ideas

Existing analogues: src/routes/dev-tools/DevToolsPage.tsx (tabs + Clear Logs), LogsTab.tsx, NotificationsTab.tsx,
src/stores/debug-log.store.ts, src/stores/notification-dispatch-log.store.ts. Editor: editor-session.ts, gap-keeper.ts,
WikiEditor.tsx, WikiEditorLazy.tsx (has console.error on load failure), save-failed.test.tsx.

</specifics>
