---
phase: quick-261103-cln
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/gitlab.ts
  - taskflow/src/services/gitlab.test.ts
  - taskflow/src/services/jira.ts
  - taskflow/src/services/jira.test.ts
  - taskflow/src/routes/dashboard/release-detail/useMrFixMutation.ts
  - taskflow/src/routes/dashboard/release-detail/useMrFixMutation.test.tsx
  - taskflow/src/routes/dashboard/release-detail/notCoveredFixes.ts
  - taskflow/src/routes/dashboard/release-detail/notCoveredFixes.test.tsx
  - taskflow/src/routes/dashboard/release-detail/calloutSection.ts
  - taskflow/src/routes/dashboard/release-detail/DeploymentPackageSection.tsx
  - taskflow/src/routes/dashboard/release-detail/NotCoveredFixActions.tsx
  - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
  - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
autonomous: true
requirements: [QUICK-261103-cln]

must_haves:
  truths:
    - "The 'Not covered by tasks above' section sits in the same place (inside UnifiedTaskTable, right under the task list) and looks like 'Deployment package mismatches': an orange accent-bar callout, an h3 with AlertTriangle, the title, one orange count pill and a muted hint, an orange header strip, orange-hover min-h-8 rows with orange dividers, and amber state pills that collapse to an icon at narrow widths"
    - "The section shows the first 5 rows plus a 'Show all N' expander when there are more, and the count pill and slicing use the filtered secondary rows"
    - "A 'Not in version' row has an Apply button. It ADDS this release's fix version to the linked task and keeps the task's other fixVersions. With several keys, a dropdown offers one entry per key. On success the MR moves into the primary table."
    - "A 'No task' row has a Link task button. It opens a searchable picker of THIS release's issues. Picking one prepends the key to the GitLab MR title (draft prefix preserved), and the MR moves into the primary table."
    - "'Not evaluated' (merged/closed) rows stay, with a muted state pill and an empty action cell"
    - "Each row shows its own pending state and an inline role=alert error. The error survives the row re-rendering."
    - "Every row stays on one line at every container width. Columns are hidden or sr-only, never wrapped."
    - "BR/MS Retarget / Assign-milestone affordances still work on secondary rows"
  artifacts:
    - path: "taskflow/src/routes/dashboard/release-detail/calloutSection.ts"
      provides: "Shared orange-callout class constants + CALLOUT_VISIBLE_ROWS"
      contains: "CALLOUT_SECTION_CLASS"
    - path: "taskflow/src/routes/dashboard/release-detail/notCoveredFixes.ts"
      provides: "prependTaskKeyToTitle pure helper + useNotCoveredFixes section-level hook (pending/errors keyed by mr.id)"
      exports: ["prependTaskKeyToTitle", "useNotCoveredFixes"]
    - path: "taskflow/src/routes/dashboard/release-detail/NotCoveredFixActions.tsx"
      provides: "ApplyFixVersionAction (button / per-key dropdown) and LinkTaskAction (Popover + cmdk picker)"
    - path: "taskflow/src/services/jira.ts"
      provides: "addIssueFixVersion using update.fixVersions add verb"
      contains: "export async function addIssueFixVersion"
    - path: "taskflow/src/services/gitlab.ts"
      provides: "updateMergeRequest accepts title"
      contains: "body.title"
  key_links:
    - from: "notCoveredFixes.ts useNotCoveredFixes.applyFixVersion"
      to: "services/jira.ts addIssueFixVersion"
      via: "readSecret('jira-pat') + jiraFix.baseUrl, then await invalidateQueries(['jira-fixversion-issues', versionId])"
      pattern: "addIssueFixVersion\\("
    - from: "notCoveredFixes.ts useNotCoveredFixes.linkTask"
      to: "services/gitlab.ts updateMergeRequest"
      via: "{ title: prependTaskKeyToTitle(mr.title, key) } then patchMrInChannelCaches + invalidateMrChannelCaches"
      pattern: "updateMergeRequest\\("
    - from: "ReleaseDetailPage.tsx"
      to: "UnifiedTaskTable jiraFix prop"
      via: "jiraFix={{ baseUrl: jiraBaseUrl, versionId }}"
      pattern: "jiraFix="
    - from: "DeploymentPackageSection.tsx"
      to: "calloutSection.ts"
      via: "import of shared constants (values unchanged)"
      pattern: "from './calloutSection'"
