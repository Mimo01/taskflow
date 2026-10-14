---
phase: quick-261014-eym
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/lib/deployment-package.ts
  - taskflow/src/lib/deployment-package.test.ts
  - taskflow/src/services/jira.ts
  - taskflow/src/hooks/useRmWeekIndex.ts
  - taskflow/src/stores/settings.store.ts
  - taskflow/src/stores/settings.store.test.ts
  - taskflow/src/components/integrations/ReleaseManagementBlock.tsx
  - taskflow/src/routes/settings/IntegrationsSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/DeploymentPackageWarning.tsx
  - taskflow/src/routes/dashboard/release-detail/DeploymentPackageSection.tsx
  - taskflow/src/routes/dashboard/release-detail/useDeploymentPackageSync.ts
  - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
  - taskflow/src/routes/dashboard/ReleasesTab.tsx
autonomous: true
requirements: [QUICK-261014-eym]

must_haves:
  truths:
    - "Settings > Integrations has a Release Management project picker; with no project selected, no deployment-package warnings, sections or columns appear anywhere (D-settings)"
    - "On a Story's detail sidebar, the Deployment package row shows the RM child key/summary, and a warning appears under Fix Versions / Deployment package when only one is set or the fix version date is outside the package's WEEK range"
    - "The warning offers one-click fixes: pkg-only gives 'Set fix version', fv-only gives 'Set deployment package', mismatch gives both buttons; clicking writes Jira and the warning clears after refetch"
    - "Epics and Subtasks never show the warning"
    - "Release detail page lists Stories whose fix version and deployment package disagree, each with fix actions, in a section separate from MR drift"
    - "Releases tab shows the derived deployment package (RM child) per fix-version row and has a per-row 'Sync deployment packages' action that confirms, writes Jira per story, and reports per-item successes and failures"
    - "If editmeta does not list customfield_15725, the fix buttons are replaced by read-only warnings plus an 'Open in Jira' link, and bulk sync is disabled with that reason"
  artifacts:
    - path: "taskflow/src/lib/deployment-package.ts"
      provides: "Pure week-range parsing, matching, state evaluation, bulk plan"
      exports: ["parseWeekRange", "isDateInWeek", "findWeekForDate", "findChildForProject", "extractDeploymentPackageKey", "evaluatePackageSync", "planBulkSync", "buildPackageFieldValue"]
    - path: "taskflow/src/lib/deployment-package.test.ts"
      provides: "Vitest coverage for the pure module"
    - path: "taskflow/src/services/jira.ts"
      provides: "fetchRmWeekIndex, fetchDeploymentPackageEditShape, fetchFixVersionIssues fields additions"
      contains: "fetchRmWeekIndex"
    - path: "taskflow/src/hooks/useRmWeekIndex.ts"
      provides: "Shared ['rm-week-index', rmProject, baseUrl] query hook"
    - path: "taskflow/src/stores/settings.store.ts"
      provides: "releaseManagementProjectKey + setter, version 30 migration"
      contains: "releaseManagementProjectKey"
    - path: "taskflow/src/routes/dashboard/issue-detail/DeploymentPackageWarning.tsx"
      provides: "Sidebar warning + one-click fix buttons"
    - path: "taskflow/src/routes/dashboard/release-detail/DeploymentPackageSection.tsx"
      provides: "Release detail package-drift list with fixes"
  key_links:
    - from: "taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx"
      to: "evaluatePackageSync"
      via: "DeploymentPackageWarning rendered under the Deployment package row"
      pattern: "DeploymentPackageWarning"
    - from: "taskflow/src/routes/dashboard/issue-detail/DeploymentPackageWarning.tsx"
      to: "useFieldMutation / bulkUpdateIssue"
      via: "mutation.mutate({fieldName:'customfield_15725'|'fixVersions'})"
      pattern: "customfield_15725"
    - from: "taskflow/src/routes/dashboard/ReleasesTab.tsx"
      to: "planBulkSync + bulkUpdateIssue"
      via: "useDeploymentPackageSync"
      pattern: "useDeploymentPackageSync"
    - from: "taskflow/src/hooks/useRmWeekIndex.ts"
      to: "fetchRmWeekIndex"
      via: "useQuery key ['rm-week-index', rmProject, baseUrl]"
      pattern: "rm-week-index"
