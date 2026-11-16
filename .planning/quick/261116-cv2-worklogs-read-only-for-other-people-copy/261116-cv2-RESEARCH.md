# Quick 261116-cv2: Worklogs read-only for others + "Copy as mine" - Research

**Researched:** 2026-11-16
**Domain:** React (Worklogs route) — ownership gating, inline create form, "logging as me" labelling
**Confidence:** HIGH (all findings from codebase reads; no new packages)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Ownership per entry author, NOT per selected person filter. Mine when `entry.author.name` (or `entry.author.key`) matches `useAuthStore` `jiraUsername` / `jiraUserKey`. Works for the mixed "no person selected" view too.
- Not mine → no pencil, no trash, no EditWorklogForm reachable.
- "Copy as mine" swaps the row (like edit) for a create form prefilled with their duration, date, comment. Save → `createWorklog` on same issueKey for me. Cancel/discard returns to read-only row. On success invalidate `['tempo','worklogs']`.
- Add New Entry / empty "+" cells stay usable on another person's view, but must clearly say it's for ME ("Log as me" label / "Logging as {my display name}", avatar optional) whenever viewed person (or copied entry) is not me. Copy form carries same indicator.

### Claude's Discretion
- Wording/iconography (lucide Copy), indicator placement, reuse LogWorkPopover internals vs small inline CopyWorklogForm mirroring EditWorklogForm.
- Copied/created worklog won't appear in the current table when viewing someone else; brief success hint optional.

