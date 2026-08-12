# Requirements: Taskflow v1.14 Release Management

**Defined:** 2026-08-10
**Core Value:** Developers and PMs can see everything they need — tasks, MRs, sprint state, notifications, and test execution health — in one place, without switching between Jira, GitLab, and AIO.

**Milestone goal:** Turn the Releases view from a read-only Jira↔GitLab date-match into a working release-coordination surface that detects git-flow drift and lets the user fix it per-MR.

## v1.14 Requirements

### Foundation

- [x] **FOUND-01**: `ReleaseDetailPage.tsx` (1518 LOC) is decomposed into a `release-detail/` folder mirroring the existing `issue-detail/` precedent, with zero user-visible behavior change

### Release Branch

- [x] **RELBR-01**: Release branch name resolves as `release/<milestone title>` from the matched GitLab milestone (`release/` prefix hardcoded)
- [x] **RELBR-02**: User sees whether the release branch exists on the release detail view
- [x] **RELBR-03**: User sees a release-level warning when the release branch is missing
- [x] **RELBR-04**: User can create the missing release branch off the GitLab project default branch, behind a confirm dialog
- [x] **RELBR-05**: Branch name is validated against git ref rules before creation (milestone titles may contain spaces, slashes, or unicode)

### Release Milestone

- [x] **RELMS-01**: User sees when no GitLab milestone matches the Jira fix version
- [x] **RELMS-02**: User can create a GitLab milestone from the release view, behind a confirm dialog
- [x] **RELMS-03**: The create dialog lists the latest existing milestones for reference and lets the user type the final name (format `1.1.0`, `2.0.0`)
- [x] **RELMS-04**: Duplicate milestone title is detected and blocked before creation

### Drift Detection

- [x] **DRIFT-01**: Channel A — MRs are discovered via the Jira issue keys of the fix version's issues
- [x] **DRIFT-02**: Channel B — MRs are discovered via the GitLab milestone
- [x] **DRIFT-03**: Channel C — MRs are discovered via target branch equal to the release branch, using a fully paginated fetch
- [x] **DRIFT-04**: The three channels union into a single MR set that retains per-channel provenance
- [x] **DRIFT-05**: An MR is flagged when its target branch is not the release branch
- [x] **DRIFT-06**: An MR is flagged when the release milestone is not assigned to it
- [x] **DRIFT-07**: An MR is flagged when its Jira task is not in the fix version
- [x] **DRIFT-08**: Merged, closed, and draft MRs are classified so they do not pollute drift counts
- [~] **DRIFT-09**: ~~The release row shows an aggregate drift count~~ — **DESCOPED 2026-08-11** by user at UAT: drift information is wanted on the release detail page only, not the Releases list. Built in Phase 89 (plan 89-04), then removed along with its now-dead `computeRowDriftCount` and `fetchOpenProjectMRs` helpers. Not a gap.

### Per-MR Corrective Actions

- [x] **MRFIX-01**: User can retarget an MR to the release branch from its row — applies directly with optimistic update and rollback, no confirm dialog and no warning
- [x] **MRFIX-02**: User can assign the release milestone to an MR from its row — applies directly with optimistic update and rollback
- [x] **MRFIX-03**: Each corrective action shows per-row status and can be retried independently of the other
- [x] **MRFIX-04**: Retarget is unavailable while the release branch does not exist

### Merge-Back Verification

- [x] **MERGE-01**: Once the Jira fix version is marked released, user sees whether `release/[tag]` has been merged back into the project default branch
- [x] **MERGE-02**: Detection prefers the tracking MR's state and falls back to content comparison when no such MR exists
- [x] **MERGE-03**: The verdict is presented as advisory with a manual override

### Epics Page Redesign (Phase 91.2, inserted)

Derived from the ROADMAP Phase 91.2 success criteria as narrowed by `91.2-CONTEXT.md` decisions D-05…D-18. Criterion 2 (quick search) is cut in full by D-18; criterion 4's labels/components half is cut by D-08; criterion 5's blocked/flagged half is cut by D-12 — those cuts are intentional descopes, not gaps.

