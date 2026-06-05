# Quick Task 260605-hb4: Force full-page open for notification & dashboard issue clicks — Research

**Researched:** 2026-06-05
**Domain:** React click-handler wiring (TaskflowApp outlet context + TopBar), breadcrumb trail reset
**Confidence:** HIGH (all findings verified by direct code read)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- "Notifications" = TopBar **NotificationPopover** + its **NotificationRow** items. No notifications route exists — only the popover.
- Both notification row-body click and issue-key click must navigate full-page (key already does; body must change peek→full-page).
- Dashboard scope = **Dashboard home only** (`routes/dashboard/index.tsx` cards, i.e. `DashboardInProgressCard`).
- **Out of scope (leave peek unchanged):** Sprint Board, Backlog, Standup Notes, Command Palette, issue-detail inner panels. Do NOT touch.
- Full-page open from notifications/dashboard must **start a fresh breadcrumb trail** (`resetTrail = true`) — same as clicking the issue key from TopBar today.
- Preserve `markAsRead` and popover-close side effects on notification clicks.

### Claude's Discretion
- Prefer the **minimal, local change**. Avoid broad `main.tsx` refactors unless cleaner.
- Keep the issue-key-button path working (already full-page) — no regression.
</user_constraints>

## Summary

Two outlet/TopBar handlers exist in `main.tsx`:
- `handleOpenPeek(key)` → opens PeekPanel sidebar. Wired as `onOpenIssue`.
- `handleIssueClick(key, resetTrail=false)` → `navigate('/issue/:key')` full page. Wired as `onIssueClick`.

Today, both the NotificationPopover and DashboardInProgressCard **prefer peek** on body clicks via the pattern `(onOpenIssue ?? onIssueClick)(key)`, and only the issue-key `<button>` (with `stopPropagation`) forces `onIssueClick`. The task is to make body clicks on these two surfaces go full-page **with a fresh breadcrumb trail**, without touching any other surface.

**Primary recommendation:** Use **Option B (stop passing `onOpenIssue`)** at the *call sites in `TopBar.tsx` and `dashboard/index.tsx`*, NOT inside the leaf components. The components already have a built-in `onOpenIssue ?? onIssueClick` fallback that resolves to full-page when `onOpenIssue` is undefined. Combined with ensuring the `onIssueClick` they receive carries `resetTrail=true`, this is the smallest, lowest-risk change and requires **zero edits to the leaf components or their prop types**.

## Architectural Responsibility Map

| Capability | Primary Tier | Rationale |
|------------|-------------|-----------|
| Issue navigation (full-page vs peek) | Frontend app shell (`main.tsx` handlers) | The two handlers and breadcrumb reset live in the app shell; leaf components just call whichever handler they're given |
| Breadcrumb reset | App shell (`handleIssueClick`) | `resetTrail` is the 2nd arg to `handleIssueClick`; only the shell decides it |

## Key Findings — Exact Edit Points

### Finding 1: Two clean options; Option B is minimal

**Option A — change leaf body handlers to call `onIssueClick` directly.**
Edit 6 call sites in `DashboardInProgressCard.tsx` (lines 137, 141, 171, 175, 210, 214) and `handleRowClick` in `NotificationPopover.tsx` (lines 280–290). Higher edit surface, touches leaf logic, makes `onOpenIssue` a dead prop on the card.

**Option B — stop passing `onOpenIssue` to these two surfaces (RECOMMENDED).**
The fallback `(onOpenIssue ?? onIssueClick)` already exists in the card, and `handleRowClick` already falls through to `onIssueClick` when `onOpenIssue` is undefined (NotificationPopover.tsx lines 280–290: `if (issueKey && onOpenIssue) {...} if (issueKey && onIssueClick) {...}`). Dropping the `onOpenIssue` prop makes both resolve to the full-page handler. Fewer lines, no leaf-logic edits, no prop-type changes.

**Recommendation: Option B**, applied at the two parent call sites:

1. **TopBar → NotificationPopover** (`src/components/app/TopBar.tsx`, ~L102):
   - Currently: `<NotificationPopover onIssueClick={onIssueClick} onOpenIssue={onOpenIssue} ... />`
   - Change: **remove the `onOpenIssue={onOpenIssue}` prop** from the NotificationPopover element only.
   - Breadcrumb: TopBar already receives `onIssueClick` that is wired in `main.tsx` L534 as `(key) => handleIssueClick(key, true)` — **`resetTrail` is already true.** No further work for notifications. [VERIFIED: main.tsx L533-535]
   - Do NOT remove `onOpenIssue` from `RecentItemsPopover` or from TopBar's own prop list — only from the `<NotificationPopover>` element. (RecentItemsPopover doesn't take it anyway; verify scope is the NotificationPopover JSX only.)

