---
phase: quick-4
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/stores/debug-log.store.ts
  - taskflow/src/lib/apiFetch.ts
  - taskflow/src/stores/settings.store.ts
  - taskflow/src/services/jira.ts
  - taskflow/src/services/gitlab.ts
  - taskflow/src/routes/settings/DebugModeSection.tsx
  - taskflow/src/routes/settings/Settings.tsx
  - taskflow/src/routes/debug-logs/DebugLogs.tsx
  - taskflow/src/routes/debug-logs/index.tsx
  - taskflow/src/components/app/Sidebar.tsx
  - taskflow/src/main.tsx
autonomous: true
requirements: [QUICK-4]

must_haves:
  truths:
    - "Settings page has a Debug Mode toggle that persists across app restarts"
    - "When debug mode is on, every Jira and GitLab API call is captured with method, URL, status, duration, request headers, and response body"
    - "When debug mode is off, no logging overhead occurs"
    - "A dedicated Debug Logs page shows all captured log entries newest-first"
    - "Log entries can be cleared from the Debug Logs page"
    - "Log store is in-memory (cleared on app restart, max 200 entries FIFO)"
  artifacts:
    - path: "taskflow/src/stores/debug-log.store.ts"
      provides: "In-memory Zustand log store with append and clear actions"
      exports: ["useDebugLogStore", "ApiLogEntry"]
    - path: "taskflow/src/lib/apiFetch.ts"
      provides: "Instrumented fetch wrapper that intercepts when debug mode enabled"
      exports: ["apiFetch"]
    - path: "taskflow/src/routes/debug-logs/DebugLogs.tsx"
      provides: "Log viewer UI page"
    - path: "taskflow/src/routes/settings/DebugModeSection.tsx"
      provides: "Settings section with debug toggle"
  key_links:
    - from: "taskflow/src/lib/apiFetch.ts"
      to: "taskflow/src/stores/debug-log.store.ts"
      via: "useDebugLogStore.getState().append(entry)"
      pattern: "getState\\(\\)\\.append"
    - from: "taskflow/src/lib/apiFetch.ts"
      to: "taskflow/src/stores/settings.store.ts"
      via: "useSettingsStore.getState().debugMode"
      pattern: "getState\\(\\)\\.debugMode"
    - from: "taskflow/src/services/jira.ts"
      to: "taskflow/src/lib/apiFetch.ts"
      via: "import { apiFetch } replacing fetch from @tauri-apps/plugin-http"
      pattern: "apiFetch"
    - from: "taskflow/src/services/gitlab.ts"
      to: "taskflow/src/lib/apiFetch.ts"
      via: "import { apiFetch } replacing fetch from @tauri-apps/plugin-http"
      pattern: "apiFetch"
---

<objective>
Add API call logging infrastructure for Jira and GitLab, a debug mode toggle in Settings, and a dedicated Debug Logs page.

Purpose: Allows developers to diagnose API issues against real Jira DC / GitLab instances by inspecting every HTTP call with full request and response detail.
Output: debug-log store, apiFetch wrapper, DebugModeSection in Settings, DebugLogs route with log viewer.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/4-jira-gitlab-api-call-logging-debug-optio/4-CONTEXT.md

<interfaces>
<!-- Key types and contracts the executor needs. -->

From src/stores/settings.store.ts (SettingsState interface to extend):
```typescript
interface SettingsState {
  role: 'developer' | 'pm' | null;
  theme: Theme;
  onboardingComplete: boolean;
  staleMrThresholdDays: number;
  notificationPollIntervalSecs: number;
  osNotifJiraEnabled: boolean;
  osNotifGitlabEnabled: boolean;
  storyPointsFieldKey: string;
  // ADD: debugMode: boolean;
  // ADD: setDebugMode: (v: boolean) => void;
  setRole, setTheme, setOnboardingComplete, setStaleMrThresholdDays,
  setNotificationPollIntervalSecs, setOsNotifJiraEnabled, setOsNotifGitlabEnabled, setStoryPointsFieldKey
}
```

Settings store uses Zustand persist with Tauri Store plugin (settings.json). The persist name is 'settings-store'.

