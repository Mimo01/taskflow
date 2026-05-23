---
phase: quick-9
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/lib/apiFetch.ts
autonomous: true
requirements:
  - QUICK-9
must_haves:
  truths:
    - "API calls to Jira and GitLab that hang longer than 15s are automatically aborted"
    - "A timed-out call throws an error so callers surface the failure correctly"
    - "Normal calls (completing in < 15s) are unaffected"
  artifacts:
    - path: "taskflow/src/lib/apiFetch.ts"
      provides: "Timeout-wrapped fetch via AbortController"
      contains: "AbortController"
  key_links:
    - from: "taskflow/src/lib/apiFetch.ts"
      to: "@tauri-apps/plugin-http fetch"
      via: "AbortController signal passed in RequestInit"
      pattern: "AbortController"
---

<objective>
Add a 15-second timeout to every Jira and GitLab API call so that network hangs do not freeze the UI indefinitely.

Purpose: Without timeouts, a slow or unresponsive self-hosted Jira/GitLab instance causes the app to stall forever with no feedback.
Output: Modified apiFetch.ts that aborts any call exceeding 15s and re-throws so existing error handlers surface the failure.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add 15s AbortController timeout to apiFetch</name>
  <files>taskflow/src/lib/apiFetch.ts</files>
  <behavior>
    - Normal call (resolves in < 15s): returns the Response unchanged, no abort fires
    - Timed-out call (does not resolve within 15s): AbortController fires, fetch rejects with AbortError, clearTimeout is called, the error is re-thrown
    - Timeout fires BEFORE call resolves: timer is cleared to prevent memory leaks
    - Both debug-mode and passthrough branches get the same timeout behaviour
  </behavior>
  <action>
    At the top of `apiFetch`, create an AbortController and start a 15-second timer that calls `controller.abort()`. Merge `{ signal: controller.signal }` into the `init` object passed to every `fetch(url, init)` call (there are two calls — one in the passthrough branch at line 33 and one inside the debug try/catch at line 58). Wrap each `fetch(...)` in `try/finally` so `clearTimeout(timer)` is always called regardless of success or failure.

    Do NOT change the function signature, return type, logging behaviour, or error re-throw logic. If the caller already passes a signal in `init`, merge it as: the abort fires when EITHER the caller's signal OR the timeout fires. Use a combined signal via `AbortSignal.any([controller.signal, init?.signal].filter(Boolean))` if `init?.signal` exists, otherwise just use `controller.signal` directly. Keep the change minimal — only add the timeout scaffolding around existing fetch calls.

    Constant to define at module scope: `const API_TIMEOUT_MS = 15_000;`
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | grep apiFetch || echo "no apiFetch errors"</automated>
  </verify>
  <done>apiFetch.ts compiles cleanly, AbortController + clearTimeout present around both fetch call sites, API_TIMEOUT_MS constant defined at module scope</done>
</task>

</tasks>

<verification>
TypeScript compile passes with no new errors in apiFetch.ts:
`cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit`
</verification>

<success_criteria>
- `API_TIMEOUT_MS = 15_000` constant defined at top of apiFetch.ts
- Both `fetch(url, init)` call sites (passthrough branch + debug branch) use the AbortController signal
- `clearTimeout` is called in a `finally` block so no timer leaks
- No changes to function signature, logging, or error handling logic
- TypeScript compilation passes
</success_criteria>

<output>
After completion, create `.planning/quick/9-add-timeouts-for-jira-and-gitlab-api-cal/9-SUMMARY.md`
</output>
