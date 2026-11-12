---
phase: quick-261112-dai
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/notifications/notification-view.ts
  - taskflow/src/lib/notification-dispatch-log.ts
  - taskflow/src/lib/notification-dispatch-log.test.ts
  - taskflow/src/stores/notification-dispatch-log.store.ts
  - taskflow/src/hooks/useNotificationPolling.ts
  - taskflow/src/hooks/useNotificationPolling.test.tsx
  - taskflow/src/routes/dev-tools/NotificationsTab.tsx
  - taskflow/src/routes/dev-tools/NotificationsTab.test.tsx
autonomous: true
requirements: [QUICK-261112-dai]

must_haves:
  truths:
    - "OS notification title is item-led: 'PROJ-123 · <summary>' for Jira, '!<iid> · <MR title>' for GitLab, with no 'Jira —' or 'GitLab —' prefix (D-layout)"
    - "OS notification body is a single line '<first name>: <what happened>', or just '<what happened>' when the author is empty. It never contains '\\n' and never starts with ': '"
    - "Issue updates and GitLab system notes show only the top-priority change (status > assignee > others) as 'Field → value', plus ' (+N more)' when there are more changes (D-headline)"
    - "Comment and mention bodies are cleaned plain text from fullBody: Jira wiki and GitLab Markdown are stripped, the current user's [~username] becomes @<display name>, other mentions become @username, whitespace collapses, and the text is hard-capped at about 140 chars with an ellipsis (D-cleanup)"
    - "A poll with 3 or fewer fresh items sends one banner per item. A poll with more sends exactly one summary banner, '<n> new notifications' / '<j> Jira · <g> GitLab', omitting a zero side (D-bursts)"
    - "The Developer Tools Notifications tab shows a summary row with the exact summary strings and real outcome, plus one 'Grouped' row per folded item"
    - "In-app notification output is unchanged: cleanCommentText, commentPreview, describeEventParts and parseChangeLines keep their behaviour and their existing tests pass untouched"
  artifacts:
    - path: "taskflow/src/lib/notification-dispatch-log.ts"
      provides: "formatOsNotification(item, ctx?), toPlainNotificationText, planOsDispatch, OS_BURST_THRESHOLD, the 'grouped' outcome, a summary-capable log entry type"
      exports: ["formatOsNotification", "toPlainNotificationText", "planOsDispatch", "OS_BURST_THRESHOLD", "logOsDispatches"]
    - path: "taskflow/src/hooks/useNotificationPolling.ts"
      provides: "Dispatch loop: plan with planOsDispatch, send, log"
      contains: "planOsDispatch"
    - path: "taskflow/src/routes/dev-tools/NotificationsTab.tsx"
      provides: "Summary row and Grouped outcome rendering"
  key_links:
    - from: "taskflow/src/lib/notification-dispatch-log.ts"
      to: "taskflow/src/routes/notifications/notification-view.ts"
      via: "imports getEntityRef, getEntityTitle, parseChangeLines, parseSystemLines, orderChanges, isSystemNote, cleanCommentText, actorName"
      pattern: "from '../routes/notifications/notification-view'"
    - from: "taskflow/src/hooks/useNotificationPolling.ts"
      to: "planOsDispatch"
      via: "single plan, then tryDispatchOsNotification once per banner or once for the summary"
      pattern: "planOsDispatch\\("
---

<objective>
Condense desktop (OS) notifications so each one says clearly what it is about. The title names the item and the body is one short line saying what happened. Bursts of more than 3 fresh items collapse into one summary banner. The Developer Tools dispatch log keeps recording exactly what was sent.

Purpose: the current banners ('Jira — PROJ-1: long summary' / 'Author: raw wiki markup \n change \n change') are noisy and hard to scan.
Output: a rewritten formatter plus helpers in notification-dispatch-log.ts, a restructured dispatch loop, and summary/grouped rows in the dev-tools tab.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261112-dai-condense-desktop-notification-content-so/261112-dai-CONTEXT.md
@.planning/quick/261112-dai-condense-desktop-notification-content-so/261112-dai-RESEARCH.md
@taskflow/src/lib/notification-dispatch-log.ts
@taskflow/src/routes/notifications/notification-view.ts
@taskflow/src/hooks/useNotificationPolling.ts
@taskflow/src/stores/notification-dispatch-log.store.ts
@taskflow/src/routes/dev-tools/NotificationsTab.tsx

