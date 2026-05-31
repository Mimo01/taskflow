# Quick Task 260531-qx3: Add more info to the release detail page - Research

**Researched:** 2026-05-31
**Domain:** React/TS UI — surfacing already-loaded Jira/GitLab data in `ReleaseDetailPage.tsx`
**Confidence:** HIGH (all findings read directly from source)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
Add exactly these three info groups (do NOT add milestone timeline group):
1. **MR state distribution** — compact summary by state ("X merged · Y open · Z closed"). Use `Badge` tones (green=merged, blue=opened, gray=closed).
2. **Contributor list** — unique MR authors as `CachedAvatar`s with names.
3. **Issue breakdown / effort** — issue status distribution (new / in progress / done) and, when populated, story points total vs. completed (`customfield_10016`).

### Claude's Discretion
Placement per info group — compact stats fit the sidebar (MetaRow / badges); richer breakdowns may warrant a small section in the left column. Match existing density; don't overcrowd the sidebar.

### Missing data — Hide gracefully
Only render a field/section when its data exists. No empty rows, "—" placeholders, or zero-states. No GitLab milestone matched → omit MR-derived sections. Story points absent → omit effort line but still show status distribution.

### Deferred Ideas (OUT OF SCOPE)
- Milestone timeline (start_date→due_date / merge-time) group — explicitly NOT selected.
</user_constraints>

## Summary

All three info groups can be built almost entirely from data **already loaded** into the page — with **one important exception**: story points are NOT fetched. The Jira issue query (`fetchFixVersionIssues`) requests only `fields = 'summary,status,assignee,issuetype'` (line 108), so `customfield_10016` will always be `null` on the loaded `JiraIssue` objects. Surfacing story points requires adding `customfield_10016` to that `fields` string — a one-line change in the same file.

MR state distribution and contributor list need **no new fetches**: `milestoneMRs` (the `GitLabMR[]` for the matched milestone) is already loaded and carries both `state` and `author`. Issue status distribution is fully derivable from `fixVersionIssues[].fields.status.statusCategory.key`.

**Primary recommendation:** Derive MR-state counts and unique contributors from the existing `releaseMrs` array; derive status distribution from `releaseIssues`. Add `customfield_10016` to the issue `fields=` list (line 108) to enable the effort line, then sum it gated on "any issue has a non-null value" so it hides gracefully when the field isn't configured.

## Data Availability (per info group)

### 1. MR state distribution — FULLY AVAILABLE, no fetch needed
- **Array:** `releaseMrs` (= `milestoneMRs ?? []`), declared `ReleaseDetailPage.tsx:324`. Loaded by the `gitlab-milestone-mrs` query (lines 308-320) via `fetchMilestoneMRs` (all states — `state=all`, gitlab.ts:1008).
- **State field:** `mr.state`, typed `'opened' | 'closed' | 'merged' | 'locked'` (`GitLabMR`, gitlab.ts:189-196). Note the union includes `'locked'` — fold it into the "closed/other" bucket so the count math stays exhaustive.
- **Gate for graceful hide:** Only render when `gitlabMatch.type !== 'none'` AND `milestoneMRs` is loaded AND `releaseMrs.length > 0` (mirror the existing `MR Labels` MetaRow guard at lines 1030-1075).
- **Color mapping per CONTEXT:** green=merged, blue=opened, gray=closed. Use `Badge` `tone` prop — `tone="green"` / `tone="blue"` / `tone="muted"` (gray). See ChipTone note below.

### 2. Contributor list — FULLY AVAILABLE, no fetch needed
- **Author source:** `mr.author` on each `GitLabMR`, shape `{ id: number; name: string; username: string; avatar_url: string }` (gitlab.ts:196).
- **Dedupe:** Build a `Map<number, GitLabMR['author']>` keyed on `author.id` over `releaseMrs` (id is the stable unique key — prefer it over name/username). `Array.from(map.values())` gives unique contributors. This mirrors the existing `labelMap` aggregation pattern (lines 343-360).
- **Render:** `<CachedAvatar url={author.avatar_url} name={author.name} size={20} />` — exact pattern already used at lines 872-877. Counts as "N contributors".
- **Gate:** same as group 1 (milestone matched + MRs loaded).

