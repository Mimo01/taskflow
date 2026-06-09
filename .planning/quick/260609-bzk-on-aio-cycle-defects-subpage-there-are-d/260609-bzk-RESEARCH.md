# Quick Task 260609-bzk: AIO Cycle Defects Side Preview - Research

**Researched:** 2026-06-09
**Domain:** React router OutletContext, PeekPanel wiring
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Row body click opens PeekPanel via `onOpenIssue` from OutletContext
- Key column NavLink keeps existing full-page navigation with stopPropagation
- "Triggered By" keys also open the peek panel
- Scope: defects tab only — do NOT wire peek for test runs or test cases

### Claude's Discretion
- Breadcrumb push behavior: existing `openDefect` pushes a breadcrumb before navigating; with peek this is no longer needed (PeekPanel doesn't change the route)
</user_constraints>

---

## Summary

`AioCycleDetailPage` currently does NOT call `useOutletContext` at all — it navigates full-page via a local `openDefect` function. The wiring is entirely self-contained in this one file. Three changes are needed: (1) add `useOutletContext` to extract `onOpenIssue`, (2) replace `openDefect` with a direct call to `onOpenIssue`, (3) wire the "Triggered By" cell in `DefectRow` to call `onOpenIssue` instead of rendering plain text.

`DefectRow` already has the row-body click pattern fully implemented — the `onOpen` prop is wired to the `<tr>` as a role=button. The key `<NavLink>` already calls `e.stopPropagation()`. No changes to `DefectRow`'s structure are needed; only the callback it receives changes.

**Primary recommendation:** Extract `onOpenIssue` from OutletContext in `AioCycleDetailPage`, pass it as `DefectRow.onOpen`, and add a `onOpenIssue` prop to `DefectRow` for the "Triggered By" links (or re-use `onOpen`).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PeekPanel open/close | AppLayout (main.tsx) | — | `peekIssueKey` state lives in AppLayout; all children reach it via OutletContext `onOpenIssue` |
| Passing `onOpenIssue` to pages | Outlet context (main.tsx line 582) | — | Single source of truth |
| Row-body peek trigger | DefectRow (presentational) | — | Already has `onOpen` prop wired to `<tr>` |

---

## Key Findings

### 1. OutletContext shape (main.tsx lines 572–583)

`onOpenIssue` is already in the OutletContext passed to every child route:

```tsx
<Outlet
  context={{
    onIssueClick: handleIssueClick,
    onEpicClick: handleIssueClick,
    onMRClick: handleMRClick,
    openEdit: handleOpenEdit,
    openClone: handleOpenClone,
    openAddSubtask: handleOpenAddSubtask,
    openCreateStory: handleOpenCreateStory,
    onOpenIssue: handleOpenPeek,   // ← this is what we need
  }}
/>
```

`handleOpenPeek` is simply `(issueKey: string) => setPeekIssueKey(issueKey)` (line 322). No route change, no breadcrumb push needed. [VERIFIED: read from main.tsx]

### 2. AioCycleDetailPage does NOT call useOutletContext today

The entire file has no `useOutletContext` import or call. `openDefect` (lines 738–741) does:

```tsx
const openDefect = (resolvedKey: string) => {
  useBreadcrumbStore.getState().push({ label: cycleName, path: location.pathname });
  navigate(`/issue/${resolvedKey}`);
};
```

This must be replaced with `onOpenIssue(resolvedKey)`. The breadcrumb push is not needed since PeekPanel does not navigate. [VERIFIED: read from AioCycleDetailPage.tsx]

### 3. DefectRow `onOpen` prop — already fully wired to row body

`DefectRow` (lines 221–350) takes `onOpen: (resolvedKey: string) => void` and wires it to the `<tr>` via `onClick` and `onKeyDown` (Enter/Space). The key `<NavLink>` already calls `e.stopPropagation()` (line 263). The row pattern is already correct — only the callback passed in changes. [VERIFIED: read from AioCycleDetailPage.tsx]

### 4. "Triggered By" cell — plain text today, needs peek links

The last `<td>` in `DefectRow` (line 347) renders:

```tsx
<td className="px-3 py-3 text-xs text-muted-foreground">{triggeredBy || '—'}</td>
```

`triggeredBy` is a comma-joined string of `testCaseKey` values (e.g., `"ABC-TC-1, ABC-TC-2"`). These are AIO test case keys, not Jira issue keys — they don't map to Jira issues and don't have a `/issue/` route. **The CONTEXT.md decision says these should open the peek panel, but they are AIO test case keys, not Jira issue keys.** This is a scope conflict that needs clarification before implementation.

Options:
- A. Skip wiring "Triggered By" links (they are not Jira issue keys; PeekPanel only shows Jira issues)
- B. Wire them as NavLinks to `/aio-cycle/:projectKey/:cycleKey/run/:runId` — but `DefectRow` doesn't have run IDs available in its `triggeredBy` string
- C. Confirm with user whether "Triggered By" should be left as plain text in this task

**Recommendation:** Treat "Triggered By" as out of scope for peek-wiring in this task since they are not Jira issue keys. The CONTEXT.md decision appears to assume they are issue keys — this needs a note in the plan. [ASSUMED: test case keys cannot open PeekPanel without a Jira issue key]

### 5. BacklogRow dual pattern (reference only)

BacklogRow uses `(onOpenIssue ?? onIssueClick)(issue.key)` on row click (lines 304, 327). The key button calls `e.stopPropagation(); onIssueClick(issue.key)`. DefectRow already mirrors this pattern exactly — `onOpen` is for the row body (now peek), and `NavLink onClick` does `e.stopPropagation()`. No new pattern work needed. [VERIFIED: read from BacklogRow.tsx]

### 6. No shared OutletContext type definition to update

There is no exported TypeScript type for the OutletContext shape. Pages using it call `useOutletContext<{ onOpenIssue: (key: string) => void; ... }>()` inline with local type annotations. Adding `onOpenIssue` to `AioCycleDetailPage`'s `useOutletContext` call is a local change only. [VERIFIED: no exported type found in main.tsx or routes/]

---

## Implementation Steps (for planner)

1. **Add `useOutletContext` import** to `AioCycleDetailPage.tsx` (from `react-router-dom`; already imported on line 15 — just add to destructure)
2. **Extract `onOpenIssue`** from outlet context with appropriate type annotation
3. **Replace `openDefect`** — remove the breadcrumb push and navigate call; replace body with `onOpenIssue(resolvedKey)`
4. **Pass `onOpenIssue` as `DefectRow.onOpen`** — the existing call site (line 1233) passes `onOpen={openDefect}`, change to `onOpen={onOpenIssue}`
5. **"Triggered By" links** — confirm scope (see Finding #4 above); if deferred, no change to `DefectRow` needed

The diff is minimal: ~5 lines changed/added in `AioCycleDetailPage.tsx`, no changes to `DefectRow`, no changes to `main.tsx`.

---

## Open Questions

1. **"Triggered By" links are AIO test case keys, not Jira issue keys**
   - What we know: `triggeredBy` is a comma-joined string of `run.testCaseKey` values (e.g., `PROJ-TC-42`)
   - What's unclear: PeekPanel only handles Jira issue keys — these cannot be peeked
   - Recommendation: Descope "Triggered By" wiring from this task; confirm with user

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Triggered By" keys are AIO test case keys, not Jira issue keys, so they cannot open PeekPanel | Finding #4 | If they are actually Jira issue keys, they can be wired to onOpenIssue directly |

---

## Sources

### Primary (HIGH confidence)
- `taskflow/src/main.tsx` — OutletContext shape, handleOpenPeek definition (lines 322, 572–583)
- `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` — full file, openDefect, DefectRow, triggeredBy rendering
- `taskflow/src/routes/dashboard/BacklogRow.tsx` — dual click pattern (lines 103–119, 304, 327)