---

<objective>
Restyle the release-detail "Not covered by tasks above" section (UnifiedTaskTable `secondary-section`, ~L1556) so it matches the "Deployment package mismatches" orange callout (DeploymentPackageSection.tsx ~L330-489). Keep the section where it is. Add per-row fix actions: **Apply** adds the release fix version to the linked task, and **Link task** prepends a picked release-issue key to the MR title. Merged and closed rows stay, with no action.

Purpose: both callouts on the page get the same visual language, and the user can fix coverage drift in place instead of jumping to Jira or GitLab.
Output: shared callout constants, two service writes, a section-level fix hook, the picker/apply action components, a restyled section, and updated tests.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261103-cln-redesign-not-covered-by-tasks-section-to/261103-cln-CONTEXT.md
@.planning/quick/261103-cln-redesign-not-covered-by-tasks-section-to/261103-cln-RESEARCH.md

Repo layout: `.planning/` and git live at /Users/mimo/Documents/Projects/taskflow. npm, vitest, biome and tsc run from /Users/mimo/Documents/Projects/taskflow/taskflow.

Key source anchors (from RESEARCH.md; read each only once, use grep for specifics):
- taskflow/src/routes/dashboard/release-detail/DeploymentPackageSection.tsx: constants at :100-129, section render at :330-489, Apply / multi-fix DropdownMenu at :437-466, errors map at :296-325
- taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx: MrFixContext :46, props :55-84, REASON_CHIP_LABEL :148, SecondaryReasonPill :155, SecondaryHeaderStrip :613, MrSubLine :640, filteredSecondaryRows :1272, secondary section :1556-1645
- taskflow/src/routes/dashboard/release-detail/useMrFixMutation.ts: MrFixPatch :66, patchMrInChannelCaches :88, invalidateMrChannelCaches :114
- taskflow/src/services/gitlab.ts updateMergeRequest :1224-1265; taskflow/src/services/jira.ts bulkUpdateIssue :2957, ISSUE_KEY_RE import :25
- taskflow/src/routes/dashboard/release-detail/useDeploymentPackageSync.ts: readSecret + invalidation pattern :36-39, :68-97
- taskflow/src/routes/dashboard/ReleaseDetailPage.tsx: versionId :50, jiraBaseUrl ~:110, UnifiedTaskTable render ~:567-600
- taskflow/src/components/ui/popover.tsx, taskflow/src/components/ui/command.tsx (cmdk), taskflow/src/components/ui/dropdown-menu.tsx
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Service writes + title helper + section-level fix hook</name>
  <files>taskflow/src/services/gitlab.ts, taskflow/src/services/gitlab.test.ts, taskflow/src/services/jira.ts, taskflow/src/services/jira.test.ts, taskflow/src/routes/dashboard/release-detail/useMrFixMutation.ts, taskflow/src/routes/dashboard/release-detail/useMrFixMutation.test.tsx, taskflow/src/routes/dashboard/release-detail/notCoveredFixes.ts, taskflow/src/routes/dashboard/release-detail/notCoveredFixes.test.tsx</files>
  <behavior>
    - updateMergeRequest(..., { title: 'PROJ-1 Fix' }) sends a PUT body that is exactly { title: 'PROJ-1 Fix' }. The explicit-pick rule is kept, so unknown keys never leak into the body. Calling it with no target_branch/milestone_id/title throws 'updateMergeRequest requires target_branch, milestone_id or title'. Update the existing guard test at gitlab.test.ts ~:2854.
    - addIssueFixVersion(baseUrl, token, 'PROJ-1', '10100') sends PUT /rest/api/2/issue/PROJ-1 with body { update: { fixVersions: [{ add: { id: '10100' } }] } } and resolves on 204. A key that fails ISSUE_KEY_RE throws 'Invalid issue key: …' before any fetch. 401/403/4xx errors are surfaced in the same way bulkUpdateIssue does it (flattened Jira message, no token in the text).
    - patchMrInChannelCaches with { title } patches the title in every channel prefix cache.
    - prependTaskKeyToTitle('Fix thing','PROJ-1') returns 'PROJ-1 Fix thing'. 'Draft: Fix' returns 'Draft: PROJ-1 Fix'. '[Draft] Fix' returns '[Draft] PROJ-1 Fix'. '(Draft) Fix' returns '(Draft) PROJ-1 Fix'. 'WIP: Fix' returns 'WIP: PROJ-1 Fix'. Matching is case-insensitive.
    - useNotCoveredFixes: applyFixVersion(mrId, key) calls addIssueFixVersion with (baseUrl, token, key, versionId). pending[mrId] is set to the key and stays set until `await invalidateQueries({queryKey:['jira-fixversion-issues', versionId]})` resolves, then clears. ['jira-issue-detail'] is also invalidated. A rejection sets errors[mrId] to the message and clears pending. A new attempt clears the old error. A missing baseUrl, token or versionId gives an error without any call.
    - useNotCoveredFixes: linkTask(row, key) calls updateMergeRequest(fix.baseUrl, fix.token, fix.projectId, mr.iid, { title: prependTaskKeyToTitle(mr.title, key) }). The update is pessimistic: only after success does it call patchMrInChannelCaches(qc, projectId, mr.id, { title: returned.title }) and then invalidateMrChannelCaches. A rejection sets errors[mr.id] and leaves the caches untouched. A falsy projectId/baseUrl/token/iid gives an error before the service is called (WR-10 guard style).
  </behavior>
  <action>
    gitlab.ts: extend updateMergeRequest `fields` with `title?: string`. Add the pick line `if (fields.title !== undefined) body.title = fields.title`. Extend the guard and its message to the text above, and keep the T-90-01 explicit pick and the T-90-02 token-free errors. Add `title?: string` to MrFixPatch in useMrFixMutation.ts. Nothing else there changes.

    jira.ts (legacy file, NOT services/jira/ modules): add `export async function addIssueFixVersion(baseUrl: string, token: string, issueKey: string, versionId: string): Promise<void>` next to bulkUpdateIssue. Validate with ISSUE_KEY_RE first. Copy bulkUpdateIssue's fetch/headers/status/flattenJiraError handling, but the body uses the `update.fixVersions[{add:{id}}]` verb. Do NOT write `fields.fixVersions`, because that replaces the whole set, and do NOT use computeFixVersionsForFix, because it drops versions outside the RM week. This implements the CONTEXT 'Not in version' decision of keeping existing fixVersions. Add a doc comment noting the fallback if Jira DC rejects add-by-id: `{add:{name}}` (RESEARCH A1).

    New notCoveredFixes.ts: export `prependTaskKeyToTitle` (draft-prefix regex per RESEARCH Code Examples). Export the hook `useNotCoveredFixes({ fix: MrFixContext, jiraFix?: { baseUrl: string | null; versionId: string } })`. It returns `{ pending: Record<number,string>, errors: Record<number,string>, applyFixVersion(mrId: number, key: string), linkTask(row: DriftRow, key: string) }`. State lives at section level, keyed by mr.id, so an error survives when a row unmounts or remounts (RESEARCH pitfall 3). Get the token with `readSecret('jira-pat')` exactly as useDeploymentPackageSync.applyFix does. Invalidate by prefix only, and never rebuild windowed keys by hand (CR-02). Hooks are called unconditionally (React Compiler) and there are no module-level mutable reads. Import MrFixContext as a type from UnifiedTaskTable. If that creates a runtime import cycle, use a type-only import.

    Tests: add cases to gitlab.test.ts, jira.test.ts and useMrFixMutation.test.tsx (title patch). Create notCoveredFixes.test.tsx: pure-helper cases, plus renderHook with a seeded QueryClient, vi.mock('@/services/stronghold'), a partial vi.mock of '@/services/jira' (addIssueFixVersion) and of '@/services/gitlab' (updateMergeRequest), following the useDeploymentPackageSync.test.tsx :36-43 and useMrFixMutation.test.tsx :191-310 patterns. Use placeholder data only (PROJ-1, no customer data). RED and GREEN go in ONE commit, because the pre-commit hook runs the full suite.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/services/gitlab.test.ts src/services/jira.test.ts src/routes/dashboard/release-detail/useMrFixMutation.test.tsx src/routes/dashboard/release-detail/notCoveredFixes.test.tsx && npx tsc --noEmit && npx biome check src/services/gitlab.ts src/services/gitlab.test.ts src/services/jira.ts src/services/jira.test.ts src/routes/dashboard/release-detail/useMrFixMutation.ts src/routes/dashboard/release-detail/useMrFixMutation.test.tsx src/routes/dashboard/release-detail/notCoveredFixes.ts src/routes/dashboard/release-detail/notCoveredFixes.test.tsx</automated>
  </verify>
  <done>All behaviors above are covered by passing tests. tsc is clean. Biome is clean on the touched files. One commit `feat(261103-cln): fix-version add + MR title link writes for not-covered rows`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Shared callout constants + restyle the section with Apply / Link task actions</name>
  <files>taskflow/src/routes/dashboard/release-detail/calloutSection.ts, taskflow/src/routes/dashboard/release-detail/DeploymentPackageSection.tsx, taskflow/src/routes/dashboard/release-detail/NotCoveredFixActions.tsx, taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx, taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx, taskflow/src/routes/dashboard/ReleaseDetailPage.tsx</files>
  <behavior>
    - secondary-section is an orange callout div (not a section element), placed after the task list as before. Its h3 contains the 'Not covered by tasks above' text and one `secondary-count` pill showing filteredSecondaryRows.length. The secondary-reason-chip-* chips no longer exist (memory: no figure shown twice).
    - With 6 or more filtered rows, only 5 `drift-row` rows render, plus a 'Show all N' button. Clicking it renders all rows.
    - The header strip labels read State, Key, Merge request, Author, Reviewers, MR state, BR, MS, plus a sr-only/empty Fix column. It still has no Assignee/Status/MR/Summary labels (WR-06).
    - The state pill keeps testid `secondary-reason-pill` and `data-reason`. Not in version / No task use the amber pill. Not evaluated uses the muted pill.
    - A not-in-fix-version row with one key and jiraFix set shows an 'Apply' button. Clicking it calls addIssueFixVersion('PROJ-1', versionId). While the call is pending the button is disabled and shows a spinner. When it rejects, a role=alert error renders under the row.
    - A not-in-fix-version row with 2 keys shows a dropdown with one 'Add KEY to <versionName>' entry per key.
    - A no-linked-task row shows a 'Link task' trigger. Opening it lists primaryRows issues (key + summary). Typing filters them. Selecting PROJ-1 calls updateMergeRequest with { title: 'PROJ-1 <original title>' }.
    - An unevaluated row has no action button. No Apply button renders when jiraFix is absent.
    - drift-br / drift-ms cells and the group/row hover reveal (D-05), the no line-wide click target rule (D-04), the UAT-91.1-B filter and CR-01 tests all still pass. The secondary-key-flagged/none/unevaluated testids are kept.
    - DeploymentPackageSection.test.tsx stays green without edits.
  </behavior>
  <action>
    calloutSection.ts: export the constants listed in RESEARCH section 5. Copy them VERBATIM from DeploymentPackageSection.tsx. CALLOUT_SECTION_CLASS has no margin; each caller adds mt-6 or mt-4. Then replace DeploymentPackageSection's local strings with these imports, with every value unchanged. This follows the CONTEXT decision to extract shared constants instead of copy-pasting.

    NotCoveredFixActions.tsx: add `ApplyFixVersionAction({ keys, versionName, pendingKey, onApply })`. With 1 key it renders an outline xs Button using CALLOUT_APPLY_CLASS. With more than 1 key it renders a DropdownMenu, mirroring DeploymentPackageSection :437-466. Add `LinkTaskAction({ issues: JiraIssue[], pending, onPick })`, a Base UI Popover whose PopoverTrigger renders an outline xs Button labelled 'Link task'. PopoverContent is `w-80 p-0` with align="end". Inside it, a cmdk Command has a CommandInput, a CommandEmpty, and one CommandItem per issue. Each item has `value={`${key} ${summary}`}` and shows IssueTypeIcon, the mono key and the truncated summary. Selecting an item closes the popover and calls onPick(key). The picker always offers every release issue, unaffected by the table filters. Rows use plain sibling buttons, not an overlay (D-04).

    UnifiedTaskTable.tsx: add the optional prop `jiraFix?: { baseUrl: string | null; versionId: string }` (do NOT extend MrFixContext, because that would break the fixtures). Call useNotCoveredFixes({ fix, jiraFix }) unconditionally in the component. Rebuild the secondary block as `<div data-testid="secondary-section" className={`mt-4 ${CALLOUT_SECTION_CLASS}`}>`, which drops the old border-t. It contains:
    - an h3 with the AlertTriangle icon, the title, the count pill and a hint such as 'MRs in this release whose task isn't in the version' (the hint is hidden at @max-[760px]);
    - SecondaryHeaderStrip restyled to CALLOUT_HEADER_CLASS, with a 'State' label and a trailing CALLOUT_FIX_ACTION_COL;
    - a CALLOUT_LIST_CLASS list over the expanded/sliced rows, using CALLOUT_VISIBLE_ROWS and a local `expanded` useState;
    - the 'Show all N' button.

    Delete the per-reason chips and REASON_CHIP_LABEL/secondaryReasonCounts if they become unused. Restyle SecondaryReasonPill to the package-state geometry: the label is `@max-[520px]:sr-only` and the AlertTriangle shows at 520. Not in version and No task use the amber classes; Not evaluated uses bg-muted text-muted-foreground. This replaces the per-reason REASON_CLASS colours, because colour encodes status only.

    Extend MrSubLine with an optional `actionCell` prop rendered in a trailing CALLOUT_FIX_ACTION_COL, and an optional row-class override. When reasonCell is set, use the CALLOUT_ROW_CLASS orange hover with min-h-8. Keep `group/row` and `data-testid="drift-row"` on the row root, and render the inline error (CALLOUT_ERROR_CLASS, role="alert") under the row from fixes.errors[mr.id].

    actionCell is:
    - for not-in-fix-version with jiraFix set: ApplyFixVersionAction;
    - for no-linked-task: LinkTaskAction with issues=primaryRows.map(r=>r.issue);
    - for unevaluated: nothing.

    One row = one line at every width: the MR title is the flex-[2_1_0%] min-w-[6rem] expander and every other cell is flex-none. Author is sr-only at 860, Reviewers hidden at 640, Key hidden at 520, MR state hidden at 400. No wrapping. The `@container` on the callout div styles only its children.

    ReleaseDetailPage.tsx: pass `jiraFix={{ baseUrl: jiraBaseUrl, versionId }}`. Only do this when versionId is defined; otherwise omit the prop.

    Tests (UnifiedTaskTable.test.tsx): update WR-06, the 261102-fkr secondary header tests (flip them to assert secondary-count, chips absent) and the secondary row info tests. Add the new Apply, multi-key, Link task, unevaluated and Show all cases from the behavior list. Mock '@/services/stronghold' and partially mock '@/services/jira' (addIssueFixVersion). If cmdk selection needs it, add a local Element.prototype.scrollIntoView mock (RESEARCH A4). Use placeholders only. Run biome only on the touched files, never `biome --write` over src. Make ONE commit.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/release-detail src/routes/dashboard/ReleaseDetailPage && npx tsc --noEmit && npx biome check src/routes/dashboard/release-detail/calloutSection.ts src/routes/dashboard/release-detail/DeploymentPackageSection.tsx src/routes/dashboard/release-detail/NotCoveredFixActions.tsx src/routes/dashboard/release-detail/UnifiedTaskTable.tsx src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx src/routes/dashboard/ReleaseDetailPage.tsx && npm run test</automated>
  </verify>
  <done>The release-detail tests pass, including DeploymentPackageSection.test.tsx left unedited. The full vitest suite passes. tsc is clean. Biome is clean on the touched files. `grep -c "border-t border-border/50" UnifiedTaskTable.tsx` no longer matches the secondary block. One commit `feat(261103-cln): not-covered section as orange callout with Apply / Link task fixes`.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| app → Jira REST | Authenticated write of fixVersions using the stored PAT |