### Specifics
- Hover-revealed icon buttons in WorklogEntryRow (Copy replaces Pencil/Trash for others' entries). Match local button row style; no new card panels.

### Deferred Ideas
None.
</user_constraints>

## Summary

All needed data already exists. `TempoWorklog.author` is `{ name, key?, displayName? }` (types.ts:28) and the Phase 61 probe confirmed live shape `name: "<username>"`, `key: "JIRAUSER…"` [VERIFIED: .planning/milestones/v1.9-phases/61-tempo-probe-service-layer/61-PROBE-RESULT.md]. The auth store's `jiraUsername` = `/myself .name` and `jiraUserKey` = `/myself .key` (auth.store.ts:44-49) — the same identifiers, so they are directly comparable. No new libraries.

**Primary recommendation:** Add a pure `isOwnWorklog(author, me)` helper; WorklogEntryRow reads the auth store itself and branches Mine (pencil/trash, unchanged) vs Other (Copy button → inline `CopyWorklogForm`). Give `LogWorkPopover` one optional prop `loggingAs?: { displayName; avatarUrl? }` (shows "Logging as {name}" line + caller passes `triggerLabel="Log as me"`), and thread `viewedUsername` from WorklogsPage through the 3 `WorklogCellPopover` call sites.

## 1. Determining "entry is mine"

Store fields (auth.store.ts): `jiraUsername` (/myself .name), `jiraUserKey` (/myself .key), `jiraUserDisplayName`, `jiraUserAvatarUrl`.

**Gotcha:** `jiraUserKey` can be null — onboarding `JiraStep.tsx:120` calls `setJiraUser(displayName, name, undefined, avatar)`; it's only filled later by `useNotificationPolling.ts:119` / `TokenSection.tsx:226,240`. So name-matching must work on its own.

Recommended helper (e.g. `src/lib/worklog-ownership.ts`, pure, unit-testable):
```ts
export function isOwnWorklog(
  author: { name?: string; key?: string } | undefined,
  me: { username: string | null; userKey: string | null },
): boolean {
  if (!author) return false;
  if (me.userKey && author.key && author.key === me.userKey) return true;
  if (me.username && author.name && author.name.toLowerCase() === me.username.toLowerCase()) return true;
  return false;
}
// plus isMeUsername(username, me) for the selected-person check (same case-insensitive name rule)
```
- Key compare exact (JIRAUSER12345 / legacy lowercase keys); name compare case-insensitive — Jira Server/DC usernames are case-insensitive [ASSUMED], and WorklogsPage already compares `selectedUsername === jiraUsername` exactly (line 837), so lowercase compare is strictly safer.
- **Fallback when store values missing: read-only (fail closed).** Matches the locked "not mine → no edit"; `jiraUsername` is set at onboarding so this only bites a broken/unhydrated store, and Copy still lets the user log. Jira enforces permissions server-side anyway (T-64-08).
- Do NOT use `displayName` for matching (non-unique; "SURNAME Given" format quirks per memory).

## 2. Copy form: new inline `CopyWorklogForm` (recommended)

Do **not** reuse LogWorkPopover for copy: the decision says the row is swapped in place like edit; LogWorkPopover is a Popover, which would be a popover-in-popover anchored to a row (WorklogCellPopover already documents nested-popover risk, Pitfall 4) and it lacks initial duration/comment. EditWorklogForm is the right template (same container `space-y-2 py-1`, Label/Input/DatePicker/Textarea, `formatSecondsForInput`, `+0000` started construction).

`CopyWorklogForm` props: `{ entry, issueKey, jiraBaseUrl, me: {displayName, avatarUrl}, onSuccess, onCancel }`.
- State seeded from entry: duration `formatSecondsForInput(entry.timeSpentSeconds)`, date `entry.dateStarted`, comment `entry.comment ?? ''`.
- Mutation: `readSecret('jira-pat')` → `createWorklog(jiraBaseUrl, token, issueKey, { timeSpentSeconds, started, comment })` (signature worklogs.ts:69; blank comment auto-defaults to "Working on issue X").
- Buttons: primary "Log as me" (flex-1) + outline/ghost "Cancel" (calls onCancel). No Delete.
- Top line: "Logging as {me.displayName}" (muted text-xs, optional `CachedAvatar` size small from `components/ui/cached-avatar.tsx`).
- Invalidate on success: `['tempo','worklogs']` (via row's `onMutationSuccess`), and mirror LogWorkPopover's extra keys `['jira-worklogs', issueKey, jiraBaseUrl]` + `['jira-issues']` so issue detail / list time bars update.
- Move `formatSecondsForInput` to a shared spot (or export from EditWorklogForm) rather than copy-pasting a third time (WorklogEntryRow already has a duplicate `formatSecs`).

WorklogEntryRow changes: replace `editing: boolean` with `mode: 'view' | 'edit' | 'copy'`; still call `onEditingChange(mode !== 'view')` so WorklogCellPopover hides "Add New Entry" and drops `max-h-48` while copying. Other-author row: hover cluster shows only `<button aria-label="Copy worklog as mine"><Copy className="size-3.5"/></button>` with identical classes to Pencil. Guard `EditWorklogForm` render with `isMine` too (not just hide the button).

## 3. "Logging as me" in LogWorkPopover + prop threading

LogWorkPopover (issue-detail/LogWorkPopover.tsx) is also used by `IssueDetailHeader.tsx` — add props as optional, default off:
- `loggingAs?: { displayName: string; avatarUrl?: string | null }` → when set, render a muted "Logging as {displayName}" row at the top of the `space-y-3` form.
- Trigger label already overridable via `triggerLabel` (pass `"Log as me"` instead of `"Add New Entry"`).

Threading: WorklogsPage has `selectedUsername` (null = all people) and auth values. Add one prop to `WorklogCellPopover`, e.g. `viewedUsername: string | null`, at the **3 call sites** (WorklogsPage.tsx ~1037 epic row, ~1102 story row, ~1167 subtask row). Inside WorklogCellPopover read `useAuthStore` (selectors) and compute
`showLogAsMe = !isMeUsername(viewedUsername, me)` — i.e. true when viewing someone else **or** the all-people (null) view (ambiguous, so label it). Alternatively pass a precomputed `logAsMe: boolean` from the page; either is fine, but computing once in the page avoids store reads in hundreds of cells — prefer passing `logAsMe` boolean + reading display name/avatar once in the popover (only mounted content reads it).

Optional success hint when `logAsMe` (created entry won't show in another person's table): small "Logged for you" text — not required.

## 4. Test patterns to extend (WorklogsPage.test.tsx)

- `@/services/jira/worklogs` mocked: `createWorklog/updateWorklog/deleteWorklog` → `vi.fn().mockResolvedValue(undefined)` (line 62).
- `@/stores/auth.store` mock (line 67) returns `{ jiraBaseUrl, activeJiraProject, jiraUsername: mockJiraUsername, jiraUserDisplayName }` — **no `jiraUserKey` / `jiraUserAvatarUrl`**; add `mockJiraUserKey` / avatar there. Mock supports selector form.
- `readSecret` → `'test-jira-token'`; `makeWorklog(authorName, displayName, date, hours, issueKey)` helper (line 198).
- Row unit tests render `<WorklogEntryRow …>` directly via `renderComponent` (lines 1027-1108); popover tests click `[aria-label="View worklogs for STORY-1 on ${date}"]` then query `document.body` (portal) — lines 1153-1350.

**BREAKING for existing tests:** current row/popover tests use author `'alice'`/`'bob'` while `mockJiraUsername = 'jdoe'`, and assert `Delete worklog entry` / `Edit worklog entry` exist (lines 1033, 1059, 1091, 1160, 1197, 1245-1285, 1300-1343). After the change these must switch author to `'jdoe'` (keep a few as `'alice'` for the new read-only assertions).

New tests to add:
1. `isOwnWorklog` unit: key match, case-insensitive name match, null store → false, displayName ignored.
2. Other author row: no Edit/Delete buttons; has "Copy worklog as mine".
3. Copy click → form prefilled (duration "2h 30m", comment) + "Logging as Jane Doe"; Save → `createWorklog('https://jira.example.com','test-jira-token','PROJ-1', {timeSpentSeconds, started: /\+0000$/, comment})`; `updateWorklog` not called.
4. Cancel → back to read-only row, no createWorklog.
5. Popover with selected person ≠ me shows "Log as me" trigger; with me selected shows "Add New Entry".

## Common Pitfalls

1. **Pre-commit runs `biome check --staged`, `tsc --noEmit`, full `npm run test`** (taskflow/.husky/pre-commit) — failing tests block commits; combine test+impl in one commit; after a failed hook, staged files remain staged (commit with explicit paths).
2. **React Compiler in app, not in vitest** — compute `isMine` from props/store values during render (pure helper), never from hidden module-level state; don't cache via `getState()` in render.
3. **Store reads per cell:** WorklogCellPopover renders for every day×issue cell; use fine-grained `useAuthStore((s) => s.x)` selectors (page already notes IN-01) or pass values down.
4. **Unmount on close:** WorklogCellPopover resets `anyEditing` on close; row mode state lives in content that unmounts — fine, but make sure copy mode also reports through `onEditingChange` or "Add New Entry" stays visible under the copy form.
5. **Don't bulk find-replace** "Add New Entry"/aria-labels (memory: scoped edits); only the worklogs call site changes label.
6. Run vitest/biome/tsc from inner `taskflow/taskflow/`; `.planning` + git at outer root.

## Environment / Packages
No new packages (lucide `Copy` icon already available via lucide-react). Package legitimacy audit: N/A.

## Security Domain
V4 Access Control: UI gating only; Jira server is authoritative (403 surfaces via mutation onError). Fail-closed ownership default. V5: durations via existing `parseDuration`; `started` via `+0000` pattern.

## Assumptions Log
| # | Claim | Risk if Wrong |
|---|-------|---------------|
| A1 | Jira DC usernames compare case-insensitively | Low — lowercase compare only widens matches for the same account |

## Validation
Quick: `cd taskflow && npx vitest run src/routes/worklogs` ; Full: `npm run test && npm run check`.
