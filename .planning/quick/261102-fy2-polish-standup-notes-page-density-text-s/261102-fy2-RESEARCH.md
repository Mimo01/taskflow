# Quick Task 261102-fy2: Polish standup notes page (density, text size, status pills) - Research

**Researched:** 2026-11-02
**Domain:** Tailwind v4 UI polish (density variants, rem-based font scale) + one Jira fetch field addition
**Confidence:** HIGH (everything verified by codebase grep/read; no external libraries involved)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**Status display style (LOCKED)**
- Trailing status pill, right-aligned, using the shared `statusPillClass` from `@/lib/statusStyles`
  (same pill as Backlog / release tables). Summary/title truncates first; the pill never shrinks.
- Pill must sit in a flex parent (see memory: statusPillClass needs flex parent — wrap, don't add geometry to a bare span).
- Colour comes from status category (statusCategory.key), consistent with the rest of the app.

**Density / text size scope (LOCKED)**
- Full page: row padding/gaps follow density; text sizes AND icon sizes follow text size (fontScale)
  everywhere on the page — rows, sub-items, section headers, page header.
- Use the app's existing mechanisms (density-compact:/density-comfortable: variants already used
  in this folder; whatever fontScale mechanism the rest of the app uses — e.g. rem-based sizing).
  Do not invent a new system. Hard-coded px sizes that ignore fontScale must go.

### Claude's Discretion
- Where status appears — recommended default: every issue row — Yesterday issue group headers, nested sub-task sub-headers,
  and Today section rows (In progress, Up next, Participating). Skip a row's pill only where the
  status is redundant or unavailable (e.g. MR-only rows, "other commits" group). If a section is
  inherently one status (e.g. "In progress"), still show the pill. If status data isn't already in the fetched issue payloads, fetch it efficiently (add `status`
  to existing field lists / batch issue-meta), never one request per row.
- Exact spacing values per density, icon sizing approach, which rows get status.

### Specifics (user preferences)
- One row = one line at every density; density changes padding/font only — never stack a second line.
- Page header consistency: standard top-left header bar (border-b, px-6 py-4).
- Colour = status only; detail pages avoid card panels.
- Italic text clipped by truncate → add pr-0.5.
- Hover affordances must not shift layout.
- Visual verification: screenshot via throwaway vite page + cached Chromium.

### Deferred Ideas
None listed.
</user_constraints>

## Summary

Both mechanisms already exist and are simple. **Density** = `data-density` attribute on `<html>` (set by `services/theme.ts:18-28`) plus two Tailwind custom variants at `src/index.css:10-11` (`density-compact:` / `density-comfortable:`; default tier has no attribute, so the unprefixed class is the default). **Text size** = `data-font-scale` on `<html>` changing the root font-size (`index.css:163-171`: sm 87.5%, md 100%, lg 112.5%, xl 125%). So **every rem-based Tailwind utility scales automatically**: `text-*`, `size-*`, `w-*`, `h-*`, `px/py-*`, `gap-*` (Tailwind v4 spacing = `calc(var(--spacing) * n)` with `--spacing: 0.25rem`). Only arbitrary `[..px]` values and numeric `size={N}` props passed straight to SVG/img ignore it. [VERIFIED: codebase]

The standup-notes folder is **already almost entirely rem-based** — grep found zero `[..px]` arbitrary values. The only px holdouts are `CachedAvatar size={20}`, which maps to `size-5` internally (`components/ui/cached-avatar.tsx:18-24`), so it already scales. The real problems are **inconsistency**, not px: MR rows use a 2x padding scale (`py-3/2/4`) vs issue rows (`py-1.5/1/2.5`); group wrappers add a second `[&>*]:py-2` padding layer on top of row padding; section spacing is fixed `mb-4 pt-4` (not density-aware) and the first section lacks `pt-4`; the SP chip uses `py-1` so rows with SP are taller than rows without; the transition arrow has no text size (inherits 1rem body size); section header text is `/60` muted at `text-sm`.

Status data: **Today rows already have it** (`fetchSprintIssues` requests `status`, `services/jira.ts:526`). **Yesterday rows do not** — `fetchIssueMeta` (`services/jira.ts:1153`) requests `fields=issuetype,summary,parent,subtasks`. Add `,status` to that field list (and to the parent follow-up request) and read `parent.fields.status` for rolled-up parents. `fetchIssueMeta` has exactly one consumer (`StandupNotesPage.tsx:454`), so there is no shared-fetcher cache-key blast radius.

