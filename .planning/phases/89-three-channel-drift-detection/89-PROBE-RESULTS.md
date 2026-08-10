# Phase 89 Probe Results — Assumption A2 (Channel C pagination-completeness)

## Raw output

```
==================== PHASE 89 PROBE RESULTS ====================
base=https://git.devel.sun.orange.sk  project=455

----- PROBE A: list-endpoint field shape (target_branch, draft) -----
[
  "assignee",
  "assignees",
  "author",
  "blocking_discussions_resolved",
  "closed_at",
  "closed_by",
  "created_at",
  "description",
  "detailed_merge_status",
  "discussion_locked",
  "downvotes",
  "draft",
  "force_remove_source_branch",
  "has_conflicts",
  "id",
  "iid",
  "imported",
  "imported_from",
  "labels",
  "merge_after",
  "merge_commit_sha",
  "merge_status",
  "merge_user",
  "merge_when_pipeline_succeeds",
  "merged_at",
  "merged_by",
  "milestone",
  "prepared_at",
  "project_id",
  "reference",
  "references",
  "reviewers",
  "sha",
  "should_remove_source_branch",
  "source_branch",
  "source_project_id",
  "squash",
  "squash_commit_sha",
  "squash_on_merge",
  "state",
  "target_branch",
  "target_project_id",
  "task_completion_status",
  "time_stats",
  "title",
  "updated_at",
  "upvotes",
  "user_notes_count",
  "web_url",
  "work_in_progress"
]
target_branch: PRESENT
draft: PRESENT

----- PROBE B: release branches + MR counts targeting each (DRIFT-03 core) -----
release/* branches found: 1
release/33.7.0

  release/33.7.0: 8 MRs (X-Total header: 8)

----- PROBE C: synthetic fixture note -----
If Probe B shows no release/* branch with >100 targeting MRs, the roadmap's
alternative instruction applies: build a synthetic >100-MR fixture in the unit
test suite (driftDetection.test.ts / gitlab pagination test) to prove the LOOP
MECHANISM is correct, since live data cannot prove it empirically. This is a
unit-test-level proof (mock apiFetch returning >1 page), not a live-data proof —
record which path was taken in the phase's VERIFICATION.md.

==================== END ====================
```

## Resolution

A2: RESOLVED — `target_branch: PRESENT` and `draft: PRESENT` on the GitLab MR list endpoint. No plan revision needed; Task 2 and Task 3 proceed as written.

## Channel C max MR count

Max per-branch MR count: 8 (`release/33.7.0`, the only `release/*` branch present on the live project). No branch exceeds a single page (100).

Proof path: synthetic multi-page fixture — live data cannot prove the pagination loop empirically at this volume (only 8 MRs on the sole release branch). This choice is recorded here so the phase verifier can carry it into `VERIFICATION.md`.