Repo layout: `.planning` and git live in /Users/mimo/Documents/Projects/taskflow. npm, vitest and biome run in the inner dir /Users/mimo/Documents/Projects/taskflow/taskflow.

Commit rules:
- The pre-commit hook runs the full vitest suite, biome and tsc. Put the RED and GREEN steps of each tdd task in ONE commit.
- Commit with `git commit -- <paths>`, then check `git log -1`. If the hook fails it leaves files staged.
- Never run `biome --write` on all of src. Only format the files you touched.
- The biome baseline has pre-existing diagnostics. The gate is "no NEW files flagged", not a diagnostic count.

Fixtures use placeholder data only (PROJ-1, Alex Doe, feature/x-y). No customer names or keys.

Interfaces in use (from notification-view.ts):
- `getEntityRef(item): string | null` returns the Jira key or `!iid`.
- `getEntityTitle(item): string` returns the summary without its `KEY:` prefix.
- `parseChangeLines(body): ChangeLine[]` handles issue-update bodies.
- `parseSystemLines(body): ChangeLine[]` handles GitLab system notes.
- `orderChanges(lines): ChangeLine[]` sorts status, then assignee, then the rest, with description last.
- `isSystemNote(item)` checks for the `gitlab-system-` id prefix.
- `cleanCommentText(text): string` is the in-app cleaner. Do not modify it.
- `actorName(author): string | undefined` returns the first name. It is currently private and is the only export this plan adds to that file.
- `ChangeLine` is `{ field (lower-case), from?, to?, text?, action? }`.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Item-led formatOsNotification + OS-only plain-text cleaner</name>
  <files>taskflow/src/routes/notifications/notification-view.ts, taskflow/src/lib/notification-dispatch-log.ts, taskflow/src/lib/notification-dispatch-log.test.ts</files>
  <behavior>
    - issue-update with 'Assignee: A → B\nStatus: To Do → In Review\nPriority: Low → High' from 'Alex Doe' gives title 'PROJ-1 · Title' and body 'Alex: Status → In Review (+2 more)'. Status wins over assignee even when assignee comes first.
    - An issue-update with a single change has no '(+N more)'. A from-only change renders as 'Assignee removed'. A text change renders as 'Labels +a −b' or 'Description edited'. A phrase-only change renders capitalised ('Merged').
    - A system mr-note ('gitlab-system-…' id, fullBody 'State: opened → merged') with mrIid 482 gives title '!482 · MR title' and body 'Alex: Merged' or 'Alex: State → merged', whichever the ChangeLine shape produces. Assert the exact string after implementing.
    - issue-assignment gives 'Alex: Assigned you'. mr-approval gives 'Alex: Approved'.
    - due-date-reminder with author '' gives body 'Due tomorrow', with no leading ': ' and no date suffix.
    - pipeline-failure with author '' and preview 'Pipeline #4821 failed on feature/x-y' gives body 'Pipeline failed on feature/x-y'. The branch name passes through unchanged.
    - jira-comment / comment-mention fullBody 'h3. Note\n*Can* you check {{{}staging{}}} logs [~jdoe]? [docs|https://x] !shot.png|thumbnail!' gives a single-line cleaned body. With ctx { jiraUsername: 'jdoe', jiraDisplayName: 'Jane Doe' } the mention becomes '@Jane Doe'. Without ctx it becomes '@jdoe'.
    - mr-note (human) and gitlab-mention fullBody with Markdown ('**b**', '[t](url)', '![a](u)', '# Head', '- item', a code fence) are cleaned to plain text.
    - toPlainNotificationText leaves 'snake_case', 'a-b-c', '2*3*4' and 'feature/x-y' unchanged. Text over the cap ends with '…' and is at most about 141 chars.
    - A GitLab item with no mrIid but url '…/merge_requests/77' still gets '!77 · title'. With neither, the title is just the entity title.
    - For every type: !body.includes('\n') and !body.startsWith(': ').
  </behavior>
  <action>
