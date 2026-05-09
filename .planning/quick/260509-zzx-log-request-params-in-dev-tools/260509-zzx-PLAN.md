---
phase: quick
plan: 260509-zzx
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/stores/debug-log.store.ts
  - taskflow/src/lib/apiFetch.ts
  - taskflow/src/routes/dev-tools/LogsTab.tsx
  - taskflow/src/routes/debug-logs/DebugLogs.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "POST/PUT log entries in dev tools show the request body when a body was sent"
    - "Request Body appears between Request Headers and Response Body in the detail panel"
    - "GET requests show no Request Body section (field absent, no empty section rendered)"
    - "Large request bodies are truncated to 5000 chars to avoid log bloat"
    - "JSON request bodies are pretty-printed for readability"
  artifacts:
    - path: "taskflow/src/stores/debug-log.store.ts"
      provides: "ApiLogEntry with requestBody?: string field"
      contains: "requestBody"
    - path: "taskflow/src/lib/apiFetch.ts"
      provides: "requestBody captured from init.body when requestLogging is enabled"
      contains: "requestBody"
    - path: "taskflow/src/routes/dev-tools/LogsTab.tsx"
      provides: "Request Body section in LogCard detail panel"
      contains: "Request Body"
    - path: "taskflow/src/routes/debug-logs/DebugLogs.tsx"
      provides: "Request Body section in LogCard detail panel"
      contains: "Request Body"
  key_links:
    - from: "taskflow/src/lib/apiFetch.ts"
      to: "taskflow/src/stores/debug-log.store.ts"
      via: "ApiLogEntry.requestBody field populated from init.body"
    - from: "taskflow/src/stores/debug-log.store.ts"
      to: "taskflow/src/routes/dev-tools/LogsTab.tsx"
      via: "entry.requestBody conditional render"
---

<objective>
Add request body capture and display to the dev tools log system. POST and PUT calls
currently show only the URL, which is insufficient to understand what data was sent.

Purpose: Make dev logs actionable for debugging write operations by showing the full
request payload alongside existing URL, headers, and response body.

Output: requestBody field on ApiLogEntry, captured in apiFetch, rendered in both
LogsTab.tsx and DebugLogs.tsx detail panels.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/mimo/Documents/Projects/taskflow/.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add requestBody to ApiLogEntry and capture it in apiFetch</name>
  <files>
    taskflow/src/stores/debug-log.store.ts,
    taskflow/src/lib/apiFetch.ts
  </files>
  <action>
**In `taskflow/src/stores/debug-log.store.ts`:**

Add `requestBody?: string` to the `ApiLogEntry` interface, after `requestHeaders` and before `status`. Update the JSDoc comment on `responseBody` to note "truncated to 10_000 chars" so the new field can reference similar truncation at 5_000 chars. Add a comment: `// raw text body of the request; pretty-printed if JSON, truncated to 5_000 chars`.

**In `taskflow/src/lib/apiFetch.ts`:**

Before the try/catch block (around line 91, after `safeHeaders` is built), add request body capture:

```ts
// Capture request body for logging when requestLogging is enabled
let requestBody: string | undefined;
if (requestLogging && init?.body != null) {
  const raw = typeof init.body === 'string' ? init.body : String(init.body);
  try {
    const pretty = JSON.stringify(JSON.parse(raw), null, 2);
    requestBody = pretty.length > 5_000 ? `${pretty.slice(0, 5_000)}\n[truncated]` : pretty;
  } catch {
    requestBody = raw.length > 5_000 ? `${raw.slice(0, 5_000)}\n[truncated]` : raw;
  }
}
```

Then add `requestBody` to BOTH `ApiLogEntry` object literals in this file:
1. The error-path entry (inside the `catch` block, around line 116): add `requestBody,` after `requestHeaders: safeHeaders,`.
2. The success-path entry (around line 157): add `requestBody,` after `requestHeaders: safeHeaders,`.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>
    `ApiLogEntry` has `requestBody?: string`. Both entry construction sites in `apiFetch.ts` include `requestBody`. TypeScript compiles without errors.
  </done>
</task>

<task type="auto">
  <name>Task 2: Render Request Body section in LogsTab.tsx and DebugLogs.tsx</name>
  <files>
    taskflow/src/routes/dev-tools/LogsTab.tsx,
    taskflow/src/routes/debug-logs/DebugLogs.tsx
  </files>
  <action>
In both files, add a conditional "Request Body" section inside the detail panel, positioned **between** the Request Headers block and the Response Body block.

The pattern to insert (identical in both files):

```tsx
{entry.requestBody && (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
      Request Body
    </p>
    <pre className="text-xs bg-muted rounded p-2 overflow-auto max-h-64 whitespace-pre-wrap break-all">
      {entry.requestBody}
    </pre>
  </div>
)}
```

In **`LogsTab.tsx`**: insert after the closing `</div>` of the "Request Headers" block (around line 64) and before the `{entry.responseBody && ...}` block.

In **`DebugLogs.tsx`**: insert after the closing `</div>` of the "Request Headers" block (around line 85) and before the `{entry.responseBody && ...}` block.

Note: `DebugLogs.tsx` has its own local `formatBody` function — the request body is already pre-formatted (pretty-printed or plain) in `apiFetch`, so render `entry.requestBody` directly without calling `formatBody`. The same applies in `LogsTab.tsx` (which uses the imported `formatBody` from utils — do not apply it to `requestBody`).
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>
    Both detail panels conditionally render a "Request Body" section using the same styling as other sections. TypeScript compiles without errors. Section only appears when `entry.requestBody` is set (GET requests show no section).
  </done>
</task>

</tasks>

<verification>
After both tasks:

1. `npx tsc --noEmit` in `taskflow/` passes with no new errors.
2. Grep confirms the field is present in the store and both renderers:
   - `grep -c 'requestBody' taskflow/src/stores/debug-log.store.ts` returns >= 1
   - `grep -c 'requestBody' taskflow/src/lib/apiFetch.ts` returns >= 2 (one per log site)
   - `grep -c 'Request Body' taskflow/src/routes/dev-tools/LogsTab.tsx` returns >= 1
   - `grep -c 'Request Body' taskflow/src/routes/debug-logs/DebugLogs.tsx` returns >= 1
</verification>

<success_criteria>
- POST and PUT log entries display the request body in the dev tools detail panel
- GET log entries show no Request Body section
- JSON payloads are pretty-printed; non-JSON payloads are shown as-is
- Bodies longer than 5000 chars are truncated with a `[truncated]` marker
- No TypeScript errors introduced
</success_criteria>

<output>
After completion, create `.planning/quick/260509-zzx-log-request-params-in-dev-tools/260509-zzx-SUMMARY.md`
</output>
