---
phase: quick-261112-cmy
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/lib/notification-dispatch-log.ts
  - taskflow/src/lib/notification-dispatch-log.test.ts
  - taskflow/src/hooks/useNotificationPolling.ts
  - taskflow/src/hooks/useNotificationPolling.test.tsx
autonomous: true
requirements: [QUICK-261112-cmy]

must_haves:
  truths:
    - "In dev (import.meta.env.DEV) with Desktop notifications ON, each poll that has new items writes one collapsed devtools group '[notifications] N dispatched, M skipped' (per D-01, D-02, discretion format)"
    - "Each dispatched entry shows the exact title/body strings passed to tryDispatchOsNotification plus its result sent/denied/error and the full item (per D-03, D-05)"
    - "Items skipped by the existingIds guard appear in the group marked 'skipped (already known)' (per D-04)"
    - "With Desktop notifications OFF nothing is logged, including skips (per D-02)"
    - "With DEV false nothing is logged, but the real OS dispatch still runs (per D-01, D-03)"
  artifacts:
    - path: "taskflow/src/lib/notification-dispatch-log.ts"
      provides: "formatOsNotification (single title/body source of truth) + logOsDispatches (DEV-gated collapsed group)"
      exports: ["formatOsNotification", "logOsDispatches", "OsDispatchLogEntry"]
    - path: "taskflow/src/lib/notification-dispatch-log.test.ts"
      provides: "Unit tests for formatter and logger gating/format"
  key_links:
    - from: "taskflow/src/hooks/useNotificationPolling.ts"
      to: "formatOsNotification"
      via: "dispatch loop uses formatter for both tryDispatchOsNotification args and the log entry"
      pattern: "formatOsNotification\\(item\\)"
    - from: "taskflow/src/hooks/useNotificationPolling.ts"
      to: "logOsDispatches"
      via: "called once after the loop inside an import.meta.env.DEV guard"
      pattern: "import\\.meta\\.env\\.DEV"
---