In notification-view.ts, the only change is adding `export` to `actorName`. Do not touch any other function in that file. The in-app output must stay byte-identical.

In notification-dispatch-log.ts:

1. Add `OsFormatContext { jiraUsername?: string; jiraDisplayName?: string }`.

2. Add a pure exported `toPlainNotificationText(text: string, ctx?: OsFormatContext): string`. It is OS-only (per D-cleanup) and runs these passes in order:
   - If ctx.jiraUsername and ctx.jiraDisplayName are set, replace `[~<jiraUsername>]` with `@<jiraDisplayName>`. This is the cheap self-mention mapping chosen by the orchestrator. Other mentions are not looked up over the network; cleanCommentText turns them into `@username` later.
   - Drop images: Jira `!x|opts!` and Markdown `![alt](url)`.
   - Markdown links `[t](url)` become t.
   - Jira teletype becomes its inner text, using a regex tolerant of `{{{}x{}}}` and `{{x}}`.
   - Replace `{color…}` with a space.
   - Remove line-leading `h1.`–`h6.`, `bq.`, Markdown `#` headings, list markers (`* `, `# `, `- `, `1. `), table pipes and code-fence lines.
   - Remove word-boundary-anchored inline emphasis: `*b*`, `_i_`, `+u+`, `-s-`, `^sup^`, `??cite??`, `__b__`. Anchor each match with a lookbehind on start/whitespace/`(` and a lookahead on whitespace/punctuation/end, so identifiers and hyphenated words survive. Run this pass after mention handling.
   - Run `cleanCommentText`, which handles `[~u]`, `[t|url]`, `{code}`, `**b**`, backticks, `> ` and the whitespace collapse.
   - Hard-cap at 140 chars: trim trailing punctuation and spaces, then append `…`.

3. Rewrite `formatOsNotification(item, ctx?)`:
   - **Title** (per D-layout):
     - `ref` = `getEntityRef(item)`. For GitLab items without a ref, fall back to `!` plus the `/merge_requests/(\d+)` match in `item.url`.
     - Title is `${ref} · ${getEntityTitle(item)}` when ref exists, otherwise just the entity title.
   - **What happened**, by `notificationType`:
     - issue-update, or an mr-note where `isSystemNote` is true (per D-headline): run `orderChanges` over `parseChangeLines` / `parseSystemLines` of `fullBody || bodyPreview`. Render the head change with a private `headline(c)`:
       - capitalise the first char of `field` only;
       - `to` present gives `Field → to`;
       - `text` present gives `Field text`;
       - `from` only gives `Field removed`;
       - otherwise give the capitalised field phrase.
       - Append ` (+N more)` when there are more changes.
       - With no parsed changes, use the first raw line cleaned with `toPlainNotificationText`.
     - issue-assignment gives `Assigned you`.
     - mr-approval gives `Approved`.
     - due-date-reminder gives `bodyPreview` as-is. It is computed at fetch time; do not recompute dates.
     - pipeline-failure: match `failed on (.+)$` and give `Pipeline failed on <branch>`. Fall back to bodyPreview. Do NOT run the comment cleaner on it.
     - Comment and mention types (jira-comment, comment-mention, human mr-note, gitlab-mention) give `toPlainNotificationText(fullBody || bodyPreview, ctx)`.
     - Unknown types give cleaned bodyPreview.
   - **Body**: `actor ? `${actor}: ${what}` : what`, with `actor = actorName(item.author)`. Finally apply `.replace(/\s+/g, ' ').trim()` so the result is guaranteed to be one line.

Read src/services/notifications.ts briefly (the producer per type) to confirm the exact notificationType string literals before writing the switch. Use the type union and do not guess.

