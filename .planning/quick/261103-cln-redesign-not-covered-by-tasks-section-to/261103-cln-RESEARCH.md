# Quick 261103-cln: Restyle "Not covered by tasks above" + per-row fixes - Research

**Researched:** 2026-11-03
**Domain:** Release detail UI (React 19 + React Compiler, TanStack Query v5, Base UI, Tailwind v4 container queries), Jira REST v2 + GitLab REST v4 writes
**Confidence:** HIGH (codebase-verified). External API claims are cited.

<user_constraints>
## User Constraints (from CONTEXT.md, summarised verbatim-intent)

**Locked**
- Visual: orange accent-bar callout (`border-l-[3px] border-orange-400 bg-orange-50/60 px-6 py-4` + dark variants, `@container`), h3 with AlertTriangle + title + orange count pill + muted hint (hidden narrow), HEADER_CLASS-style strip, orange hover rows, `divide-orange-200/60`, `min-h-8`, amber state pill like `package-state` (collapses to icon narrow), VISIBLE_ROWS + "Show all N" expander. Extract shared class constants instead of copy-pasting.
- Position unchanged: stays inside UnifiedTaskTable directly under the task list.
- "Not in version" → **Apply**: ADD this release's fix version to the linked task(s), keeping existing fixVersions; the MR then moves into the primary table.
- "No task" → **Link task**: pick an issue from THIS release (popover + search), prepend key to MR title via GitLab PUT; optimistic/invalidate via mrChannelKeys prefixes.
- "Not evaluated" rows: keep, muted pill, empty action cell.
- Per-row pending + inline error like DeploymentPackageSection. Keep testids where practical.

**Claude's discretion**: columns (recommended: State, Key, Merge request, Author, Reviewers, MR state, BR, MS + trailing Fix-action column); per-reason header counts; multi-key Apply behaviour. One row = one line at every width.

**Deferred**: none.
</user_constraints>

## Project Constraints (no CLAUDE.md exists; from memory/conventions)
- `.planning`/git at outer `taskflow/`; src/npm/vitest/biome in inner `taskflow/taskflow/`.
- Edit legacy `src/services/jira.ts` (not `services/jira/`).
- Pre-commit: `biome check --staged`, `tsc --noEmit`, full `vitest run` — combine RED/GREEN per commit; gate on "no new biome files flagged", never a hardcoded count.
- React Compiler is on in app, not in vitest. No module-level mutable reads in render.
- Colour = status only; no figure shown twice; one row = one line (drop/sr-only columns rather than wrap).
- Container queries never style the container element itself.
- No customer data in fixtures (placeholders like PROJ-1).

## Summary

The secondary section (`UnifiedTaskTable.tsx:1556-1645`) renders `secondaryRows` via `MrSubLine` with a reason pill, header chips and `SecondaryHeaderStrip`. The target style lives in `DeploymentPackageSection.tsx:100-112, 129, 330-489`. Both fixes can move a row into the primary table without a page reload: (1) Link task patches `mr.title` in the three MR channel caches, so `extractMrTaskKeys` picks up the key on the next render and `buildTaskMrAttachment` reclassifies the row; (2) Apply writes Jira and then refetches `['jira-fixversion-issues', versionId, …]`, which grows `fixVersionIssueKeys`/`coveredKeys`.

You need three small additions to services and hooks: `updateMergeRequest` must accept `title`, `MrFixPatch` must allow `title`, and a new `addIssueFixVersion` helper goes in `jira.ts` using the Jira `update.fixVersions[{add:{id}}]` verb, which keeps existing versions. Do **not** reuse `computeFixVersionsForFix`, because it drops versions outside the RM week. Thread `versionId` and `jiraBaseUrl` into UnifiedTaskTable as a new **optional** prop. The release's issues are already available as `primaryRows[].issue`, so the picker needs no new data. For the picker, use Base UI `Popover` with `cmdk` `Command` (both already installed).

