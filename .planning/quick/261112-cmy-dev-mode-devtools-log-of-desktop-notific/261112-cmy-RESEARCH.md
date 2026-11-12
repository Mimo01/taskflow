# Quick 261112-cmy: Dev-mode devtools log of desktop notifications - Research

**Researched:** 2026-11-12
**Confidence:** HIGH (all findings from reading the codebase and the installed vitest typings)

<user_constraints>
Locked decisions are in 261112-cmy-CONTEXT.md: only log when `import.meta.env.DEV`; only log when the desktop toggle is on; still try the real send and log its result; log `existingIds` skips marked as skipped; extract one title/body helper so the logged strings and the OS strings can't drift. Format is Claude's discretion (one collapsed group per poll).
</user_constraints>

## 1. Logging conventions and lint

- **There's no logger or debug-log helper in `src/`.** The only console use in production code is `src/services/jira/greenhopper/warnOnce.ts:28`, a bare `console.warn` with a `[greenhopper]` prefix. Follow that pattern: plain `console.groupCollapsed` / `console.log` / `console.groupEnd` with a `[notifications]` prefix. [VERIFIED: grep]
- **Biome doesn't block console calls.** `biome.json` uses `recommended: true` and adds only `noExplicitAny` and `noArrayIndexKey` under `suspicious`. In Biome 2, `noConsole` is not in the recommended set, and `warnOnce.ts` already passes the lint gate with a console call. [VERIFIED: biome.json + existing code; that `noConsole` is off by default is ASSUMED from Biome 2 docs, but the existing passing code supports it]
- **There's already a DEV-gating precedent.** `src/routes/settings/NotificationSettingsSection.tsx:229` checks `import.meta.env.DEV && navigator.platform.startsWith('Mac') && desktopNotificationsEnabled` to show the "dev mode can't send" alert. Read `import.meta.env.DEV` the same way.

## 2. Tests

- **`src/hooks/useNotificationPolling.test.tsx` replaces `../services/notifications` with a mock factory** that defines only `fetchNewNotifications` and `tryDispatchOsNotification`. `dispatch` is a `vi.fn().mockResolvedValue('sent')`. The existing tests "switch on" and "switch off" (L106-116) use `pollOnce(enabled)` and check `dispatch` call counts.
  - **Pitfall:** if the new helpers (e.g. `formatOsNotification`, `logOsDispatch`) go into `services/notifications.ts` and the hook imports them, the mock doesn't define them and the hook breaks in tests. Either:
    - (a) put the helpers in a new module such as `src/lib/notification-dispatch-log.ts` (recommended: no mock churn, and it's easy to unit-test directly), or
    - (b) add them to the mock factory, or switch to `vi.mock(path, async (importOriginal) => ({...await importOriginal(), ...}))`.
- **`src/services/notifications.test.ts` mocks `@tauri-apps/plugin-notification`** (`isPermissionGranted`, `requestPermission`, `sendNotification`). Tests for `tryDispatchOsNotification` start around L389. No change is needed there unless the title/body formatter lives in that file.
- **DEV gating in vitest:** `import.meta.env.DEV` is `true` by default in vitest (mode `test`, not prod). The installed vitest 4 typings show `vi.stubEnv(name, value: name extends 'PROD'|'DEV'|'SSR' ? boolean : string)` (`node_modules/vitest/dist/index.d.ts:500`), so `vi.stubEnv('DEV', false)` is supported. `unstubEnvs` isn't set in `vitest.config.ts`, so add `afterEach(() => vi.unstubAllEnvs())`. Read `import.meta.env.DEV` when the function runs, not into a module-level const, or the stub won't take effect.
- **Suggested tests:**
  - `const spy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {})`, plus spies on `console.log` and `console.groupEnd`.
  - Assert the group title (`[notifications] 1 dispatched, 0 skipped`), and that the logged title/body equal the `dispatch` call args.
  - Toggle off: no logging.
  - `vi.stubEnv('DEV', false)`: no logging, but `dispatch` is still called.
  - An item already in the store gets logged as skipped.
  - Restore the spies with `vi.restoreAllMocks()`. `src/test/setup.ts` doesn't silence console.

## 3. Pitfalls

- **React Compiler:** not a concern. The loop runs inside the `queryFn` (an async closure, not render), and the compiler only memoises render-time values. The [React Compiler vs module reads] memory issue is about module-level reads during render. The plain helper reads `import.meta.env.DEV` (a compile-time constant) and its arguments, with no hidden mutable state. The ref read `desktopNotificationsEnabledRef.current` is unchanged.
- **Tree-shaking:** Vite replaces `import.meta.env.DEV` with the literal `false` in production builds, so `if (import.meta.env.DEV) {...}` blocks get removed by minification. To guarantee no prod output, check `import.meta.env.DEV` directly at the call site or as the first line of the helper; don't route it through a variable from another module. If the helper module is only used under a DEV guard, Rollup drops it too. [ASSUMED: standard Vite behaviour, not re-verified this session]
- **Collect, then log once:** build an array of `{ item, title, body, result | 'skipped (already known)' }` during the loop and emit one group after it. The `await` in the loop means calling `groupCollapsed` per item would interleave with other console output.
- **Skips and the toggle:** with the toggle off, log nothing at all, including skips (locked decision). So collect skips only when `desktopNotificationsEnabledRef.current` is true, and don't log an empty group.
- **Formatter is the single source of truth:** move `` `${item.source === 'jira' ? 'Jira' : 'GitLab'} — ${item.entityTitle}` `` and `` `${item.author}: ${item.bodyPreview}` `` (useNotificationPolling.ts L243-244) into `formatOsNotification(item) => { title, body }`. Use it for both the `tryDispatchOsNotification` call and the log.

## Validation

- Quick check, run in `taskflow/taskflow/`: `npx vitest run src/hooks/useNotificationPolling.test.tsx`
- Full gate (the pre-commit hook runs the full suite): `npx vitest run`, `npx biome check <changed files>`, `npx tsc --noEmit`
- Manual check: run `npm run tauri dev`, turn on Desktop notifications, wait for a poll, and look for the collapsed group in the webview devtools console.
