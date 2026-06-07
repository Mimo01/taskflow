---
phase: quick-260607-mhc-standup-watched-person-picker
verified: 2026-06-07T16:38:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
human_verification:
  - test: "Open /standup-notes; observe the header picker"
    expected: "A subtle 'Showing: <my name>' label with a hover-revealed chevron sits left of the sync-status/Refresh group; defaults to the logged-in user"
    why_human: "Visual subtlety + hover affordance cannot be verified by grep"
  - test: "Click the picker, type a teammate's name in the search box"
    expected: "Server-filtered Jira assignable users appear (no client-side filtering); selecting one refetches and rerenders both Yesterday and Today columns for that person"
    why_human: "Requires a live Jira instance and runtime react-query refetch behavior"
  - test: "Watch a teammate whose GitLab account does not resolve"
    expected: "Yesterday MR-events section and Today reviewer/participating MR sections render empty/hidden with the 'GitLab account not matched for <name> — MRs hidden.' hint; the logged-in user's MRs are NEVER shown"
    why_human: "Requires a live person with no GitLab match to observe the rendered empty/hint state"
  - test: "Select 'Me', then reload the page"
    expected: "Selecting 'Me' restores own data; reloading/remounting resets the watched person back to the logged-in user (transient state)"
    why_human: "Reset-on-mount is a runtime lifecycle behavior, not statically observable"
---

# Quick 260607-mhc: Standup Watched-Person Picker Verification Report

**Phase Goal:** On the standup notes page, allow switching the watched person via a subtle Jira person picker (default = logged-in user). Selected person's standup data is derived identically to "me" with best-effort git/GitLab matching; unmatched is acceptable (graceful empty) with NO silent fallback to the logged-in user's gitlabUserId. Selection is transient (resets to me each load).

**Verified:** 2026-06-07T16:38:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Header shows a subtle 'Showing: <name> ▼' picker defaulting to the logged-in user | ✓ VERIFIED | `WatchedPersonPicker.tsx:85-88` renders `Showing: {triggerLabel}` with `opacity-0 group-hover:opacity-60` chevron; `triggerLabel = value?.displayName ?? meDisplayName` (:76); mounted in `StandupPageHeader.tsx:70-76` left of sync/Refresh; `meDisplayName={jiraUserDisplayName ?? 'Me'}` from auth store (`StandupNotesPage.tsx:420`). Visual subtlety → human. |
| 2 | Selecting a watched Jira person refetches/rerenders both Yesterday and Today columns | ✓ VERIFIED | `id = resolveEffectiveIdentity(...)` threaded into all 5 page query keys (schedule :186, tempo :213, jira :233, commits :258-260, mr-events :285) and into TodayColumn props (:453-455) which key reviewer/participating MR queries on `watchedGitlabUserId` (:229,:243) and sprint filter on `watchedDisplayName` (:258). Key changes → react-query refetch. Live refetch → human. |
| 3 | Yesterday commits use best-effort name matching (displayName as gitlabName); empty if no match acceptable | ✓ VERIFIED | Watched branch sets `gitlabName: watchedUser.displayName` (`effectiveIdentity.ts:66`); commits query feeds `id.gitlabName`/`id.gitlabEmail` to `fetchUserCommits` (:271-272); guard widened to `(!!id.gitlabUsername || !!id.gitlabName)` (:280) so matching runs for watched people. `fetchUserCommits` accepts empty `authorUsername` + `authorName` (gitlab.ts:1198-1206). |
| 4 | gitlabUserId-keyed sections render empty + 'not matched' hint and NEVER show the logged-in user's MRs | ✓ VERIFIED | `resolveEffectiveIdentity` forces `gitlabUserId/gitlabUsername/gitlabEmail = null` for any watched user (`effectiveIdentity.ts:68-70`), never references auth GitLab fields in the watched branch. mrEvents `enabled: ... && !!id.gitlabUserId` (:293); reviewer/participating `enabled: ... && !!watchedGitlabUserId` (TodayColumn :236,:250); copy-markdown reads `id.gitlabUserId`-keyed cache (:389,392). Hint shown + MR sections hidden when `showNotMatchedHint` (TodayColumn :304,315-319,364,377). Unit-tested: critical guard test asserts all three null + non-inheritance (`effectiveIdentity.test.ts:58-65`). |
| 5 | Reopening / remounting the page resets the watched person to the logged-in user | ✓ VERIFIED | `const [watchedUser, setWatchedUser] = useState<JiraAssignableUser \| null>(null)` (`StandupNotesPage.tsx:108`) — transient, initialized null on every mount; no persistence (no store/localStorage write). Runtime reset → human. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `effectiveIdentity.ts` | Pure `resolveEffectiveIdentity` + `EffectiveIdentity` type | ✓ VERIFIED | Exports both + `AuthIdentity`; watched branch forces GitLab fields null; imported & used in StandupNotesPage |
| `effectiveIdentity.test.ts` | Unit tests asserting gitlabUserId=null + displayName→gitlabName | ✓ VERIFIED | 5 tests, all pass; includes explicit non-inheritance assertion |
| `WatchedPersonPicker.tsx` | Subtle header dropdown, server-side fetchAssignableUsers, debounce | ✓ VERIFIED | Default export; 200ms debounce; token read inside queryFn; `enabled: open && !!jiraBaseUrl && !!projectKey`; imported in StandupPageHeader |
| `StandupNotesPage.tsx` (mod) | watchedUser state + effective-identity threading | ✓ VERIFIED | All queries + copy-markdown use `id.*` |
| `StandupPageHeader.tsx` (mod) | Renders picker, 5 new props | ✓ VERIFIED | Picker left of sync/Refresh group |
| `TodayColumn.tsx` (mod) | 3 watched props + not-matched hint | ✓ VERIFIED | MR queries keyed on watchedGitlabUserId; hint + section suppression |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| StandupNotesPage | effectiveIdentity#resolveEffectiveIdentity | compute `id` from auth + watchedUser | ✓ WIRED | :113-124 |
| StandupNotesPage | TodayColumn | pass `id.gitlabUserId`/`id.jiraUserDisplayName`/`id.isWatched` | ✓ WIRED | :453-455 |
| WatchedPersonPicker | jira/users#fetchAssignableUsers | server-side `&username=` query, debounced term in key | ✓ WIRED | :65,70; users.ts:26 confirms `&username=` |
| StandupPageHeader | WatchedPersonPicker | render in action group | ✓ WIRED | :70-76 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Critical guard unit test | `vitest run effectiveIdentity.test.ts` | 5/5 passed | ✓ PASS |
| Standup suite regression | `vitest run src/routes/standup-notes/` | 70/70 passed (9 files) | ✓ PASS |
| Typecheck (tsc --noEmit) | `npx tsc --noEmit` | no errors | ✓ PASS |
| fetchUserCommits accepts name-only matching | signature inspection | `authorUsername` required, `authorName?`/`authorEmail?` optional | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| STANDUP-WATCH-01 | 260607-mhc-PLAN | Switch watched person on standup via subtle Jira picker, effective-identity threading, no silent gitlabUserId fallback | ✓ SATISFIED | All 5 truths verified; guard unit-tested |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| StandupNotesPage.tsx | 399-401 | Silent clipboard `.catch` (IN-02 from REVIEW) | ℹ️ Info | Pre-existing copy-markdown behavior, unrelated to watched-person guard |
| — | — | No TODO/FIXME/XXX/HACK/PLACEHOLDER in any modified file | — | Clean |

