---
phase: quick-260531-owi
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/gitlab.ts
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
autonomous: true
requirements: [QUICK-OWI]

must_haves:
  truths:
    - "When a GitLab milestone matches the release and has a description, that description is rendered on the release detail page below the Jira description."
    - "When the matched milestone has no description (null/empty), a 'No description' italic empty-state is shown, matching the Jira description block."
    - "GitLab milestone description renders as GitHub-flavored markdown (not Jira wiki), consistent with the app's UpdatesSection markdown convention."
    - "The GitLab Description section is omitted entirely when no GitLab milestone is matched."
  artifacts:
    - path: "taskflow/src/services/gitlab.ts"
      provides: "GitLabMilestone.description field typed and parsed from API"
      contains: "description"
    - path: "taskflow/src/routes/dashboard/ReleaseDetailPage.tsx"
      provides: "GitLab Description section rendering matched milestone description as markdown"
      contains: "ReactMarkdown"
  key_links:
    - from: "taskflow/src/routes/dashboard/ReleaseDetailPage.tsx"
      to: "milestones (GitLabMilestone[])"
      via: "find matched milestone by gitlabMatch.candidateName === m.title"
      pattern: "candidateName"
    - from: "taskflow/src/routes/dashboard/ReleaseDetailPage.tsx"
      to: "react-markdown + remark-gfm"
      via: "ReactMarkdown remarkPlugins={[remarkGfm]}"
      pattern: "ReactMarkdown"
---

<objective>
Surface the GitLab milestone description on the release detail page, alongside the existing Jira description.

Today `ReleaseDetailPage.tsx` renders a single "Description" section sourced from `version.description` (the Jira fix-version description, lines 465-476). The page already fetches GitLab milestones into `milestones` and computes a `gitlabMatch` (a `ReleaseMatch` carrying only `candidateName`/`candidateUrl`). GitLab milestones have their OWN `description` field returned by the GitLab API, but it is currently neither typed on `GitLabMilestone` nor displayed.

Purpose: Give the user the GitLab milestone's release notes/description in the same place they already see the Jira description, without leaving the app.
Output: A typed `description` field on `GitLabMilestone`, and a read-only "GitLab Description" section on the release detail page rendered as markdown.

Scope guard: Display-only. Do NOT add editing for the GitLab description (the existing edit form mutates only the Jira fix-version via `updateFixVersion`; GitLab milestone editing is out of scope).
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

# The release detail page — already fetches `milestones` and computes `gitlabMatch`.
# Existing Jira "Description" section is at lines 465-476.
@taskflow/src/routes/dashboard/ReleaseDetailPage.tsx

# GitLabMilestone interface is at lines 172-180 — currently missing `description`.
# fetchProjectMilestonesInRange returns the raw API objects cast as GitLabMilestone[].
@taskflow/src/services/gitlab.ts

# Reference pattern for rendering plain GitHub-flavored markdown (NOT the Jira-specific
# WikiRenderer). Uses ReactMarkdown + remarkGfm with prose classes — mirror this (lines 15-16, 154-155).
@taskflow/src/routes/settings/UpdatesSection.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add description field to GitLabMilestone type</name>
  <files>taskflow/src/services/gitlab.ts</files>
  <action>
In the `GitLabMilestone` interface (lines 172-180), add a `description: string | null;` field. GitLab's milestone API returns `description` (may be null or empty string). Place it immediately after `title: string;` for readability. No fetch-function change is needed: `fetchProjectMilestonesInRange` already casts the raw JSON to `GitLabMilestone[]`, so the field flows through once typed. Do not touch any other interface or function.
  </action>
  <verify>
    <automated>cd taskflow && grep -A8 "export interface GitLabMilestone" src/services/gitlab.ts | grep -c "description:"</automated>
  </verify>
  <done>`GitLabMilestone` interface contains `description: string | null;` and the project typechecks.</done>
</task>