| app → GitLab REST | Authenticated MR title write using the stored token |
| GitLab/Jira data → UI | MR titles and issue summaries rendered in the picker and the rows |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-cln-01 | Tampering | addIssueFixVersion path | mitigate | ISSUE_KEY_RE check before the key is interpolated into the URL; throws before fetch |
| T-cln-02 | Tampering | updateMergeRequest body | mitigate | explicit-pick body (T-90-01). The title is built only from a release-issue key plus the existing title. |
| T-cln-03 | Tampering | fixVersions write | mitigate | the update.add verb, never a fields.fixVersions replace, so other versions can never be wiped |
| T-cln-04 | Info disclosure | error messages | mitigate | reuse the token-free error flattening (T-90-02, flattenJiraError). Inline errors show only the message. |
| T-cln-05 | Spoofing/XSS | picker/row text | accept | rendered as React text nodes; no dangerouslySetInnerHTML |
| T-cln-SC | Tampering | npm installs | accept | no new packages (cmdk and @base-ui already installed) |
</threat_model>

<verification>
- `cd taskflow && npm run test && npx tsc --noEmit` pass.
- Human check (post-execution UAT):
    1. Run `cd /Users/mimo/Documents/Projects/taskflow/taskflow && npm run tauri dev` and open a release detail page that has uncovered MRs.
    2. Compare the section with 'Deployment package mismatches': check the accent bar, the h3, the single count pill, the hint, the header strip, the row hover and dividers, and the amber pills. Confirm the section is still directly under the task table.
    3. Narrow the window step by step. Every row should stay on one line, columns should drop out, and the state pill should collapse to an icon.
    4. On a 'Not in version' row, click Apply. Check in Jira that the task gained this fix version and kept its other versions. Check that the MR moved into the task table.
    5. On a 'No task' row, click Link task, search, and pick an issue. Check on GitLab that the title became 'KEY Original title' (and that a Draft MR is still a draft). Check that the MR moved into the task table.
    6. Check that merged or closed rows show a muted pill and no action, and that BR/MS Retarget / Assign milestone still work.
- Biome is clean on every touched file, with no new files flagged. Never gate on an absolute count.
- The source audit is covered. CONTEXT visual style: Task 2. 'Not in version' Apply: Tasks 1 and 2. 'No task' Link task: Tasks 1 and 2. 'Not evaluated' muted, no action: Task 2. Columns and one-line rows: Task 2. Shared constants: Task 2. Position unchanged: Task 2. Pending/error per row: Tasks 1 and 2. Testids kept: Task 2.
</verification>

<success_criteria>
- The section visually matches the package callout and sits in the same place.
- Apply adds the fix version without removing others, and the row moves into the primary table.
- Link task prepends the key to the MR title (draft preserved), and the row moves into the primary table.
- Unevaluated rows have no action. Errors render inline and persist.
- The full suite, tsc and biome (touched files) are green, in 2 commits.
</success_criteria>

<output>
Create `.planning/quick/261103-cln-redesign-not-covered-by-tasks-section-to/261103-cln-SUMMARY.md` when done.
</output>