---

<objective>
Link the Jira "Deployment package" field (customfield_15725, an issue picker pointing at a Release Management child issue) to a Story's fix version. A fix version matches the package when its releaseDate falls inside the inclusive dd.MM.yyyy - dd.MM.yyyy range in the WEEK parent's summary. Show warnings with one-click fixes in two directions in the issue sidebar and on release detail. Show the derived package on the Releases tab, with a bulk sync. Add a global RM project picker in settings.

Purpose: Fix versions and deployment packages drift apart silently today. This makes the drift visible and fixable in one click.
Output: A pure lib with tests, jira.ts fetchers, a settings field and picker, the sidebar warning, the release-detail section, and the Releases tab column and sync.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261014-eym-enhance-deployment-package-for-jira-stor/261014-eym-CONTEXT.md
@.planning/quick/261014-eym-enhance-deployment-package-for-jira-stor/261014-eym-RESEARCH.md

Key anchors (verified):
- taskflow/src/services/jira.ts: `customfield_15725?: unknown` on JiraIssueDetail fields (~1791). `fetchFixVersionIssues` (~1335). `updateIssueField` (~2047). `bulkUpdateIssue` (~2475, uses flattenJiraError). Private `fetchAllSearchPages` (~316). `fetchIssuePriorityOptions` (~2369) is the editmeta GET pattern to copy. `listJiraProjects` (~112). Per the dual-file memory, edit jira.ts, NOT the jira/ modules.
- taskflow/src/services/jira/versions.ts: `fetchFixVersions(baseUrl, token, projectKey)`, used with the key `['jira-fix-versions', projectKey]`.
- taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx: `extractDeploymentPackage` (:75). Read-only Deployment package row (~1097). Fix versions mutation `mutation.mutate({fieldName:'fixVersions', value:[{id}]})` (:563). Fix-versions list query (:207).
- taskflow/src/stores/settings.store.ts: `version: 29` (:371). `selectedAioProjectKey` is the precedent (:60, :170, :274, migrate :444).
- taskflow/src/components/integrations/AioBlock.tsx: the project picker pattern (Select with explicit name in trigger, stale-key warning, retry).
- taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts (~462): stories query `['jira-fixversion-issues', versionId, storyPointsFieldKey]`.
- taskflow/src/routes/dashboard/ReleaseDetailPage.tsx renders sections such as LabelSummarySection.
- taskflow/src/routes/dashboard/ReleasesTab.tsx: versions query (:105), per-row useQueries counts (:176).

