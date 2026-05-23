---
phase: quick-260323-hwn
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
autonomous: true
requirements: [LABEL-SUMMARY]

must_haves:
  truths:
    - "User can see all unique labels from MRs in a summary section on the release detail page"
    - "Each label shows its GitLab color and a count of how many MRs carry it"
    - "Labels are visible even when MRs are matched to issues or unmatched"
  artifacts:
    - path: "taskflow/src/routes/dashboard/ReleaseDetailPage.tsx"
      provides: "Label summary section aggregating unique labels across all milestone MRs"
      contains: "labelSummary"
  key_links:
    - from: "labelSummary useMemo"
      to: "milestoneMRs query data"
      via: "aggregation of mr.labels across all MRs"
      pattern: "milestoneMRs.*labels"
---

<objective>
Add a label summary section to the release detail page that aggregates all unique labels from milestone MRs and displays them as colored badges with counts.

Purpose: Give the user a quick overview of what types of work (features, bugs, etc.) are included in a release by surfacing the GitLab labels assigned to merge requests.
Output: A new "Labels" section in ReleaseDetailPage showing unique labels with their GitLab colors and MR counts.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
@taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx (label rendering pattern)

<interfaces>
<!-- GitLabLabel type from gitlab.ts -->
From taskflow/src/services/gitlab.ts:
```typescript
export interface GitLabLabel {
  name: string;
  color: string;     // hex like "#428BCA"
  text_color: string; // hex like "#FFFFFF"
}

export interface GitLabMR {
  // ...
  labels: GitLabLabel[];
  // ...
}
```

<!-- Label rendering pattern from MergeRequestDetailPage.tsx lines 326-336 -->
```tsx
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
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add label summary section to ReleaseDetailPage</name>
  <files>taskflow/src/routes/dashboard/ReleaseDetailPage.tsx</files>
  <action>
1. Add a `useMemo` hook called `labelSummary` that:
   - Combines all MRs from `milestoneMRs` (both matched and unmatched are already in this array)
   - Iterates over every MR's `labels` array
   - Builds a Map keyed by label name, storing `{ label: GitLabLabel, count: number }` where count = number of MRs carrying that label
   - Returns the map values sorted by count descending, then alphabetically
   - Dependencies: `[milestoneMRs]`

2. Add a new `<section>` between the progress bar area (after the closing of the Issues `</section>` around line 686) and the "Action buttons" section (line 688). Place it as a sibling section in the left column `space-y-6` container. Insert it BEFORE the Issues section (between the Description section ending ~line 444 and the Issues section starting ~line 447) so labels appear as a high-level summary before the detailed issue table.

3. The section structure:
   - Heading: "Labels" with a `Tag` icon from lucide-react (add to imports), styled like the existing section headings (`text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5`)
   - Only render if `labelSummary.length > 0` AND `milestoneMRs` is defined (don't show when no milestone matched)
   - Content: `flex flex-wrap gap-1.5` container with label badges
   - Each badge: use the EXACT same rendering pattern as MergeRequestDetailPage (rounded-full, border, px-2 py-0.5, text-xs font-medium, backgroundColor/color/borderColor from label object)
   - Append the MR count after the label name: `{l.label.name} ({l.count})` -- the count in parentheses helps users see which labels dominate

4. Import `Tag` from lucide-react (add to the existing import block around line 12).

5. Import `GitLabLabel` type -- it is already imported indirectly via `GitLabMR` but add explicit import if needed for the Map value type. Actually, since the label objects come from `mr.labels` which are already typed, no extra import is needed. Just use inline typing for the Map value.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit --pretty 2>&1 | head -30</automated>
  </verify>
  <done>Release detail page shows a "Labels" section with colored badges for each unique label across all milestone MRs, each showing label name and MR count. Section only appears when milestone MRs are available.</done>
</task>

</tasks>

<verification>
- TypeScript compiles without errors
- Labels section appears between Description and Issues sections
- Each label badge uses GitLab colors (backgroundColor, textColor, borderColor)
- Label count reflects number of MRs carrying that label
- Section hidden when no milestone is matched (gitlabMatch.type === 'none')
</verification>

<success_criteria>
- User sees unique labels from all milestone MRs as colored badges with counts
- Labels sorted by frequency (most common first)
- Visual style matches existing label rendering in MergeRequestDetailPage
- No TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/260323-hwn-on-the-release-detail-page-i-want-to-see/260323-hwn-SUMMARY.md`
</output>
