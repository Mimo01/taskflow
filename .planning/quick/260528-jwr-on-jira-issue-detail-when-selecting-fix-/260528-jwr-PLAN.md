---
phase: quick-260528-jwr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
autonomous: true
requirements:
  - QUICK-260528-jwr
must_haves:
  truths:
    - "Fix Version popover on Jira issue detail lists versions sorted by release date (newest first), not alphabetically"
    - "Unreleased versions are ordered by release date (those with the soonest upcoming date first; those without a date fall to the end), then released versions (most recent release first)"
    - "Currently-selected released versions remain visible even if outside the recent window"
  artifacts:
    - path: "taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx"
      provides: "filteredVersions sorter that orders unreleased by releaseDate (ascending), released by releaseDate (descending), with name as tiebreaker"
  key_links:
    - from: "FieldsSection.tsx filteredVersions IIFE"
      to: "Popover list render at line ~776"
      via: "filteredVersions array"
      pattern: "filteredVersions\\.map"
---

<objective>
On the Jira issue detail page, the Fix Version popover currently sorts unreleased versions alphabetically by `name` (FieldsSection.tsx line 211). Users expect chronological order by `releaseDate` so the next-upcoming release is at the top.

Purpose: Match the user's mental model — fix versions = releases on a timeline, not a glossary.
Output: Updated `filteredVersions` sorter in `FieldsSection.tsx`.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
@taskflow/src/services/jira/types.ts
@taskflow/src/services/jira/versions.ts

<interfaces>
From taskflow/src/services/jira/types.ts:
```typescript
export interface JiraFixVersion {
  id: string;
  name: string;
  releaseDate?: string; // "YYYY-MM-DD" — absent when not set, never null
  released: boolean;
  description?: string;
}
```

Current sorter (FieldsSection.tsx lines 188–220), to be replaced:
- Unreleased branch uses `a.name.localeCompare(b.name)` — this is the bug.
- Released branch already sorts by `releaseDate` descending (keep that behavior).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Sort unreleased fix versions by releaseDate ascending</name>
  <files>taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx</files>
  <action>
    In the `filteredVersions` IIFE (lines ~188–220), replace the unreleased sort.
    - Replace `const sortedUnreleased = [...unreleased].sort((a, b) => a.name.localeCompare(b.name));` with a sort by `releaseDate` ascending (soonest upcoming first), with these tie-break rules:
      1. Both have `releaseDate`: ascending string compare (`a.releaseDate.localeCompare(b.releaseDate)`) — YYYY-MM-DD format makes lexical = chronological.
      2. Only one has `releaseDate`: the one WITH a date comes first (undefined sinks to the bottom of the unreleased group).
      3. Neither has `releaseDate`: fall back to `a.name.localeCompare(b.name)` so the order is still deterministic.
    - Leave the released-branch sort unchanged (it already sorts by `releaseDate` descending — most recent release first — which is correct).
    - Do not change the unreleased/released grouping, the recent-10 cap, or the `selectedOlder` carve-out — only the unreleased ordering.
    - No other files need to change; the popover render at line ~776 consumes `filteredVersions` directly.
  </action>
  <verify>
    <automated>cd taskflow && npx tsc --noEmit && npx biome check src/routes/dashboard/issue-detail/FieldsSection.tsx</automated>
  </verify>
  <done>
    Unreleased fix versions in the popover render in ascending `releaseDate` order (soonest first); versions without a `releaseDate` appear at the end of the unreleased group; released versions still appear after unreleased, sorted by `releaseDate` descending; TypeScript and Biome pass.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Fix Version popover on Jira issue detail now orders unreleased versions by upcoming release date instead of alphabetically.</what-built>
  <how-to-verify>
    1. `cd taskflow && npm run dev`
    2. Open a Jira issue detail sheet for an issue in a project that has multiple unreleased fix versions with different `releaseDate` values (e.g. one ending in `-06-15`, one in `-09-01`, one with no date).
    3. Click the Fix Versions row to open the popover.
    4. Confirm unreleased versions are listed in ascending release-date order (soonest upcoming at the top); versions with no `releaseDate` appear at the bottom of the unreleased group.
    5. Confirm released versions still appear below the unreleased group, most recent release first.
    6. Confirm a currently-selected older released version (if any) is still shown.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues.</resume-signal>
</task>

</tasks>

<verification>
- TypeScript clean: `cd taskflow && npx tsc --noEmit`
- Biome clean on changed file
- Manual check via the human-verify checkpoint above
</verification>

<success_criteria>
- Fix Versions popover lists unreleased versions in chronological (release-date ascending) order
- Released versions order unchanged (release-date descending)
- No regressions in selected-version visibility or recent-10 carve-out
- TypeScript + Biome pass
</success_criteria>

<output>
Create `.planning/quick/260528-jwr-on-jira-issue-detail-when-selecting-fix-/260528-jwr-SUMMARY.md` when done.
</output>