**Primary recommendation:** Extract the package section's layout constants into `release-detail/calloutSection.ts`. Rebuild the secondary section as an orange callout whose rows use their own column set plus a trailing `COL_FIX_ACTION`. Implement the two fixes as per-row hooks modelled on `useMrFixMutation`: per-instance state, a sticky error, and an action that stays pending until the refetch moves the row.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Row classification (no-task / not-in-version / unevaluated) | Client derived data (`driftDetection.ts`) | — | pure functions, recomputed every render |
| Add fix version to issue | Jira REST via `services/jira.ts` | TanStack cache invalidation | Jira is the source of truth; no optimistic issue insert possible (task's full JiraIssue not cached) |
| Prepend key to MR title | GitLab REST via `services/gitlab.ts` | optimistic channel-cache patch | title drives linkage (`extractTicketKeys`) |
| Issue picker | Browser (Popover + cmdk) | — | source list is in props |

## 1. How rows are classified and what moves them (driftDetection.ts)

- `extractMrTaskKeys(mr)` = dedup of `extractTicketKeys(mr.title)` + `extractTicketKeys(mr.source_branch)` (`driftDetection.ts:167-169`).
- `evaluateTaskDrift` (`:181-186`): no keys → `'no-linked-task'`; keys but none in `fixVersionIssueKeys` → `'not-in-fix-version'`.
- `buildDriftRows` (`:213-279`): when `mr.state !== 'opened'` (merged/closed/locked; drafts ARE evaluated, D-10) → `evaluated:false, taskReason:null`, i.e. **unevaluated**. `taskKeys` is always computed.
- `buildTaskMrAttachment` (`:383-404`) decides membership by **`taskKeys ∩ releaseIssues.map(key)`**, not by `taskReason`. That is what moves a row.
- UI mapping is `secondaryReason(row)` (`UnifiedTaskTable.tsx:131-135`).
- Wiring is in `useReleaseDetail.ts:609-632`: `fixVersionIssueKeys` comes from the `['jira-fixversion-issues', versionId, storyPointsFieldKey]` query (`:485`). Channels A/B/C come from `mrChannelKeys` (`:555, 574, 596`). Channel A is re-selected each render from `allProjectMRs`, so new keys automatically pull MRs in.

**What moves a row**
| Reason | Change | Cache work so the row moves without reload |
|---|---|---|
| no-linked-task | MR title gains a release key | `patchMrInChannelCaches(qc, projectId, mr.id, { title })` (optimistic, instant), then `invalidateMrChannelCaches` on settle |
| not-in-fix-version | linked Jira issue gains this fixVersion | `await queryClient.invalidateQueries({ queryKey: ['jira-fixversion-issues', versionId] })` (prefix match covers storyPointsFieldKey suffix). Also invalidate `['jira-issue-detail']` (same as `useDeploymentPackageSync.ts:36-39`) and optionally `['jira-version-counts','batch']` (releases list counts, `useEditRelease.ts:166`) |
| unevaluated | none (merged/closed) | — |

Note on `isLoadingIssues`: the page passes `issueGraphState === 'loading'` (`ReleaseDetailPage.tsx:574`), a data-presence rule, so a background refetch does not hide the secondary section. [VERIFIED: codebase]

## 2. Adding a fix version (Jira)

- Write path today: `bulkUpdateIssue(baseUrl, token, key, fields)` sends `PUT /rest/api/2/issue/{key}` with `{fields}` and flattens Jira errors (`services/jira.ts:2957-2983`). `fields.fixVersions` **replaces** the whole set.
- `useDeploymentPackageSync.applyFix` (`useDeploymentPackageSync.ts:68-97`) reads the token with `readSecret('jira-pat')` and `jiraBaseUrl` from `useAuthStore`. It writes `computeFixVersionsForFix(current, versionId, week, projectVersions)` (`lib/deployment-package.ts:417-429`), which **drops versions outside the RM week**. That contradicts "keep existing fixVersions", so it is not reusable here. It also needs the issue's current fixVersions, and the out-of-release task is not in any cache.
- **Recommended:** add a new helper to legacy `services/jira.ts`, next to `bulkUpdateIssue`:
  ```ts
  export async function addIssueFixVersion(baseUrl, token, issueKey, versionId): Promise<void>
  // PUT /rest/api/2/issue/{key}  body: { update: { fixVersions: [{ add: { id: versionId } }] } }
  // same 204/401/403/flattenJiraError handling as bulkUpdateIssue
  ```
  This is atomic, keeps existing versions and needs no read. Fix Versions supports the Set/Add/Remove verbs with id or name. [CITED: developer.atlassian.com/server/jira/platform/updating-an-issue-via-the-jira-rest-apis-6848604] The `{add:{id}}` form is the documented by-name pattern with `id` swapped in (MEDIUM confidence). Unit-test the body shape in `services/jira.test.ts`.
- **Version id:** UnifiedTaskTable currently receives only `versionName` (`UnifiedTaskTableProps`, `UnifiedTaskTable.tsx:55-84`). `ReleaseDetailPage.tsx:50` has `versionId` (route param), and `jiraBaseUrl` is available there (`:110`). Add an **optional** prop such as `jiraFix?: { baseUrl: string | null; versionId: string }` and pass it at `ReleaseDetailPage.tsx:567-600`. Do not extend `MrFixContext`: it is typed into many test fixtures, and adding required fields breaks `tsc` across `UnifiedTaskTable.test.tsx`. When `jiraFix` is absent, render no Apply button.
- **Multi-key rows:** `taskKeys` includes source-branch keys, which can be stale or false positives. Apply with one key → plain button. With more than one → `DropdownMenu` listing each key ("Add KEY-1 to <version>"), exactly like the package section's `fixes.length > 1` branch (`DeploymentPackageSection.tsx:437-466`). One key is enough to cover the MR.
- **Errors to expect:** an issue in another project → Jira 400 (version not valid for project); a false-positive key → 404; field not on the edit screen → 400. Surface the message inline with `describeWriteError`-style text (`lib/deployment-package.ts`) or the flattened Jira message.

## 3. Updating the MR title (GitLab)

- `updateMergeRequest(baseUrl, token, projectId, mrIid, fields)` (`services/gitlab.ts:1224-1265`) builds the body by **explicit pick** of `target_branch`/`milestone_id` and throws `'updateMergeRequest requires target_branch or milestone_id'` when both are undefined. Extend it with `title?: string`: add a pick line, extend the guard, and update the message plus the test at `services/gitlab.test.ts:2854-2856`. GitLab PUT accepts optional `title` and "must include at least one non-required attribute". [CITED: docs.gitlab.com/api/merge_requests/#update-a-merge-request]
- The cache patch is `patchMrInChannelCaches` (`useMrFixMutation.ts:89-108`): it strips undefined keys and calls `setQueriesData` on every `[prefix, projectId]` prefix. `MrFixPatch` (`:66-69`) is a deliberately closed type. Add `title?: string` there, so the patch, inverse-patch rollback and invalidation all work unchanged.
- **Hook shape:** either extend `MrFixAction` with `'link-task'` plus an arg `taskKey`, or write a sibling `useMrLinkTaskMutation` that reuses `patchMrInChannelCaches`/`invalidateMrChannelCaches`. Prefer the **sibling hook**: `fire` needs a runtime argument (the picked key) and `useMrFixMutation`'s `fire: () => void` and readiness helpers (`mrFixReadiness`) assume BR/MS. Same guards: falsy projectId/baseUrl/token/iid → throw before calling the service (WR-10).
- **New title:** `${key} ${mr.title}`, **but keep a draft prefix first**. GitLab marks drafts only when `[Draft]`, `Draft:` or `(Draft)` starts the title [CITED: docs.gitlab.com/user/project/merge_requests/drafts/]. Prepending before it would silently un-draft the MR. Use `/^(\s*(?:\[draft\]|draft:|\(draft\))\s*)/i` and insert after the match: `Draft: PROJ-1 Fix`. Treat legacy `WIP:` the same way (ASSUMED; harmless). Put this in a pure exported function (`prependTaskKeyToTitle`) with unit tests.
- **Optimistic effect:** after the patch, `extractMrTaskKeys` sees the key in the next render, the row leaves `secondaryRows` immediately, and the hook instance unmounts with the row. A failure then surfaces only via rollback. Because the row reappears in the secondary list after the inverse patch, its component state (the error) is lost on remount. Two ways to handle this: keep the patch **pessimistic** (write → then patch from the response → invalidate), or lift error state to the section keyed by `mr.id` (like `DeploymentPackageSection`'s `errors: Record<string,string>`, `:296-325`). **Recommend:** section-level `pending`/`errors` maps keyed by `mr.id`, a pessimistic patch from the returned `GitLabMR` (`updateMergeRequest` returns it), then `invalidateMrChannelCaches`. This is simpler and the error survives.

## 4. Task picker

- No existing issue picker. Building blocks are installed: `components/ui/popover.tsx` (Base UI Popover, portalled, z-50) and `components/ui/command.tsx` (cmdk `Command`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandItem`; `cmdk@^1.1.1`). The closest UI pattern is the assignee popover `FieldsSection.tsx:800-887` (Popover + Input + filtered buttons).
- Source list: `primaryRows.map(r => r.issue)`, already a prop; Jira order. Do not filter it by the active issue filters, because the picker must offer every release issue. Item: `IssueTypeIcon` + mono key + truncated summary. cmdk `value={`${key} ${summary}`}` so search matches both.
- Trigger: `PopoverTrigger render={<Button variant="outline" size="xs" className={APPLY_CLASS} …/>}` with label "Link task". Width `w-80 p-0`, `align="end"`.
- cmdk in jsdom: `CommandPalette.test.tsx` already exercises it; `src/test/setup.ts` mocks ResizeObserver. If item selection fails in tests, mock `Element.prototype.scrollIntoView` locally. (ASSUMED; check while writing tests.)

## 5. Styling: exact constants to share

From `DeploymentPackageSection.tsx`:
- Section: `@container mt-6 border-l-[3px] border-orange-400 bg-orange-50/60 px-6 py-4 dark:border-orange-500/70 dark:bg-orange-500/[0.06]` (`:333`). Inside the table use `mt-4` and drop the old `border-t`.
- h3: `mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold`. Icon `size-3.5 text-orange-600 dark:text-orange-400`. Count pill `rounded-full bg-orange-500/15 px-1.5 text-xs font-medium tabular-nums text-orange-700 dark:text-orange-300`. Hint `text-xs font-normal text-muted-foreground @max-[760px]:hidden` (`:335-347`).
- `HEADER_CLASS` (`:111-112`), `APPLY_CLASS` (`:108-109`), `COL_FIX_ACTION = 'flex w-[4.75rem] flex-none justify-end'` (`:110`), `VISIBLE_ROWS = 5` (`:129`).
- List `flex flex-col divide-y divide-orange-200/60 dark:divide-orange-500/15` (`:370`). Row `flex min-h-8 min-w-0 items-center gap-3 px-2 @max-[860px]:gap-2 py-1 text-sm transition-colors hover:bg-orange-100/50 dark:hover:bg-orange-500/10` (`:373`).
- State pill `inline-flex items-center justify-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-400` + COL_STATE `w-[84px] flex-none @max-[520px]:w-7`, with a hidden `AlertTriangle` that shows `@max-[520px]` and the label `@max-[520px]:sr-only` (`:385-392`). Unevaluated: same geometry with `bg-muted text-muted-foreground`.
- Inline error `break-words px-2 pb-1.5 text-xs text-destructive` `role="alert"` (`:470-474`). Show-all button (`:478-488`).

**Recommendation:** create `release-detail/calloutSection.ts` exporting `CALLOUT_SECTION_CLASS`, `CALLOUT_TITLE_CLASS`, `CALLOUT_ICON_CLASS`, `CALLOUT_COUNT_CLASS`, `CALLOUT_HINT_CLASS`, `CALLOUT_HEADER_CLASS` (= HEADER_CLASS), `CALLOUT_LIST_CLASS`, `CALLOUT_ROW_CLASS`, `CALLOUT_STATE_PILL_CLASS`, `CALLOUT_APPLY_CLASS`, `CALLOUT_FIX_ACTION_COL`, `CALLOUT_VISIBLE_ROWS`, `CALLOUT_ERROR_CLASS`, `CALLOUT_SHOW_ALL_CLASS`. DeploymentPackageSection should import them **unchanged in value**; its tests must stay green. Keep the `mt-6` vs `mt-4` margin outside the shared constant.

**Container-query notes**
- The new secondary `<section>`/`<div>` with `@container` becomes the nearest container for its rows. Every `@max-[…]` inside resolves against the callout's content box, which is roughly 51px narrower than the outer table (px-6 + 3px border). That is the same as the package section, so it is fine. The `@container` element's own classes never respond to itself (memory).
- The test at `UnifiedTaskTable.test.tsx:1938-1945` uses `container.querySelector('section')`, which still finds the outer section first. Using a `<div>` for the callout avoids any ambiguity.
- One row = one line: give the MR title the flex-1 expander (`flex-[2_1_0%] min-w-[6rem]`) and keep every other cell `flex-none`. Sr-only the Author name at 860, hide Reviewers at 640, MR state at 400, and the Key column at 520 (as the reason column is today). Never wrap.
- Header counts: show one count pill (total). Drop the per-reason chips: each row's state pill already says the reason, and the chips plus the pill would show the same figure twice. This rewrites the `261102-fkr: secondary header` tests.
- Keep `group/row` on each row root: `DriftActionCell`'s hover reveal uses `group-hover/row` (`UnifiedTaskTable.tsx:531-532`), and the D-05 test at `UnifiedTaskTable.test.tsx:1248-1269` asserts it.

## 6. Tests to update or add

`UnifiedTaskTable.test.tsx` (2396 lines; mocks `@tauri-apps/plugin-opener` and `@/services/gitlab.updateMergeRequest`, and renders with QueryClientProvider):
- `WR-06` (`:562-614`): the header label list changes ('Reason' becomes 'State', plus the Fix column). Keep the "no Assignee/Status/MR/Summary" assertions.
- `D-13: secondary table` (`:1425-1619`): keep the `secondary-key-flagged/none/unevaluated` testids, or update.
- `261102-fkr: secondary row info` (`:2047-2137`): `secondary-reason-pill` → keep the testid and `data-reason` on the new state pill. Keep `secondary-mr-state`.
- `261102-fkr: secondary header` (`:2139-2192`): chips are replaced by the count pill. Rewrite with a new `secondary-count` testid (these tests currently assert it is **absent**, so flip them).
- `D-05` (`:1248`), `D-04` (`:1073`, no line-wide click target), `UAT-91.1-B` filter (`:1713`), `CR-01` (`:490-530`): should pass unchanged if `drift-row` stays on each row root.
- New: Apply calls `addIssueFixVersion` with (key, versionId), the button shows pending, an inline error appears on rejection, and the multi-key dropdown works. Link task: picker lists release issues, selecting one calls `updateMergeRequest` with `{title:'PROJ-1 Fix thing'}`, a draft title is preserved, and `drift-br/ms` still render. Unevaluated rows have no action. Show all appears above 5 rows. These need `vi.mock('@/services/stronghold')` and a partial mock of `@/services/jira` (`addIssueFixVersion`), as `useDeploymentPackageSync.test.tsx:36-43` does.
- Hook tests: follow `useMrFixMutation.test.tsx:191-310` (renderHook + seeded QueryClient caches under `mrChannelKeys.*`, assert patch, invalidation and rollback) and add a `patchMrInChannelCaches` `title` case. `services/gitlab.test.ts:2794-2915`: add a title body test and update the guard message. `services/jira.test.ts`: add an `addIssueFixVersion` body/204/error test.
- `DeploymentPackageSection.test.tsx` must stay green after the constant extraction.

## Common Pitfalls
1. **Un-drafting MRs**: prepending a key before `Draft:` removes draft status (section 3).
2. **`fields.fixVersions` replaces**: using `bulkUpdateIssue({fixVersions:[{id}]})` wipes the task's other versions. Use the `update.add` verb.
3. **Optimistic title patch unmounts the row**, so per-row hook state (error) is lost on rollback. Keep pending/errors in section state keyed by `mr.id`, or patch pessimistically.
4. **Query-key churn**: invalidate by prefix (`['jira-fixversion-issues', versionId]`, `mrChannelKeys.channelForProject`). Never rebuild windowed keys by hand (CR-02). Keep the Apply button pending until `await invalidateQueries(...)` resolves so the row does not flash "ready" before it moves.
5. **Jira search index lag**: the JQL `fixVersion = X` refetch may briefly not include the newly-tagged issue (ASSUMED; Jira DC usually indexes synchronously). If UAT shows the row lingering, add one delayed re-invalidate.
6. **React Compiler**: no module-level mutable reads in render. Existing code mixes `useMemo` (package section) and none (`useMrFixMutation`); both compile. Don't call hooks conditionally per reason: render a per-row component that always calls its hook, or keep the actions in section-level handlers.
7. **Nested interactive / click model**: rows have no overlay click target (D-04). Keep the key/!iid buttons and new action buttons as plain siblings. Popover content is portalled, so it is not clipped by the callout.
8. **MrFixContext fixtures**: adding required fields breaks `tsc` in many test fixtures. Use a new optional prop.
9. **Pre-commit runs the full suite + tsc + biome**: changes to `gitlab.ts` guard text and to the secondary-header tests must land in the same commit as the implementation.
10. **Filter interplay**: `filteredSecondaryRows` applies the BR/MS/label filter (`UnifiedTaskTable.tsx:1272-1274`). The count pill and VISIBLE_ROWS slicing must use the filtered array. Reset `expanded` is not needed (component keyed by versionId).

## Code Examples

```ts
// services/gitlab.ts updateMergeRequest — extended pick (keep T-90-01 explicit-pick rule)
fields: { target_branch?: string; milestone_id?: number; title?: string }
if (fields.target_branch === undefined && fields.milestone_id === undefined && fields.title === undefined)
  throw new Error('updateMergeRequest requires target_branch, milestone_id or title');
if (fields.title !== undefined) body.title = fields.title;
```

```ts
// pure helper (UnifiedTaskTable.tsx or a small module), unit-tested
const DRAFT_PREFIX_RE = /^\s*(?:\[draft\]|\(draft\)|draft:|wip:)\s*/i;
export function prependTaskKeyToTitle(title: string, key: string): string {
  const m = DRAFT_PREFIX_RE.exec(title);
  return m ? `${m[0]}${key} ${title.slice(m[0].length)}` : `${key} ${title}`;
}
```

## Validation Architecture
| Property | Value |
|---|---|
| Framework | vitest (jsdom), `src/test/setup.ts` |
| Quick run | `cd taskflow && npx vitest run src/routes/dashboard/release-detail src/services/gitlab.test.ts src/services/jira.test.ts` |
| Full suite | `cd taskflow && npm run test && npx tsc --noEmit && npx biome check ./src` |

Wave 0: none. The test infrastructure exists; add cases to the existing files listed in section 6.

## Security Domain
- V5 input validation: the picked key comes from release issues (validated Jira keys). Build the title from that key plus the existing title only. `updateMergeRequest` keeps its explicit-pick body (T-90-01) and its token-free error messages (T-90-02). `addIssueFixVersion` must use the issue key in the path only after it matches the `ISSUE_KEY_RE` style check already used in `jira.ts` (`fetchIssuesByKeys`, `:1797`). `encodeURIComponent` is not needed if validated.
- No new auth surface: it reuses the `readSecret('jira-pat')` and GitLab token from `fix`.

## Environment Availability
Node v26.12.1. `cmdk` and `@base-ui/react` are installed (`package.json:26,45`). No new packages are needed, so no package legitimacy audit applies.

## Assumptions Log
| # | Claim | Risk |
|---|---|---|
| A1 | `{update:{fixVersions:[{add:{id}}]}}` works on this Jira DC (docs show by-name add) | Low: fall back to `{add:{name: versionName}}` |
| A2 | Jira search reflects the new fixVersion immediately on refetch | Row lingers until next refetch |
| A3 | Legacy `WIP:` prefix should be treated like Draft | Harmless |
| A4 | cmdk item selection works in jsdom without extra mocks | Test-only; add a scrollIntoView mock |

## Sources
- Codebase (HIGH): files and line numbers cited above.
- [GitLab Update MR API](https://docs.gitlab.com/api/merge_requests/): `title` optional; at least one attribute required.
- [GitLab draft MRs](https://docs.gitlab.com/user/project/merge_requests/drafts/): Draft prefixes must start the title.
- [Atlassian: Updating an issue via the Jira REST APIs](https://developer.atlassian.com/server/jira/platform/updating-an-issue-via-the-jira-rest-apis-6848604/): fixVersions supports set/add/remove.
- [JRASERVER-59730](https://jira.atlassian.com/browse/JRASERVER-59730): `update.fixVersions.add` example.

**Valid until:** 2026-12-03