### 3. Issue breakdown / effort — STATUS DISTRIBUTION AVAILABLE; STORY POINTS NEEDS A FETCH CHANGE
- **Issue array:** `releaseIssues` (= `fixVersionIssues ?? []`), line 323. Loaded by `jira-fixversion-issues` query (lines 296-305) via `fetchFixVersionIssues`.
- **Status field:** `issue.fields.status.statusCategory?.key`, typed `'new' | 'indeterminate' | 'done'` (jira.ts:144-148). This is the canonical three-bucket distribution: `new` = To Do / new, `indeterminate` = In Progress, `done` = Done. `statusCategory` is optional (`?`) — guard with `?? 'new'` or skip undefined.
- **Story points field:** `issue.fields.customfield_10016: number | null` (jira.ts:150). **GAP — see below.**

## Gaps / Extra Fetches

**Story points are NOT loaded.** `fetchFixVersionIssues` (jira.ts/ReleaseDetailPage.tsx:99-127) requests:
```
const fields = 'summary,status,assignee,issuetype';   // line 108
```
`customfield_10016` is absent, so every loaded issue has `customfield_10016 === null`. The type allows the field but the data is never populated.

**Fix (single line, same file):**
```
const fields = 'summary,status,assignee,issuetype,customfield_10016';
```
No separate API call, no new query, no adapter change — the existing search endpoint returns it once requested. After this, sum `customfield_10016` across `releaseIssues` for total, and sum only those whose `status.statusCategory?.key === 'done'` for completed.

**Graceful hide for effort line:** `customfield_10016` may not be the configured story-points field in every Jira instance (note jira.ts:376 uses `storyPointsFieldKey = 'customfield_10016'` as a *default*, and line 385 unions multiple candidate keys elsewhere). Treat "no story points" as: total === 0 OR every issue's value is null/0. Per CONTEXT, omit the effort line in that case but still render the status distribution. Recommended guard: render effort only when `releaseIssues.some(i => typeof i.fields.customfield_10016 === 'number' && i.fields.customfield_10016 > 0)`.

**Cache note:** the `jira-fixversion-issues` query key (line 297) does not include the fields list, so changing `fields=` is safe — but a stale React Query cache from a prior session could lack the new field until `staleTime` (5 min) expires. Not a code concern; just a runtime-freshness note.

## Reuse Patterns (verified signatures)

| Component | Import | Key props (real names) |
|-----------|--------|------------------------|
| `Badge` | `@/components/ui/badge` | `tone?: ChipTone` AND/OR `variant?: 'default'\|'secondary'\|'destructive'\|'outline'\|'ghost'\|'link'`. `tone` governs color and can coexist with `variant` (badge.tsx:36-60). Renders a `<span>`. |
| `CachedAvatar` | `@/components/ui/cached-avatar` | `url: string \| null \| undefined`, `name: string \| null \| undefined`, `size?: 20\|24\|32\|40` (default 32), `className?` (cached-avatar.tsx:27-36). |
| `Progress` | `@/components/ui/progress` | `value` (0-100), `className?`, `indicatorClassName?` (e.g. `bg-green-500`). Existing usage at lines 664-669. |
| `MetaRow` | local component (ReleaseDetailPage.tsx:1262) | `label: string`, `children: React.ReactNode`. Sidebar label+value row. |

**ChipTone valid values** (statusStyles.ts:104): `'blue' | 'green' | 'red' | 'orange' | 'amber' | 'purple' | 'muted'`. **There is no `gray` tone** — CONTEXT says "gray=closed"; use `tone="muted"` (renders `bg-muted text-muted-foreground`, the gray family). Existing `Badge tone="green"` / `tone="amber"` usage at lines 966-968.

