# Phase 75: Progressive Issue Detail Rendering - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 75-progressive-issue-detail-rendering
**Areas discussed:** Fetch decomposition, Skeleton & layout behavior, Per-section error handling, Scope (which panels)

---

## Fetch Decomposition

| Option | Description | Selected |
|--------|-------------|----------|
| Base + 3 follow-ups | Slim base /issue fetch (header+description+fields+attachments+links); comments, subtasks (enrichment JQL), and changelog each get their own query | ✓ |
| Granular — every section its own request | Description/fields/attachments/links also separate calls — more round-trips for cheap embedded data | |
| Base header-only + everything else deferred | Base returns only header; description/fields/attachments become follow-ups — cheap data flashes skeletons | |

**User's choice:** Base + 3 follow-ups
**Notes:** Targets the actual blockers — the embedded payload (description/fields/attachments/links) is cheap and renders together with the header; only comments, subtask-assignee enrichment, and changelog are slow/sequential.

---

## Skeleton & Layout Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Reserve space, fill in place | Localized skeleton at ~final size per section; content fills the same slot; no layout shift; useDelayedLoading(200ms) avoids flash | ✓ |
| Reflow as sections arrive | Sections appear and push content down as each resolves; simpler but jumpy | |

**User's choice:** Reserve space, fill in place
**Notes:** Reuse existing `useDelayedLoading(200ms)` and `Skeleton` primitive.

---

## Per-Section Error Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Independent inline error + retry | Failed section shows inline error+retry; rest stays functional; base fetch failure still shows panel-level error | ✓ |
| Inline error message, no retry | Message only; reopen to retry | |
| Keep current behavior on error | Any failure surfaces at panel level as today | |

**User's choice:** Independent inline error + retry
**Notes:** Mirrors Phase 69 standup independent-degradation pattern. Base issue fetch is the sole exception that may blank the panel.

---

## Scope (which panels)

| Option | Description | Selected |
|--------|-------------|----------|
| Full-page IssueDetailPage only | Canonical route; Epic isEpic branch benefits via shared IssueDetailContent; legacy Sheet untouched | ✓ |
| Page + legacy Sheet | Also rewire IssueDetailSheet — more paths to change/test | |
| You decide | Determine from usage | |

**User's choice:** Full-page IssueDetailPage only
**Notes:** Codebase grep confirmed `IssueDetailSheet` is dead code — no longer mounted anywhere (only referenced in comments). The live surface is `IssueDetailPage` at `/issue/:key`. Sheet deletion noted as a deferred cleanup task.

---

## Claude's Discretion

- Query-key naming, hook structure (dedicated sections hook vs. inline queries), and exact skeleton dimensions per section.
- Section render order in JSX, provided the header paints first and each section is independently gated.

## Deferred Ideas

- Delete dead `IssueDetailSheet` (legacy slide-out, no longer mounted) — tech-debt cleanup.
- Prefetch-on-hover for the `/issue/:key` route — separate optimization beyond progressive-render scope.
