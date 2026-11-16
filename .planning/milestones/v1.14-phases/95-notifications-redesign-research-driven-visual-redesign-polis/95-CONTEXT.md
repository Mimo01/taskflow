# Phase 95: Notifications redesign - Context

**Gathered:** 2026-11-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the existing notifications popover (TopBar bell → `NotificationPopover` → `NotificationRow`) for a modern, usable triage experience: one-line rows, entity grouping inside time buckets, neutral styling with status-only colour, clear read/Done triage, popover-scoped keyboard navigation, and honest empty/error states. Also fix the two real data bugs found in research (unbounded `readIds`, resurrecting dismissed due-date reminders) and surface fetch errors while cached items exist.

Not in scope: new sources, polling/fetch logic changes, OS notification content, Settings page redesign, a new Inbox route.

</domain>

<decisions>
## Implementation Decisions

**User direction (verbatim):** "I leave all the decisions up to you. I want a modern usable notification experience."
So every decision below is Claude-chosen. They adopt the research defaults (`95-RESEARCH.md` → Open Questions D1–D10) and the approved `95-UI-SPEC.md`, and they count as locked for planning. If they need revisiting, UAT is the place to do it, not more discussion.

### Surface
- **D-01:** Popover only, no new route/page. Shell stays `Popover`, `w-[28rem]`, `p-0`, list `max-h-[520px]` (research D1).

### Row anatomy
- **D-02:** One line per event at every density: `[unread dot][type glyph][avatar 20][KEY mono][action + snippet, truncate][time]`. Full body, parent story summary and absolute timestamp go in a hover `TooltipBody` (≤4 rows, ~600ms delay). Nothing stacks. Narrow widths truncate text first, then hide the key, and never drop the avatar or dot (research D2, UI-SPEC "Event row").
- **D-03:** Unread = leading `bg-primary` dot + weight 500 / `text-foreground`; read = weight 400 / muted. Remove the blue unread tint, the avatar unread ring, the coloured source left borders and the 9 rainbow type badges.
- **D-04:** Colour = status only: pipeline-failure red, mr-approval green, due-date amber (reuse `lib/statusStyles.ts` tokens). All other glyphs neutral muted. Source (Jira/GitLab) shown via the source tabs + glyph tooltip, never colour (research D3).
- **D-05:** The row is one stateful component for read and unread; only classes change, so mark-read never remounts it (memory: optimistic mark unmount).

### Grouping
- **D-06:** Time buckets `Today / Yesterday / This week / Older` (replaces "Earlier"). Inside each bucket, events on the same entity (Jira key / GitLab `project/iid`) are grouped, ordered by newest event. A one-event entity renders as a plain row. A multi-event group gets a one-line header (chevron, newest author avatar, KEY, title, `+N` chip, entity-state pill, time). It is expanded if it contains unread, collapsed otherwise. No height animation (virtualizer safety) (research D5).
- **D-07:** Add a structured entity key helper (`getEntityKey`) instead of the two regex-from-title copies. Bucket "now" comes from a ticking `useNow(60_000)` passed into pure helpers.

### Triage
- **D-08:** Vocabulary: read/unread toggle + **Done** (renamed from dismiss, `Check` icon), with **Clear read** in the header overflow menu. **Mark all read** is scoped to the active source tab/filter and disabled at 0 unread. No confirmations, no undo/toast, no snooze/archive view (research D4/D6).
- **D-09 (Claude addition):** Group headers get the same hover/focus tray, acting on the whole group: "Mark group read" / "Done" for all events in the group. Triage by thread is what makes grouping useful (GitHub/Linear model).
- **D-10:** Done persistence: persisted `dismissedIds` tombstones, capped (~500). The due-date reminder id includes the due date, so a dismissed reminder stays dismissed, but a changed due date notifies again (research D8, Pitfall 2).
- **D-11:** Prune `readIds` to ids still present in `items` (research Pitfall 1).

### Filter bar & header
- **D-12:** Header: "Notifications" title, `Mark all read` ghost button, overflow (`MoreHorizontal`) with `Clear read` + `Notification settings`. Filter bar: segmented `Unread | All` (AIO-cycles pattern, no Switch) + source tabs `All sources | Jira | GitLab` with neutral unread count chips, hidden at 0 (research D6).

### Click target
- **D-13:** Row click = mark read + **full-page navigation** (`onIssueClick` / `onMRClick`) + close popover. This preserves the current effective behaviour. `TopBar` deliberately doesn't wire peek (260605-hb4, comment at `src/components/app/TopBar.tsx:22-24`). **This corrects research NOTIF-08:** do not wire peek. `useIsPeeked` highlight may still apply when the issue is already open in peek elsewhere, but it isn't required.