**Primary recommendation:** Add `status` to `fetchIssueMeta` + `StandupIssueMeta`, thread `status` onto `IssueGroup`/`SubTaskSubGroup` in `buildGroups` (markdown generator untouched), render a trailing `statusPillClass` pill in `ActivityGroupHeader` and Today `IssueRow`, and normalise all row/section spacing to one density-aware scale. Fix `TodayColumn.test.tsx:175` (`getByText('In Progress')` will match both the section header and the new pill).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Density / font scale application | Browser (html attrs + CSS) | — | Already global; components only consume rem utilities + variants |
| Yesterday status data | API client (`services/jira.ts` fetchIssueMeta) | Page query (`StandupNotesPage.tsx:449`) | One batched JQL search already exists; add a field |
| Today status data | API client (`fetchSprintIssues`) | — | Already fetched; no change |
| Status → pill styling | `lib/statusStyles.ts` | — | Shared contract; do not add geometry |
| Markdown export | Pure functions in YesterdayColumn/TodayColumn | — | Must not change output |

## Standard Stack

No new packages. Uses existing: Tailwind v4 custom variants, `statusPillClass` (`lib/statusStyles.ts:91`), `IssueTypeIcon`, `CachedAvatar`, lucide-react icons. **Package Legitimacy Audit: N/A — no installs.**

## Findings

### 1. How density + fontScale work (copy these, don't invent)

| Mechanism | Where | Effect |
|-----------|-------|--------|
| `@variant density-compact (&:is([data-density="compact"] *))` | `src/index.css:10` | `density-compact:py-1` |
| `@variant density-comfortable (...)` | `src/index.css:11` | `density-comfortable:py-3` |
| `html[data-font-scale='sm'/'lg'/'xl'] { font-size: 87.5/112.5/125% }` | `src/index.css:163-171` | All rem utilities scale |
| Attribute writers | `services/theme.ts:18-43`, `routes/settings/AppearanceSection.tsx:34-42` | — |

**Reference rows to copy:**
- `routes/dashboard/BacklogRow.tsx:97-216` — every cell `py-2 density-compact:py-1 density-comfortable:py-3`, `text-sm` body, `text-xs` chips, `size-3.5` icons, chips `px-1 py-0.5 text-xs` (row height stays constant with or without chips). Title `flex-[1_1_auto] min-w-0` + `truncate`.
- `routes/my-tasks/MyTaskRow.tsx:236-245` — the trailing right cluster: `<div className="flex items-center gap-2 shrink-0">` → `<div className="flex shrink-0"><span className={statusPillClass(key)}>{name}</span></div>` → fixed-width slots (`w-12`) with **invisible placeholders** so columns align between rows that have/lack a value.

### 2. Audit of `routes/standup-notes/` (non-test)

No arbitrary-px values exist. Concrete issues:

