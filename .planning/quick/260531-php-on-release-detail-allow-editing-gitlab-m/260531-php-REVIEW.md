---
phase: quick-260531-php-release-detail-edit-gitlab-milestone
reviewed: 2026-05-31T00:00:00Z
depth: quick
files_reviewed: 3
files_reviewed_list:
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
  - taskflow/src/services/gitlab.test.ts
  - taskflow/src/services/gitlab.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase quick-260531-php: Code Review Report

**Reviewed:** 2026-05-31
**Depth:** quick (escalated to per-file reading given the small, focused scope)
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the move of release editing into a modal and the new GitLab milestone
title/description editing. The new `updateMilestone()` service fn is correct and
well-tested. The combined-save / `Promise.allSettled` partial-failure handling is
sound in structure. However, several correctness gaps exist around cache
invalidation scoping, the changed-fields diffing for a non-matched milestone,
stale `matchedMilestone` identity after a successful save, and a milestone-match
ambiguity that can edit the wrong milestone. No Critical (security/data-loss)
issues found — the focus areas surfaced Warnings.

## Warnings

### WR-01: GitLab milestone cache invalidation misses the date-scoped query key — UI shows stale milestone after save

**File:** `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx:465` (vs. query key declared at `227-233`)
**Issue:** The milestones query key is four-part:
`['gitlab-milestones', activeGitlabProject, milestoneWindow?.from, milestoneWindow?.to]`.
On a successful GitLab save the code invalidates only
`['gitlab-milestones', activeGitlabProject]`. TanStack Query invalidation is
prefix-matching, so a 2-element prefix *does* match the 4-element key — this
particular call happens to work. But it is fragile and inconsistent with the
Jira invalidations (which spell out full keys), and any future `exact: true`
or reordering silently breaks it. More importantly, after invalidation the
edited milestone title/description is refetched, but `matchedMilestone` is
recomputed from `gitlabMatch.candidateName` (the *old* title) — see WR-02.
**Fix:** Invalidate with the documented prefix intent explicit, and confirm
prefix semantics are desired:
```ts
queryClient.invalidateQueries({ queryKey: ['gitlab-milestones', activeGitlabProject] });
// ^ relies on prefix match; the milestone-mrs key also keys on candidateName:
queryClient.invalidateQueries({ queryKey: ['gitlab-milestone-mrs', activeGitlabProject] });
```

### WR-02: Editing the milestone title breaks the match key — refetched milestone no longer resolves, edited values vanish from view

**File:** `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx:266-270, 286, 392`
**Issue:** `matchedMilestone` is resolved by
`milestones.find((m) => m.title === gitlabMatch.candidateName)`, and
`gitlabMatch.candidateName` comes from matching on `due_date`. After the user
edits the title and saves, the milestones cache is invalidated and refetched
with the *new* title. `matchedMilestone` re-resolves via title equality, but
`gitlabMatch.candidateName` was derived from the date match (still valid), so
on a fuzzy/exact date match it can still resolve. However the
`gitlab-milestone-mrs` query is keyed on `gitlabMatch.candidateName` (the title)
at line 286 and is never invalidated on GitLab save, so the MR list and label
summary keep using the stale title. If GitLab's milestone search by old title
returns nothing, the MR section silently empties.
**Fix:** Invalidate `['gitlab-milestone-mrs', activeGitlabProject]` (prefix) on
GitLab save, and prefer matching `matchedMilestone` by a stable id rather than
by title. Capture `matchedMilestone.id` for the match instead of re-deriving
from `candidateName`.

### WR-03: `buildGitlabDiff()` returns `{}` when no milestone is matched, but the title can still be "dirty" — and title is sent even when only description changed could clear it

**File:** `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx:389-397`
**Issue:** Two sub-issues:
(a) The diff correctly short-circuits to `{}` when `!matchedMilestone`, so the
GitLab section is only rendered when a milestone is matched (`1144`). Consistent.
(b) Empty-string title: the milestone Title `Input` has no `required` guard
(unlike `release-name` at `1086`). If the user clears the title field,
`editMilestoneTitle !== matchedMilestone.title` is true and `fields.title = ''`
is sent. GitLab rejects an empty milestone title with 400, surfaced as the
generic "Failed to update milestone: status 400". The Save button only checks
`!editName.trim()` (Jira name), not the milestone title, so an empty milestone
title is savable.
**Fix:** Disable Save (or block the GitLab promise) when
`gitlabFields.title !== undefined && gitlabFields.title.trim() === ''`, mirroring
the Jira name guard:
```ts
disabled={isSaving || !editName.trim() || !isEditDirty ||
  (buildGitlabDiff().title?.trim() === '')}
```

### WR-04: `addDays` / milestone window uses `new Date(d)` on a `YYYY-MM-DD` string — parsed as UTC, can shift the window by a day in negative offsets

**File:** `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx:216-220`
**Issue:** `new Date('2026-06-01')` is parsed as UTC midnight, then
`.toISOString().slice(0,10)` reads back in UTC — consistent here, so the date
math itself round-trips. The risk is the `setDate` boundary: for a date near
month end with `+7`, `setDate` correctly rolls over, so this is low-severity.
Flagging because the codebase elsewhere (gitlab.ts `fetchUserCommits`,
`fetchUserMREvents`) is explicitly careful about local-vs-UTC day boundaries,
and this helper silently assumes UTC. If `version.releaseDate` ever carries a
time component, `.slice(0,10)` after UTC conversion can land on the wrong day.
**Fix:** Keep it pure-string or document the UTC assumption; given `releaseDate`
is `YYYY-MM-DD` this is currently safe but undocumented.