> Note: `src/services/jira.test.ts` and `EpicsPage.test.tsx` already carry legacy `EPIC-01` / `EPIC-03` test labels from Phase 13 (`fetchEpicsWithEnrichment`). The IDs below are the Phase 91.2 requirement IDs; the label collision is cosmetic and does not affect traceability.

- [ ] **EPIC-01**: Epics render in creation-ascending order (`ORDER BY created ASC`, equivalent to key order) and the order never re-shuffles while enrichment data streams in (D-17)
- [x] **EPIC-02**: The epic row is a single-line div+flex row with column order key → name → status → priority → progress → points → assignee, staying one line at every density, with no column collapsing to zero width in the Tauri/WebKit webview (D-05, D-06, D-07, D-09)
- [ ] **EPIC-03**: Story progress and points load progressively behind first paint, with all four enrichment cell states: pending shimmer, success, "No stories", and error + click-to-retry (D-04, D-14, D-15, D-16)
- [ ] **EPIC-04**: Each row shows the epic's priority via the existing `PriorityIcon` for the project's 9-level scheme — icon only, name in `title`/alt (D-10; labels/components half descoped by D-08)
- [ ] **EPIC-05**: Each row exposes a three-segment child-status breakdown (To Do / In Progress / Done by Jira status category) as one visual with `done/total` beside it and per-status counts revealed on hover (D-11; blocked/flagged half descoped by D-12)
- [ ] **EPIC-06**: Story points render as `done/total SP`, backed by a new `donePoints` aggregate in `fetchEpicEnrichmentMap` (D-13)
- [x] **EPIC-07**: Preserved behaviour — row click still opens `EpicDetailSheet`, the skeleton / error / stale-banner states, density variants and "+ Create Epic" are unchanged, no search UI is added (D-18) — and the dead `src/services/jira/epics.ts` module is removed

## Future Requirements

Deferred. Tracked but not in the v1.14 roadmap.

### Release Coordination