| # | File:line | Issue | Fix |
|---|-----------|-------|-----|
| A1 | `TodayMrsSection.tsx:92`, `TodayParticipatingSection.tsx:74`, `StandaloneMrGroup.tsx:39` (non-dense branch) | MR rows use `py-3 density-compact:py-2 density-comfortable:py-4` — double the issue-row scale | Use the row scale `py-1.5 density-compact:py-1 density-comfortable:py-2.5` everywhere |
| A2 | `YesterdayColumn.tsx:772,799`, `TodayInProgressSection.tsx:219`, `TodayUpNextSection.tsx:229` | `[&>*]:py-2/1/3` wrapper padding stacks on top of row padding (group gap = wrapper + row) | Keep a group gap but make it explicit and small, e.g. `flex flex-col gap-1 density-compact:gap-0.5 density-comfortable:gap-2` instead of padding children; or keep wrapper but ensure the same pattern in all sections |
| A3 | `OtherCommitsGroup.tsx:19` | Uses `[&>*]:py-1.5/1/2.5` on children (row scale, but via wrapper, unlike all other rows which own their padding) | Move padding onto the row div so all rows are self-padded identically |
| A4 | `TodayInProgressSection.tsx:211` (`mb-4`) vs other sections `mb-4 pt-4` (`TodayUpNextSection.tsx:212`, `TodayMrsSection.tsx:66`, `TodayParticipatingSection.tsx:61`, `YesterdayColumn.tsx:770/794/817`) | Section spacing fixed (not density-aware) and first section differs | Wrap sections in `flex flex-col gap-6 density-compact:gap-4 density-comfortable:gap-8`; drop per-section `mb-4 pt-4` |
| A5 | `TodayInProgressSection.tsx:141`, `TodayUpNextSection.tsx:145` | SP chip `px-2 py-1 text-xs` → 1.5rem tall vs 1.25rem text-sm line → rows with SP are taller | Use BacklogRow chip `inline-flex w-7 justify-center rounded border border-border bg-muted px-1 py-0.5 text-xs font-medium` |
| A6 | `IssueActivityGroup.tsx:175` | Transition arrow `→` span has no text size (inherits 1rem) — larger than surrounding text-sm/xs | Add `text-xs` (or `text-sm`) |
| A7 | `StandupSectionHeader.tsx:24-26` | `text-sm` header at `/60` opacity; count same size | Fine for fontScale (rem). Optional polish: `text-xs font-semibold uppercase tracking-wide text-muted-foreground` is NOT the app style — keep text-sm; `mb-2/1/3` already density-aware |
| A8 | `IssueActivityGroup.tsx:233`, Today rows `:129/133` | Key `text-xs font-mono` — fine; scales | none |
| A9 | `StandupPageHeader.tsx:61-68` | Header is correct per memory (summary-line pages use `h1 text-3xl font-semibold`, like `MyTasksPage.tsx:755`, `ReleasesHero.tsx:59`). Missing `shrink-0 gap-4` / `min-w-0` that ReleasesHero has (`ReleasesHero.tsx:57-58`) | Add `shrink-0 gap-4` on header, `min-w-0` on left block; keep text-3xl |
| A10 | `YesterdayColumn.tsx:703`, `TodayColumn.tsx:310` | Column h2 `text-2xl` — rem, scales; consistent between columns | Keep |
| A11 | `CachedAvatar size={20}` (`TodayInProgressSection.tsx:149`, `TodayUpNextSection.tsx:153`, `WatchedPersonPicker.tsx:109,144`) | Maps to `size-5` (rem) — already scales. Only the unassigned fallback `<User size={px}>` inside the shared component is px | Leave; do NOT edit shared `cached-avatar.tsx` for this task |
| A12 | `TodayInProgressSection.tsx:76`/`TodayUpNextSection.tsx:80` `Progress className="w-20"` | rem, scales. But ProgressBar returns `null` when no estimate → right-cluster width varies per row → pills would not align | Render a fixed-width slot (invisible placeholder) when no estimate, per MyTaskRow pattern |
| A13 | Icons `size-4` everywhere | rem → scales with fontScale. OK. Header Calendar `size-3.5` with text-xs OK | none |

### 3. Status data per row type

| Row | Data source | Status available? | Action |
|-----|-------------|-------------------|--------|
| Yesterday issue group header (`IssueActivityGroup` → `ActivityGroupHeader`) | `buildGroups` from tempo/activity/commits/MR + `issueMeta` | **No** | Add to `fetchIssueMeta` |
| Yesterday sub-task sub-header | `issueMeta[key]` (`YesterdayColumn.tsx:559-564`) | **No** | Same |
| Yesterday sub-items (worklog, commit, MR comment...) | — | n/a | No pill (activity lines, not issues) |
| Yesterday standalone MR / Other commits | GitLab | n/a | No pill |
| Today In Progress / Up Next `IssueRow` (parent + subtask) | `fetchSprintIssues`, fields include `status` (`services/jira.ts:526`) | **Yes** — `issue.fields.status.name` + `.statusCategory?.key` (already read at `TodayInProgressSection.tsx:130`) | Render pill |
| Today nested MR rows, MRs Awaiting You, Participating | GitLab MR data (no Jira issue) | n/a | No pill (Participating is MR-only despite CONTEXT listing it) |