Update the pinned assertions in notification-dispatch-log.test.ts by hand: 'Jira — PROJ-1: Title' becomes 'PROJ-1 · Title', 'Cara Doe: body' becomes 'Cara: body', and remove the `startsWith('GitLab — ')` assertion. Then add table-driven cases covering the behaviour list. Do not bulk find-replace.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/lib/notification-dispatch-log.test.ts src/routes/notifications && npx tsc --noEmit -p .</automated>
  </verify>
  <done>All new formatter and cleaner cases pass. The existing notification-view tests pass with no changes, which proves the in-app output is unchanged. Commit as feat(261112-dai) with the tests in the same commit.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Burst grouping (planOsDispatch) wired into the poller and dispatch log</name>
  <files>taskflow/src/lib/notification-dispatch-log.ts, taskflow/src/lib/notification-dispatch-log.test.ts, taskflow/src/stores/notification-dispatch-log.store.ts, taskflow/src/hooks/useNotificationPolling.ts, taskflow/src/hooks/useNotificationPolling.test.tsx</files>
  <behavior>
    - planOsDispatch with 3 fresh items returns kind 'items' with 3 banners, each with formatOsNotification strings.
    - planOsDispatch with 4 items (3 Jira, 1 GitLab) returns kind 'summary', title '4 new notifications', body '3 Jira · 1 GitLab'. With all 5 items Jira the body is '5 Jira'.
    - Polling hook, 1 fresh Jira item: dispatch is called with ('PROJ-1 · Title', 'Cara: body') and the log row matches. This is the updated pinned test at ~128-139.
    - Polling hook, 4 fresh items: dispatch is called exactly once, with the summary strings. The log holds 1 summary entry (outcome 'sent', items length 4) followed by 4 entries with outcome 'grouped'.
    - Already-known items are still logged as 'skipped' and do not count toward the threshold. The existing ~157 test still passes.
    - A denied or error result on the summary send still sets permissionDenied / notificationSendError.
  </behavior>
  <action>
Per D-bursts:

In notification-dispatch-log.ts:
- Export `OS_BURST_THRESHOLD = 3`.
- Add `'grouped'` to `OsDispatchOutcome`.
- Export a discriminated `OsDispatchPlan`:
  - `{ kind: 'items'; banners: { item; title; body }[] }`
  - `{ kind: 'summary'; title; body; items: NotificationItem[] }`
- Export a pure `planOsDispatch(items, ctx?)`:
  - Return 'items' when `items.length <= OS_BURST_THRESHOLD`.
  - Otherwise return 'summary' with title `${n} new notifications` and body built from the Jira and GitLab counts joined with ' · ', omitting a zero side.
- Widen `OsDispatchLogEntry` into a union:
  - item rows keep `{ kind?: 'item'; item; title; body; outcome }`, so existing callers and the 'skipped' rows stay valid;
  - summary rows are `{ kind: 'summary'; items: NotificationItem[]; title; body; outcome }`.

In notification-dispatch-log.store.ts, derive the `NotificationDispatchLogEntry` type from the same union plus `{ id, timestamp }`. Keep the `append` signature and the retention behaviour unchanged.

In useNotificationPolling.ts:
1. Restructure the loop at ~243-257.
2. Split `newItems` into known items (push 'skipped' rows as today, only when desktop is enabled) and `fresh` items.
3. If desktop is enabled and fresh is non-empty, call `planOsDispatch(fresh, { jiraUsername, jiraDisplayName: jiraUserDisplayName })`. Both values are already in scope in the poll callback; check the variable names around lines 176-182.
4. For a summary plan:
   - make one `tryDispatchOsNotification(plan.title, plan.body)` call;
   - apply the same denied/error flags;
   - push the summary row first, then one 'grouped' row per item with that item's own formatOsNotification strings.
5. For an items plan, keep the per-banner send/log behaviour, passing ctx to the formatter.
6. Keep `logOsDispatches(dispatchLog)` as the single log call.

Do not add an isFirstPoll gate. Grouping already covers the backfill burst.