### Keyboard
- **D-14:** Popover-scoped: Up/Down + j/k move focus (scroll into view via `virtualizer.scrollToIndex`), Enter/Space open, Right/Left expand/collapse a group, `u` toggle read, `e`/Delete Done then focus the next entry, Esc closes. Ignored in inputs. Visible inset focus ring; the hover tray also shows on focus. Show the shortcuts in tooltips; add them to `KeyboardShortcutsPanel` only if that panel is registry-driven (research D7).

### States
- **D-15:** Shared primitives only: `EmptyState` compact (no-notifications / all caught up / nothing from source), `ErrorState` (error, no cache), `StaleDataBanner` (error with cached items, which is currently invisible), `Alert` (permission denied / send error). Copy per UI-SPEC Copywriting Contract.
- **D-16:** Bell badge unchanged: unread count, 99+ cap, pulse only on increase, none while open.

### Claude's Discretion
- Exact lucide icon choices, as long as only the three status glyphs are coloured.
- Whether `NotificationItem` is deduplicated into one type (research Pitfall 4). Recommended: yes.
- Test rewrite strategy: `NotificationRow.test.tsx` is rewritten around behaviour (roles/text/aria), not preserved.
- Requirement IDs: adopt research's NOTIF-01..10, with NOTIF-08 reworded per D-13.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase design artefacts
- `.planning/phases/95-notifications-redesign-research-driven-visual-redesign-polis/95-UI-SPEC.md` — approved visual/interaction contract (spacing, type, colour, layout, copy). Binding.
- `.planning/phases/95-notifications-redesign-research-driven-visual-redesign-polis/95-RESEARCH.md` — current-state inventory with line anchors, pitfalls 1-10, NOTIF-01..10 candidates, code examples.
- `.planning/phases/95-notifications-redesign-research-driven-visual-redesign-polis/95-VALIDATION.md` — validation strategy.

### Code (inner app dir `taskflow/`)
- `taskflow/src/routes/notifications/NotificationPopover.tsx`, `NotificationRow.tsx` (+ tests) — redesign targets.
- `taskflow/src/stores/notifications.store.ts` — readIds/dismiss persistence (D-10, D-11).
- `taskflow/src/services/notifications.ts` — item ids (due-date id change, D-10), duplicate item type.
- `taskflow/src/components/app/TopBar.tsx` — bell/badge, peek-not-wired rationale (D-13).
- `taskflow/src/routes/standup-notes/IssueActivityGroup.tsx` — entity-group header + overlay-button precedent.
- AIO cycles page segmented Open|All filter — filter-bar precedent (D-12).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `EmptyState`, `ErrorState`, `StaleDataBanner`, `Alert`, `CachedAvatar`, `LinkContextMenu`, `TooltipBody`/`TooltipRow`, `statusPillClass` (needs flex parent), `useIsPeeked` + `PEEKED_ROW_CLASS`, density variants. All exist (paths in RESEARCH "Shared primitives").

### Established Patterns
- Overlay button (`absolute inset-0`) as sibling of the inner key button; replaces the current `div[role=button]` + nested button.
- Virtualized rows: explicit px sizing for fixed cells (0-width collapse), stable `getItemKey`, `measureElement` on the wrapper.
- Hover tray absolute over the time cell (no layout shift).
- React Compiler runs in the app but not in vitest: no hidden module-level reads in render.

### Integration Points
- `main.tsx` owns popover open state, menu event and palette open action; `CommandPalette` "Mark all notifications read" must keep working.
- Visual verification via throwaway vite preview page (`@source '../src'`) at all densities, light/dark, before declaring done.

</code_context>

<specifics>
## Specific Ideas

The goal is "modern usable notification experience". Reference models are GitHub notifications (Done vs read, triage by thread) and the Linear inbox (keyboard triage, dense one-line rows), adapted to taskflow's neutral design language.

</specifics>

<deferred>
## Deferred Ideas

- Inbox page/route, snooze, per-entity mute, Done-history/archive view, undo toast, dock/OS badge, new sources (research D10).

### Reviewed Todos (not folded)
- `priority-stripe-rest-rank.md`: matched only on the keyword "phase"; unrelated to notifications.

</deferred>

---

*Phase: 95-notifications-redesign-research-driven-visual-redesign-polis*
*Context gathered: 2026-11-10*