- **RELF-01**: Freeze-window visibility (what may still merge into the release branch)
- **RELF-02**: Cherry-pick tracking between the release branch and the default branch
- **RELF-03**: Bulk "fix all drift" action — deliberately excluded from v1.14 in favour of per-MR control; revisit only if per-MR proves too slow in practice

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| GitLab permission/role gating for write buttons | User confirmed the whole team holds Developer or above; gating would be dead code. 403s still surface as normal errors via the existing `ApiError` path |
| Fork-MR handling in drift channels | User confirmed the team does not use forks; drift logic may assume same-project MRs |
| Bulk "fix all" corrective action | User explicitly chose per-MR actions; bulk removes the per-row review step that makes team-visible writes safe |
| Silent auto-retarget / auto-assign / auto-merge-back | Release-branch writes are team-visible and hard to undo; every write stays user-initiated |
| Inline approval-reset warning on retarget | Retargeting does reset regular approvals (GitLab docs, issue #415496), but user reviewed the evidence and chose a direct action with no warning |
| Configurable integration-branch / release-prefix settings | `develop` is the GitLab project default branch (read from the API) and `release/` is hardcoded per user decision |
| Historical analytics / DORA / release-velocity dashboards | Rejected twice already (v1.9 widget removal, v1.13 insights retirement) |
| GitLab review actions (approve, comment, request changes) | Still deferred to v2.0 — GitLab's own UI is mature for code review |
| Slack / email release notifications | External service dependencies; conflicts with the no-server architecture |
| Quick-search / filtering on the Epics list (Phase 91.2) | Fully specified during discuss-phase, then reversed by the user (D-18): *"I have changed my mind, I dont want any new search bar added to the epics page."* Recoverable from `91.2-DISCUSSION-LOG.md` if ever revisited |
| Labels / components on the Epics list row (Phase 91.2) | Dropped by D-08 — *"I dont need labels at all on the list page"*; they remain in `EpicDetailSheet` |
| Blocked / flagged surfacing on the Epics list (Phase 91.2) | Dropped by D-12 — *"Flags are ignored, flag is just a flag, not a progress marker. only statuses count"*; the Jira Flagged field is never fetched by this page |
| Click-to-sort columns on the Epics list (Phase 91.2) | Rejected by D-17; creation order is fixed |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 87 | Mapped |
| RELBR-01 | Phase 88 | Mapped |
| RELBR-02 | Phase 88 | Mapped |
| RELBR-03 | Phase 88 | Mapped |
| RELBR-04 | Phase 88 | Mapped |
| RELBR-05 | Phase 88 | Mapped |
| RELMS-01 | Phase 88 | Mapped |
| RELMS-02 | Phase 88 | Mapped |
| RELMS-03 | Phase 88 | Mapped |
| RELMS-04 | Phase 88 | Mapped |
| DRIFT-01 | Phase 89 | Mapped |
| DRIFT-02 | Phase 89 | Mapped |
| DRIFT-03 | Phase 89 | Mapped |
| DRIFT-04 | Phase 89 | Mapped |
| DRIFT-05 | Phase 89 | Mapped |
| DRIFT-06 | Phase 89 | Mapped |
| DRIFT-07 | Phase 89 | Mapped |
| DRIFT-08 | Phase 89 | Mapped |
| DRIFT-09 | Phase 89 | Descoped (user, UAT 2026-08-11) |
| MRFIX-01 | Phase 90 | Mapped |
| MRFIX-02 | Phase 90 | Mapped |
| MRFIX-03 | Phase 90 | Mapped |
| MRFIX-04 | Phase 90 | Mapped |
| MERGE-01 | Phase 91 | Mapped |
| MERGE-02 | Phase 91 | Mapped |
| MERGE-03 | Phase 91 | Mapped |
| EPIC-01 | Phase 91.2 | Mapped |
| EPIC-02 | Phase 91.2 | Mapped |
| EPIC-03 | Phase 91.2 | Mapped |
| EPIC-04 | Phase 91.2 | Mapped |
| EPIC-05 | Phase 91.2 | Mapped |
| EPIC-06 | Phase 91.2 | Mapped |
| EPIC-07 | Phase 91.2 | Mapped |
| RELF-01 | — | Deferred (future requirement, not in v1.14) |
| RELF-02 | — | Deferred (future requirement, not in v1.14) |
| RELF-03 | — | Deferred (deliberately excluded in favour of per-MR control) |

**Coverage:**

- v1.14 requirements: 33 total (26 release-management + 7 Phase 91.2 epics-page)
- Mapped to phases: 33/33 ✓
- Unmapped: 0 ✓

## Key Decisions Recorded During Definition

| Decision | Rationale |
|----------|-----------|
| Release branch cut from the GitLab **project default branch** | User clarified `develop` *is* the project default branch — read it from the API rather than adding configuration |
| Confirm dialog on **create** actions only (branch, milestone) | Creating team-visible refs warrants a gate; retarget/assign are reversible enough to apply directly |
| Retarget applies with **no warning at all** | User was shown GitLab's documented approval-reset behavior and chose the direct action anyway |
| **Two** independent mutations, not one combined PUT | `PUT /merge_requests/:iid` accepts both `target_branch` and `milestone_id` in one call, but a combined call cannot express "assign succeeded, retarget failed" as two retryable states |
| Merge-back detection is **layered and advisory** | The branch `merged` field false-negatives on squash/rebase merges (GitLab #36963); user confirmed merge-back happens sometimes via MR and sometimes via direct push, so both paths are required |
| Channel C must use a **fully paginated** fetch | `fetchRecentProjectMRs` is capped at 100 (`GGX-WARN-01`); reusing it would recur a bug class this codebase has already hit twice |
| Epics-page enrichment must **fail closed** (Phase 91.2, D-15) | `fetchEpicEnrichmentMap`'s `.catch(() => [])` would render a failed fetch as "0 stories" — the same absence-of-evidence bug class already shipped in 88-CR-01, 91-07 and 91.1-CR-06 |
| Epics row converts from `<table>` to **div+flex** (Phase 91.2, D-07) | Narrow columns collapse to zero width in the Tauri/WebKit webview; adding three columns to the existing `<colgroup>` would re-trigger a documented recurring bug |

---
*Requirements defined: 2026-08-10*
*Last updated: 2026-08-12 — registered EPIC-01…EPIC-07 for inserted Phase 91.2*