Memory constraints to honor:
- Edit jira.ts, not the jira/ modules.
- Drift lives on release detail only. The Releases list shows the package but NO drift counts.
- Detail pages have no card panels (use h3 + rows).
- Base UI Select needs the selected label rendered in the trigger.
- Pre-commit runs the full vitest suite, so RED and GREEN go in ONE commit per tdd task.
- Biome gate: no NEW files flagged. Don't use a fixed count, and never run biome --write on all of src.
- Shared fetcher key: add fields to fetchFixVersionIssues but do NOT change its JQL or order.
- No bulk find-replace of identifiers.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pure deployment-package lib, jira.ts fetchers, RM project setting + picker</name>
  <files>taskflow/src/lib/deployment-package.ts, taskflow/src/lib/deployment-package.test.ts, taskflow/src/services/jira.ts, taskflow/src/hooks/useRmWeekIndex.ts, taskflow/src/stores/settings.store.ts, taskflow/src/stores/settings.store.test.ts, taskflow/src/components/integrations/ReleaseManagementBlock.tsx, taskflow/src/routes/settings/IntegrationsSection.tsx</files>
  <behavior>
    - parseWeekRange('WEEK43 (19.10.2026 - 25.10.2026) LETNA AKCIA') returns {weekNo:43, start:'2026-10-19', end:'2026-10-25'}. Trailing text is ignored. Flexible whitespace around '-' is accepted. Malformed input returns null: 'WEEK43', 'WEEK43 (19.10.2026)', invalid month 13, or a non-WEEK summary.
    - isDateInWeek: both boundaries are inclusive ('2026-10-19' and '2026-10-25' are true), '2026-10-26' is false. Comparison uses YYYY-MM-DD strings only, with no Date objects, so there is no timezone off-by-one.
    - findWeekForDate(weeks, ymd) returns the containing week or null.
    - findChildForProject(week, 'Core'): a case-insensitive includes match. If several children match, prefer a word-boundary match ('Core' over 'Core Admin'). If it is still ambiguous, or nothing matches, return null.
    - extractDeploymentPackageKey accepts 'ABC-12', {key:'ABC-12'}, ['ABC-12'], [{key:'ABC-12'}] and returns 'ABC-12'. It returns null for null, '', non-key strings, and arrays with 0 or 2+ items. The key must match /^[A-Z][A-Z0-9_]+-\d+$/.
    - evaluatePackageSync({pkgKey, fixVersions:[{id,name,releaseDate?}], weeks, projectName, projectVersions}) returns one of:
      - 'none': neither field is set.
      - 'ok': any fix version's releaseDate is in the package week.
      - 'pkg-only': there is a package and no fix versions. The fix is set-fix-version when exactly one projectVersion has a releaseDate inside the week.
      - 'fv-only': there are fix versions and no package. The fix is set-package when exactly one dated fix version exists and a child matches that date's week + project.
      - 'mismatch': both are set and no date matches. Offer both fixes when each can be resolved.
      - 'unresolved': the package key is not in the index, or the fix versions are undated. No fixes, plus a hint.
      Each result has state, hint text, and fixes[] of {kind:'set-fix-version', versionId, versionName} or {kind:'set-package', childKey, childSummary}.
    - planBulkSync(stories, version, weeks, projectVersions, shape) returns {key, fields}[] for Story issues only. Direction is always fix version to package, because the release's version is authoritative on the release screens. It sets customfield_15725 (in the buildPackageFieldValue shape) on stories whose package is missing or points to another week. It skips 'ok' stories and those with an unresolvable child.
    - buildPackageFieldValue(key, 'array') returns [key]. buildPackageFieldValue(key, 'single') returns key.
    - settings.store migrate from v29 leaves releaseManagementProjectKey as null. The version is 30.
  </behavior>
  <action>