No blocker anti-patterns. The forced-null GitLab fields are the intended correctness guard (not a stub); the "not matched" hint is intentional UX. WatchedPersonPicker's empty `users = []` default is overwritten by the react-query fetch — not a stub.

### Human Verification Required

1. **Picker presence + subtlety** — Open /standup-notes; confirm the subtle 'Showing: <my name>' picker with hover-revealed chevron defaults to the logged-in user.
2. **Server-side search + refetch** — Type a teammate name; confirm server-filtered Jira users appear and selecting one refetches both columns.
3. **No-fallback + not-matched hint** — Watch a teammate with no GitLab match; confirm MR sections are empty/hidden with the hint and the logged-in user's MRs are never shown.
4. **Transient reset** — Select 'Me' restores own data; reload resets to the logged-in user.

### Gaps Summary

No gaps. All five observable truths are verified against the codebase, all artifacts exist/substantive/wired, all key links connected, the critical NO-fallback guard is enforced by `resolveEffectiveIdentity` (gitlabUserId/gitlabUsername/gitlabEmail forced null in the watched branch, never inheriting auth values) and is unit-tested (5/5), the full standup suite passes 70/70, and typecheck is clean. Status is `human_needed` only because the picker's visual subtlety, live server search, runtime refetch/rerender, the rendered not-matched state with a real unmatched person, and transient reset-on-reload are runtime/UI behaviors that cannot be confirmed statically — consistent with the SUMMARY's own "Ready for live UAT" note.

The non-blocking REVIEW.md warnings (WR-01 memoization, WR-02 commits-section hint parity, WR-03 date NaN guard, WR-04 picker key uniqueness) are robustness/quality items that do not defeat the goal or the guard, and are not part of the must-have contract.

---

_Verified: 2026-06-07T16:38:00Z_
_Verifier: Claude (gsd-verifier)_
