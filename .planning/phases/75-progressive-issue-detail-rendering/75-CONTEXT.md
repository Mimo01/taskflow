# Phase 75: Progressive Issue Detail Rendering - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminate the "blank panel until everything loads" feeling on the Jira issue detail page (`IssueDetailPage` at `/issue/:key`). Render each section (header, description, fields, attachments, links, comments, subtasks, activity/changelog) as soon as its own data resolves, instead of blocking the entire panel on a single global `isLoading` gate.

**Stays entirely on Jira REST v2.** This is NOT a GreenHopper `details.json` migration (PERF-DETAIL-03 / GH-CUT-01 explicitly keep the detail panel on REST). All existing mutations and features must keep working unchanged.

**In scope:** the full-page `IssueDetailPage` only (the Epic `isEpic` branch shares `IssueDetailContent` and benefits automatically).

**Out of scope:** any GreenHopper migration of the detail panel; the legacy `IssueDetailSheet` slide-out (dead code — see deferred); new detail-panel capabilities.
</domain>

<decisions>
## Implementation Decisions

### Fetch Decomposition
- **D-01:** Split the single `fetchIssueDetail` call into a slim **base fetch + 3 independent follow-up queries**. The base `/issue/{key}` fetch carries header (title/key/status/assignee), description, custom fields, attachments, and issue links — all embedded in one cheap payload, so they render together as soon as the base resolves.
- **D-02:** Move the three slow/sequential paths to their own queries so they no longer gate the base paint:
  - **Comments** — own request (e.g. `/issue/{key}/comment`), currently embedded via `fields.comment`.
  - **Subtasks (enriched)** — own query for the secondary JQL search that enriches subtask assignees (currently a follow-up search inside `fetchIssueDetail` at `services/jira.ts:1546-1574`).
  - **Changelog / activity** — own request, currently pulled via `expand=changelog` on the base call.
- **D-03:** Worklogs (`fetchFullWorklogs`), epic stories (`fetchEpicStories`), and AIO test runs are already independent queries — leave them as-is; they fold naturally into the progressive model.
- **D-04:** Do NOT over-split. Description / fields / attachments / links stay on the base fetch (rejected the "every section its own request" and "header-only base" options — they add round-trips for data that already arrives cheaply together).

