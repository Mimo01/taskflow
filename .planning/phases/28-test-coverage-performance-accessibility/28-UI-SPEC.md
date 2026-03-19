---
phase: 28
slug: test-coverage-performance-accessibility
status: draft
shadcn_initialized: true
preset: base-nova
created: 2026-03-20
---

# Phase 28 — UI Design Contract

> Visual and interaction contract for Phase 28. This phase introduces NO new visual components or screens. Changes are limited to virtualization of existing lists (PERF-01), ARIA attribute additions (A11Y-01, A11Y-02), and unit tests (TEST-01, TEST-02, PERF-02). The contract below defines interaction and accessibility requirements only.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn |
| Preset | base-nova |
| Component library | @base-ui/react (via shadcn) |
| Icon library | lucide-react |
| Font | Geist Variable, sans-serif |

Source: components.json, src/index.css (existing project configuration)

---

## Spacing Scale

Declared values (inherited from existing project, multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding |
| sm | 8px | Compact element spacing |
| md | 16px | Default element spacing |
| lg | 24px | Section padding |
| xl | 32px | Layout gaps |
| 2xl | 48px | Major section breaks |
| 3xl | 64px | Page-level spacing |

Exceptions: Virtualized row height estimates -- BacklogRow 44px, NotificationItem 64px, SprintBoardSwimlane variable (use measureElement). Touch target minimum 44px for interactive elements within virtualized rows.

---

## Typography

No typography changes in this phase. Existing values preserved (2-weight scale: 400 regular, 600 semibold):

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 | 1.5 |
| Label | 12px | 400 | 1.4 |
| Heading | 20px | 600 | 1.2 |
| Display | 28px | 600 | 1.2 |

Label is differentiated from Body by size (12px vs 14px), not weight. Two weights only: 400 (Body, Label) and 600 (Heading, Display).

Source: Inherited from existing project. No modifications in this phase.

---

## Color

No color changes in this phase. Existing shadcn neutral palette with oklch tokens preserved:

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | var(--background) | Background, surfaces |
| Secondary (30%) | var(--card) / var(--secondary) | Cards, sidebar, nav |
| Accent (10%) | var(--primary) | Primary buttons, focus rings |
| Destructive | var(--destructive) | Destructive actions only |

Accent reserved for: Primary action buttons, focus ring outlines, active navigation indicators. No changes in this phase.

---

## Copywriting Contract

This phase introduces no new user-facing copy. All existing copy remains unchanged.

| Element | Copy | Status |
|---------|------|--------|
| Primary CTA | N/A | No new CTAs in this phase |
| Empty state heading | N/A | Existing empty states unchanged |
| Empty state body | N/A | Existing empty states unchanged |
| Error state | N/A | Existing error handling unchanged |
| Destructive confirmation | N/A | No new destructive actions |

---

## Virtualization Contract (PERF-01)

This is the primary interaction contract for Phase 28. Three existing lists must be virtualized using @tanstack/react-virtual without visual regression.

### General Rules

| Property | Value |
|----------|-------|
| Library | @tanstack/react-virtual v3.13.23 |
| Minimum test item count | 200+ items render without visible scroll jank |
| Overscan | 5-10 items (prevents flicker during fast scroll) |
| Row measurement | Use `measureElement` for variable-height rows; `estimateSize` for fixed-height rows |
| Scroll container | Existing scrollable parent; do not add new scroll wrappers unless required |

### BacklogPage Issue List

| Property | Value |
|----------|-------|
| Component | `src/routes/dashboard/BacklogPage.tsx` |
| Estimated row height | 44px |
| Row height type | Fixed (BacklogRow has consistent height) |
| Measurement | `estimateSize: () => 44` (no measureElement needed) |
| Overscan | 10 items |
| Scroll container | The existing overflow-auto parent within BacklogPage |
| Visual contract | No visible change to row appearance. Rows must render identically to current `.map()` output. |

### Notification List

| Property | Value |
|----------|-------|
| Component | `src/routes/notifications/NotificationPopover.tsx` (shared rendering for popover and page) |
| Estimated row height | 64px |
| Row height type | Variable (notification content length varies) |
| Measurement | `measureElement` callback on each rendered item |
| Overscan | 5 items |
| Scope | Virtualize the shared list rendering used by both popover and full-page views |
| Visual contract | No visible change to notification item appearance. Unread indicators, timestamps, and action buttons render identically. |

### Sprint Board Columns

| Property | Value |
|----------|-------|
| Component | `src/routes/dashboard/SprintBoardTab.tsx` |
| Virtualization unit | Swimlane rows (story groups), NOT individual cards within a swimlane |
| Estimated row height | Variable (swimlanes contain 1-N cards) |
| Measurement | `measureElement` callback on each swimlane |
| Overscan | 5 swimlanes |
| DnD compatibility | DragOverlay renders OUTSIDE the virtualized container. Adequate overscan prevents drag source unmounting. Cards within a visible swimlane remain fully rendered (not virtualized). |
| Visual contract | No visible change to board layout. Column headers remain sticky. Swimlane grouping and card appearance unchanged. |

### Virtualization Anti-Regression Rules

1. Virtualized lists must NOT introduce horizontal scrollbars.
2. Keyboard navigation (J/K) within virtualized lists must continue to work (scroll-into-view for focused item).
3. Empty states must render when item count is 0 (virtualizer returns no items, empty state component shows).
4. Loading skeletons must render during data fetch (before virtualizer has items).

---

## Accessibility Contract (A11Y-01, A11Y-02)

### Form Input Labels (A11Y-01)

Every form input in CreateEditIssueModal and ConnectionsSection must have a programmatic label association. Use ONE of these patterns per input:

| Pattern | When to Use |
|---------|-------------|
| `<label htmlFor="id">` + `<input id="id">` | Input has a visible text label |
| `aria-label="description"` on input | Input has no visible label (icon-only, placeholder-only) |

#### CreateEditIssueModal Inputs Requiring Labels

| Input | Current State | Required Fix |
|-------|---------------|-------------|
| Summary | Missing association | `htmlFor="issue-summary"` + `id="issue-summary"` |
| Description | Missing association | `htmlFor="issue-description"` + `id="issue-description"` |
| Assignee picker | Missing label | `aria-label="Assignee"` |
| Story points | Missing association | `htmlFor="story-points"` + `id="story-points"` |
| Time estimate | Missing association | `htmlFor="time-estimate"` + `id="time-estimate"` |
| Parent key | Missing association | `htmlFor="parent-key"` + `id="parent-key"` |
| Epic filter input | Missing label | `aria-label="Filter epics"` |

#### ConnectionsSection Inputs Requiring Labels

| Input | Current State | Required Fix |
|-------|---------------|-------------|
| Jira base URL | Missing association | `htmlFor="jira-base-url"` + `id="jira-base-url"` |
| Jira email | Missing association | `htmlFor="jira-email"` + `id="jira-email"` |
| Jira API token | Missing association | `htmlFor="jira-api-token"` + `id="jira-api-token"` |
| GitLab base URL | Missing association | `htmlFor="gitlab-base-url"` + `id="gitlab-base-url"` |
| GitLab token | Missing association | `htmlFor="gitlab-token"` + `id="gitlab-token"` |

### Custom Dropdown ARIA Roles (A11Y-02)

Hand-built dropdown widgets must use proper ARIA roles. Library-provided components (@base-ui/react Select) already have correct roles and need no changes.

| Widget | Component | Required ARIA |
|--------|-----------|--------------|
| Epic link picker | CreateEditIssueModal (epic dropdown) | Filter input: `role="combobox"`, `aria-expanded`, `aria-controls="epic-listbox"`, `aria-label="Filter epics"`. List container: `role="listbox"`, `id="epic-listbox"`. Each option: `role="option"`, `aria-selected` |
| Assignee autocomplete | CreateEditIssueModal (assignee picker) | Filter input: `role="combobox"`, `aria-expanded`, `aria-controls="assignee-listbox"`, `aria-label="Assignee"`. List container: `role="listbox"`, `id="assignee-listbox"`. Each option: `role="option"`, `aria-selected` |

### ARIA Verification Method

All ARIA additions verified via RTL assertions in existing or new test files:

```typescript
expect(input).toHaveAttribute('aria-label', 'Filter epics');
expect(listbox).toHaveAttribute('role', 'listbox');
expect(option).toHaveAttribute('role', 'option');
```

No vitest-axe dependency. Manual RTL `toHaveAttribute` assertions are the verification standard.

---

## Memoization Contract (PERF-02)

| Property | Value |
|----------|-------|
| Target | `useUnreadCount` in notifications store |
| Problem | Creates `new Set(readIds)` on every render |
| Solution | Cached derived `_unreadCount` field updated on `setItems`, `prependItems`, `markAsRead`, `markAllRead` |
| Selector | `(s) => s._unreadCount` (primitive number, no equality function needed) |
| Visual impact | None -- same count displayed, fewer re-renders |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | button, input, dialog, select, popover, command, badge, sheet, skeleton, label, radio-group, context-menu, alert | not required |
| Third-party | none | N/A |

No new shadcn components added in this phase. No third-party registries.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS (no new copy -- N/A confirmation)
- [ ] Dimension 2 Visuals: PASS (no visual changes -- virtualization is invisible)
- [ ] Dimension 3 Color: PASS (no color changes)
- [ ] Dimension 4 Typography: PASS (2 weights: 400, 600)
- [ ] Dimension 5 Spacing: PASS (row height estimates documented)
- [ ] Dimension 6 Registry Safety: PASS (no new registries)

**Approval:** pending