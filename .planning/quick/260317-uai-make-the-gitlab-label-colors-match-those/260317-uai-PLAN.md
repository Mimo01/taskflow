---
phase: quick
plan: 260317-uai
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/gitlab.ts
  - taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx
  - taskflow/src/routes/dashboard/IssueDetailSidebar.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "GitLab labels on MR detail page render with their actual GitLab color (background + text)"
    - "Jira issue labels in issue detail sidebar remain functional (no regression)"
  artifacts:
    - path: "taskflow/src/services/gitlab.ts"
      provides: "GitLabLabel type and colored label data from API"
      contains: "GitLabLabel"
    - path: "taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx"
      provides: "Color-rendered GitLab label badges"
      contains: "backgroundColor"
  key_links:
    - from: "taskflow/src/services/gitlab.ts"
      to: "taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx"
      via: "GitLabLabel type used for rendering"
      pattern: "GitLabLabel"
---

<objective>
Make GitLab labels display with their actual GitLab colors (background + contrasting text) instead of generic gray badges.

Purpose: Labels in GitLab have user-assigned colors. The app currently renders them as plain gray `Badge variant="secondary"` chips, losing the visual distinction that makes labels useful for quick identification.

Output: GitLab MR detail page shows labels with their real colors. The approach uses inline styles with the hex color/text_color from the GitLab API, similar to the existing epic color pattern in `epicColors.ts`.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/services/gitlab.ts (GitLab API service — GitLabMRDetail type at line 183, fetchMRDetail at line 567)
@taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx (MR detail — label rendering at line 274)
@taskflow/src/routes/dashboard/IssueDetailSidebar.tsx (Jira issue labels at line 538 — for reference, uses f.labels which are plain strings from Jira)
@taskflow/src/lib/epicColors.ts (existing pattern for hex-to-inline-style color rendering)

<interfaces>
From taskflow/src/services/gitlab.ts:
```typescript
export interface GitLabMRDetail extends GitLabMR {
  description: string | null;
  target_branch: string;
  created_at: string;
  labels: string[];  // Currently plain strings — will become GitLabLabel[]
  draft: boolean;
  merge_status: string;
  has_conflicts: boolean;
  changes_count: string;
  merged_at: string | null;
  closed_at: string | null;
  pipeline: { id: number; status: string; web_url: string } | null;
  assignee: { id: number; name: string; username: string; avatar_url: string } | null;
}
```

From taskflow/src/lib/epicColors.ts (inline hex style pattern to follow):
```typescript
// If it looks like a hex color, generate inline styles
if (normalized.startsWith('#') && (normalized.length === 4 || normalized.length === 7)) {
  return {
    className: 'border',
    style: {
      backgroundColor: `${normalized}20`, // ~12% opacity bg
      color: normalized,
      borderColor: `${normalized}60`, // ~38% opacity border
    },
  }
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add GitLabLabel type and fetch label details from API</name>
  <files>taskflow/src/services/gitlab.ts</files>
  <action>
1. Add a new `GitLabLabel` interface near the existing GitLab types (around line 183):
   ```typescript
   export interface GitLabLabel {
     name: string;
     color: string;       // hex like "#428BCA"
     text_color: string;  // hex like "#FFFFFF"
   }
   ```

2. Change `GitLabMRDetail.labels` from `string[]` to `GitLabLabel[]`.

3. In `fetchMRDetail` (line 573), append `?include_labels_details=true` to the URL so the GitLab API returns label objects instead of plain strings. The URL becomes:
   ```
   `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${projectId}/merge_requests/${mrIid}?include_labels_details=true`
   ```

4. The API response will now have `labels` as `[{id, name, color, text_color, ...}]` objects. The existing `return data as GitLabMRDetail` cast will work since we only read `name`, `color`, `text_color`.

5. Also check `fetchProjectMRs` (line 601) — it returns `GitLabMR[]` which does NOT have labels, so no change needed there.

Note: Jira labels in IssueDetailSidebar use `f.labels` which are `string[]` from Jira's API (Jira labels have no color). These are unrelated and unchanged.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>GitLabLabel type exists, GitLabMRDetail.labels is GitLabLabel[], fetchMRDetail URL includes include_labels_details=true, TypeScript compiles clean</done>
</task>

<task type="auto">
  <name>Task 2: Render GitLab labels with actual colors in MR detail page</name>
  <files>taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx</files>
  <action>
1. Update the label rendering block (around line 274-282) to use the new `GitLabLabel` color fields. Replace the generic `Badge variant="secondary"` with inline-styled spans that use the label's actual hex colors:

   ```tsx
   {mr.labels.length > 0 && (
     <SidebarField label="Labels">
       <div className="flex flex-wrap gap-1">
         {mr.labels.map((l) => (
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
         ))}
       </div>
     </SidebarField>
   )}
   ```

2. The style uses `l.color` as background (the actual GitLab label color), `l.text_color` for text contrast (GitLab provides this as white or black), and a semi-transparent version of the color for the border.

3. Remove the `Badge` import if it's no longer used elsewhere in the file — check before removing.

4. If Badge is still used elsewhere in the file, keep the import.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>MR detail page renders GitLab labels with their actual hex background color and contrasting text color from the GitLab API, matching how they appear in GitLab's UI</done>
</task>

</tasks>

<verification>
1. `cd taskflow && npx tsc --noEmit` — TypeScript compiles with no errors
2. Visual: Open an MR detail page for an MR that has labels — labels should show with colored backgrounds matching GitLab
</verification>

<success_criteria>
- GitLab labels on MR detail page display with their actual GitLab-assigned colors (colored background, contrasting text)
- No TypeScript compilation errors
- Jira issue labels in IssueDetailSidebar are unaffected (still plain Badge variant="secondary")
</success_criteria>

<output>
After completion, create `.planning/quick/260317-uai-make-the-gitlab-label-colors-match-those/260317-uai-SUMMARY.md`
</output>