**Cheapest fetch (no per-row requests):** in `services/jira.ts`:
1. `fetchIssueMeta` main request (line 1162): `fields=issuetype,summary,parent,subtasks` → append `,status`. Keep the existing prefix order — `services/jira-standup.test.ts` asserts `toContain('fields=issuetype,summary,parent')`.
2. Extend the response type with `status?: { name: string; statusCategory?: { key: string } }` and `parent.fields.status?` — Jira's `parent` field carries `fields.status` (already relied on at `routes/dashboard/IssueDetailContent.tsx:178`).
3. Extend `StandupIssueMeta` (line 1128) with `statusName?`, `statusCategoryKey?`, `parentStatusName?`, `parentStatusCategoryKey?` (flat optional fields keep existing `toMatchObject` tests green).
4. Parent follow-up request (line 1203) `fields=subtasks` → `fields=subtasks,status`, and merge status into `map[p.key]` alongside `subtaskKeys` (test asserts `toContain('fields=subtasks')` — still passes).
5. In `buildGroups.resolveRollup` / `ensureGroup` (`YesterdayColumn.tsx:320-354`), carry status: for a rolled-up subtask use `meta.parentStatus*`; for own key use `meta.status*`; also upgrade on later calls if the existing group lacks status (same pattern as summary/type upgrade at line 338-341). Prefer `issueMeta[rollupKey].status*` when the parent itself was fetched. Sub-task groups (line 559): `status: issueMeta?.[key]?.statusName`.
6. Add optional `statusName?/statusCategoryKey?` to `IssueGroup`, `SubTaskSubGroup`, and `IssueActivityGroupProps`. `generateMarkdown` never reads them → output unchanged.

**Cache-key pitfall check:** `fetchIssueMeta` is only called from `StandupNotesPage.tsx:454` (query key `['standup','issue-meta',jiraBaseUrl,referencedKeys]`); no other consumer is affected. `fetchSprintIssues` is shared but needs no change. Note `staleTime: 60 * 60 * 1000` on issue-meta (`StandupNotesPage.tsx:457`) — status could be up to 1h stale; Refresh button already refetches the `['standup']` prefix (`StandupNotesPage.tsx:466`). Recommend lowering to `5 * 60 * 1000` (matches neighbouring standup queries) since status is now volatile data. While meta is loading, render no pill (do not render a placeholder that flashes "To Do").

### 4. Trailing pill layout pattern

```tsx
// Today IssueRow (div[role=button] flex row) — summary truncates first, cluster never shrinks
<span className="flex-1 min-w-0 truncate text-sm">{summary}</span>
<div className="flex shrink-0 items-center gap-2">
  <div className="flex shrink-0">
    <span className={statusPillClass(issue.fields.status.statusCategory?.key)}>
      {issue.fields.status.name}
    </span>
  </div>
  {/* SP slot w-12 with invisible placeholder; progress slot fixed width with placeholder; avatar */}
</div>
```

```tsx
// ActivityGroupHeader (overlay-button pattern, IssueActivityGroup.tsx:220-241):
// pill MUST be pointer-events-none + relative so clicks fall through to the inset-0 overlay
// and it paints above the overlay's stacking position.
{statusName && (
  <div className="pointer-events-none relative flex shrink-0">
    <span className={statusPillClass(statusCategoryKey)}>{statusName}</span>
  </div>
)}
```

- `STATUS_PILL_LAYOUT_CLASS` (`lib/statusStyles.ts:84-85`) = `shrink-0 min-w-[5.5rem] whitespace-nowrap text-center rounded px-1.5 py-0.5 text-xs font-medium` — `min-w-[5.5rem]` is rem, so pills scale with fontScale. Height = 1rem + 0.25rem = 1.25rem = text-sm line-height → pill does not change row height.
- Do not add any geometry to the span (contract comment at `statusStyles.ts:74-79`).
- Long status names (> 5.5rem) widen the pill; whitespace-nowrap + shrink-0 means the summary absorbs it — correct per locked decision.
- Sub-task header pills: sub-task header sits in `pl-6 ml-2` but spans full width, so its pill's right edge aligns with the parent header pill. Good.

## Common Pitfalls