Update the pinned assertions in useNotificationPolling.test.tsx by hand and add the 4-item burst test.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/lib/notification-dispatch-log.test.ts src/hooks/useNotificationPolling.test.tsx src/stores && npx tsc --noEmit -p .</automated>
  </verify>
  <done>A burst of 4 or more fresh items sends one OS banner and logs 1 summary row plus N grouped rows. Bursts of 3 or fewer behave per item. tsc is clean. Committed with the tests.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Developer Tools tab renders summary and Grouped rows</name>
  <files>taskflow/src/routes/dev-tools/NotificationsTab.tsx, taskflow/src/routes/dev-tools/NotificationsTab.test.tsx</files>
  <behavior>
    - An item row with title 'PROJ-1 · Title' renders as before: source badge plus banner preview.
    - A summary entry renders a 'summary' badge in place of the source badge, the exact title '4 new notifications' and body '3 Jira · 1 GitLab', and its real outcome label. When expanded it shows the banner preview and JSON of `items`.
    - A 'grouped' entry renders the label 'Grouped' in the muted skipped-style badge. When expanded it shows the note 'Not sent individually: folded into a summary banner.'
  </behavior>
  <action>
In NotificationsTab.tsx:
- Add `grouped: 'Grouped'` to OUTCOME_LABEL.
- In `outcomeClass`, style 'grouped' the same as 'skipped'.
- Branch on `entry.kind === 'summary'`:
  - render a neutral 'summary' badge using the existing muted badge classes, in place of `sourceBadgeClass(entry.item.source)`;
  - render `JSON.stringify(entry.items, null, 2)` for the raw JSON.
- Item rows are unchanged apart from narrowing.
- Add the grouped explanatory note next to the existing skipped note, and copy its markup.
- Keep the OsNotificationPreview for every row, because it reflects the exact strings.
- Update the file's header doc comment so it mentions summary/grouped rows.

Update the fixture title in NotificationsTab.test.tsx to 'PROJ-1 · Title' by hand, including the aria name. Add the summary and grouped cases.

Finally, run biome check on the 8 touched files only and fix anything it reports for them. Do not run biome on the whole tree.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dev-tools/NotificationsTab.test.tsx && npx biome check src/lib/notification-dispatch-log.ts src/lib/notification-dispatch-log.test.ts src/stores/notification-dispatch-log.store.ts src/hooks/useNotificationPolling.ts src/hooks/useNotificationPolling.test.tsx src/routes/dev-tools/NotificationsTab.tsx src/routes/dev-tools/NotificationsTab.test.tsx src/routes/notifications/notification-view.ts && npm test</automated>
  </verify>
  <done>The dev-tools tab shows summary and Grouped rows. Biome reports nothing new on the touched files and the full vitest suite is green. Committed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira/GitLab API → OS notification | Untrusted comment text, titles and branch names flow into the OS banner strings |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-dai-01 | Tampering | toPlainNotificationText regexes | mitigate | Use only non-nested, lazy and anchored patterns, with no catastrophic backtracking. Cap the output at 140 chars. Tests cover pathological markup. |
| T-dai-02 | Information disclosure | Notification fixtures | mitigate | Placeholder data only (PROJ-1, Alex Doe), per the no-customer-data rule |
| T-dai-03 | Denial of service | Banner flood on backfill | mitigate | planOsDispatch folds more than 3 fresh items into one banner |
| T-dai-04 | Spoofing | OS banner content | accept | Plain-text strings are passed to notify_rust and nothing is rendered as HTML. This is unchanged from today. |
</threat_model>

<verification>
- `npx vitest run` covering the dispatch-log, polling, NotificationsTab and routes/notifications tests passes.
- `npm test` (full suite) and `npx tsc --noEmit` are green.
- `git diff` of notification-view.ts shows only the `export` added to actorName.
- Biome reports nothing new on the touched files.
</verification>

<success_criteria>
- OS titles are item-led ('PROJ-1 · …', '!482 · …') and bodies are one condensed line.
- Issue updates show the headline change plus '(+N more)', and comments are cleaned plain text.
- Bursts of more than 3 send one summary banner, and the Developer Tools log shows the summary row plus the grouped rows.
- In-app notifications are unchanged.
</success_criteria>

<output>
Create `.planning/quick/261112-dai-condense-desktop-notification-content-so/261112-dai-SUMMARY.md` when done.
</output>