From src/services/jira.ts and gitlab.ts:
Both files import `fetch` from `@tauri-apps/plugin-http`:
```typescript
import { fetch } from '@tauri-apps/plugin-http';
```
All fetch calls follow this pattern:
```typescript
response = await fetch(url, { headers: { ... } });
```
The `fetch` from `@tauri-apps/plugin-http` has the same signature as the standard `fetch` API.

Router in main.tsx uses createHashRouter with children array. New routes are added to the children array.

Sidebar navigation pattern: role-gated sections use conditional rendering. Settings link is in the bottom div. The sidebar collapses to icon-only on small screens (w-16 / md:w-56).

Settings sections follow this layout pattern (from NotificationSettingsSection.tsx):
```tsx
<div className="flex flex-col gap-4">
  <div>
    <h3 className="text-base font-semibold">{Section Title}</h3>
    <p className="text-sm text-muted-foreground">{Description}</p>
  </div>
  {/* Controls */}
</div>
```

Checkbox pattern (from NotificationSettingsSection.tsx):
```tsx
<input
  id="toggle-id"
  type="checkbox"
  checked={value}
  onChange={(e) => setter(e.target.checked)}
  className="h-4 w-4 rounded border-input accent-primary"
/>
<label htmlFor="toggle-id" className="text-sm font-medium cursor-pointer">Label</label>
```

Settings.tsx adds each section inside a div with className="pt-8" inside the divide-y container.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create debug-log store and apiFetch wrapper</name>
  <files>
    taskflow/src/stores/debug-log.store.ts
    taskflow/src/lib/apiFetch.ts
    taskflow/src/stores/settings.store.ts
  </files>
  <action>
**1a. Create `taskflow/src/stores/debug-log.store.ts`:**

In-memory Zustand store (no persist middleware — logs are transient). Max 200 entries, FIFO eviction on overflow.

```typescript
export interface ApiLogEntry {
  id: string;             // crypto.randomUUID()
  timestamp: string;      // ISO string, new Date().toISOString()
  source: 'jira' | 'gitlab';
  method: string;         // e.g. "GET", "POST"
  url: string;
  requestHeaders: Record<string, string>;
  status: number | null;  // null if network error
  durationMs: number;
  responseBody: string;   // raw text, truncated to 10_000 chars if longer
  error?: string;         // set only on network-level failure (catch block)
}

interface DebugLogState {
  entries: ApiLogEntry[];
  append: (entry: ApiLogEntry) => void;
  clear: () => void;
}

const MAX_ENTRIES = 200;

export const useDebugLogStore = create<DebugLogState>((set) => ({
  entries: [],
  append: (entry) =>
    set((s) => {
      const next = [entry, ...s.entries];
      return { entries: next.length > MAX_ENTRIES ? next.slice(0, MAX_ENTRIES) : next };
    }),
  clear: () => set({ entries: [] }),
}));
```

**1b. Create `taskflow/src/lib/apiFetch.ts`:**

A wrapper around `fetch` from `@tauri-apps/plugin-http`. Reads `debugMode` and `getState()` (not hooks — this runs outside React) to avoid subscription overhead. The `source` parameter is determined by the caller.

