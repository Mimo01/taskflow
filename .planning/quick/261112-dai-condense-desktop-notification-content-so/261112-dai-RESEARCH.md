# Quick 261112-dai: Condense desktop notification content - Research

**Researched:** 2026-11-12
**Domain:** OS notification formatting (Tauri plugin-notification) + poller dispatch loop
**Confidence:** HIGH (everything below is from reading the codebase and the installed plugin source, except where tagged [ASSUMED])

## Summary

Nearly everything the new formatter needs already exists in the pure in-app view model at `src/routes/notifications/notification-view.ts`. That file has `getEntityRef` (Jira key or `!iid`), `getEntityTitle` (summary with the `KEY:` prefix removed), `parseChangeLines` / `parseSystemLines` (structured `ChangeLine[]` built from the service's `Field: old → new` lines), `orderChanges` (status > assignee > priority > sprint > version/milestone > labels > others > description, which is the locked headline priority), and `cleanCommentText`. Build the new `formatOsNotification` on top of these instead of re-parsing strings. `lib/` already imports from `routes/` elsewhere (`src/lib/release-refresh.ts`), so the import direction is fine. `notification-view.ts` pulls in `notification-colours.ts`, which imports lucide icons. That is harmless in the app bundle and in vitest.

The desktop plugin only passes `title`, `body`, `icon` and `sound` to macOS. `subtitle` does not exist in the TS `Options`, and `group` (threadIdentifier) and `summary` are dropped by `desktop.rs`. All condensing has to happen inside the two strings.

For bursts, put the decision into a pure planner function in `notification-dispatch-log.ts` (for example `planOsDispatch(items)`). The hook loop then becomes "plan, send, log", and the Developer Tools log records both the summary banner and the folded items.

**Primary recommendation:** Rewrite `formatOsNotification(item)` as an item-led formatter that composes `getEntityRef`/`getEntityTitle` + `orderChanges(parse…Lines(fullBody))` + a new OS-only plain-text cleaner. Add a pure `planOsDispatch` that returns either per-item banners (3 or fewer) or one summary. Leave `cleanCommentText` and the in-app output untouched.

## Project Constraints (from CLAUDE.md / memory)
- App code, npm, vitest and biome run in the inner dir `/Users/mimo/Documents/Projects/taskflow/taskflow`. `.planning` and git are in the outer dir.
- The pre-commit hook runs the full vitest suite plus biome plus tsc, so RED and GREEN go in one commit per TDD task. Commit with `git commit -- <paths>` and check `git log -1` after a failed hook.
- Never run `biome --write` on all of `src`. Gate on "no NEW files flagged", not on a diagnostic count.
- The app uses React Compiler and vitest does not. Keep the formatter pure, with no clock reads and no hidden module state.
- Fixtures must use placeholder data only (no customer names or keys).
- Do not bulk find-replace identifiers that also appear in labels. Edit the three pinned tests by hand.

## Item shapes per notificationType (from `src/services/notifications.ts`)

| Type | entityTitle | author | bodyPreview / fullBody | Proposed OS title / body |
|------|-------------|--------|------------------------|--------------------------|
| issue-update | `KEY: summary` | changelog author (fallback assignee/reporter) | `\n`-joined lines `Status: A → B`, `Assignee: A → B`, `Description: updated\|set`, `<Label>: A → B` (TRACKED_FIELDS incl. `Flagged`), `(none)` for empty; preview == full (uncut) | `KEY · summary` / `Alex: Status → In Review (+2 more)` |
| issue-assignment | `KEY: summary` | assigner | `Assigned to you by <name>` | `KEY · summary` / `Alex: Assigned you` (the current string would read "Alex: Assigned to you by Alex Smith") |
| comment-mention | `KEY: summary` | comment author | raw Jira wiki; preview = `body.substring(0,80)` (raw cut, can split markup) | `KEY · summary` / `Maria: <cleaned fullBody>` |
| jira-comment | same as above | same | same | same |
| due-date-reminder | `KEY: summary` | `''` (empty) | `Due today` / `Due tomorrow`; full adds `(yyyy-mm-dd)` | `KEY · summary` / `Due tomorrow` (no `: ` prefix; the current string is `: Due today`) |
| mr-note (system, id `gitlab-system-*`) | `mr.title` (no iid) | note author | `parseSystemNote` output, e.g. `State: opened → merged`, `Review requested: a, b`, `Labels added: x`; preview cut at 120 | `!482 · title` / `Alex: Merged`, `Alex: Review requested → ana` |
| mr-note (human) | `mr.title` | note author | raw GitLab Markdown, cut at 80 | `!482 · title` / `Maria: <cleaned fullBody>` |
| gitlab-mention | same as above | same | same | same |
| mr-approval | `mr.title` | approver | `Approved by <name>` | `!482 · title` / `Maria: Approved` |
| pipeline-failure | `mr.title` | `''` (empty) | `Pipeline #<id> failed on <branch>` | `!482 · title` / `Pipeline failed on feature/x` (locked example drops `#id`) |

**Title derivation:** `ref = getEntityRef(item)`, `name = getEntityTitle(item)`, `title = ref ? \`${ref} · ${name}\` : name`. Every GitLab producer sets `mrIid`. Items persisted before the field existed could lack it, but OS dispatch only runs for freshly fetched items, so `getEntityRef` returning `null` is only a fallback. If you want to harden it, parse `/merge_requests/(\d+)` from `item.url`. `getJiraKey` already falls back to `/browse/KEY` in `url`.

**Author label:** the locked examples use first names ("Alex:", "Maria:"). `actorName(author)` in notification-view.ts (line 388) does exactly this and returns `undefined` for `''`. It is not exported yet, so export it. Body = `actor ? \`${actor}: ${what}\` : what`.

**Headline change (issue-update / system mr-note):**
`changes = orderChanges(item.notificationType === 'issue-update' ? parseChangeLines(src) : parseSystemLines(src))` where `src = item.fullBody || item.bodyPreview`. Use `fullBody`: the system-note preview is cut at 120 characters. (`changeSource` is private, but `fullBody` is always the uncut text for these types.) `ChangeLine.field` is lower-cased ("status", "fix version"), so capitalise the first letter for display. Render the head change as follows:
- `to` present: `Status → In Review` (drop `from`, per the locked example)
- `from` only: `Assignee removed` / `Fix version removed`
- `text` (labels diff `+a −b`, `edited`, `removed`): `Labels +a −b`, `Description edited`
- phrase-only (`merged`, `closed`, `reopened`, `marked as draft`, `ready for review`, `flagged`): capitalised phrase
- Append ` (+N more)` when `changes.length > 1`.
- If `changes` is empty (unparseable line), fall back to the first raw line of the body, cleaned.

To check the locked priority: `orderChanges` ranks the status action 0, assignee/unassigned 1, then the others, with description last. That is the order CONTEXT asks for.

## Plain-text cleanup (comments / mentions)

| Existing helper | Location | Covers | Gaps |
|-----------------|----------|--------|------|
| `cleanCommentText` | notification-view.ts:315 (used by in-app `commentPreview`) | `[~u]`→`@u`, `[t\|url]`→t, `{code\|noformat\|quote\|panel}`, `**b**`, backticks, `> `, whitespace collapse | Jira `*b*` `_i_` `-s-` `+u+` `{{mono}}` / `{{{}x{}}}`, `{color}`, `!img!`, `h1.`, `bq.`, list markers, table pipes; Markdown `[t](url)`, `![alt](url)`, `#` headings, fences, `__b__` |
| `stripWikiMarkup` | src/lib/search-text.ts:202 (global search) | headings, `{code\|noformat\|quote\|color\|panel}`, `!img!`, `[~u]`→u, `[t\|url]`, whitespace | inline emphasis, Markdown |

**Recommendation:** add a new pure `toPlainNotificationText(text)` next to the formatter. Do not change `cleanCommentText`, because the in-app preview is out of scope and has its own tests. The new function should apply the extra passes and then `cleanCommentText`:
1. Drop images: Jira `!x.png|thumbnail!` and Markdown `![alt](url)`.
2. Markdown links: `[t](url)` becomes t.
3. Jira teletype: `{{{}x{}}}` and `{{x}}` become x. Real Jira content is `{{{}TEXT{}}}` (see memory: Jira tt macro format), so use `\{\{\{?\}?(.+?)\{?\}?\}\}`.
4. `{color:…}` / `{color}` become a space.
5. Line-leading `h1.`–`h6.`, `bq.`, `#`-headings, list markers `* ` `# ` `- ` `1. `, table `||` `|`, and code-fence lines are removed.
6. Inline emphasis: `*b*` `_i_` `+u+` `-s-` `~sub~` `^sup^` `??cite??`, `__b__`. Only match these at word boundaries, for example `(^|[\s(])\*(\S[^*]*?)\*(?=[\s).,!?:;]|$)`, so that `snake_case`, `a-b-c` and `2*3*4` survive. Run this pass after `[~user]` handling so the `~` pass cannot eat mentions.
7. Then run `cleanCommentText`, which handles `[~u]`, links, `{code}` and the whitespace collapse.
8. Hard-cap the result at about 140 chars with `…` (trim trailing punctuation first, like `commentPreview` does).

Always use `fullBody`. `bodyPreview` is a raw 80-character cut that can end inside markup.

**`[~user]` mentions to names:** resolving a username to a display name requires a network call (`fetchJiraUserByName` via `useMentionUserMap`). Do not add async lookups to the dispatch loop. The cheap win is to let the formatter take an optional `{ jiraUsername, jiraDisplayName }` context and map the current user's `[~jiraUsername]` to `@<first name>`. Both values are already in scope in the hook (`jiraUsername`, `jiraUserDisplayName`). Other mentions render as `@username`, which matches the in-app behaviour. GitLab `@username` is already plain text.

## Tauri plugin facts (installed 2.3.3, JS and crate)

- `sendNotification` on desktop only applies `title`, `body`, `icon` and `sound`. Verified in `~/.cargo/registry/.../tauri-plugin-notification-2.3.3/src/desktop.rs` (lines 26-43 and 179-193, which map to `notify_rust::Notification.summary(title)` and `.body(body)`). [VERIFIED: crate source]
- The TS `Options` has no `subtitle` field. `group`, `summary`, `largeBody` and `inboxLines` are documented for iOS/Android and are dropped on desktop. **Do not adopt them.** [VERIFIED: node_modules/@tauri-apps/plugin-notification/dist-js/index.d.ts + desktop.rs]
- macOS banner rendering: the title is one line, truncated with an ellipsis. The body shows about 2 lines in the banner and more when expanded in Notification Center. [ASSUMED] The dev-tools `OsNotificationPreview` already models this (title `truncate`, body `line-clamp-2`), so no change is needed there.
- Keep `sound: 'Basso'`. Send one summary banner per burst, which also avoids stacking repeated sounds.

## Burst grouping: dispatch loop restructure

Current loop (`useNotificationPolling.ts` ~238-256): for each `newItems` entry, a known id logs `skipped` (only if desktop is enabled). Otherwise it calls `formatOsNotification`, `await tryDispatchOsNotification`, records `denied`/`error` flags, and logs the entry. **Note:** OS dispatch does not check `isFirstPoll`. After being offline, the first poll can therefore fire one banner per unknown 24h-backfill item. Grouping fixes this as a side effect.

**Recommended shape (pure, unit-testable):**
```ts
// lib/notification-dispatch-log.ts
export const OS_BURST_THRESHOLD = 3;
export type OsDispatchPlan =
  | { kind: 'items'; banners: { item: NotificationItem; title: string; body: string }[] }
  | { kind: 'summary'; title: string; body: string; items: NotificationItem[] };
export function planOsDispatch(items: NotificationItem[], ctx?: OsFormatContext): OsDispatchPlan;
// summary: title `${n} new notifications`, body `4 Jira · 3 GitLab` (omit a zero side → `7 Jira`)
```
Hook loop: split `newItems` into `known` (logged `skipped` as today) and `fresh`. Then `plan = planOsDispatch(fresh)`. For `items`, keep today's per-item send and log. For `summary`, make one `tryDispatchOsNotification(plan.title, plan.body)` call and apply the same denied/error flag handling.

**Dev-tools log for the grouped case (discretion; recommendation):**
- Add `'grouped'` to `OsDispatchOutcome`. Each folded item is logged with its own would-be title and body and outcome `grouped` (label "Grouped", muted style like `skipped`). The expanded panel notes "Not sent individually: folded into a summary banner."
- Add one summary entry carrying the real outcome (`sent`/`denied`/`error`) and the exact summary title and body. `NotificationDispatchLogEntry.item` is currently required and `NotificationsTab` reads `entry.item.source` and `JSON.stringify(entry.item)`. Make the entry a discriminated union, for example `item?: NotificationItem; items?: NotificationItem[]` or `kind: 'item' | 'summary'`. For summary rows the tab shows a "summary" badge instead of the source badge and the raw JSON of `items`. Log order should be summary first, then the grouped members (the store reverses each poll's batch).
- `logOsDispatches` and the store's `append` signature stay as they are. Only the entry type widens.

## Tests that pin the current strings (must be updated by hand)

| File | Pins |
|------|------|
| `src/lib/notification-dispatch-log.test.ts:38-45` | `'Jira — PROJ-1: Title'`, `'Cara Doe: body'`, `startsWith('GitLab — ')` |
| `src/hooks/useNotificationPolling.test.tsx:128-139` | logged title/body and `dispatch` called with `('Jira — PROJ-1: Title', 'Cara Doe: body')`. The new values become `('PROJ-1 · Title', 'Cara: body')` |
| `src/routes/dev-tools/NotificationsTab.test.tsx:33-51` | fixture title `'Jira — PROJ-1: Title'` and the aria name. These only render stored strings, so the test still passes, but update it for realism and add a summary-row and `grouped` case |
| `src/services/notifications.test.ts:389+` | `tryDispatchOsNotification('Test Title','Test body')`. Unaffected unless the signature changes (it should not) |

The "already-known items are recorded as skipped" test (polling test ~157) must keep passing.

## Common Pitfalls

1. **Empty author.** due-date and pipeline items have `author: ''`, which currently produces the body `": Due today"`. Never emit a leading `: `.
2. **Redundant actor.** Assignment and approval preview strings already contain the author name. Build the body from the type (`Assigned you`, `Approved`), not from `bodyPreview`.
3. **Raw 80-char cut.** Cleaning `bodyPreview` can leave `[~jsm` or `{code` fragments. Always clean `fullBody`.
4. **`\n` in the body.** Issue updates join lines with `\n`. The final body must go through `.replace(/\s+/g,' ')` and the tests should assert `!body.includes('\n')`.
5. **Over-eager emphasis regex.** A `_i_` or `-s-` pass mangles identifiers, branch names (`feature/sso-retry`) and hyphenated words. Use word-boundary anchors and test them. Do not run the comment cleaner on pipeline branch names.
6. **Field casing.** `ChangeLine.field` is lower-case. Capitalise only the first char ("Fix version → 2.1"). Do not title-case the values.
7. **React Compiler / clock.** The formatter must stay pure. The due-date label is computed at fetch time, so don't recompute "today/tomorrow" in the formatter. NotificationsTab renders stored strings, so there is no render-time formatting to go stale.
8. **Threshold counts only fresh items.** Count only items that would actually be sent, excluding `existingIds` and type-disabled items (already filtered). Skipped rows don't count. A desktop-disabled poll logs nothing, as today.
9. **The in-app view must not change.** Don't modify `cleanCommentText`, `commentPreview`, `describeEventParts` or `parseChangeLines` behaviour. Add the new helpers and only export `actorName`.

## Validation Architecture

| Property | Value |
|----------|-------|
| Framework | vitest (inner dir), jsdom + @testing-library/react |
| Quick run | `cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/lib/notification-dispatch-log.test.ts src/hooks/useNotificationPolling.test.tsx src/routes/dev-tools/NotificationsTab.test.tsx` |
| Full suite | `npm test` (also runs in the pre-commit hook), plus `npm run check` |

Test map (all automated):
- `formatOsNotification`: a table-driven case for each of the 9 types, covering title `KEY · summary` / `!iid · title`, the missing-mrIid fallback, no-author bodies, headline + `(+N more)`, status-over-assignee priority, single-line output and the length cap.
- `toPlainNotificationText`: wiki and Markdown samples (`{{{}x{}}}`, `*b*`, `[t|url]`, `[t](url)`, `!img!`, `{code}`, lists), the self-mention → name case, and survival of `snake_case`, `a-b-c` and `feature/x-y`.
- `planOsDispatch`: 3 fresh items give 3 banners; 4 give a summary (`4 new notifications` / `3 Jira · 1 GitLab`); a single source omits the zero side.
- Polling hook: a 4-item poll leads to exactly 1 `dispatch` call with the summary strings, and the log holds 1 summary row plus 4 `grouped` rows.
- NotificationsTab renders the summary row and the Grouped label.

No Wave 0 gaps: all test files and fixtures already exist.

## Assumptions Log

| # | Claim | Risk if wrong |
|---|-------|---------------|
| A1 | The macOS banner shows a 1-line title and about 2 body lines | Low. Only affects how much text is visible, and the dev-tools preview already approximates it |
| A2 | Mapping only the current user's `[~username]` to a name (others stay `@username`) satisfies "turn mentions into names" | Medium. If the user expects every mention resolved, that needs a user cache lookup (no sync source exists in the item) |

## Open Questions
1. Should the summary banner list the entities (`PROJ-1, PROJ-4, !482…`) instead of the source counts? CONTEXT gives `4 Jira · 3 GitLab`, so use that.

## Sources
- Codebase: `src/lib/notification-dispatch-log.ts`, `src/hooks/useNotificationPolling.ts` (L170-256), `src/services/notifications.ts` (L97-118, 166-270, 300-340, 440-480, 552-700, 753-805, 893-909), `src/routes/notifications/notification-view.ts` (L75-101, 205-376, 377-536), `src/lib/search-text.ts:202`, `src/hooks/useMentionUserMap.ts`, `src/stores/notification-dispatch-log.store.ts`, `src/routes/dev-tools/NotificationsTab.tsx`
- Installed plugin: `node_modules/@tauri-apps/plugin-notification` 2.3.3 `dist-js/index.d.ts`; crate `tauri-plugin-notification-2.3.3/src/desktop.rs`

**Valid until:** 2026-12-12 (stable; re-check if plugin-notification is upgraded)