1. **Test collision** — `TodayColumn.test.tsx:175` `screen.getByText('In Progress')`: fixture status name for `indeterminate` is `'In Progress'` (`TodayColumn.test.tsx:113-118`), so the new pill makes `getByText` throw "multiple elements". Change to `getByRole('heading', { name: 'In Progress' })` (section header is an `<h3>`). Grep other tests for `getByText('To Do'|'Done'|'In Progress')` after implementing.
2. **Markdown output must not change** — `generateMarkdown` (`YesterdayColumn.tsx:222-281`) and `generateTodayMarkdown` (`TodayColumn.tsx:86+`) are covered by `YesterdayColumn.test.ts` (5 describe blocks) and `TodayColumn.markdown.test.ts`. Add status only as new optional fields; never touch `label` (comment at `YesterdayColumn.tsx:402`).
3. **statusPillClass needs a flex parent** — always wrap in `<div className="flex shrink-0">`.
4. **Overlay button z-order** — in `ActivityGroupHeader`, siblings are `relative`; the key button is `relative z-10`. The pill must be `pointer-events-none relative` (not z-10) or it will swallow clicks / sit under the overlay.
5. **WebKit (Tauri) flex quirks** — no `min-w-[min(x,max-content)]` (dropped by WebKit); use fixed-length floors only. Use `flex-1 min-w-0` + `truncate` on the summary, `shrink-0` on the cluster. If the right cluster has zero-width risk, give slots explicit widths (`w-12`) as MyTaskRow does.
6. **Italic + truncate** — no italic text currently on this page; if any is introduced, add `pr-0.5`.
7. **React Compiler** — the app compiles with React Compiler; vitest doesn't. Pass status as data through props/`buildGroups` return values; never derive it from a module-level mutable lookup. `issueMeta={issueMetaQuery.data ?? {}}` (`StandupNotesPage.tsx:584`) creates a new `{}` each render while loading — pre-existing, harmless, but don't add memo deps that rely on its identity.
8. **Hover affordance no layout shift** — the header ChevronDown (`YesterdayColumn.tsx:705`) is opacity-only, already correct; keep it.
9. **Pre-commit hook** runs `biome check --staged`, `tsc --noEmit`, and the full `npm run test` (`taskflow/.husky/pre-commit`) — every commit must be green; fold test updates into the same commit as the behaviour change. Don't run `biome --write` on all of `src`.
10. **One row = one line** — never let the pill/cluster wrap to a second line; no `flex-wrap` on rows.

## Validation Architecture

| Property | Value |
|----------|-------|
| Framework | vitest (run from `/Users/mimo/Documents/Projects/taskflow/taskflow`) |
| Quick run | `npx vitest run src/routes/standup-notes src/services/jira-standup.test.ts` |
| Full suite | `npm run test` (also run by pre-commit) |
| Lint/types | `npx biome check <changed files>` and `npx tsc --noEmit` |

| Behaviour | Test | File |
|-----------|------|------|
| fetchIssueMeta requests + maps status (own + parent + follow-up) | unit, extend existing | `src/services/jira-standup.test.ts` (~line 545-690) |
| Yesterday header shows status pill from issueMeta; sub-task header too | new render test (IssueActivityGroup props or YesterdayColumn render with issueMeta) | new `IssueActivityGroup.test.tsx` (Wave 0) |
| Today row shows status pill | extend | `TodayColumn.test.tsx` (fix line 175 first) |
| Markdown unchanged | existing | `YesterdayColumn.test.ts`, `TodayColumn.markdown.test.ts` |
| Visual (density x fontScale, both themes) | manual | throwaway vite preview page + cached Playwright Chromium `--headless=new --screenshot`, set `data-density` / `data-font-scale` on `<html>`; delete afterwards |

## Security Domain

Not materially applicable: read-only display of data already fetched with the user's Jira PAT; adding a field to an existing JQL search. Token stays out of query keys (existing T-62-06 rule). JQL keys come from regex-extracted issue keys (existing behaviour, unchanged).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Jira search response's `parent.fields.status` is populated when `parent` is requested | Findings 3 | Rolled-up parent shows no pill until parent key is in referencedKeys; mitigated by follow-up request also fetching `status` — but the follow-up only fires for parents not in keys, which is exactly this case, so coverage is complete either way |

Evidence for A1: `IssueDetailContent.tsx:178` already reads `parent?.fields.status`; and the follow-up request makes it redundant anyway.

## Sources

### Primary (HIGH)
- `taskflow/src/index.css:10-11,163-171`; `services/theme.ts:18-43`; `stores/settings.store.ts:16-17,42-43`
- `lib/statusStyles.ts:74-93`; `routes/my-tasks/MyTaskRow.tsx:236-260`; `routes/dashboard/BacklogRow.tsx:97-216`
- `services/jira.ts:526,1128-1222`; `routes/standup-notes/*.tsx` (all read); `StandupNotesPage.tsx:427-470`
- `services/jira-standup.test.ts:545-690`; `TodayColumn.test.tsx:100-176`; `TodayMrsSection.test.tsx:47-91`; `.husky/pre-commit`
- User memory notes: statuspill flex parent, page header consistency, backlog flex-shrink, React Compiler, pre-commit

## Metadata
- Standard stack: HIGH (no new deps)
- Architecture: HIGH (single fetcher, single consumer verified)
- Pitfalls: HIGH (test collision verified by reading fixture)

**Valid until:** 2026-12-02