```typescript
import { fetch } from '@tauri-apps/plugin-http';
import { useSettingsStore } from '../stores/settings.store';
import { useDebugLogStore } from '../stores/debug-log.store';
import type { ApiLogEntry } from '../stores/debug-log.store';

/**
 * Instrumented fetch wrapper.
 * - When debugMode is disabled: passes through to @tauri-apps/plugin-http fetch unchanged.
 * - When debugMode is enabled: captures method, URL, headers, status, duration, response body.
 *   Sanitizes Authorization and PRIVATE-TOKEN header values — replaces with "[REDACTED]".
 *
 * @param source - 'jira' | 'gitlab' — identifies which service made the call
 * @param url    - Request URL
 * @param init   - Standard RequestInit options
 */
export async function apiFetch(
  source: 'jira' | 'gitlab',
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const { debugMode } = useSettingsStore.getState();

  if (!debugMode) {
    return fetch(url, init);
  }

  // Debug mode: instrument the call
  const start = performance.now();
  const method = init?.method ?? 'GET';

  // Sanitize headers for logging — redact auth values
  const rawHeaders = (init?.headers ?? {}) as Record<string, string>;
  const safeHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawHeaders)) {
    const lower = k.toLowerCase();
    if (lower === 'authorization' || lower === 'private-token') {
      safeHeaders[k] = '[REDACTED]';
    } else {
      safeHeaders[k] = v;
    }
  }

  let response: Response;
  let errorMsg: string | undefined;
  let status: number | null = null;
  let responseBody = '';

  try {
    response = await fetch(url, init);
    status = response.status;
    // Clone before reading so callers can still read the body
    const clone = response.clone();
    const text = await clone.text().catch(() => '');
    responseBody = text.length > 10_000 ? text.slice(0, 10_000) + '\n[truncated]' : text;
  } catch (err) {
    const durationMs = Math.round(performance.now() - start);
    errorMsg = err instanceof Error ? err.message : String(err);
    const entry: ApiLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      source,
      method,
      url,
      requestHeaders: safeHeaders,
      status: null,
      durationMs,
      responseBody: '',
      error: errorMsg,
    };
    useDebugLogStore.getState().append(entry);
    throw err; // re-throw so callers still get the network error
  }

  const durationMs = Math.round(performance.now() - start);
  const entry: ApiLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    source,
    method,
    url,
    requestHeaders: safeHeaders,
    status,
    durationMs,
    responseBody,
  };
  useDebugLogStore.getState().append(entry);

  return response;
}
```

**1c. Extend `taskflow/src/stores/settings.store.ts`:**

Add `debugMode: boolean` (default `false`) and `setDebugMode` to SettingsState interface and to the `create(...)` call. It persists automatically via the existing tauriStorage middleware (already covers all keys in the store object).

Add to interface:
```typescript
/** Enable API call logging for debug inspection. Default: false. */
debugMode: boolean;
setDebugMode: (v: boolean) => void;
```

Add to state initializer (inside `persist`):
```typescript
debugMode: false,
setDebugMode: (v) => set({ debugMode: v }),
```
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - `debug-log.store.ts` exports `ApiLogEntry` and `useDebugLogStore` with `entries`, `append`, `clear`
    - `apiFetch.ts` exports `apiFetch(source, url, init?)` — no-op passthrough when `debugMode` is false, full capture when true, auth headers redacted
    - `settings.store.ts` has `debugMode: boolean` and `setDebugMode` with default false
    - TypeScript reports no new errors in these three files
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire apiFetch into jira.ts and gitlab.ts</name>
  <files>
    taskflow/src/services/jira.ts
    taskflow/src/services/gitlab.ts
  </files>
  <action>
In both service files, replace the existing import and all `fetch(` call sites.

**In `jira.ts`:**

Replace:
```typescript
import { fetch } from '@tauri-apps/plugin-http';
```
With:
```typescript
import { apiFetch } from '../lib/apiFetch';
```

Then replace every occurrence of:
```typescript
response = await fetch(url, {
```
With:
```typescript
response = await apiFetch('jira', url, {
```

And the standalone call at line 461 (discoverStoryPointsField, which uses `const response = await fetch(...)`):
```typescript
const response = await apiFetch('jira', url, {
```

Also the subtask fetch inside fetchSprintIssues (line 239):
```typescript
const subtaskResponse = await fetch(subtaskUrl, {
```
Becomes:
```typescript
const subtaskResponse = await apiFetch('jira', subtaskUrl, {
```

**In `gitlab.ts`:**

Replace:
```typescript
import { fetch } from '@tauri-apps/plugin-http';
```
With:
```typescript
import { apiFetch } from '../lib/apiFetch';
```

Then replace every occurrence of:
```typescript
response = await fetch(url, {
```
With:
```typescript
response = await apiFetch('gitlab', url, {
```

All existing `RequestInit` option objects (`headers`, `method`, `body`) are forwarded as-is — the `apiFetch` signature accepts standard `RequestInit`.

