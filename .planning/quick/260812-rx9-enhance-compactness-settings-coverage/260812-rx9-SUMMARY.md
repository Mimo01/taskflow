---
phase: quick-260812-rx9
plan: 01
subsystem: ui
tags: [tailwind, density, compactness, appearance-settings, typography]

requires:
  - phase: quick-260812-mry
    provides: Density/compactness + Text Size settings in Appearance section, data-density attribute mechanism
provides:
  - Density variant coverage extended from 11 files to ~48 files across wiki prose, standup notes,
    Epics, AIO pages, issue detail, MR list/detail, My Tasks, worklogs, backlog, filter bars,
    popovers, settings, dev tools and release detail
  - Five min-h floors (AioTestRunsSection, EpicsPage, SprintBoardTab x2, SubtasksPanel,
    MrHealthPanel) made density-aware, fixing the "AIO/Epics don't compact" reported bug
affects: [appearance-settings, ui-density]

tech-stack:
  added: []
  patterns:
    - "density-compact:/density-comfortable: Tailwind variant pairs appended after baseline
       vertical-spacing utility, never replacing it"
    - "prose-p:/prose-ul:/prose-li:/prose-headings:/prose-pre:/prose-td:/prose-th: typography
       modifiers for the single WikiRenderer prose attach point, with raw [&_p]:leading-* for
       line-height (no prose-* equivalent)"
    - "min-h-* floors paired with a matching density-compact:min-h-*/density-comfortable:min-h-*
       whenever a padding variant is added to the same element (R5)"

