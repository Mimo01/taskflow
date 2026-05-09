---
quick_id: 260509-yzn
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/stores/debug-log.store.ts
  - taskflow/src/stores/debug-log.store.test.ts
  - taskflow/src/routes/dev-tools/utils.ts
  - taskflow/src/routes/dev-tools/WaterfallBar.tsx
  - taskflow/src/routes/dev-tools/WaterfallTab.tsx
  - taskflow/src/routes/debug-logs/DebugLogs.tsx
  - taskflow/src/hooks/useUpdatePolling.ts
autonomous: true

must_haves:
  truths:
    - "Update check log entries show 'updater' badge, not 'jira' badge"
    - "Jira and GitLab log filters exclude update check entries"
    - "All TypeScript source types compile without error"
  artifacts:
    - path: "taskflow/src/stores/debug-log.store.ts"
      provides: "ApiLogEntry.source union includes 'updater'"
    - path: "taskflow/src/routes/dev-tools/utils.ts"
      provides: "sourceBadgeClass handles 'updater' with distinct color"
    - path: "taskflow/src/hooks/useUpdatePolling.ts"
      provides: "All appendLog calls use source: 'updater'"
  key_links:
    - from: "useUpdatePolling.ts"
      to: "debug-log.store.ts"
      via: "appendLog({ source: 'updater', ... })"
    - from: "LogsTab.tsx / WaterfallTab.tsx / DebugLogs.tsx"
      to: "utils.ts"
      via: "sourceBadgeClass('updater')"
---

<objective>
Add an 'updater' source category to the dev log system so update check calls are
distinguishable from Jira and GitLab API calls in Developer Tools.

Purpose: Update checks call a Tauri endpoint (tauri://updater/check), not Jira.
Misclassifying them as 'jira' pollutes Jira log filters and misleads developers
reading the log.

Output: 'updater' as a first-class source value in ApiLogEntry, with a styled
badge in all log views, and all three appendLog call sites in useUpdatePolling
using source: 'updater'.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/mimo/Documents/Projects/taskflow/.planning/STATE.md
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend source type and update all consumers</name>
  <files>
    taskflow/src/stores/debug-log.store.ts,
    taskflow/src/stores/debug-log.store.test.ts,
    taskflow/src/routes/dev-tools/utils.ts,
    taskflow/src/routes/dev-tools/WaterfallBar.tsx,
    taskflow/src/routes/dev-tools/WaterfallTab.tsx,
    taskflow/src/routes/debug-logs/DebugLogs.tsx,
    taskflow/src/hooks/useUpdatePolling.ts
  </files>
  <behavior>
    - ApiLogEntry.source type union is 'jira' | 'gitlab' | 'updater'
    - sourceBadgeClass('updater') returns a blue/sky badge class (distinct from orange=jira, purple=gitlab)
    - WaterfallBar fetchBarColor handles 'updater' — returns a distinct color (e.g. blue)
    - WaterfallTab SourceFilter type includes 'updater'; filter button renders for 'updater'
    - DebugLogs.tsx badge condition handles 'updater' with its own color class
    - All three appendLog calls in useUpdatePolling use source: 'updater'
  </behavior>
  <action>
    1. debug-log.store.ts — change line 13:
       `source: 'jira' | 'gitlab';`
       → `source: 'jira' | 'gitlab' | 'updater';`

    2. utils.ts — extend sourceBadgeClass signature and add 'updater' case:
       Change: `export function sourceBadgeClass(source: 'jira' | 'gitlab'): string`
       → `export function sourceBadgeClass(source: 'jira' | 'gitlab' | 'updater'): string`
       Add else-if before the fallthrough return:
       `if (source === 'updater') return \`\${base} bg-sky-500/15 text-sky-600 dark:text-sky-400\`;`
       The existing fallthrough (`return \`\${base} bg-purple-500/15 text-purple-600 dark:text-purple-400\``) stays for 'gitlab'.

    3. WaterfallBar.tsx — extend fetchBarColor:
       Change: `function fetchBarColor(source: 'jira' | 'gitlab', hasError: boolean): string`
       → `function fetchBarColor(source: 'jira' | 'gitlab' | 'updater', hasError: boolean): string`
       Add case: `if (source === 'updater') return 'bg-sky-400 dark:bg-sky-600';`
       before the existing fallthrough (gitlab = purple).

       Also update the dominant-source logic in the body of WaterfallBar where it
       renders the source badge via `sourceBadgeClass(fetch.source)` — the type
       annotation on `fetch.source` must accept 'updater'. This flows automatically
       from the ApiLogEntry type change.

    4. WaterfallTab.tsx — extend SourceFilter and add filter button:
       Change: `type SourceFilter = 'all' | 'jira' | 'gitlab';`
       → `type SourceFilter = 'all' | 'jira' | 'gitlab' | 'updater';`

       In the dominant-source filter logic (lines ~47-53), extend to handle
       'updater': count updater sources like jira/gitlab, pick dominant among
       all three. A simple approach: use the most frequent source; if tied,
       prefer jira > gitlab > updater.

       Add an "Updater" filter button after the GitLab button, following the same
       pattern (active state uses sourceBadgeClass('updater'), inactive uses the
       muted hover style).

    5. DebugLogs.tsx — add 'updater' badge color condition:
       The inline ternary at line ~42 currently checks `entry.source === 'jira'`
       for orange vs purple. Extend to a function or chained ternary:
       - 'jira' → orange classes
       - 'updater' → sky/blue classes (match sourceBadgeClass)
       - default (gitlab) → purple classes

    6. useUpdatePolling.ts — change all three appendLog calls:
       Line ~53, ~65, ~82: change `source: 'jira'` → `source: 'updater'`
       Also remove the stale comment "// reusing existing source type for dev tools display"
       from the first appendLog call (it's no longer accurate).

    Write the test additions in debug-log.store.test.ts:
    - Add a test: `makeEntry` with `source: 'updater'` is accepted (no TS error).
    - The existing FIFO and append tests keep passing unchanged.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit && npx vitest run src/stores/debug-log.store.test.ts src/services/updater.test.ts</automated>
  </verify>
  <done>
    - TypeScript compiles without errors (tsc --noEmit passes)
    - debug-log.store tests pass with 'updater' source accepted
    - All three appendLog calls in useUpdatePolling.ts use source: 'updater'
    - sourceBadgeClass, fetchBarColor, SourceFilter all handle 'updater'
    - DebugLogs badge renders correct color for 'updater' entries
  </done>
</task>

</tasks>

<verification>
cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit && npx vitest run src/stores/debug-log.store.test.ts
</verification>

<success_criteria>
- 'updater' is a valid ApiLogEntry source value (type-safe, no casting)
- Update check log entries display a sky/blue 'updater' badge in LogsTab, WaterfallTab, and DebugLogs
- WaterfallTab has an 'Updater' filter button alongside Jira and GitLab
- No existing tests broken
- TypeScript strict mode passes
</success_criteria>

<output>
After completion, create `.planning/quick/260509-yzn-add-update-check-log-category/260509-yzn-SUMMARY.md`
</output>