1. Create taskflow/src/lib/deployment-package.ts as a pure module (no React or store imports) with the exports and behaviors above. Export the types RmWeek {key, summary, weekNo, start, end, children:{key, summary}[]}, PackageSyncState, PackageFix, and PackageEditShape = 'array' | 'single' | 'not-editable'. Use the regex from RESEARCH section 5 and normalise dd.MM.yyyy to YYYY-MM-DD. Also export indexChildToWeek(weeks) to build a Map from child key to RmWeek. Fix-version merge rule for set-fix-version (Claude's discretion, document it in a JSDoc): the new fixVersions are the current versions minus any *dated* version outside the package week, plus the target. Undated versions are kept. Export this as computeFixVersionsForFix(current, targetId, week, projectVersions) returning {id}[]. Write deployment-package.test.ts that covers every behavior bullet.

2. In taskflow/src/services/jira.ts (per the dual-file memory, not jira/):
   (a) Add `fetchRmWeekIndex(baseUrl, token, rmProjectKey): Promise<RmWeek[]>`. Validate rmProjectKey against /^[A-Z][A-Z0-9_]+$/ and quote it in JQL. The parent/child mechanism is unconfirmed (research A3), so do NOT block on a probe. Run ONE fully paginated fetchAllSearchPages over the RM project with JQL `project = "{RM}" AND created >= startOfYear(-1) ORDER BY created DESC` and fields `summary,parent,subtasks,issuelinks,customfield_10014`. Then build weeks on the client: issues whose summary passes parseWeekRange are parents. Collect children from every source and dedupe by key: parent.fields.subtasks[], any issue whose fields.parent.key is a parent, any issue whose customfield_10014 (Epic Link) is a parent key, and any issue linked through issuelinks (inward or outward) to a parent. This handles sub-task, epic and link structures in one query, over a bounded and fully paginated set, so it is not the page-cap pitfall.
   (b) Add `fetchDeploymentPackageEditShape(baseUrl, token, issueKey): Promise<PackageEditShape>`. Copy the fetchIssuePriorityOptions editmeta GET. If fields.customfield_15725 is absent, return 'not-editable'. Otherwise return 'array' when schema.type === 'array', else 'single'. Validate issueKey with the key regex.
   (c) In fetchFixVersionIssues, append `customfield_15725`, `fixVersions`, `project` to the requested fields list only (no JQL or order change) and widen its return type accordingly. Add `name?: string` to the project type on JiraIssueDetail fields.

3. Create taskflow/src/hooks/useRmWeekIndex.ts. It reads releaseManagementProjectKey and the Jira creds the way other hooks do, then runs useQuery with key ['rm-week-index', rmProject, baseUrl], enabled only when the key is set, and staleTime 5 min. Return {weeks, childToWeek (memoised indexChildToWeek), enabled, isLoading, isError}. Also export `useDeploymentPackageEditShape(issueKey)` with key ['jira-editmeta-deployment-package', issueKey] and staleTime 30 min.

4. Settings: add `releaseManagementProjectKey: null as string | null` plus `setReleaseManagementProjectKey` in settings.store.ts, following the selectedAioProjectKey pattern. Bump version 29 to 30 and add a `version < 30` migrate step that sets null when the value is undefined. Update the migrate tests in settings.store.test.ts. Create components/integrations/ReleaseManagementBlock.tsx by copying the AioBlock picker structure: a listJiraProjects query under its own key ['jira-projects-rm', baseUrl], the selected project name rendered explicitly in the trigger (Base UI Select memory), a stale-key warning, a "None" option that clears to null, and helper text saying the feature is disabled when nothing is selected. Mount it in IntegrationsSection.tsx under an h3 "Release Management", matching the section conventions.

Commit RED and GREEN together in one commit (the pre-commit hook runs the full suite).
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/lib/deployment-package.test.ts src/stores/settings.store.test.ts && npx tsc --noEmit -p .</automated>
  </verify>
  <done>All deployment-package and settings tests pass and tsc is clean. fetchRmWeekIndex and fetchDeploymentPackageEditShape exist in jira.ts. fetchFixVersionIssues requests the 3 extra fields with an unchanged JQL. The RM picker renders in Integrations and persists the key. Biome flags no new files.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Issue-detail sidebar warning + one-click fixes</name>
  <files>taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx, taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx, taskflow/src/routes/dashboard/issue-detail/DeploymentPackageWarning.tsx</files>
  <behavior>
    - extractDeploymentPackage({key:'RM-5'}) returns 'RM-5'. [{key:'RM-5'}] returns 'RM-5'. {key, value} prefers key. All existing extractDeploymentPackage tests are unchanged and still pass.
    - DeploymentPackageWarning renders nothing when there is no RM project, the issue type is not Story, or the state is 'ok' or 'none'.
    - For 'fv-only' with a resolvable child, it renders a warning plus a "Set deployment package to {childKey}" button. Clicking calls mutate with {fieldName:'customfield_15725', value: buildPackageFieldValue(childKey, shape)}.
    - For 'pkg-only', a "Set fix version to {name}" button calls mutate with {fieldName:'fixVersions', value: computeFixVersionsForFix(...)}.
    - For 'mismatch', both buttons render.
    - For 'unresolved', or when there is no fix, it shows only the hint text.
    - When the shape is 'not-editable', the package button is replaced by an "Open in Jira" link. The fix-version button still works.
  </behavior>
  <action>
1. In FieldsSection.tsx, extend extractDeploymentPackage to accept {key} (taking precedence over value and name) and arrays of {key}. Leave other behavior unchanged. In the Deployment package row (~1097), show the key, plus the RM child summary from useRmWeekIndex().childToWeek when it is known (truncate, keep it on one line).

2. Create DeploymentPackageWarning.tsx with props {issueKey, issueTypeName, projectName, pkgField, fixVersions, projectVersions, mutation, jiraBaseUrl}. It uses useRmWeekIndex, plus useDeploymentPackageEditShape(issueKey) enabled only when the evaluated state needs a package write. It calls evaluatePackageSync and renders a compact amber warning line (lucide AlertTriangle, text-xs) with the hint and inline small buttons, following the existing sidebar row conventions. No card panel (memory). Render it once in FieldsSection, directly under the Deployment package row (which sits next to Fix Versions). Pass the existing useFieldMutation instance so its optimistic update and invalidations (jira-issue-detail, jira-fixversion-issues) are reused. The optimistic write stores the write shape, which the extended extractor reads (research gotcha). Reuse the fix-versions list query already in FieldsSection for projectVersions. Project name comes from f.project.name; if it is missing, fall back to the project key, and the match then likely returns 'unresolved', which is acceptable. Gate on issuetype name === 'Story' only (per CONTEXT: Stories only).

3. Add tests to FieldsSection.test.tsx (or a colocated DeploymentPackageWarning.test.tsx, adding it to files if created) covering the behavior bullets, with useRmWeekIndex and the edit-shape hook mocked. Do not bend production code to fit mocks (memory). One commit for RED and GREEN.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/issue-detail/ && npx tsc --noEmit -p .</automated>
  </verify>
  <done>A Story with a mismatched or one-sided package and fix version shows a warning with the right buttons. Clicks issue the correct field PUT shape. Non-Stories and an unconfigured RM project show nothing. All existing issue-detail tests pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Release detail package-drift section + Releases tab package column and bulk sync</name>
  <files>taskflow/src/routes/dashboard/release-detail/useDeploymentPackageSync.ts, taskflow/src/routes/dashboard/release-detail/DeploymentPackageSection.tsx, taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts, taskflow/src/routes/dashboard/ReleaseDetailPage.tsx, taskflow/src/routes/dashboard/ReleasesTab.tsx</files>
  <behavior>
    - useDeploymentPackageSync({version, stories, projectName, projectVersions}).run() fetches the edit shape once (from the first planned story). When the shape is 'not-editable' it returns {blocked:true} without writing. Otherwise it calls bulkUpdateIssue sequentially for each planBulkSync item, collects {key, ok, error} without aborting on a 400 or 403, and then invalidates ['jira-fixversion-issues'] and ['jira-issue-detail'].
    - DeploymentPackageSection lists only Stories whose state is pkg-only, fv-only, mismatch or unresolved, with per-row fix buttons (the same fix semantics as the sidebar). It renders nothing when the RM project is unset or there is no drift.
  </behavior>
  <action>
1. Create useDeploymentPackageSync.ts. It exposes `plan` (memoised planBulkSync over Story-type stories using useRmWeekIndex().weeks), `run()` (the behavior above, via bulkUpdateIssue from jira.ts), `applyFix(storyKey, fix)` for single-row fixes (a set-package fix uses buildPackageFieldValue with the fetched shape, and a set-fix-version fix uses computeFixVersionsForFix, both through bulkUpdateIssue), plus `isRunning`, `results` and `blockedReason`. Add a small test (useDeploymentPackageSync.test.tsx, added to files) with mocked bulkUpdateIssue and edit-shape. It must cover the not-editable block, error collection that continues past a failure, and invalidation.

2. In useReleaseDetail.ts, expose the stories from the existing fetchFixVersionIssues query (which now includes customfield_15725, fixVersions and project) to the page if they aren't exposed already. Do not change the query key.

3. Create release-detail/DeploymentPackageSection.tsx. Use an h3 "Deployment package" and rows in IssueDetailContent style (no card panels, per memory, one line per row). Each row shows the story key link, the summary, a state label, the hint, and fix buttons. Per CONTEXT, this is a separate section from driftDetection.ts, which stays untouched (MR-only). Mount it in ReleaseDetailPage.tsx near LabelSummarySection. projectVersions comes from the cached ['jira-fix-versions', projectKey] query (fetchFixVersions from services/jira/versions).

4. In ReleasesTab.tsx, call useRmWeekIndex once (a single shared query, not one per row). For each version row with a releaseDate, show the derived package: findWeekForDate, then findChildForProject using the active project's name (from listJiraProjects or an existing project source in the tab; resolve it once). Show it as a compact key chip with the summary in a title tooltip, or as the week label alone if no child matches. Show nothing if the RM project is unset. NO drift counts on the list (Phase 89 memory). Add a per-row action (in the existing row action/menu pattern) "Sync deployment packages". It fetches that version's stories via queryClient.fetchQuery with the SAME key ['jira-fixversion-issues', versionId, storyPointsFieldKey] and fetcher as useReleaseDetail (warm cache), computes the plan, and shows a confirm dialog ("N stories will be updated"; if N=0, show "Already in sync"). It then runs the sync and toasts or inlines a summary of updated and failed counts with the failed keys. Disable it with a tooltip when the shape is not-editable or the version has no releaseDate. Keep each row on one line (memory).
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/ && npx tsc --noEmit -p . && npx biome check src/lib/deployment-package.ts src/hooks/useRmWeekIndex.ts src/routes/dashboard/release-detail/DeploymentPackageSection.tsx src/routes/dashboard/release-detail/useDeploymentPackageSync.ts src/routes/dashboard/issue-detail/DeploymentPackageWarning.tsx src/components/integrations/ReleaseManagementBlock.tsx</automated>
  </verify>
  <done>Release detail shows a Deployment package drift section with working fixes. The Releases tab shows the package per row and a confirmable bulk sync that reports per-item results. ReleasesTab tests, including the versionCountsParity test, still pass. tsc is clean, and biome is clean on the new files.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| app -> Jira REST | Issue keys and project keys are interpolated into JQL and URL paths; writes PUT to the issue endpoint |
| Jira data -> UI | RM summaries and story summaries are rendered in the sidebar and lists |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-eym-01 | Tampering | fetchRmWeekIndex JQL | mitigate | Validate rmProjectKey with /^[A-Z][A-Z0-9_]+$/ and quote it in the JQL |
| T-eym-02 | Tampering | fetchDeploymentPackageEditShape / bulk write URLs | mitigate | Validate issue keys with /^[A-Z][A-Z0-9_]+-\d+$/ before building URLs; the extractor rejects non-key strings |
| T-eym-03 | Elevation | customfield_15725 PUT | mitigate | Check editmeta first. If the field is not editable, writes are disabled and only a link-out is shown, so no blind PUTs. Jira enforces permissions server-side |
| T-eym-04 | Info disclosure / XSS | Rendering RM summaries | accept | React escaping, no dangerouslySetInnerHTML |
| T-eym-05 | DoS | Bulk sync loop | mitigate | Sequential writes, only after explicit confirmation; errors are collected per item and do not abort the loop |
</threat_model>

<verification>
- cd taskflow && npm test (full suite green)
- npx tsc --noEmit clean; biome flags no NEW files
- Manual UAT: (1) select an RM project in Settings > Integrations. (2) Open a Story with only a fix version and check the warning and the "Set deployment package" button; click it and confirm the field updates in Jira. (3) Open a Story with a mismatched package and check that both buttons appear. (4) On the Releases tab, check the package chip and run the sync on a test version. (5) On release detail, check the drift section. If the PUT is rejected or editmeta lacks the field, confirm the read-only fallback appears.
</verification>

<success_criteria>
- Every CONTEXT decision is implemented: field as an issue key (tolerant read, editmeta-driven write), child match by project name, inclusive WEEK range rule, warnings with fixes in both directions in the sidebar and on release detail, Stories only, package display and bulk sync on the Releases tab, global RM picker, feature disabled when unset.
- There are no drift counts on the Releases list, and driftDetection.ts is unchanged.
</success_criteria>

<output>
Create `.planning/quick/261014-eym-enhance-deployment-package-for-jira-stor/261014-eym-SUMMARY.md` when done
</output>
