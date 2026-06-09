---
phase: quick-260609-bzk
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/routes/dashboard/AioCycleDetailPage.tsx
autonomous: true
requirements:
  - bzk-defects-peek

must_haves:
  truths:
    - "Clicking a defect row body opens the PeekPanel side preview"
    - "Clicking the issue key NavLink still navigates full-page to /issue/:key"
    - "The 'Triggered By' column remains plain text (AIO test case keys, not Jira issue keys)"
  artifacts:
    - path: "src/routes/dashboard/AioCycleDetailPage.tsx"
      provides: "onOpenIssue wired to DefectRow.onOpen; openDefect removed"
      contains: "onOpenIssue"
  key_links:
    - from: "AioCycleDetailPage (useOutletContext)"
      to: "main.tsx handleOpenPeek"
      via: "OutletContext onOpenIssue"
      pattern: "onOpenIssue.*useOutletContext"
    - from: "DefectRow onOpen prop"
      to: "onOpenIssue"
      via: "prop passed at line ~1233"
      pattern: "onOpen=\\{onOpenIssue\\}"
---

<objective>
Wire the AIO cycle defects list to open the PeekPanel side preview on row-body click, matching the pattern used by BacklogRow and SprintBoardTab throughout the app.

Purpose: Clicking a defect row currently triggers a full-page navigation (openDefect → navigate('/issue/...')), breaking the non-blocking peek flow the rest of the app provides.
Output: `AioCycleDetailPage.tsx` updated — `onOpenIssue` extracted from OutletContext, `openDefect` replaced, `DefectRow.onOpen` receives the peek callback.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/quick/260609-bzk-on-aio-cycle-defects-subpage-there-are-d/260609-bzk-RESEARCH.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wire DefectRow row-click to PeekPanel via onOpenIssue</name>
  <files>src/routes/dashboard/AioCycleDetailPage.tsx</files>
  <action>
    In `AioCycleDetailPage.tsx`:

    1. Add `useOutletContext` to the existing `react-router-dom` import (it is already imported on line 15 — extend the destructure).

    2. Near the top of the component function body (after existing hooks), extract `onOpenIssue` from OutletContext:
       `const { onOpenIssue } = useOutletContext<{ onOpenIssue: (issueKey: string) => void }>();`

    3. Remove the `openDefect` function entirely (lines ~738–741). It currently pushes a breadcrumb and calls `navigate('/issue/...')`. PeekPanel does not navigate, so no breadcrumb push is needed.

    4. At the `DefectRow` call site (~line 1233), change the `onOpen` prop from `onOpen={openDefect}` to `onOpen={onOpenIssue}`.

    5. Do NOT change `DefectRow`'s internal structure — the `<tr>` onClick/onKeyDown and the key `<NavLink>` with `e.stopPropagation()` already implement the correct dual pattern.

    6. Do NOT change the "Triggered By" `<td>` — per D (CONTEXT.md decision), those values are AIO test case keys (e.g., PROJ-TC-42), not Jira issue keys, and PeekPanel cannot handle them. Leave as plain text.

    The diff is approximately 5 lines: add `useOutletContext` to import destructure, add one `const { onOpenIssue }` line, remove the 4-line `openDefect` function, change one prop reference.
  </action>
  <verify>
    <automated>npm run check 2>&1 | tail -20</automated>
  </verify>
  <done>
    `npm run check` passes (Biome + tsc clean). In the app, navigating to an AIO cycle's defects tab and clicking a defect row body opens the PeekPanel. Clicking the issue key link still opens the full-page issue detail. The "Triggered By" column remains plain text.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| OutletContext consumer | AioCycleDetailPage reads onOpenIssue from OutletContext — the callback is provided by AppLayout (main.tsx) and is always a stable setter, not user-supplied data |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-bzk-01 | Tampering | onOpenIssue(issueKey) | accept | issueKey originates from server-fetched defect data already validated on prior fetch; PeekPanel query re-fetches server-side |
</threat_model>

<verification>
1. `npm run check` exits 0 (Biome lint + tsc)
2. AIO cycle defects tab: row body click opens PeekPanel (not full-page navigate)
3. AIO cycle defects tab: key NavLink click opens full issue page
4. "Triggered By" column: unchanged, still plain text
</verification>

<success_criteria>
Defect rows in the AIO cycle defects tab behave identically to Backlog rows: body click = peek, key click = full page. No regressions in tsc or Biome.
</success_criteria>

<output>
Create `.planning/quick/260609-bzk-on-aio-cycle-defects-subpage-there-are-d/260609-bzk-SUMMARY.md` when done.
</output>