2. **Dashboard → DashboardInProgressCard** (`src/routes/dashboard/index.tsx`, L111-119):
   - Currently passes both `onIssueClick={onIssueClick}` and `onOpenIssue={onOpenIssue}` from outlet context.
   - Change: **remove `onOpenIssue={onOpenIssue}`** so the card's fallback resolves to `onIssueClick`.
   - **Breadcrumb caveat (the one subtlety):** the outlet context `onIssueClick` is raw `handleIssueClick` (`main.tsx` L575), whose `resetTrail` defaults to **false**. To honor the CONTEXT decision (fresh trail), wrap it at the dashboard call site:
     `onIssueClick={(key) => onIssueClick(key, true)}`
     — but the outlet-context type declares `onIssueClick: (key: string) => void` (index.tsx L34-37), so calling with a 2nd arg won't typecheck against that local type.

### Finding 2: Breadcrumb reset for the dashboard — cleanest approach

The outlet context value IS the full `handleIssueClick(key, resetTrail?)` (main.tsx L575), so it accepts a 2nd arg at runtime; only the **local TypeScript annotation** in `dashboard/index.tsx` L34-37 narrows it to `(key: string) => void`.

Cleanest fix (local, no main.tsx change): widen the local outlet-context type in `dashboard/index.tsx` and wrap:
```ts
const { onIssueClick, onOpenIssue } = useOutletContext<{
  onIssueClick: (key: string, resetTrail?: boolean) => void;  // widened
  onOpenIssue: (key: string) => void;
}>();
...
<DashboardInProgressCard
  ...
  onIssueClick={(key) => onIssueClick(key, true)}   // fresh trail
  // onOpenIssue removed → body clicks fall back to onIssueClick (full-page)
/>
```
`onOpenIssue` then becomes unused in `index.tsx` — remove it from the destructure to avoid a lint warning. [VERIFIED: dashboard/index.tsx L34-37, L111-119]

The card's prop `onIssueClick: (key: string) => void` (DashboardInProgressCard.tsx L33) is unchanged — passing an arrow that ignores extra args is type-compatible. `onOpenIssue?` stays optional on the card; leaving it undefined is already supported.

### Finding 3: Tests to update

| Test file | Current assertion | Required change |
|-----------|------------------|-----------------|
| `DashboardInProgressCard.test.tsx` **test 3** (L189-217) | Asserts body click → `onOpenIssue` (peek), key click → `onIssueClick`. Explicitly passes `onOpenIssue={onOpenIssue}` and expects it called. | **Must update.** After Option B, the card is rendered WITHOUT `onOpenIssue`, so body click → `onIssueClick`. Rewrite: body click should call `onIssueClick` (full-page); the `onOpenIssue` peek assertion (L212-216) is obsolete. Key-button assertion (L204-208) stays valid. |
| `DashboardInProgressCard.test.tsx` **test 6** (L234-281) | Renders WITHOUT `onOpenIssue`; asserts parent/subtask body clicks call `onIssueClick`. | **No change needed** — already matches new behavior (fallback to `onIssueClick`). Confirms Option B is consistent with existing coverage. |
| `NotificationPopover.test.tsx` (L45-99 row-click tests) | Renders `<NotificationPopover />` with NO `onIssueClick`/`onOpenIssue` props; only asserts `markAsRead`/`readIds`. | **No change needed** — no peek/navigate assertion exists. markAsRead path preserved. |
| `NotificationRow.test.tsx` | Only generic `onClick` fires test (L161-167) + render tests. No peek vs full-page assertion. | **No change needed.** |

**Net:** only `DashboardInProgressCard.test.tsx` test 3 needs editing. Consider adding/strengthening a NotificationPopover test asserting a row-body click with `onIssueClick` provided (and `onOpenIssue` omitted) calls `onIssueClick` + `markAsRead` + `onClose`, to lock the new behavior.

### Finding 4: Scope confirmation — DashboardInProgressCard not reused out of scope

`grep` for `DashboardInProgressCard` across `src/` returns:
- `routes/dashboard/index.tsx` — renders it (in scope)
- `routes/dashboard/DashboardInProgressCard.tsx` — definition
- two test files
- `routes/standup-notes/TodayColumn.tsx` — **comment reference only** (L14: "...and DashboardInProgressCard."). Standup uses its own `TodayInProgressSection` component (L31 import, L305 render), NOT the card. [VERIFIED: grep + read]

**Confirmed: DashboardInProgressCard is rendered ONLY by the Dashboard home.** Changing its call site cannot affect Standup Notes or any out-of-scope surface.

NotificationPopover is rendered only by `TopBar.tsx` (plus polling hook import + tests). Removing `onOpenIssue` from the NotificationPopover element in TopBar affects only the popover. [VERIFIED: grep]

## Common Pitfalls

