---
phase: quick
plan: 260317-wdi
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/gitlab.ts
  - taskflow/src/routes/dashboard/MergeRequestListPage.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "MR labels on the list page render with their GitLab hex colors instead of generic gray"
    - "MR labels on the detail page continue to render with colors (no regression)"
  artifacts:
    - path: "taskflow/src/services/gitlab.ts"
      provides: "GitLabMR.labels typed as GitLabLabel[], fetchProjectMRs enriches labels with color data"
    - path: "taskflow/src/routes/dashboard/MergeRequestListPage.tsx"
      provides: "Label rendering with inline color styles matching detail page pattern"
  key_links:
    - from: "taskflow/src/services/gitlab.ts (fetchProjectMRs)"
      to: "GitLab /projects/:id/labels API"
      via: "apiFetch call to get label colors, same pattern as fetchMRDetail"
      pattern: "labelColorMap"
    - from: "taskflow/src/routes/dashboard/MergeRequestListPage.tsx"
      to: "GitLabLabel.color / GitLabLabel.text_color"
      via: "inline style on label span elements"
      pattern: "style=.*backgroundColor.*l\\.color"
---

<objective>
Make MR labels on the list page render with their actual GitLab colors instead of generic gray badges.

Purpose: Visual consistency between MR list and MR detail pages, and with GitLab itself.
Output: Colored MR labels on the list page using the same pattern already established on the detail page.
</objective>

<context>
@taskflow/src/services/gitlab.ts (GitLabMR interface at line 170, GitLabLabel at 185, fetchProjectMRs at 637, fetchMRDetail label enrichment at 602-632)
@taskflow/src/routes/dashboard/MergeRequestListPage.tsx (label rendering at lines 196-205)
</context>

<interfaces>
<!-- From taskflow/src/services/gitlab.ts -->
```typescript
export interface GitLabLabel {
  name: string;
  color: string;       // hex like "#428BCA"
  text_color: string;  // hex like "#FFFFFF"
}

export interface GitLabMR {
  // ... other fields
  labels: string[];  // <-- THIS NEEDS TO BECOME GitLabLabel[]
  milestone: { id: number; title: string } | null;
}
```

<!-- Existing color enrichment pattern from fetchMRDetail (lines 602-632): -->
```typescript
let labelColorMap: Record<string, { color: string; text_color: string }> = {};
// Fetch /api/v4/projects/{projectId}/labels?per_page=100
// Build map from name -> {color, text_color}
// Then map labels: string -> GitLabLabel using the map
```

<!-- Existing colored rendering pattern from MergeRequestDetailPage.tsx (lines 315-327): -->
```typescript
<span
  key={l.name}
  className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
  style={{
    backgroundColor: l.color,
    color: l.text_color,
    borderColor: `${l.color}80`,
  }}
>
  {l.name}
</span>
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Enrich fetchProjectMRs with label colors and update GitLabMR type</name>
  <files>taskflow/src/services/gitlab.ts</files>
  <action>
1. Change `GitLabMR.labels` type from `string[]` to `GitLabLabel[]` (line 181). Update the comment to say "label objects with colors".

2. In `fetchProjectMRs`, after getting the MR data array, add label color enrichment using the exact same pattern as `fetchMRDetail` (lines 602-632):
   - Collect all unique label names across all MRs in the response
   - If any labels exist, fetch `/api/v4/projects/${projectId}/labels?per_page=100` to get the color map
   - Map each MR's labels from strings to `GitLabLabel` objects using the color map
   - Fall back to `{ color: '#6b7280', text_color: '#FFFFFF' }` if color lookup fails (same defaults as fetchMRDetail)
   - Wrap the labels fetch in try/catch so it degrades gracefully

3. In `searchGitLabMRs`, the search API also returns string labels. Since search results span multiple projects and we don't have a single projectId, just convert labels to GitLabLabel with the default gray color (`#6b7280`/`#FFFFFF`). This keeps the type consistent without an expensive multi-project label fetch.

4. Verify that test fixtures in MrAttentionTab.test.tsx and MyTasksTab.test.tsx use `labels: []` (empty arrays are compatible with both types, so no changes needed there).
  </action>
  <verify>cd taskflow && npx tsc --noEmit 2>&1 | head -30</verify>
  <done>GitLabMR.labels is GitLabLabel[], fetchProjectMRs enriches labels with color data from project labels API, searchGitLabMRs converts to GitLabLabel with defaults, no TypeScript errors</done>
</task>

<task type="auto">
  <name>Task 2: Render MR list labels with GitLab colors</name>
  <files>taskflow/src/routes/dashboard/MergeRequestListPage.tsx</files>
  <action>
Update the label rendering in MergeRequestListPage.tsx (around lines 198-204) to use the colored style pattern instead of generic gray.

Replace:
```tsx
{mr.labels?.map((label) => (
  <span
    key={label}
    className="inline-flex items-center rounded-full bg-muted px-1.5 py-0 text-[10px] font-medium text-muted-foreground"
  >
    {label}
  </span>
))}
```

With (using the same inline style pattern as MergeRequestDetailPage but with the smaller list-appropriate sizing):
```tsx
{mr.labels?.map((l) => (
  <span
    key={l.name}
    className="inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium"
    style={{
      backgroundColor: l.color,
      color: l.text_color,
      borderColor: `${l.color}80`,
    }}
  >
    {l.name}
  </span>
))}
```

Keep the existing sizing classes (px-1.5 py-0 text-[10px]) to maintain the compact list appearance. Only change the color approach from Tailwind gray classes to inline hex styles.
  </action>
  <verify>cd taskflow && npx tsc --noEmit 2>&1 | head -30</verify>
  <done>MR list page labels render with their actual GitLab hex background/text colors instead of generic gray badges</done>
</task>

</tasks>

<verification>
- `cd taskflow && npx tsc --noEmit` passes with no errors
- `cd taskflow && npx vitest run --reporter=verbose 2>&1 | tail -20` shows no test failures
- MR list page labels visually match GitLab's label colors
</verification>

<success_criteria>
- MR labels on list page display with colored backgrounds matching their GitLab configuration
- MR detail page labels continue working (no regression)
- TypeScript compiles cleanly
- All existing tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/260317-wdi-make-mr-labels-match-gitlab-colors-on-de/260317-wdi-SUMMARY.md`
</output>