key-files:
  created:
    - .planning/quick/260812-rx9-enhance-compactness-settings-coverage/260812-rx9-SUMMARY.md
  modified:
    - taskflow/src/routes/dashboard/WikiRenderer.tsx
    - taskflow/src/routes/dashboard/EpicsPage.tsx
    - taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx
    - taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx
    - taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
    - taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx
    - taskflow/src/routes/standup-notes/*.tsx (9 files)
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/SubtasksPanel.tsx
    - taskflow/src/routes/dashboard/MrHealthPanel.tsx
    - taskflow/src/routes/dashboard/issue-detail/*.tsx (9 files)
    - taskflow/src/routes/dashboard/IssueDetailContent.tsx
    - taskflow/src/routes/dashboard/IssueDetailView.tsx
    - taskflow/src/routes/my-tasks/MyTasksPage.tsx
    - taskflow/src/routes/notifications/NotificationPopover.tsx
    - taskflow/src/routes/dashboard/MergeRequestListPage.tsx
    - taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx
    - taskflow/src/routes/dashboard/DiscussionThreads.tsx
    - taskflow/src/routes/dashboard/ReleasesTab.tsx
    - taskflow/src/routes/worklogs/WorklogEntryRow.tsx
    - taskflow/src/routes/worklogs/WorklogsPage.tsx
    - taskflow/src/routes/dashboard/BacklogPage.tsx
    - taskflow/src/components/UnifiedFilterBar.tsx
    - taskflow/src/routes/dashboard/QuickFilterChipRow.tsx
    - taskflow/src/routes/dashboard/StatusPopover.tsx
    - taskflow/src/routes/dashboard/IssueLinkRow.tsx
    - taskflow/src/components/app/RecentItemsPopover.tsx
    - taskflow/src/routes/standup-notes/WatchedPersonPicker.tsx
    - taskflow/src/routes/settings/SidebarItemsList.tsx
    - taskflow/src/routes/settings/SubtaskTemplatesSection.tsx
    - taskflow/src/routes/dev-tools/OperationsTab.tsx
    - taskflow/src/routes/dev-tools/LogsTab.tsx
    - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx
    - taskflow/src/routes/dashboard/release-detail/DescriptionsSection.tsx

key-decisions:
  - "DiscussionThreads.tsx:335 prose-xs SystemNote block and DescriptionsSection li stay at their
     zero-floor baseline in compact mode (R2 exception) — only density-comfortable: was added"
  - "AttachmentsSection.tsx thumbnail grid gap-2 (flex-wrap 2D grid) skipped — mixes horizontal
     and vertical axes, R3 forbids varying horizontal gap"
  - "MyTasksPage.tsx:146 SkeletonRow px-4 py-2 treated as an ordinary row per plan's discretion
     clause, not described as a filter bar"
  - "Update/WhatsNew changelog prose (UpdateDialog, WhatsNewDialog, UpdatesSection) classified
     N-A per RESEARCH's recommended answer — fixed-height scroll boxes, already tight, files
     deliberately excluded from files_modified frontmatter"
  - "LabelSummarySection.tsx and MetaRow.tsx classified N-A — badge chips and a leaf row with no
     py to vary; the actual density-relevant spacing lives one level up in
     ReleaseDetailSidebar.tsx's space-y-4 stack, which was covered"
  - "AioBlock.tsx classified N-A — no row/list containers or spacing classes found on sweep"

patterns-established:
  - "R5 min-h pairing: min-h-[Npx] density-compact:min-h-[~0.7*N] density-comfortable:min-h-[~1.2*N]"
  - "Prose attach-point extension pattern reused for two bespoke prose blocks that bypass
     WikiRenderer (DiscussionThreads.tsx bare prose, DescriptionsSection.tsx local overrides)"

requirements-completed: []

duration: ~2h
completed: 2026-08-12
---

# Quick Task 260812-rx9: Enhance Compactness Settings Coverage Summary

**Extended density (`density-compact:`/`density-comfortable:`) Tailwind variant coverage from 11
files to ~48 files across three priority tiers, and fixed five `min-h-*` floors that were silently
no-oping the existing compact-mode classes on AIO test runs, Epics rows, Sprint Board columns, and
two dashboard cards — all edits strictly additive so `default` density renders byte-identical to
before.**

## Performance

- **Duration:** ~2h
- **Tasks:** 3 code tasks completed (Task 4 is a `checkpoint:human-verify` gate, not yet run)
- **Files modified:** 49 (48 source files + this SUMMARY)
- **Commits:** 15 atomic commits (see below)

## Accomplishments

- Wiki-rendered content (issue descriptions, comments, MR bodies, AIO test steps) now tightens/
  loosens paragraph, list, heading, code-block and table-cell rhythm across all three density
  tiers via the single `WikiRenderer.tsx` attach point, with zero font-size change (R3 verified
  by automated gate: 0 `text-*`/`prose-<size>` density variants in the file)
- Fixed the reported "AIO pages and Epics page don't compact enough" bug: five `min-h-*` floors
  (`AioTestRunsSection` `min-h-11`, `EpicsPage` `min-h-[3rem]`, `SprintBoardTab` `min-h-[80px]` x3,
  `SubtasksPanel`/`MrHealthPanel` `min-h-[160px]`) now carry matching density variants so the
  pre-existing (or newly added) `py-*`/`p-*` variants actually take visible effect
  - Note: `SprintBoardTab.tsx` also carries three `min-h-0` occurrences (lines 519, 695, 1672) —
    these are flex-overflow-containment zero-floors, structurally unrelated to row-height rhythm,
    left untouched (N-A, recorded below)
- All ten standup-notes files now honor density on both direct row padding and `[&>*]:py-*` group
  wrappers (R6), including `StandaloneMrGroup`'s pre-existing `dense` boolean prop layered with
  density variants on both branches
- Every P1 high-traffic surface (issue detail sections, My Tasks, MR list/detail, discussion
  threads, releases, worklogs, backlog headers) and P2 consistency surface (filter bars, popovers,
  settings, dev tools, release detail) carries both variants or is recorded N-A with a reason
- At `default` density the diff is provably inert: every hunk audited via `git diff -U0` shows
  baseline utility classes retained verbatim with only `density-*:` utilities appended

## Task Commits

1. **Task 1a: Wiki prose attach point** - `99530259` (feat)
2. **Task 1b: Epics page rows** - `d1724a57` (feat) + `bdae8041` (style: biome line-length wrap)
3. **Task 1c: AIO test run min-h fix** - `fa932783` (fix)
4. **Task 1d: AIO project overview page** - `40975ad2` (feat)
5. **Task 1d: AIO cycle detail page** - `900b7690` (feat)
6. **Task 1d: AIO test run detail page** - `53225c2e` (feat)
7. **Task 1e: Standup notes row groups** - `0434bd26` (feat)
8. **Task 1f: Remaining min-h floors (SprintBoard/Subtasks/MrHealth)** - `56a185cf` (fix)
9. **Task 2a/2b/2f: Issue-detail rows, MR list/detail, discussions, releases** - `17c6da94` (feat)
10. **Task 2b/2c: Issue-detail vertical stacks and cards** - `3a0761f4` (feat)
11. **Task 2d/2e: My Tasks, notifications, worklogs, backlog headers** - `c64be3bb` (feat)
12. **Task 3a/3b: Filter bars and popover/picker rows** - `2a2455f5` (feat)
13. **Task 3c: Settings and dev-tools lists** - `9ed7c4c6` (feat)
14. **Task 3d: Release detail sidebar and descriptions** - `18a1dce3` (feat)

**Plan metadata:** pending (docs: complete plan) — added by orchestrator after this SUMMARY

_Task 4 (UAT checkpoint) has not been executed by this agent — see "Task 4 Status" below._

## Files Created/Modified

See `key-files.modified` in frontmatter for the full list (34 unique paths, several standup-notes
and issue-detail files grouped by directory glob for brevity).

## Per-Surface Disposition Table (RESEARCH.md §3, required by R9)

Legend: **COVERED** = both variants applied (or documented one-sided exception) · **N-A** = skipped
with reason.

### P0 — the four named surfaces

| Surface | File | Status | Notes |
|---|---|---|---|
| Wiki prose | `WikiRenderer.tsx` | COVERED | prose-p/ul/ol/li/headings/pre/td/th + leading-snug (compact only) |
| Standup — activity group | `IssueActivityGroup.tsx` | COVERED | 4 row containers + header |
| Standup — in-progress | `TodayInProgressSection.tsx` | COVERED | row buttons + `[&>*]:py-2` wrapper + section gap/py |
| Standup — up next | `TodayUpNextSection.tsx` | COVERED | row buttons + `[&>*]:py-2` wrapper + section gap/py + footer row |
| Standup — MRs | `TodayMrsSection.tsx` | COVERED | row py-3 + section gap/py |
| Standup — participating | `TodayParticipatingSection.tsx` | COVERED | row py-3 + section gap/py |
| Standup — yesterday | `YesterdayColumn.tsx` | COVERED | 2x `[&>*]:py-2` wrappers + section gap/py |
| Standup — standalone MR | `StandaloneMrGroup.tsx` | COVERED | `dense` prop preserved, variants layered on both branches |
| Standup — other commits | `OtherCommitsGroup.tsx` | COVERED | `[&>*]:py-1.5` wrapper |
| Standup — section header | `StandupSectionHeader.tsx` | COVERED | `mb-2` |
| Standup — page chrome | `TodayColumn.tsx`, `StandupNotesPage.tsx`, `StandupPageHeader.tsx` | N-A | page-level `px-6 py-4` chrome, matches other page headers |
| Epics page rows | `EpicsPage.tsx:52,62,67,78` | COVERED | 4 td py-3 → compact 1.5 / comfortable 4 |
| Epics page min-h blocker | `EpicsPage.tsx:46` | COVERED | `min-h-[3rem]` was flooring every row; now density-aware (R5) |
| AIO issue-detail test runs | `AioTestRunsSection.tsx:365` | COVERED | `min-h-11` was flooring pre-existing `density-compact:py-1`; fixed (R5) |
| AIO project overview | `AioProjectOverviewPage.tsx` | COVERED | th/td, skeleton row, sidebar nav items, folder skeleton p-2/space-y-1 |
| AIO cycle detail | `AioCycleDetailPage.tsx` | COVERED | header cells, td rows (both tables), filter toolbars |
| AIO test run detail | `AioTestRunDetailPage.tsx` | COVERED | all 24 `px-3 py-2` th/td cells across 3 tables |
| AIO shared block | `AioBlock.tsx` | N-A | swept — no row/list containers or spacing classes present |

### P1 — high-traffic list surfaces

| Surface | File | Status | Notes |
|---|---|---|---|
| Changelog entries | `ChangelogEntry.tsx:37` | COVERED | R10: was NOT already covered, confirmed gap |
| Activity timeline | `ActivityTimeline.tsx:117,143,168` | COVERED | skeleton stack, section mt/pb, entry `<ol>` |
| Attachments — file row | `AttachmentFileRow.tsx:50` | COVERED | |
| Attachments — section | `AttachmentsSection.tsx:184` | COVERED | expanded stack space-y-3; thumbnail grid `gap-2` at :196 skipped (2D flex-wrap grid mixes axes, R3) |
| Linked issues | `LinkedIssuesSection.tsx:36,45` | COVERED | list stack + row |
| Merge requests (sidebar list) | `MergeRequestsSection.tsx:38` | COVERED | |
| Worklog entry card | `WorklogEntry.tsx:66,128` | COVERED | card p/space-y + edit-mode stack |
| Issue detail sidebar | `IssueDetailSidebar.tsx:92` | COVERED | field stack |
| Issue detail content | `IssueDetailContent.tsx:111,119,278,314,320,410` | COVERED | subtask list + row, section stack, linked-issue list + rows |
| Issue detail comment card | `IssueDetailView.tsx` (~778) | COVERED | local wrapper div, not the `Card` primitive (R7 respected) |
| Subtasks panel | `SubtasksPanel.tsx:77,106` | COVERED | min-h-[160px] card floor + row py-1.5 |
| My Tasks page | `MyTasksPage.tsx:146,565,585,657,674` | COVERED | section wrappers, group stacks (space-y-0.5 not a floor, both variants), skeleton row treated as ordinary row |
| Notifications popover | `NotificationPopover.tsx:174,197` | COVERED | sticky group headers, virtualized list — CSS-only per R8 |
| MR list page | `MergeRequestListPage.tsx:196,283` | COVERED | rows + skeleton row |
| MR detail page | `MergeRequestDetailPage.tsx:209,256,294,542,557,564` | COVERED | description stack, commit list + row, sidebar stack |
| Discussion threads | `DiscussionThreads.tsx` | COVERED | note headers, thread cards, reply stacks, bare prose block (:314); prose-xs SystemNote (:335) comfortable-only (R2 zero-floor exception) |
| Releases tab | `ReleasesTab.tsx:426,604` | COVERED | |
| Worklog entry row | `WorklogEntryRow.tsx:81` | COVERED | py-0.5 not a floor, both variants applied (R2) |
| Worklogs page headers | `WorklogsPage.tsx:981-1060` | COVERED | 8 sticky grid header cells |
| Backlog group headers | `BacklogPage.tsx:1121,1153,1190,1203` | COVERED | sprint section header, skeleton, empty-filter text, create-story footer; `useVirtual=false` so CSS-only is safe (R8) |
| Sprint board swimlane headers/dropzone | `SprintBoardTab.tsx:183,533,708` | COVERED | (done in Task 1f alongside min-h fix) |

### P2 — lower-traffic consistency sweep

| Surface | File | Status | Notes |
|---|---|---|---|
| Unified filter bar | `UnifiedFilterBar.tsx` | COVERED | search input, options list, option rows, footer, primary row, quickfilter scroll row (x2 instances), expandable filters row |
| Quick filter chips | `QuickFilterChipRow.tsx:44` | COVERED | |
| Status popover | `StatusPopover.tsx:189` | COVERED | |
| Issue link picker | `IssueLinkRow.tsx:127` | COVERED | |
| Recent items popover | `RecentItemsPopover.tsx:141` | COVERED | |
| Watched-person picker | `WatchedPersonPicker.tsx:105,114,117,133` | COVERED | all 4 `px-2 py-1.5` rows |
| Settings — sidebar items | `SidebarItemsList.tsx:33` | COVERED | |
| Settings — subtask templates | `SubtaskTemplatesSection.tsx:200,320` | COVERED | container + row card |
| Dev tools — operations | `OperationsTab.tsx:46,49,51` | COVERED | summary, container, row |
| Dev tools — logs | `LogsTab.tsx:20,44` | COVERED | summary row + detail panel |
| Release detail — label summary | `LabelSummarySection.tsx` | N-A | badge-chip geometry (px-1.5 py-0.5), not a repeating row/list rhythm; matches Badge tone treatment elsewhere in the app |
| Release detail — meta row | `MetaRow.tsx` | N-A | leaf component has no `py-*` of its own; the actual vertical rhythm lives in the parent's `space-y-4` stack, which is covered below |
| Release detail — sidebar | `ReleaseDetailSidebar.tsx:286,460` | COVERED | meta-row stack (wraps `MetaRow` instances) + unlabeled-MR sub-list |
| Release detail — descriptions | `DescriptionsSection.tsx:52` | COVERED | GitLab-description prose block; `[&_li]:my-0` at zero-floor, comfortable-only (R2) |
| Update/WhatsNew changelogs | `UpdateDialog.tsx`, `WhatsNewDialog.tsx`, `UpdatesSection.tsx` | N-A | RESEARCH's recommended answer: fixed-height scroll boxes, already tight hand-tuned prose; deliberately excluded from `files_modified` frontmatter, not edited |

### N/A — legitimately density-neutral (from RESEARCH §3, unchanged)

All entries in RESEARCH.md's N/A table (shadcn `components/ui/*` primitives, `card.tsx`
`--card-spacing`, most `*Skeleton.tsx` files not explicitly named above, onboarding wizard, fixed-
geometry modals, `TopBar`/`PinnedTabStrip`/`PeekPanel`/`CommandPalette`, charts, error/empty states,
textareas/composers) were left untouched as originally scoped. No `components/ui/*` file appears
in this plan's diff (verified: `git diff --name-only -- src/components/ui` = 0 files).

## R2 One-Sided (Comfortable-Only) Exceptions

Per R2's genuine zero-floor exception, only two locations got `density-comfortable:` without a
paired `density-compact:` (baseline already at the minimum step):

1. `DiscussionThreads.tsx:337` — `[&_p]:my-0.5 [&_ul]:my-0.5 [&_li]:my-0` in the `prose-xs`
   SystemNote block. Added `density-comfortable:[&_p]:my-2`, `[&_ul]:my-2`, `[&_li]:my-1` only.
2. `DescriptionsSection.tsx:52` — `[&_li]:my-0` in the GitLab-description prose override. Added
   `density-comfortable:[&_li]:my-1` only (the `[&_p]:my-1` and `[&_ul]:my-1` on the same element
   were NOT at the floor and got the full R4 pair).

## Deviations from Plan

### Auto-fixed Issues

None — no bugs were discovered outside the planned scope; all edits were the additive density-
variant work specified in the plan's task actions.

### Scope Extensions (Claude's Discretion, within R9)

**1. [Discretion] Extended a handful of row shapes beyond the plan's literal line-number list to
maintain internal consistency within a single file** — Found during: Tasks 1d, 1e, 2, 3.
- **Detail:** Several files had 2-6 more instances of the exact same repeating class shape than
  the plan's action text named line numbers for (e.g. `AioCycleDetailPage.tsx` has a second table
  mirroring the first at different line numbers; `UnifiedFilterBar.tsx` has a duplicate
  "expandable filters row" at a second render path; `TodayInProgressSection.tsx`/
  `TodayUpNextSection.tsx`/`TodayMrsSection.tsx`/`TodayParticipatingSection.tsx` share an identical
  `flex flex-col gap-2 py-2` section wrapper the plan only named explicitly for `YesterdayColumn`).
- **Fix:** Applied the same R4-derived variant pair to every occurrence of an identically-shaped
  class string within the touched file, rather than leaving siblings of a just-fixed row
  inconsistent.
- **Files:** `AioProjectOverviewPage.tsx`, `AioCycleDetailPage.tsx`, `AioTestRunDetailPage.tsx`,
  `TodayInProgressSection.tsx`, `TodayUpNextSection.tsx`, `TodayMrsSection.tsx`,
  `TodayParticipatingSection.tsx`, `UnifiedFilterBar.tsx`, `WorklogsPage.tsx`.
- **Commits:** `40975ad2`, `900b7690`, `53225c2e`, `0434bd26`, `c64be3bb`, `2a2455f5`.

**2. [Discretion] `ActivityTimeline.tsx:117` skeleton `space-y-3` was treated per the plan's
explicit instruction, deviating from the general "skeletons are N/A" guidance in RESEARCH §3's
N/A table** — Found during: Task 2b. The plan's task action for Task 2b explicitly named this
line; RESEARCH's general skeleton guidance is advisory ("optional follow-through"), so the more
specific plan instruction took precedence. Same reasoning applied to `MyTasksPage.tsx:146`'s
`SkeletonRow`, `MergeRequestListPage.tsx`'s `MRListSkeleton`, `AioProjectOverviewPage.tsx`'s
skeleton row, and `BacklogPage.tsx`'s section-loading skeleton — all explicitly named or
structurally identical to a named row in their respective plan task actions.

No architectural changes, no new dependencies, no `components/ui/*` edits, no `estimateSize`
changes.

## Task 4 Status

Task 4 is `type="checkpoint:human-verify" gate="blocking"` — a manual UAT walkthrough across all
three density tiers with `npm run tauri dev`. This agent does not perform manual UI verification;
the automated portion of Task 4's `<verify>` block (`npm run check && npm run test`) has already
been run and passes as part of Tasks 1-3 gates below. **This checkpoint awaits human UAT** per the
plan's `<resume-signal>`: the user should walk the surfaces listed in Task 4's `<how-to-verify>`
and either type "approved" or list surfaces that still look wrong.

## Verification Results

- `npm run test` (after every commit and at plan end): **2586 passed, 2 skipped, 13 todo, 181 test
  files passed** — matches the documented baseline exactly, zero regressions
- `npm run check`: **4 errors / 30 warnings**, identical file set to the pre-task baseline
  (`WikiRenderer.tsx` format, `TaskCard.tsx` format, `release-detail/UnifiedTaskTable.tsx` format,
  `components/ui/chart.tsx`, `BacklogRow.tsx`, `MyTasksPage.tsx`, `MyTasksPage.test.tsx`) — verified
  by diffing `biome check` output against the pre-task commit (910aaac3) for each newly-appearing
  file; all were already flagged there. **No NEW files flagged** by this plan's changes.
- R1 (additive-only): every `git diff` hunk across all 15 commits was manually inspected via
  `git diff | grep '^-[^-]'` per commit; every removed line's baseline utility class reappears
  verbatim on the paired `+` line with only `density-*:` utilities appended. Two exceptions are
  pure formatting reflow from `biome format --write` (a `useMemo` deps array in `BacklogPage.tsx`
  and JSX attribute wrapping in `IssueActivityGroup.tsx`/`EpicsPage.tsx`), not manual edits —
  content is unchanged, only line-wrapping.
- R5 (min-h audit): `grep -n min-h` on all 5 P0-named floor files shows zero bare `min-h-*` without
  a `density-compact:min-h-` sibling. Additional `min-h-0` (flex-overflow zero-floors, unrelated to
  row height) and `min-h-[Npx]` textarea composers found during the sweep are recorded N-A above.
- R7: `git diff --name-only -- src/components/ui` = 0 files.
- R8: `estimateSize: () => 120|64|44` — all three constants byte-unchanged (verified via grep
  after every SprintBoardTab/NotificationPopover/BacklogPage commit).
- R3 (WikiRenderer): `grep -Ec 'density-(compact|comfortable):(text-|prose-(xs|sm|base|lg|xl))'` = 0.

## Self-Check: PASSED

- All 15 commit hashes verified present via `git log --oneline --all`: `99530259`, `d1724a57`,
  `bdae8041`, `fa932783`, `40975ad2`, `900b7690`, `53225c2e`, `0434bd26`, `56a185cf`, `17c6da94`,
  `3a0761f4`, `c64be3bb`, `2a2455f5`, `9ed7c4c6`, `18a1dce3` — all FOUND, none missing.
- Representative key-files verified present on disk: `WikiRenderer.tsx`, `EpicsPage.tsx`,
  `AioTestRunsSection.tsx`, `ReleaseDetailSidebar.tsx` — all FOUND.
- No missing items.

---

## Task 4 — Human UAT: APPROVED (2026-08-12)

User walked the density tiers in the running app and approved. The checkpoint gate is closed.

### Post-UAT adjustments (4 commits after the original 15)

| Commit | Change | Origin |
|---|---|---|
| `99fe186e` | Restored both-variant parity: `density-compact:[&_p]:my-0` / `[&_ul]:my-0` on the DiscussionThreads NoteCard, and `density-comfortable:[&_p]:leading-relaxed` / `[&_li]` on WikiRenderer | Code review WR-01, WR-02 |
| `b9231844` | Loosened compact wiki prose one half-step (`my-1`→`my-1.5`, `li my-0`→`my-0.5`, headings `mt-3/mb-1`→`mt-4/mb-1.5`, `leading-snug`→`leading-normal`) | UAT: compact descriptions read too tight |
| `cdec90cb` | Set all three wiki-prose tiers explicitly on one monotonic scale — tightened Default, loosened Comfortable | UAT: default too loose, comfortable too subtle |

### Final wiki-prose scale

| | Compact | Default | Comfortable |
|---|---|---|---|
| paragraphs, lists | `my-1.5` | `my-3` | `my-5` |
| list items | `my-0.5` | `my-0.5` | `my-1.5` |
| headings mt/mb | `mt-4 mb-1.5` | `mt-5 mb-2` | `mt-7 mb-3.5` |
| line-height | 1.5 | 1.625 | 1.8 |

### Deviation from R1 (recorded, accepted)

`cdec90cb` intentionally changes rendering **at default density** for wiki prose. The sweep's
original R1 invariant — "at default density the app renders byte-identically to before" — no
longer holds for `WikiRenderer.tsx`. This was requested directly at UAT and is the only place
in the 49-file change where the diff is not purely additive.

Root cause it exposed: the Default tier was never explicitly set, so it inherited `prose-sm`'s
own values (`p my-4`, line-height 1.714). Comfortable's `my-4` was therefore near-identical to
Default, and its `leading-relaxed` (1.625) was *tighter* than Default — Comfortable was doing
almost nothing on prose and working backwards on line-height. All three tiers are now explicit.

### Known follow-up (not a gap)

MR discussion comment cards (`DiscussionThreads.tsx` `NoteCard`) render through a separate
`prose-xs` block and were deliberately left on their own scale during the tier rebalance. Offered
to the user and not requested. Bring them onto the same scale if comment density is revisited.

### Final state

- 19 commits total (15 sweep + 4 post-UAT)
- Density variant coverage: 11 files → 49 files
- `npm run test`: 2586 passed / 2 skipped / 13 todo — green after every commit
- `npm run check`: no NEW files flagged vs. the pre-task baseline at `910aaac3`