Do NOT change any other logic, error handling, or response processing. This is a pure import + call-site substitution.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - `jira.ts` has no `import { fetch }` from plugin-http; all 10 fetch calls use `apiFetch('jira', ...)`
    - `gitlab.ts` has no `import { fetch }` from plugin-http; all 10 fetch calls use `apiFetch('gitlab', ...)`
    - TypeScript reports no new errors introduced by these files
  </done>
</task>

<task type="auto">
  <name>Task 3: Debug Mode settings section, Debug Logs page, sidebar link, router wiring</name>
  <files>
    taskflow/src/routes/settings/DebugModeSection.tsx
    taskflow/src/routes/settings/Settings.tsx
    taskflow/src/routes/debug-logs/DebugLogs.tsx
    taskflow/src/routes/debug-logs/index.tsx
    taskflow/src/components/app/Sidebar.tsx
    taskflow/src/main.tsx
  </files>
  <action>
**3a. Create `taskflow/src/routes/settings/DebugModeSection.tsx`:**

Follow the same layout pattern as NotificationSettingsSection. Checkbox binds to `debugMode` / `setDebugMode`.

```tsx
/**
 * DebugModeSection — Settings section for API call logging.
 *
 * When enabled, every Jira and GitLab API call is captured with full
 * request/response detail. View logs at /debug-logs.
 * Logs are in-memory only — cleared on app restart.
 */
import { useSettingsStore } from '../../stores/settings.store';

export default function DebugModeSection() {
  const { debugMode, setDebugMode } = useSettingsStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-semibold">Debug</h3>
        <p className="text-sm text-muted-foreground">
          Capture API call logs for troubleshooting. Logs are in-memory and cleared on restart.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <input
            id="debug-mode"
            type="checkbox"
            checked={debugMode}
            onChange={(e) => setDebugMode(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <label htmlFor="debug-mode" className="text-sm font-medium cursor-pointer">
            Enable API call logging
          </label>
        </div>
        <p className="text-xs text-muted-foreground pl-7">
          View captured logs on the Debug Logs page in the sidebar.
        </p>
      </div>
    </div>
  );
}
```

**3b. Update `taskflow/src/routes/settings/Settings.tsx`:**

Import `DebugModeSection` and append it as the last section inside the `divide-y` container, following the same `<div className="pt-8">` wrapping pattern used by other sections.

**3c. Create `taskflow/src/routes/debug-logs/DebugLogs.tsx`:**

Log viewer page. Shows entries newest-first (store already inserts newest-first). Each entry is a collapsible card showing: timestamp, source badge (Jira/GitLab), method, URL, status (colored: green >=200 <300, red >=400, yellow 3xx, gray for null), duration, request headers, and response body in a pre block.