<task type="auto">
  <name>Task 2: Render matched GitLab milestone description on the release detail page</name>
  <files>taskflow/src/routes/dashboard/ReleaseDetailPage.tsx</files>
  <action>
Add a read-only "GitLab Description" section that displays the matched GitLab milestone's `description` as markdown, directly below the existing Jira "Description" section (lines 465-476).

Step 1 - Imports. Add at the top of the file: an import for the default export `ReactMarkdown` from `react-markdown`, and `remarkGfm` from `remark-gfm`. Both are existing project dependencies — copy the exact import lines from UpdatesSection.tsx (lines 15-16).

Step 2 - Derive the matched milestone object. The existing `gitlabMatch` (`ReleaseMatch`) only carries `candidateName`/`candidateUrl`, not the full milestone object, so compute a `matchedMilestone` near where `gitlabMatch` is built (after line 252). Find it in the already-fetched `milestones` array by matching title to candidateName. When `gitlabMatch.type` is `none` or `milestones` is undefined, resolve to `null`. Match against `m.title === gitlabMatch.candidateName` over `(milestones as GitLabMilestone[])`. `GitLabMilestone` is already imported in this file.

Step 3 - Render the new section immediately after the closing tag of the Jira Description section (after line 476). Only render the section when there IS a matched GitLab milestone (`gitlabMatch.type !== 'none'` AND `matchedMilestone` is truthy) — when no milestone matched, omit the section entirely; the existing "No GitLab milestone matched" warning in the Issues section already covers that state. Match the existing section header treatment exactly: an h3 with classes `text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5`, a `FileText` icon with `className="size-3.5"` (already imported), and label text "GitLab Description".

Step 4 - Body rendering. If `matchedMilestone.description` is a non-empty string, render it via the markdown component with the `remarkGfm` plugin, wrapped in a prose container mirroring UpdatesSection.tsx — a div with classes `text-sm prose prose-sm dark:prose-invert max-w-none` plus the same child-spacing overrides used in UpdatesSection (`[&_p]:my-1`, `[&_ul]:my-1`, `[&_ul]:pl-4`, `[&_li]:my-0`). If the description is null or empty, render the same empty-state as the Jira block: a paragraph with classes `text-sm text-muted-foreground italic` reading "No description".

Use the app's plain-markdown convention (the react-markdown component + remarkGfm), NOT the Jira-specific `WikiRenderer` — GitLab descriptions are GitHub-flavored markdown and must not be run through Jira-wiki preprocessing.
  </action>
  <verify>
    <automated>cd taskflow && grep -c "GitLab Description" src/routes/dashboard/ReleaseDetailPage.tsx && grep -c "matchedMilestone" src/routes/dashboard/ReleaseDetailPage.tsx && grep -c "ReactMarkdown" src/routes/dashboard/ReleaseDetailPage.tsx && npm run check</automated>
  </verify>
  <done>The release detail page shows a "GitLab Description" section (markdown-rendered) below the Jira Description when a milestone is matched; the section is absent when no milestone matches; `npm run check` (biome + tsc) passes.</done>
</task>

</tasks>

<verification>
- `cd taskflow && npm run check` passes (biome lint + `tsc --noEmit`) — confirms types and lint are clean.
- Manual smoke (executor self-check, not a gate): open a release whose date matches a GitLab milestone that has a description; confirm the "GitLab Description" section renders the markdown below the Jira Description. Open a release with no matched milestone; confirm the section is absent. Open a matched milestone with an empty description; confirm the "No description" italic state.
</verification>

<success_criteria>
- `GitLabMilestone` type carries `description: string | null;`.
- Release detail page renders the matched milestone's description as GitHub-flavored markdown below the Jira Description section, using ReactMarkdown + remarkGfm (not WikiRenderer).
- Empty/null description shows the "No description" italic empty-state.
- No GitLab editing added; Jira edit form untouched.
- `npm run check` passes.
</success_criteria>

<output>
Create `.planning/quick/260531-owi-add-gitlab-milestone-description-to-rele/260531-owi-SUMMARY.md` when done.
</output>
