---
status: resolved
trigger: "Tempo backend calls are logged as AIO calls in the dev logs"
created: 2026-05-21
updated: 2026-05-22
---

## Symptoms

- **Expected:** Tempo backend calls logged under a Tempo or similar namespace
- **Actual:** Log entries show 'AIO' prefix/label instead of 'Tempo'
- **Errors:** No errors — purely a mislabeling/wrong namespace issue
- **Timeline:** Just noticed — unknown when it started; may have been this way for a while
- **Repro:** Open any Tempo-related view (worklog, schedule, etc.) and observe dev logs

## Current Focus

```yaml
hypothesis: "tempoFetch passes 'aio' as source to apiFetch; debug log UI renders source verbatim"
test: "grep source arg in tempo/client.ts"
expecting: "source 'aio' confirmed; fix by introducing 'tempo' source value"
next_action: "resolved"
reasoning_checkpoint: "aio was chosen to avoid false Jira disconnect on 401; 'tempo' gets same treatment"
```

## Evidence

- timestamp: 2026-05-22T00:00:00Z
  file: taskflow/src/services/tempo/client.ts:43
  note: tempoFetch calls apiFetch('aio', ...) — intentionally chosen to skip Jira disconnect on 401, but causes mislabeling in debug log UI
- timestamp: 2026-05-22T00:00:00Z
  file: taskflow/src/routes/debug-logs/DebugLogs.tsx:49
  note: debug log UI renders entry.source verbatim as the badge label — no mapping, so 'aio' shows as "AIO"
- timestamp: 2026-05-22T00:00:00Z
  file: taskflow/src/lib/apiFetch.ts:24
  note: markDisconnected skips for 'aio' and 'updater' — extended to also skip 'tempo'

## Eliminated

- Any rendering transformation of the source label — the UI renders it as-is
- Any other caller passing 'aio' for Tempo calls — only tempoFetch does this

## Resolution

```yaml
root_cause: "tempoFetch used 'aio' as the apiFetch source (to avoid triggering Jira disconnect on 401), but the debug log UI renders source verbatim, so all Tempo calls appeared as 'AIO'"
fix: "Introduced 'tempo' as a first-class source value; updated type unions in ApiLogEntry, FetchRecord, and apiFetch; markDisconnected skips 'tempo' the same as 'aio'; DebugLogs badge uses teal color for tempo; tests updated"
verification: "7/7 tempo client tests pass"
files_changed:
  - taskflow/src/services/tempo/client.ts
  - taskflow/src/lib/apiFetch.ts
  - taskflow/src/stores/debug-log.store.ts
  - taskflow/src/stores/operation-profiler.store.ts
  - taskflow/src/routes/debug-logs/DebugLogs.tsx
  - taskflow/src/services/tempo/client.test.ts
```