<objective>
In dev mode the macOS bundle is unsigned, so OS desktop notifications never show. Log what would be dispatched to the webview devtools console, one collapsed group per poll, gated to DEV and the Desktop notifications toggle. The real send still runs and its result is logged (D-01..D-04 in CONTEXT.md; format is Claude's discretion, D-05 = shared title/body helper).

Purpose: lets the developer see exactly which OS notifications would fire, and with what text, without signing the app.
Output: new `src/lib/notification-dispatch-log.ts` module + tests; dispatch loop in `useNotificationPolling.ts` rewired to use it.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261112-cmy-dev-mode-devtools-log-of-desktop-notific/261112-cmy-CONTEXT.md
@.planning/quick/261112-cmy-dev-mode-devtools-log-of-desktop-notific/261112-cmy-RESEARCH.md
@taskflow/src/hooks/useNotificationPolling.ts
@taskflow/src/hooks/useNotificationPolling.test.tsx
@taskflow/src/services/jira/greenhopper/warnOnce.ts

Paths: `.planning` and git live at repo root `/Users/mimo/Documents/Projects/taskflow`; all npm/vitest/biome/tsc commands run in `/Users/mimo/Documents/Projects/taskflow/taskflow`. The pre-commit hook runs the full vitest suite + biome + tsc, so each task's tests and implementation land in ONE commit (no separate RED commit). Use `git commit -- <paths>` and check `git log -1 --stat`, because a failed hook leaves files staged.

Interfaces:
- `NotificationItem` is exported from `taskflow/src/stores/notifications.store.ts` (line ~28); fields used here: `id`, `source: 'jira' | 'gitlab'`, `entityTitle`, `author`, `bodyPreview`.
- `tryDispatchOsNotification(title: string, body: string): Promise<'sent' | 'denied' | 'error'>` in `taskflow/src/services/notifications.ts:893`. Do not change it.
- Current dispatch loop: `useNotificationPolling.ts` ~L237-249. Title is `` `${item.source === 'jira' ? 'Jira' : 'GitLab'} — ${item.entityTitle}` `` and body is `` `${item.author}: ${item.bodyPreview}` `` (em dash U+2014; keep it byte-identical).
- The hook test mocks `../services/notifications` with only `fetchNewNotifications` and `tryDispatchOsNotification`. That is why the new helpers go in `src/lib/`, not the services file (RESEARCH section 2a).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: notification-dispatch-log module (formatter + DEV-gated logger)</name>
  <files>taskflow/src/lib/notification-dispatch-log.ts, taskflow/src/lib/notification-dispatch-log.test.ts</files>
  <behavior>
    - formatOsNotification on a jira item with entityTitle 'PROJ-1: Title', author 'Cara Doe', bodyPreview 'body' returns title 'Jira — PROJ-1: Title' and body 'Cara Doe: body'. A gitlab item returns a title starting 'GitLab — '.
    - logOsDispatches([]) logs nothing (no groupCollapsed call).
    - logOsDispatches with 2 'sent' entries and 1 'skipped' entry calls console.groupCollapsed once with '[notifications] 2 dispatched, 1 skipped', makes one console.log per entry, then calls console.groupEnd once.
    - A dispatched entry's console.log args include the outcome, the title string, the body string, and the item object. A skipped entry's args include 'skipped (already known)'.
    - Outcomes 'denied' and 'error' count as dispatched (the send was attempted) and show their result word.
    - With vi.stubEnv('DEV', false), logOsDispatches with entries logs nothing.
  </behavior>
  <action>
    Create `taskflow/src/lib/notification-dispatch-log.ts`, exporting:
    - `formatOsNotification(item: Pick<NotificationItem, 'source' | 'entityTitle' | 'author' | 'bodyPreview'>): { title: string; body: string }`. This is the single source of truth for OS notification text (per D-05). Its strings must be exactly the current inline template strings in the hook (see the interfaces above).
    - `type OsDispatchLogEntry = { item: NotificationItem; title: string; body: string; outcome: 'sent' | 'denied' | 'error' | 'skipped' }`.
    - `logOsDispatches(entries: OsDispatchLogEntry[]): void`. Its first statement is `if (!import.meta.env.DEV) return;`, read at call time and never cached in a module const, so vi.stubEnv works and Vite drops the body in prod (per D-01). Then return early if entries is empty. Otherwise:
      - Count dispatched entries (outcome !== 'skipped') and skipped entries.
      - Call `console.groupCollapsed` with `` `[notifications] ${dispatched} dispatched, ${skipped} skipped` ``.
      - For each entry, call `console.log`. Dispatched entries log the outcome word, then title, body and item. Skipped entries log the label 'skipped (already known)' with the same title, body and item. Prefix each line so it reads clearly, e.g. `'→ sent'` or `'⊘ skipped (already known)'`.
      - Call `console.groupEnd()`.
    Follow the bare-console `[prefix]` convention from warnOnce.ts. No new logger abstraction.
    Add a short JSDoc saying this is dev-only because unsigned macOS dev bundles can't show OS notifications.
    Write the test file first with the behaviors above. Spy on console.groupCollapsed, console.log and console.groupEnd with mockImplementation(() => {}). Use `afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); })`. Build items with a local factory using placeholder data only (no customer data).
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/lib/notification-dispatch-log.test.ts && npx biome check src/lib/notification-dispatch-log.ts src/lib/notification-dispatch-log.test.ts</automated>
  </verify>
  <done>All behavior tests pass and biome is clean on both files. Commit together with Task 2, or alone if the full suite passes: `feat(261112-cmy): dev-only OS notification dispatch log helpers`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire the formatter and logger into the polling dispatch loop</name>
  <files>taskflow/src/hooks/useNotificationPolling.ts, taskflow/src/hooks/useNotificationPolling.test.tsx</files>
  <behavior>
    - Desktop ON, DEV (vitest default): after the second poll, console.groupCollapsed is called with '[notifications] 1 dispatched, 0 skipped'. A console.log call contains dispatch.mock.calls[0][0] (title) and dispatch.mock.calls[0][1] (body), and those equal 'Jira — PROJ-1: Title' and 'Cara Doe: body'.
    - Desktop OFF: dispatch is not called and console.groupCollapsed is never called with a '[notifications]' title.
    - vi.stubEnv('DEV', false) with desktop ON: dispatch is still called once, and there is no '[notifications]' group.
    - Skip: store seeded with item('known-1'), desktop ON, and a fetch returning [item('known-1'), item('fresh-1')]. dispatch is called once (fresh-1), and the group title is '[notifications] 1 dispatched, 1 skipped', with a log line containing 'skipped (already known)'.
  </behavior>
  <action>
    In `useNotificationPolling.ts`:
    - Import `formatOsNotification`, `logOsDispatches` and `type OsDispatchLogEntry` from `'../lib/notification-dispatch-log'`.
    - Rewrite the loop at ~L237-249 to keep the existing semantics. Declare `const dispatchLog: OsDispatchLogEntry[] = []` before the loop.
    - For each item:
      - If `existingIds.has(item.id)`: when `desktopNotificationsEnabledRef.current` is true, push a 'skipped' entry built with `formatOsNotification(item)` (per D-04 and D-02: no skips are recorded while the toggle is off). Then `continue`.
      - If `desktopNotificationsEnabledRef.current` is true: compute `const { title, body } = formatOsNotification(item)`, call `await tryDispatchOsNotification(title, body)` (the real send is kept per D-03), keep the existing setPermissionDenied/setNotificationSendError handling, and push `{ item, title, body, outcome: result }`.
    - After the loop, call `if (import.meta.env.DEV) logOsDispatches(dispatchLog);`. The call-site guard is deliberate, for tree-shaking (RESEARCH section 3), per D-01. Log once after the loop, not per item, so awaits don't interleave with other console output.
    - Don't touch banners, cursors, or the `else if` branch. No settings UI.
    In `useNotificationPolling.test.tsx`:
    - Add the 4 behaviors as new `it` cases. Reuse `pollOnce` for the on, off and DEV-false cases.
    - Spy on console.groupCollapsed/log/groupEnd with mockImplementation(() => {}) in those tests. Add `vi.restoreAllMocks()` and `vi.unstubAllEnvs()` in an afterEach, and add `afterEach` to the vitest import. Careful: restoreAllMocks must not reset the module-level `dispatch` vi.fn's mockResolvedValue('sent'). It is a vi.fn, not a spy, so restoreAllMocks leaves its implementation alone in vitest 4. If it does get reset, re-apply `dispatch.mockResolvedValue('sent')` in beforeEach.
    - Use `waitFor` on the groupCollapsed spy, because logging happens after the awaited dispatch.
    - For the skip case, seed `useNotificationsStore.setState({ items: [item('known-1')] })` before rendering and set desktop on. Run the same two-poll pattern, with the second fetch returning both items.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/hooks/useNotificationPolling.test.tsx src/lib/notification-dispatch-log.test.ts && npx biome check src/hooks/useNotificationPolling.ts src/hooks/useNotificationPolling.test.tsx src/lib/notification-dispatch-log.ts src/lib/notification-dispatch-log.test.ts && npx tsc --noEmit && npx vitest run</automated>
  </verify>
  <done>The hook no longer contains the inline template strings (`grep -c "bodyPreview}" src/hooks/useNotificationPolling.ts` returns 0). All new and existing hook tests pass, and the full suite, biome and tsc are green. Committed via `git commit -- <4 files>` as `feat(261112-cmy): log would-be OS notifications to devtools in dev`, and `git log -1 --stat` shows exactly these files.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| app → devtools console | Notification previews (author, body text) are written to the console in dev builds only |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-cmy-01 | Information disclosure | logOsDispatches | mitigate | `import.meta.env.DEV` guard at the call site and as the first line of the helper; Vite turns it into the literal false in prod, so nothing is emitted; covered by the stubEnv('DEV', false) tests |
| T-cmy-02 | Information disclosure | test fixtures | mitigate | placeholder names/data only in tests (no customer data in repo) |
</threat_model>

<verification>
- `npx vitest run` (full suite), `npx biome check` on the 4 changed files, and `npx tsc --noEmit` all pass in taskflow/taskflow.
- Manual (optional): `npm run tauri dev`, turn on Desktop notifications, wait for a poll that has new items, and confirm a collapsed `[notifications] N dispatched, M skipped` group in the webview devtools.
</verification>

<success_criteria>
- Dev + toggle ON: one collapsed group per poll with new items, showing exact OS title/body, result, and full item; skips are marked.
- Toggle OFF or prod build: zero console output from this feature; the real dispatch behaviour is unchanged.
- Title/body come from a single `formatOsNotification` helper used for both the send and the log.
</success_criteria>

<output>
Create `/Users/mimo/Documents/Projects/taskflow/.planning/quick/261112-cmy-dev-mode-devtools-log-of-desktop-notific/261112-cmy-SUMMARY.md` when done
</output>