**Helpers to reuse, not reinvent:**
- `statusPillClass(categoryKey)` (statusStyles.ts:75) — already imported (line 42), used at line 743. For a status-distribution chip that needs only the color, use `tonePillClass(tone)` or `Badge tone=`. Do NOT add geometry classes on top of `statusPillClass`.
- `labelMap`/`labelSummary` aggregation pattern (lines 343-360) — copy this shape for contributor dedupe.
- lucide-react icons already imported: `GitMerge`, `Users` is NOT yet imported — add `Users` to the import block (lines 13-28) for the contributor section header. `GitMerge` is available for the MR-state summary.

## Pitfalls

### Biome / tsc clean baseline (`npm run check`)
The baseline is fully green (per memory, 944260ea). To keep it:
- **Exhaustive union handling:** `mr.state` includes `'locked'`. If you write a `switch` or chained ternary, account for it or biome/tsc may flag non-exhaustiveness. Simplest: count `merged`, `opened`, and bucket everything else as closed/other.
- **`statusCategory?.key` is optional** — TS will error on unguarded access. Use optional chaining + a default.
- **`customfield_10016` is `number | null`** — guard with `typeof === 'number'` before arithmetic; `null + null` is not valid and summing null silently yields `0` only after coercion (avoid implicit coercion to satisfy strict checks).
- Run `npm run check` (biome check + tsc), NOT `biome lint` alone (lint falsely flags assist suppressions — per memory).

### Graceful-hide null safety
- Every new section must early-return / conditionally render when its data is empty, matching the existing `{milestoneMRs && labelSummary.length > 0 && (...)}` (line 628) and `MR Labels` MetaRow (lines 1030-1075) patterns. No "—" placeholder rows (unlike the existing `MR Labels` row at line 1032 which DOES show "—"; CONTEXT overrides this for the NEW sections — omit entirely).
- `gitlabMatch.type === 'none'` must suppress ALL MR-derived sections (state distribution, contributors).

### Don't double-fetch
- Do NOT add a new React Query for MRs or issues — reuse `milestoneMRs`/`releaseMrs` and `fixVersionIssues`/`releaseIssues` already in scope. Only the issue `fields=` string changes.

## Placement Recommendation (Claude's discretion)
- **MR state distribution:** compact — sidebar `MetaRow label="MRs"` with three small `Badge tone=` counts, OR a one-line summary near the existing Issues progress bar in the left column. Either fits.
- **Contributor list:** left-column small `<section>` (avatars + names wrap) — sidebar is too narrow for an avatar group. Header with `Users` icon, matching the `Labels` section style (lines 627-650).
- **Issue status distribution + effort:** left column, directly under the existing Issues progress bar (lines 663-670). A second `Progress` or a row of three `Badge tone=` counts (new/in-progress/done) plus an effort line "Story points: X / Y" when present.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `customfield_10016` is the correct story-points field for this Jira instance | Gaps | LOW — jira.ts treats it as the default key (line 376); if wrong, effort line simply hides gracefully (no error). |

## Sources

### Primary (HIGH confidence — read directly)
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` (full read) — data loading, existing patterns, MetaRow
- `taskflow/src/services/gitlab.ts:189-196` — `GitLabMR` (state, author shapes); `:994-1031` — `fetchMilestoneMRs` (state=all)
- `taskflow/src/services/jira.ts:139-183` — `JiraIssue` type; `:99-127` (in detail page) — `fetchFixVersionIssues` fields list
- `taskflow/src/components/ui/badge.tsx`, `cached-avatar.tsx`, `progress.tsx` — component prop signatures
- `taskflow/src/lib/statusStyles.ts:104-129` — `ChipTone`, `CHIP_TONE_CLASS`, `tonePillClass`, `statusPillClass`