```tsx
/**
 * DebugLogs — API call log viewer.
 *
 * Displays captured Jira and GitLab API calls when debug mode is enabled.
 * Entries are newest-first. Each entry shows: timestamp, source, method,
 * URL, HTTP status, duration, sanitized request headers, response body.
 *
 * Log store is in-memory — cleared on app restart or via the Clear button.
 */
import { useState } from 'react';
import { useDebugLogStore, type ApiLogEntry } from '../../stores/debug-log.store';
import { useSettingsStore } from '../../stores/settings.store';

function statusColor(status: number | null): string {
  if (status === null) return 'text-muted-foreground';
  if (status >= 200 && status < 300) return 'text-green-600 dark:text-green-400';
  if (status >= 300 && status < 400) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function LogCard({ entry }: { entry: ApiLogEntry }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Summary row — always visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors text-sm"
      >
        {/* Source badge */}
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold uppercase ${
            entry.source === 'jira'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
              : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
          }`}
        >
          {entry.source}
        </span>
        <span className="font-mono font-semibold shrink-0">{entry.method}</span>
        <span className={`shrink-0 font-mono font-semibold ${statusColor(entry.status)}`}>
          {entry.status ?? 'ERR'}
        </span>
        <span className="font-mono text-xs truncate flex-1 text-muted-foreground">{entry.url}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{entry.durationMs}ms</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {new Date(entry.timestamp).toLocaleTimeString()}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {/* Detail panel */}
      {open && (
        <div className="border-t border-border px-4 py-3 flex flex-col gap-3">
          {entry.error && (
            <div className="text-sm text-red-600 dark:text-red-400">
              <span className="font-semibold">Network error:</span> {entry.error}
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Request Headers
            </p>
            <pre className="text-xs bg-muted rounded p-2 overflow-auto whitespace-pre-wrap break-all">
              {JSON.stringify(entry.requestHeaders, null, 2)}
            </pre>
          </div>
          {entry.responseBody && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Response Body
              </p>
              <pre className="text-xs bg-muted rounded p-2 overflow-auto max-h-64 whitespace-pre-wrap break-all">
                {entry.responseBody}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DebugLogs() {
  const { entries, clear } = useDebugLogStore();
  const { debugMode } = useSettingsStore();

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Debug Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Captured Jira and GitLab API calls. Logs are in-memory — cleared on restart.
          </p>
        </div>
        <button
          onClick={clear}
          disabled={entries.length === 0}
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Clear
        </button>
      </div>

      {!debugMode && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-700 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-200">
          Debug mode is off. Enable it in{' '}
          <a href="#/settings" className="underline font-medium">
            Settings
          </a>{' '}
          to start capturing API calls.
        </div>
      )}

      {debugMode && entries.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No logs yet. API calls will appear here once debug mode captures them.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {entries.map((entry) => (
          <LogCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
```

**3d. Create `taskflow/src/routes/debug-logs/index.tsx`:**

```tsx
export { default } from './DebugLogs';
```

**3e. Update `taskflow/src/components/app/Sidebar.tsx`:**

Import `Bug` from `lucide-react` (add to existing import line).

Add a "Tools" section after the role-specific Work section, always visible (not role-gated). Place it between the role nav section and the bottom settings link. Within `<nav className="flex-1 ...">`, after the `(role === 'developer' || role === 'pm')` block:

```tsx
{/* Tools section — always visible */}
<div className="mt-2">
  <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:block">
    Tools
  </p>
  <Link to="/debug-logs" className={NAV_LINK_CLASS}>
    <Bug className="h-4 w-4 shrink-0" />
    <span className="hidden md:block">Debug Logs</span>
  </Link>
</div>
```

**3f. Update `taskflow/src/main.tsx`:**

Import the DebugLogs page:
```typescript
import DebugLogs from './routes/debug-logs/index';
```

Add to the router children array:
```typescript
{ path: '/debug-logs', element: <DebugLogs /> },
```
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - Settings page has a "Debug" section with an "Enable API call logging" checkbox
    - Sidebar shows a "Tools" section with "Debug Logs" link (Bug icon) visible for all roles
    - Navigating to /debug-logs renders the log viewer with a "Clear" button
    - When debug mode is off, the log page shows a yellow banner linking to Settings
    - TypeScript reports no new errors across any of the 6 files
  </done>
</task>

</tasks>

<verification>
Run TypeScript check across the whole project after all tasks:

```bash
cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1
```

No new TypeScript errors. Existing pre-existing errors (confirmed out-of-scope) remain unchanged.

Manual smoke test (checkpoint for user after execution):
1. Open Settings — "Debug" section appears at the bottom with a checkbox
2. Enable debug mode, navigate to Dashboard (triggers Jira/GitLab API calls)
3. Navigate to Debug Logs — entries appear with source, method, URL, status, duration
4. Expand an entry — request headers show "[REDACTED]" for Authorization / PRIVATE-TOKEN values
5. Click Clear — entries disappear
6. Disable debug mode, trigger more API calls — no new entries appear in Debug Logs
</verification>

<success_criteria>
- `apiFetch` wrapper intercepts all 20 fetch calls (10 jira + 10 gitlab) with zero behavior change when `debugMode` is false
- Auth header values are always redacted in log entries
- Log page shows entries newest-first, collapsible, with full detail on expand
- Max 200 entries enforced (FIFO eviction)
- Debug mode toggle persists via Tauri Store (survives app restart)
- TypeScript clean across all modified files
</success_criteria>

<output>
After completion, create `.planning/quick/4-jira-gitlab-api-call-logging-debug-optio/4-SUMMARY.md`
</output>
