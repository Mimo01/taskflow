---
phase: quick-260606-spj
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/components/app/PeekPanel.tsx
  - taskflow/src/components/app/PeekPanel.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/useLinkedMRs.ts
  - taskflow/src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx
  - taskflow/src/routes/dashboard/IssueDetailView.tsx
autonomous: true
requirements: [SPJ-PEEK-HEADER, SPJ-PEEK-MR-MOVE]

must_haves:
  truths:
    - "Peek header shows issue-type icon + key + truncated title once the issue loads"
    - "Peek header Close (X) and Open full page controls stay visible and functional WHILE the issue is loading"
    - "Long titles truncate with ellipsis and never push the header controls off-screen"
    - "In the peek (single-column) layout, Merge Requests render at the bottom below the description/activity, not in the top fields block"
    - "The full two-column issue page header and sidebar are byte-identical to before (MR still in sidebar)"
    - "npm run check and npm test stay green"
  artifacts:
    - path: "taskflow/src/routes/dashboard/issue-detail/useLinkedMRs.ts"
      provides: "Reusable hook returning { linkedMRs, mrsLoading, gitlabConnected, gitlabBaseUrl } for an issueKey"
      exports: ["useLinkedMRs"]
    - path: "taskflow/src/components/app/PeekPanel.tsx"
      provides: "Redesigned peek header (icon+key+title) with controls owned by PeekPanel; deduped issue-detail read"
      contains: "IssueTypeIcon"
    - path: "taskflow/src/routes/dashboard/IssueDetailView.tsx"
      provides: "Single-column branch renders MergeRequestsSection at the bottom; sidebar omits MR in single-column"
      contains: "omitMergeRequests"
  key_links:
    - from: "taskflow/src/components/app/PeekPanel.tsx"
      to: "['jira-issue-detail', issueKey, jiraBaseUrl]"
      via: "useQuery same key as IssueDetailView (TanStack dedupe, no duplicate fetch)"
      pattern: "jira-issue-detail"
    - from: "taskflow/src/routes/dashboard/IssueDetailView.tsx"
      to: "MergeRequestsSection"
      via: "useLinkedMRs(issueKey) rendered in single-column bottom block"
      pattern: "useLinkedMRs"
    - from: "taskflow/src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx"
      to: "useLinkedMRs"
      via: "hook call replacing inlined gitlab-project-mrs query"
      pattern: "useLinkedMRs"
---

<objective>
Two scoped changes to the issue PEEK panel only:
1. Redesign the peek header to show issue-type icon + key + truncated title, keeping the Close (X) and Open full page controls visible and working even while the issue is loading.
2. Move the Merge Requests section out of the top fields block down to the bottom of the single-column peek content (below description/activity).

The full two-column issue page header and sidebar must remain unchanged.

Purpose: Cleaner, more informative peek header and a more sensible MR placement, without regressing the full-page layout or the always-available peek controls.
Output: Updated PeekPanel header, an extracted useLinkedMRs hook, an omitMergeRequests gate on the sidebar, MR rendered at the bottom of the single-column layout, and green tests.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260606-spj-on-issue-peek-component-show-both-key-an/260606-spj-CONTEXT.md
@.planning/quick/260606-spj-on-issue-peek-component-show-both-key-an/260606-spj-RESEARCH.md
@taskflow/src/components/app/PeekPanel.tsx
@taskflow/src/components/app/PeekPanel.test.tsx
@taskflow/src/routes/dashboard/IssueDetailView.tsx
@taskflow/src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx
@taskflow/src/routes/dashboard/issue-detail/MergeRequestsSection.tsx
@taskflow/src/components/ui/issue-type-icon.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Redesign peek header in PeekPanel with deduped issue read</name>
  <files>taskflow/src/components/app/PeekPanel.tsx</files>
  <action>