### Pitfall 1: Editing the leaf component instead of the call site
Editing inside `DashboardInProgressCard` or `NotificationRow`/`Popover` risks affecting any future reuse and is more code. The fallback already does the right thing — just stop feeding it `onOpenIssue`. Prefer the parent call site.

### Pitfall 2: Forgetting the dashboard breadcrumb reset
Notifications already get `resetTrail=true` via TopBar's `onIssueClick` wrapper (main.tsx L534). The **dashboard outlet context does NOT** — it's raw `handleIssueClick` defaulting `resetTrail=false`. Without the `(key) => onIssueClick(key, true)` wrapper, dashboard full-page opens would push a breadcrumb entry instead of starting fresh, violating the CONTEXT decision. This is the single easiest thing to miss.

### Pitfall 3: stopPropagation on key buttons — leave intact
Issue-key `<button>`s already call `e.stopPropagation()` then `onIssueClick(key)` (NotificationRow L286-289; card L154-157, L190-193, L225-228). These already navigate full-page; do not touch. With Option B the body and key paths both go full-page — but stopPropagation still correctly prevents double-firing.

### Pitfall 4: markAsRead / onClose side effects
`handleRowClick` (NotificationPopover L275-297) calls `markAsRead(item.id)` first, then navigates, then `onClose?.()`. With `onOpenIssue` removed, the `if (issueKey && onOpenIssue)` branch is skipped and the `if (issueKey && onIssueClick)` branch runs — which also calls `onClose?.()`. **Side effects preserved.** No edit to `handleRowClick` needed under Option B. [VERIFIED: L275-297]

### Pitfall 5: Unused-variable lint after removing `onOpenIssue`
After dropping `onOpenIssue` from `dashboard/index.tsx`, remove it from the `useOutletContext` destructure too, or Biome flags it unused. (`npm run check` = biome + tsc; baseline is GREEN per project memory — keep it green.)

## TypeScript Implications
- Card prop `onOpenIssue?` stays optional — no signature change. [VERIFIED: DashboardInProgressCard.tsx L34-36]
- NotificationPopover props `onIssueClick?`/`onOpenIssue?` both optional — no signature change. [VERIFIED: NotificationPopover.tsx L49-54]
- Only local outlet-context type in `dashboard/index.tsx` L34-37 needs widening to `(key: string, resetTrail?: boolean) => void` if you pass `resetTrail`. The global outlet context already provides the full `handleIssueClick`. No `main.tsx` type changes.

## Validation Architecture

| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react |
| Quick run | `npx vitest run src/routes/dashboard/DashboardInProgressCard.test.tsx src/routes/notifications/` |
| Full gate | `npm run check` (biome + tsc) then `npx vitest run` |

**Requirement → test map:**
| Behavior | Test | File exists? |
|----------|------|-------------|
| Dashboard body click → full-page (`onIssueClick`), not peek | rewrite test 3 | ✅ DashboardInProgressCard.test.tsx |
| Dashboard full-page resets breadcrumb (resetTrail=true) | assert wrapper passes `true` — best at index.test.tsx or manual | ⚠ index.test.tsx exists; verify it covers the wrapper |
| Notification body click → full-page + markAsRead + onClose | add test to NotificationPopover.test.tsx (render with onIssueClick, no onOpenIssue) | ✅ file exists, new case |
| Key-button still full-page (no regression) | existing test 3 L204-208 | ✅ |
| Out-of-scope surfaces unchanged | no edits to those files; existing suites stay green | ✅ |

## Assumptions Log
| # | Claim | Risk if wrong |
|---|-------|---------------|
| A1 | `index.test.tsx` for dashboard does not currently assert the breadcrumb-reset wrapper | Low — planner/executor should read index.test.tsx to confirm; add coverage if absent |

*All other claims VERIFIED by direct code read.*

## Sources
### Primary (HIGH)
- `src/main.tsx` L321-366 (handleOpenPeek, handleIssueClick), L533-535 (TopBar wiring resetTrail=true), L573-584 (outlet context)
- `src/components/app/TopBar.tsx` L102-104 (NotificationPopover wiring)
- `src/routes/notifications/NotificationPopover.tsx` L275-307 (handleRowClick/handleIssueKeyClick)
- `src/routes/notifications/NotificationRow.tsx` L283-292 (key button stopPropagation)
- `src/routes/dashboard/DashboardInProgressCard.tsx` L33-36, L137-228 (fallback call sites)
- `src/routes/dashboard/index.tsx` L34-37, L111-119 (outlet context type + card wiring)
- Test files: DashboardInProgressCard.test.tsx L189-281; NotificationPopover.test.tsx L45-99; NotificationRow.test.tsx L161-167
- grep: DashboardInProgressCard reused only by dashboard; standup-notes is a comment reference
