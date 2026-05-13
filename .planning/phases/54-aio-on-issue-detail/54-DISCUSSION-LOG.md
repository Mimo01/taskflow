# Phase 54: AIO on Issue Detail - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 54-aio-on-issue-detail
**Areas discussed:** Issue lookup strategy, Multi-cycle run scope, Step failure markers, Step attachment UX

---

## Issue lookup strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — test cases are linked to Jira issues | AIO has built-in Jira issue linking; researcher can probe GET /testcase?issueKey= | ✓ |
| No / not sure | No explicit linking; researcher inspects raw run response for issue key field | |

**User's choice:** Yes — test cases are linked to Jira issues
**Notes:** Confirms a direct API path exists. Researcher must probe `GET /testcase?issueKey=PROJ-123` to verify endpoint and response shape.

---

| Option | Description | Selected |
|--------|-------------|----------|
| All cycles — fetch every run for this issue's test cases | Comprehensive history; potentially many API calls | |
| Only active/latest cycle | Just the most recent open cycle; cleaner, faster | ✓ |
| Let Claude decide | Claude picks practical strategy | |

**User's choice:** Only active/latest cycle
**Notes:** Section shows runs from the latest active cycle only.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Hide the section entirely | Hidden = no runs; matches success criteria | |
| Show an empty state message | "No test runs in active cycle" for cases where test cases exist but no execution yet | ✓ |
| Let Claude decide | Apply success criteria default | |

**User's choice:** Show an empty state message
**Notes:** Two-state distinction: (1) No AIO test cases linked → section hidden; (2) Test cases linked but no runs in active cycle → empty state message.

---

## Multi-cycle run scope

| Option | Description | Selected |
|--------|-------------|----------|
| All active cycles (grouped) | Multiple sections, one per active cycle | |
| Most recently created active cycle only | Single section, highest sequence number | |
| Let Claude decide | Claude picks the simplest strategy | ✓ |

**User's choice:** Let Claude decide
**Notes:** Claude decision: latest active cycle by key sequence number (highest PROJ-CY-N). Consistent with Agile sprint patterns.

---

## Step failure markers

| Option | Description | Selected |
|--------|-------------|----------|
| Status column with colored chip per step | Pass/Fail/Blocked/Not Run chip; reuses Phase 53 chip style | ✓ (via "you decide" → Claude picked this) |
| Colored row indicator (left border or background tint) | No status column; subtle visual | |
| Both — chip + row tint | Most visual, most noise | |

**User's choice:** "you decide" (freeform Other)
**Notes:** Claude chose per-step status chip — clearest at a glance, reuses existing chip pattern from Phase 53.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Show actual column always, empty for Not Run steps | Full table structure visible | |
| Only show actual column for executed steps | Conditional hiding | |
| Let Claude decide | Always show column | ✓ |

**User's choice:** Let Claude decide
**Notes:** Claude decision: always show actual column, `—` for not-run steps.

---

| Option | Description | Selected |
|--------|-------------|----------|
| One run per group — each test case gets its own collapsible run block | Grouped by test case; expandable | |
| Flat step table — just show the first/most relevant run's steps | Single table | |
| Let Claude decide | Group when multiple, flat when single | ✓ |

**User's choice:** Let Claude decide
**Notes:** Claude decision: collapsible block per test case when multiple; flat table when only one. Fail/Blocked blocks expanded by default.

---

## Step attachment UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline thumbnail — small preview image in the row | ~48px thumbnail in actual cell; AuthImage handles auth | ✓ |
| Icon only — paperclip/image icon | No preview; lighter table | |
| Let Claude decide | Claude picks thumbnail | |

**User's choice:** Inline thumbnail
**Notes:** Thumbnails in/below the actual cell.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Show all thumbnails inline (side by side) | All images visible per step | ✓ |
| Show first thumbnail + count badge | One thumbnail + "+N" badge; AttachmentLightbox navigation | |
| Let Claude decide | First + badge for >1 | |

**User's choice:** Show all thumbnails inline (side by side)

---

| Option | Description | Selected |
|--------|-------------|----------|
| ImageLightbox per thumbnail (simple, no navigation) | Each thumbnail opens independently; no adapter needed | ✓ |
| AttachmentLightbox with navigation | Multi-image navigation; requires adapter for JiraAttachment type | |
| Let Claude decide | ImageLightbox per thumbnail | |

**User's choice:** ImageLightbox per thumbnail
**Notes:** Simplest path; AuthImage handles auth; step attachments are typically one screenshot per step.

---

## Claude's Discretion

- **Multi-cycle selection:** Latest active cycle by key sequence (highest PROJ-CY-N number)
- **Actual column:** Always shown, `—` for not-run steps
- **Multi test-case layout:** Collapsible run block per test case when multiple; flat table when one
- **Fail/Blocked auto-expand:** Run blocks with Fail/Blocked status expanded by default; Pass collapsed
- **Section heading:** "AIO Test Runs" with `FlaskConical` icon (consistent with AIO sidebar icon)
- **Section placement:** Below `ActivityTimeline` in `IssueDetailPage.tsx`
- **Loading:** Auto-loads in parallel, `useDelayedLoading` 200ms skeleton threshold
- **Thumbnail placement:** Below actual result text in the Actual cell (stacked layout)

## Deferred Ideas

- Historical run data across all cycles ("View full history") — user chose latest cycle only
- Multi-image lightbox navigation within a step's attachments — user chose independent per-thumbnail ImageLightbox
- Write actions (update run status from issue detail) — explicitly out of scope per REQUIREMENTS.md AIOWR-01