### Skeleton & Layout Behavior
- **D-05:** Reserve layout space — each pending section shows a localized skeleton at roughly its final size so resolved content fills the same slot. No content jump / layout shift as sections arrive (rejected free reflow).
- **D-06:** Gate every section skeleton through the existing `useDelayedLoading(isPending, 200)` hook so fast sections (cache hits, quick resolves) never flash a skeleton. Reuse the existing `Skeleton` primitive — build per-section skeletons only where none exist yet (comments, subtasks, description currently have none; `ActivityTimeline` already has one but it's unreachable today behind the global gate).

### Per-Section Error Handling
- **D-07:** Each section that fails shows a small **inline error with a retry affordance**, while every other section stays fully functional — mirrors the Phase 69 standup independent-degradation pattern.
- **D-08:** The **base issue fetch** is the one exception: if it fails, surface a panel-level error (nothing meaningful can render without the core issue). Only the base fetch may blank the panel.

### Scope
- **D-09:** Apply progressive rendering to the canonical full-page `IssueDetailPage` only. The Epic `isEpic` branch shares `IssueDetailContent`, so it benefits automatically. Do not touch the legacy `IssueDetailSheet`.

### Claude's Discretion
- Exact query-key naming, hook structure (e.g. a `use-issue-detail-sections` hook vs. inline queries), and skeleton dimensions per section are left to research/planning.
- Section render order in the JSX is flexible as long as the header paints first and each section is independently gated. The verification artifact (GH-CUT-02) should document which section ends up gating "fully loaded."
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — PERF-DETAIL-01/02/03, GH-CUT-01/02 (lines 30-43). PERF-DETAIL-03 and GH-CUT-01 lock the panel on REST v2 (no GreenHopper migration).
- `.planning/ROADMAP.md` §"Phase 75" — goal, 4 success criteria, the perf-verification artifact requirement.

### Implementation surfaces (existing code to modify)
- `taskflow/src/routes/dashboard/IssueDetailPage.tsx` — the global `isLoading` gate to dismantle (line ~377: `{isLoading || !issue ? <IssueDetailSkeleton/> : ...}`); main query at lines 77-92; worklogs query 247-256; full-panel `IssueDetailSkeleton` 626-643.
- `taskflow/src/routes/dashboard/IssueDetailContent.tsx` — left-column renderer (header, description, attachments, subtasks, epic stories). Shared by the Epic branch.
- `taskflow/src/routes/dashboard/issue-detail/ActivityTimeline.tsx` — already has a localized skeleton (lines 123-131) currently unreachable; comments + changelog + worklogs live here.
- `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx`, `AttachmentsSection.tsx`, `LinkedIssuesSection.tsx`, `IssueDetailSidebar.tsx` — section components.
- `taskflow/src/services/jira.ts` — `fetchIssueDetail` (lines 1486-1577), the combined fetch + subtask-enrichment JQL search to decompose.
- `taskflow/src/services/jira/worklogs.ts` — `fetchFullWorklogs` (already independent).

### Reusable infra
- `taskflow/src/hooks/useDelayedLoading.ts` — 200ms flash-prevention hook (D-06).
- `taskflow/src/components/ui/skeleton.tsx` — base `Skeleton` primitive.
- `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSkeleton.tsx` — existing per-section skeleton; good shape reference.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useDelayedLoading(isPending, 200)`: already used in `AioTestRunsSection`; extend usage to every newly-independent section.
- `Skeleton` component + `AioTestRunsSkeleton`: pattern to copy for comments/subtasks/description skeletons.
- TanStack Query with `gcTime: Infinity` (v1.7): stale-while-revalidate already in place — re-opening a recently-viewed issue shows cached sections instantly; the progressive split composes with this.

### Established Patterns
- Multiple parallel `useQuery` calls already exist in the panel (worklogs, epic stories, AIO, GitLab MRs) — the phase generalizes this to comments/subtasks/changelog rather than introducing a new fetching paradigm.
- Phase 69 standup: "each section loads independently with per-section states; one slow/failed source doesn't blank the view" — the direct precedent for D-07/D-08.
- Token never in query keys (read inside `queryFn`) — keep this convention for the new section queries.

### Integration Points
- The crux change is removing the single `isLoading || !issue` gate at `IssueDetailPage.tsx:~377` and pushing loading state down into each section, keyed off its own query's `isPending`.
- All existing mutations (edit fields, post/edit/delete comment, worklog CRUD, watcher toggle, clone, pin, open-in-Jira, attachment upload) must continue to work and invalidate correctly against the newly-split query keys (PERF-DETAIL-03).
</code_context>

<specifics>
## Specific Ideas

- The verification artifact (GH-CUT-02 / success criterion 4) must record before/after **time-to-first-meaningful-paint** (header visible) and **time-to-fully-interactive**, plus per-section latencies and which section gates "fully loaded." Plan should bake measurement in, not bolt it on.
- Header must paint the instant the base fetch resolves — it is the explicit first-paint target (PERF-DETAIL-01).
</specifics>

<deferred>
## Deferred Ideas

- **Delete dead `IssueDetailSheet`** — the legacy 75vw slide-out (`taskflow/src/routes/dashboard/IssueDetailSheet.tsx`) is no longer mounted anywhere (only referenced in comments). A cleanup/tech-debt task, not part of this phase.
- **Prefetch-on-hover for the `/issue/:key` route** — sidebar/list prefetch warming (v1.7 pattern) could further cut perceived latency, but is a separate optimization beyond the progressive-render scope.

</deferred>

---

*Phase: 75-progressive-issue-detail-rendering*
*Context gathered: 2026-05-30*
