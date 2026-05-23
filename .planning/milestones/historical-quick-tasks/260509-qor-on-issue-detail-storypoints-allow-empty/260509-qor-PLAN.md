---
phase: quick
plan: 260509-qor
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
  - taskflow/src/routes/dashboard/IssueDetailSheet.test.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "User can clear story points from an issue (set to no value / null)"
    - "Clearing story points shows '—' (empty state) after save"
    - "Entering a valid number still saves that number (no regression)"
    - "Pressing Escape while editing still cancels without saving"
  artifacts:
    - path: "taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx"
      provides: "Updated commitSpEdit + Clear button in SP edit mode"
  key_links:
    - from: "FieldsSection.tsx commitSpEdit"
      to: "mutation.mutate"
      via: "value: null when input is empty"
      pattern: "mutation\\.mutate.*null"
---

<objective>
Allow story points on issue detail to be cleared (set to null / no value).

Purpose: Currently emptying the input field sends 0, not null — users cannot remove story points from an issue.
Output: Modified FieldsSection with a "Clear" affordance and a fixed commitSpEdit that sends null on empty input.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/mimo/Documents/Projects/taskflow/.planning/STATE.md
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Fix commitSpEdit and add Clear button for story points</name>
  <files>
    taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
    taskflow/src/routes/dashboard/IssueDetailSheet.test.tsx
  </files>
  <behavior>
    - Empty input committed → mutation called with value: null (not 0)
    - Non-empty valid number → mutation called with that number (no change)
    - Same value as original with non-empty input → no mutation (no change)
    - Clear button click while in SP edit mode → mutation called with value: null, editing closes
    - Escape key → cancel, no mutation (no change)
    - storyPoints null displayed as '—' in the trigger button (already working, verify no regression)
  </behavior>
  <action>
In `FieldsSection.tsx`, make two changes:

1. **Fix `commitSpEdit`** (lines 296-302):

Replace:
```ts
function commitSpEdit() {
  setSpEditing(false);
  const num = Number(spInput);
  if (!Number.isNaN(num) && num !== spOriginal.current) {
    mutation.mutate({ fieldName: storyPointsFieldKey, value: num });
  }
}
```

With:
```ts
function commitSpEdit() {
  setSpEditing(false);
  if (spInput.trim() === '') {
    // Empty input = clear story points (send null)
    if (spOriginal.current !== null) {
      mutation.mutate({ fieldName: storyPointsFieldKey, value: null });
    }
    return;
  }
  const num = Number(spInput);
  if (!Number.isNaN(num) && num !== spOriginal.current) {
    mutation.mutate({ fieldName: storyPointsFieldKey, value: num });
  }
}
```

2. **Add a Clear button** in the SP edit mode JSX (inside the `{spEditing ? (` branch, alongside the Input). Add a small "Clear" button after the Input element so users have an explicit affordance, matching the "× Remove" pattern used on labels:

```tsx
{spEditing ? (
  <div className="flex items-center gap-1">
    <Input
      type="number"
      min={0}
      max={999}
      value={spInput}
      onChange={(e) => setSpInput(e.target.value)}
      onBlur={commitSpEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commitSpEdit();
        if (e.key === 'Escape') cancelSpEdit();
      }}
      autoFocus
      className="h-6 w-20 text-xs"
    />
    {storyPoints != null && (
      <button
        data-testid="story-points-clear"
        type="button"
        onMouseDown={(e) => {
          // Prevent onBlur on Input from firing commitSpEdit before this click registers
          e.preventDefault();
        }}
        onClick={() => {
          setSpEditing(false);
          mutation.mutate({ fieldName: storyPointsFieldKey, value: null });
        }}
        className="text-muted-foreground hover:text-destructive text-xs leading-none"
        title="Clear story points"
        aria-label="Clear story points"
      >
        ×
      </button>
    )}
    {mutation.isError && (
      <p className="text-xs text-destructive mt-1">Save failed — changes reverted</p>
    )}
  </div>
) : (
  ...existing trigger button...
)}
```

Note: The Clear button only appears when `storyPoints != null` (there is a value to clear). The `onMouseDown` with `e.preventDefault()` prevents the Input's `onBlur` → `commitSpEdit` from firing first and closing edit mode before the click is processed.

In `IssueDetailSheet.test.tsx`, add a test under the existing story points block (or create a new `describe` block `'ISSUE-SP: story points clear'`):

```ts
it('sends null when story points input is cleared and committed', async () => {
  // Use FieldsSection directly or IssueDetailSidebar with a spy mutation
  // Verify: clearing the SP input and pressing Enter calls mutation with value: null
});

it('sends null when Clear button is clicked on a story with existing points', async () => {
  // Verify: clicking story-points-clear button calls mutation with value: null
});
```

Follow the existing test patterns in the file: use `makeIssueDetail({ customfield_10016: 5 })` for an issue with story points and `makeIssueDetail({ customfield_10016: null })` for one without. Use `vi.fn()` for the mutation and assert it was called with `{ fieldName: 'customfield_10016', value: null }`.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/IssueDetailSheet.test.tsx --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>
    - commitSpEdit sends null when input is empty and original was not null
    - Clear button (data-testid="story-points-clear") appears only when storyPoints is not null
    - Clicking Clear button mutates with value: null and closes edit mode
    - All existing story points tests pass (no regression)
    - New null/clear tests pass
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| UI input → Jira API | User-supplied story points value sent via mutation to Jira REST API |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-qor-01 | Tampering | commitSpEdit numeric parsing | accept | Input is type="number" with min/max; server validates; null is an explicit valid value in Jira API |
</threat_model>

<verification>
Run full test suite to confirm no regressions:

```bash
cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/ --reporter=verbose 2>&1 | tail -40
```
</verification>

<success_criteria>
- Story points field in issue detail allows clearing (setting to null/empty)
- Empty input → null mutation (not 0)
- Clear (×) button visible when story points has a value, hidden when already null
- All existing IssueDetailSheet tests continue to pass
</success_criteria>

<output>
After completion, create `.planning/quick/260509-qor-on-issue-detail-storypoints-allow-empty/260509-qor-SUMMARY.md`
</output>