### WR-05: Milestone match can pick the wrong milestone — first fuzzy wins, no tie-break; edit then writes to an arbitrary milestone

**File:** `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx:257-270`
**Issue:** The match loop returns the first `exact` match, else the first `fuzzy`
match encountered in array order (`if (match.type === 'fuzzy' && bestMatch.type === 'none')`).
When two milestones fall within the ±7-day window, the fuzzy winner is
order-dependent (whatever order GitLab returned). `matchedMilestone` is then
re-resolved by `title === candidateName` (line 268), which could match a
*different* milestone than the one the matcher scored if two milestones share a
title. Editing then PUTs to `matchedMilestone.id`. For a date-only fuzzy match,
the user could be editing a milestone they didn't intend, with no disambiguation
shown beyond the title.
**Fix:** Make fuzzy selection deterministic (e.g. pick the milestone whose
`due_date` is closest to `releaseDate`), and resolve `matchedMilestone` from the
same candidate object the matcher chose (carry its id through `ReleaseMatch`)
rather than re-finding by title.

## Info

### IN-01: `null` vs empty-string description round-trips inconsistently between display and edit

**File:** `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx:359, 393`
**Issue:** Seeding uses `matchedMilestone?.description ?? ''` and the diff
compares against `matchedMilestone.description ?? ''`. So a milestone with
`description: null` seeds `''`, and if the user types nothing, no diff is
produced — correct. If the user clears a previously non-null description, `''`
is sent, which GitLab treats as clearing the field. This is the intended
"empty clears" behavior documented in `gitlab.ts:723`. Consistent — noting only
that GitLab returns `null` (not `''`) after clearing, so an immediately
re-opened editor re-seeds `''` and is correctly non-dirty. No bug; documented
for the next reader.

### IN-02: `updateMilestone` sends `Content-Type: application/json` but never reads an error body

**File:** `taskflow/src/services/gitlab.ts:760-765`
**Issue:** On non-401/403 failure the function throws
`Failed to update milestone: status ${response.status}`, discarding GitLab's
JSON error message (e.g. `{"message":"title is missing"}`). This makes the
empty-title 400 (WR-03) opaque to the user.
**Fix:** Best-effort parse and append the GitLab message:
```ts
const body = await response.json().catch(() => null);
throw new Error(`Failed to update milestone: ${body?.message ?? `status ${response.status}`}`);
```

### IN-03: Test asserts `updatedMilestone` deep-equals but the fixture omits the label-normalization path

**File:** `taskflow/src/services/gitlab.test.ts:1327-1339`
**Issue:** Coverage for `updateMilestone` is good (200, 401, 403, 500, body
shape, PUT method, header, changed-fields-only body). Missing: a test that
`description: ''` is forwarded verbatim (the "empty clears" contract in the
docstring) and a test that title-only updates omit `description`. The
`{ description: 'x' }` test covers description-only; add the `''` case to lock
the documented clear-field behavior.
**Fix:** Add `updateMilestone(..., { description: '' })` and assert
`JSON.parse(body)` equals `{ description: '' }`.

### IN-04: `editMilestoneDescription` seeded only at `startEditing` — stale if milestone refetches while modal open

**File:** `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx:351-363`
**Issue:** The edit form is seeded once on `startEditing`. If the
`gitlab-milestones` query refetches (e.g. window refocus, staleTime expiry)
while the modal is open, `matchedMilestone` updates underneath but the form
fields and the diff baseline (`matchedMilestone.title/description` at `392-393`)
now reference a newer object than what was seeded — a save could compute a diff
against values the user never saw. Low likelihood given 5-min staleTime, but the
diff baseline and the seed source can desync.
**Fix:** Snapshot the milestone into local state at `startEditing` and diff
against that snapshot, not the live `matchedMilestone`.

---

## Remediation (applied 2026-05-31, commit 663f36e5)

| Finding | Resolution |
|---------|------------|
| WR-01 | GitLab save now also invalidates `['gitlab-milestone-mrs', activeGitlabProject]` (prefix). |
| WR-02 | `matchedMilestone` is now the exact object the matcher chose (carried through the match), so identity is stable across a title rename; MR cache invalidated (WR-01). |
| WR-03 | Milestone Title input marked `required`; Save disabled via `isMilestoneTitleInvalid` when a matched milestone's title is cleared. |
| WR-05 | Fuzzy match is now deterministic — picks the milestone whose `due_date` is closest to the release date — and the chosen object (not a title re-find) is used for editing. |
| IN-02 | `updateMilestone` surfaces GitLab's error-body `message` (e.g. "title is missing") instead of an opaque status; regression test added. |
| WR-04, IN-01, IN-03, IN-04 | Not addressed (low-severity / informational). WR-04 documented as safe given `YYYY-MM-DD` inputs; IN-04 (open-modal refetch desync) left as a known low-likelihood edge given 5-min staleTime. |

Gates after remediation: `vitest run gitlab.test.ts` → 65/65; release tests → 23/23; `npm run check` → clean.

---

_Reviewed: 2026-05-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