Redesign the header bar in PeekPanel (currently lines 73-93) to show issue-type icon + key + truncated title while keeping the Close (X) and Open full page controls OWNED BY PeekPanel so they remain visible/functional during load (do NOT relocate the header into IssueDetailView's single-column branch — IssueDetailView early-returns a skeleton before the single-column branch, which would make the controls disappear during load; this is the explicit design guidance overriding RESEARCH Option A).

Source the title + issue type via a deduped read of the SAME react-query key IssueDetailView uses: add a useQuery with queryKey ['jira-issue-detail', issueKey, jiraBaseUrl]. Read jiraBaseUrl and jiraConnected from useAuthStore, and the five field keys (epicLinkFieldKey, epicNameFieldKey, sprintFieldKey, storyPointsFieldKey, epicColorFieldKey) from useSettingsStore so the queryFn body matches IssueDetailView.tsx:103-118 exactly (queryFn reads 'jira-pat' via readSecret, calls fetchIssueDetail with the field-key options object; staleTime 30_000; enabled !!issueKey && !!jiraBaseUrl && !!jiraConnected). TanStack Query dedupes by key (field keys are NOT part of the key), so this is the same request IssueDetailView already issues — no duplicate fetch, no flicker.

Layout the header left side as a flex container with `min-w-0 flex-1` so the title can shrink: render IssueTypeIcon (import from '@/components/ui/issue-type-icon') with typeName={issue.fields.issuetype.name}, then the key as a mono badge with `shrink-0` (keep `text-xs font-mono text-muted-foreground shrink-0` — key must NOT shrink), then the title `<span>` with `text-sm font-medium truncate pr-0.5` (the `pr-0.5` guards the italic/overhang truncate-clip pitfall; min-w-0 on the parent guards the 0-width-flex pitfall). While `issue` is undefined (loading), render ONLY the key (and the controls) — omit the icon and title until the issue resolves. The right-side controls block keeps `shrink-0` and its existing Open full page (ExternalLink) + Close (X, aria-label "Close preview") buttons wired to onNavigateFull(issueKey) and onClose exactly as today.

Keep the resize handle, width logic, Escape hotkey, and the body `<IssueDetailView issueKey={issueKey} layout="single-column" onOpenIssue={onOpenIssue} />` unchanged. Add imports for useQuery, useAuthStore, useSettingsStore, IssueTypeIcon, readSecret, and fetchIssueDetail.
  </action>
  <verify>
    <automated>cd taskflow && npx tsc --noEmit 2>&1 | grep -i "PeekPanel" || echo "PeekPanel typechecks clean"</automated>
  </verify>
  <done>PeekPanel header renders icon+key+title after load and key+controls during load; controls remain owned by PeekPanel; no duplicate network fetch (same query key); tsc clean for PeekPanel.</done>
</task>

<task type="auto">
  <name>Task 2: Extract useLinkedMRs hook and move MR to bottom of single-column peek</name>
  <files>taskflow/src/routes/dashboard/issue-detail/useLinkedMRs.ts, taskflow/src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx, taskflow/src/routes/dashboard/IssueDetailView.tsx</files>
  <action>
Create the hook file taskflow/src/routes/dashboard/issue-detail/useLinkedMRs.ts exporting `useLinkedMRs(issueKey: string)`. Move the gitlab-project-mrs useQuery (IssueDetailSidebar.tsx:75-99) and the linkedMRs filter (lines 102-108) verbatim into the hook. Read gitlabBaseUrl, gitlabConnected, activeGitlabProject from useAuthStore inside the hook. Imports the hook needs: useQuery (@tanstack/react-query), apiFetch (@/lib/apiFetch), GitLabMR type (@/services/gitlab), extractTicketKeys (@/services/linkEngine), readSecret (@/services/stronghold), useAuthStore (@/stores/auth.store). Return { linkedMRs, mrsLoading, gitlabConnected: !!gitlabConnected, gitlabBaseUrl: gitlabBaseUrl || '' }. The query key ['gitlab-project-mrs', gitlabBaseUrl, activeGitlabProject] contains NO issueKey, so calling the hook in two places is fully deduped by TanStack Query.

In IssueDetailSidebar.tsx (edit the REAL component at routes/dashboard/issue-detail/IssueDetailSidebar.tsx, NOT the re-export barrel at routes/dashboard/IssueDetailSidebar.tsx): replace the inlined MR query+filter with `const mr = useLinkedMRs(issueKey);`. Add `omitMergeRequests?: boolean` to IssueDetailSidebarProps (default undefined/false). Gate the MR render: `{!omitMergeRequests && <MergeRequestsSection linkedMRs={mr.linkedMRs} mrsLoading={mr.mrsLoading} gitlabConnected={mr.gitlabConnected} gitlabBaseUrl={mr.gitlabBaseUrl} />}`. Remove the now-unused gitlabBaseUrl/gitlabConnected/activeGitlabProject destructures from useAuthStore in this file and any now-unused imports (apiFetch, GitLabMR, extractTicketKeys) to keep biome clean.

In IssueDetailView.tsx: pass `omitMergeRequests={layout === 'single-column'}` to the IssueDetailSidebar inside sidebarNode (line 585-596) — two-column passes false so the full page is unaffected. Call `const mr = useLinkedMRs(issueKey);` at the top level of IssueDetailView (alongside the other queries, import from './issue-detail/useLinkedMRs') so the single-column bottom slot has the data (deduped with the sidebar's call). In the single-column branch (lines 652-663), render the MR section at the bottom of the content block, after activitySectionNode: wrap `<MergeRequestsSection linkedMRs={mr.linkedMRs} mrsLoading={mr.mrsLoading} gitlabConnected={mr.gitlabConnected} gitlabBaseUrl={mr.gitlabBaseUrl} />` in its own block (e.g. `<div className="px-2 pt-2">`). Import MergeRequestsSection from './issue-detail/MergeRequestsSection'. Do NOT touch the two-column branch render.
  </action>
  <verify>
    <automated>cd taskflow && npm run check 2>&1 | tail -5</automated>
  </verify>
  <done>useLinkedMRs hook exists and is used by both IssueDetailSidebar and IssueDetailView; MR renders at the bottom of single-column and stays in the sidebar for two-column; two-column branch unchanged; `npm run check` (biome + tsc) passes.</done>
</task>

<task type="auto">
  <name>Task 3: Update PeekPanel tests for header ownership and run suite</name>
  <files>taskflow/src/components/app/PeekPanel.test.tsx</files>
  <action>
PeekPanel still owns the header, so PEEK-04 (key text) and PEEK-06 (Open full page) assertions remain valid in principle, but PeekPanel now issues a useQuery for the issue detail. The existing IssueDetailView mock (lines 12-18) stays, but PeekPanel will call useQuery/useAuthStore/useSettingsStore/readSecret/fetchIssueDetail at render — mock these so the component renders without a live QueryClient: add vi.mock for '@tanstack/react-query' returning useQuery as a vi.fn that yields `{ data: undefined, isLoading: false }` (so the loading branch renders key + controls only — matching what the existing PEEK-04/PEEK-06 assertions expect: key text and the Open full page / Close buttons). Also mock '@/stores/auth.store' (useAuthStore returning { jiraBaseUrl: 'https://jira.example', jiraConnected: true }), '@/stores/settings.store' (useSettingsStore returning the five field keys as empty strings), '@/services/stronghold', and '@/services/jira' (fetchIssueDetail) so imports resolve. Keep PEEK-02/03/07 and the palette test unchanged. PEEK-04 should still assert getByText('PROJ-1')/('PROJ-2') (key shows during the undefined-issue branch); PEEK-06 still asserts onNavigateFull called with the key. Add a brief comment noting the header is owned by PeekPanel and the issue query is mocked to the loading state.

Run the full suite to confirm green.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/components/app/PeekPanel.test.tsx 2>&1 | tail -15</automated>
  </verify>
  <done>PeekPanel.test.tsx passes all cases (PEEK-02/03/04/06/07 + palette); full `npm test` green.</done>
</task>

</tasks>

<verification>
- `cd taskflow && npm run check` passes (biome + tsc, baseline GREEN).
- `cd taskflow && npm test` passes.
- Manual sanity (optional): open a peek panel — header shows icon+key+title, controls visible during load; MR section appears at the bottom below the description; full two-column page unchanged with MR still in the sidebar.
</verification>

<success_criteria>
- Peek header shows issue-type icon + key + truncated title; Close and Open full page remain visible/functional during load.
- Long titles truncate with ellipsis without displacing controls.
- Merge Requests render at the bottom of the single-column peek (below content/activity), not in the top fields block.
- Two-column issue page header and sidebar (with MR in the sidebar) are unchanged.
- No duplicate issue-detail fetch (deduped query key); no new GitLab fetch (deduped MR query key).
- `npm run check` and `npm test` are green.
</success_criteria>

<output>
Create `.planning/quick/260606-spj-on-issue-peek-component-show-both-key-an/260606-spj-SUMMARY.md` when done
</output>
