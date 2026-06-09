---
phase: quick
plan: 260609-cmd
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/components/app/CommandPalette.tsx
  - taskflow/src/components/app/CommandPalette.test.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Clicking any issue row (body) in the command palette opens the full-page issue detail, not the peek panel"
    - "Clicking the key button (e.g. TEST-1) inside an issue row still opens the full-page issue detail"
    - "Recent-items Jira entries in default state also open the full-page issue detail"
  artifacts:
    - path: taskflow/src/components/app/CommandPalette.tsx
      provides: handleIssueSelect routes to onIssueClick (full-page) not onOpenIssue (peek)
    - path: taskflow/src/components/app/CommandPalette.test.tsx
      provides: PALETTE-02 test asserts onIssueClick called, onOpenIssue NOT called
  key_links:
    - from: CommandPalette.tsx
      to: main.tsx onIssueClick handler
      via: handleIssueSelect -> onIssueClick?.(issueKey)
      pattern: "onIssueClick\\?\\."
---

<objective>
Change the command palette so all issue selections (body click + recent-item click) navigate to
the full-page issue detail instead of opening the peek panel.

Purpose: User wants a consistent "always full page" experience when selecting search results.
The key button inside each row already calls onIssueClick (full-page); this task extends that
same behaviour to the row body and recent-items Jira entries.

Output: Updated CommandPalette.tsx + matching test update.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/mimo/Documents/Projects/taskflow/.planning/STATE.md
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/components/app/CommandPalette.tsx
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/components/app/CommandPalette.test.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Route all issue selections in CommandPalette to full-page navigation</name>
  <files>taskflow/src/components/app/CommandPalette.tsx</files>
  <action>
In handleIssueSelect (line ~168), change the call from onOpenIssue(issueKey) to
onIssueClick?.(issueKey). The onIssueClick prop is already defined and wired in main.tsx to
handleIssueClick(key, true) (full-page with resetTrail). onOpenIssue remains in the props
interface because PeekPanel and other consumers pass it, but handleIssueSelect must no longer
use it for search results.

No other changes to the function — onClose() call stays.

The handleIssueKeyClick function (key-element click, line ~176) already calls onIssueClick and
is correct as-is; do not modify it.

The recent-items Jira branch in the default-state CommandItem onSelect (line ~292) calls
handleIssueSelect(item.id) — it will automatically get the full-page behaviour after the above
fix with no additional changes needed.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow && npm run check --prefix taskflow 2>&1 | tail -5</automated>
  </verify>
  <done>handleIssueSelect calls onIssueClick?.(issueKey) instead of onOpenIssue(issueKey); npm run check passes</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Update PALETTE-02 test to assert full-page navigation on body click</name>
  <files>taskflow/src/components/app/CommandPalette.test.tsx</files>
  <behavior>
    - Test: clicking an issue body row in search results calls onIssueClick('TEST-1'), NOT onOpenIssue
    - Test: onClose is still called after selection
  </behavior>
  <action>
Update the test at line ~236 (description: "selecting a Jira issue body calls onOpenIssue (peek)").

Change:
- Test description to: "selecting a Jira issue body calls onIssueClick (full-page)"
- The comment block referencing "PEEK-01: clicking the issue summary (body) calls onOpenIssue (peek)"
  → update comment to "clicking the issue summary (body) calls onIssueClick (full-page)"
- The assertions: expect(onOpenIssue).toHaveBeenCalledWith('TEST-1') → expect(onIssueClick).toHaveBeenCalledWith('TEST-1')
  and expect(onIssueClick).not.toHaveBeenCalled() → expect(onOpenIssue).not.toHaveBeenCalled()

Also update the comment on line ~265 from:
  "PEEK-01: clicking the issue summary (body) calls onOpenIssue (peek), not onIssueClick"
  → "clicking the issue summary (body) calls onIssueClick (full-page), not onOpenIssue"
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/components/app/CommandPalette.test.tsx 2>&1 | tail -20</automated>
  </verify>
  <done>All CommandPalette tests pass; PALETTE-02 now asserts onIssueClick called and onOpenIssue NOT called</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user input → issue key | Issue key from search/recent items passed to navigation handler |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation |
|-----------|----------|-----------|-------------|------------|
| T-cmd-01 | Tampering | handleIssueSelect issueKey arg | accept | Key comes from TanStack query cache (already validated on fetch); no user-supplied raw string enters navigation |
</threat_model>

<verification>
1. npm run check passes (biome + tsc)
2. CommandPalette.test.tsx all tests pass
3. Selecting a cached issue in the palette navigates to /issue/KEY (full-page), not peek panel
</verification>

<success_criteria>
Body-clicking any issue result or recent-item in the command palette opens /issue/KEY (full-page).
The key button inside each row continues to open full-page (unchanged behaviour).
All existing CommandPalette tests pass with updated assertions.
</success_criteria>

<output>
Create `.planning/quick/260609-cmd-when-searching-for-issues-always-open-th/260609-cmd-SUMMARY.md` when done
</output>
