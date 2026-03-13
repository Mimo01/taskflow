---
phase: quick-18
plan: 18
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src-tauri/tauri.conf.json
  - taskflow/src/routes/onboarding/JiraStep.tsx
  - taskflow/src/routes/onboarding/GitLabStep.tsx
  - taskflow/src/routes/onboarding/RoleStep.tsx
  - taskflow/src/routes/onboarding/DoneStep.tsx
  - taskflow/src/routes/onboarding/WelcomeStep.tsx
autonomous: true
requirements: [QUICK-18]

must_haves:
  truths:
    - "App opens with a noticeably larger default window than 800x600"
    - "Onboarding wizard steps use a wider content container"
  artifacts:
    - path: "taskflow/src-tauri/tauri.conf.json"
      provides: "Tauri window dimensions"
      contains: "width.*1100"
    - path: "taskflow/src/routes/onboarding/JiraStep.tsx"
      provides: "Wider wizard step container"
      contains: "max-w-lg"
  key_links:
    - from: "tauri.conf.json"
      to: "app window"
      via: "width/height fields in windows array"
      pattern: "\"width\":\\s*1100"
---

<objective>
Increase the default Tauri window size from 800x600 to 1100x750, and widen the onboarding wizard step containers from max-w-md (448px) to max-w-lg (512px).

Purpose: The current 800x600 window is cramped for a data-heavy app with sidebars and tabs. The wizard steps feel narrow on the new larger canvas.
Output: Larger app window on launch; wider, more comfortable onboarding wizard.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Increase default Tauri window dimensions</name>
  <files>taskflow/src-tauri/tauri.conf.json</files>
  <action>
    In the `app.windows[0]` object, change:
    - `"width": 800` → `"width": 1100`
    - `"height": 600` → `"height": 750`

    No other fields need changing.
  </action>
  <verify>
    <automated>grep -A2 '"windows"' /Users/mimo/Desktop/Tasker/taskflow/src-tauri/tauri.conf.json | grep -E '"width": 1100'</automated>
  </verify>
  <done>tauri.conf.json has width=1100 and height=750 in the windows array.</done>
</task>

<task type="auto">
  <name>Task 2: Widen onboarding wizard step containers</name>
  <files>
    taskflow/src/routes/onboarding/JiraStep.tsx,
    taskflow/src/routes/onboarding/GitLabStep.tsx,
    taskflow/src/routes/onboarding/RoleStep.tsx,
    taskflow/src/routes/onboarding/DoneStep.tsx,
    taskflow/src/routes/onboarding/WelcomeStep.tsx
  </files>
  <action>
    In each file, replace `max-w-md` with `max-w-lg` on the outermost container div of each step.

    - JiraStep.tsx line ~68: `max-w-md` → `max-w-lg`
    - GitLabStep.tsx line ~67: `max-w-md` → `max-w-lg`
    - RoleStep.tsx line ~24: `max-w-md` → `max-w-lg`
    - DoneStep.tsx line ~21: `max-w-md` → `max-w-lg`
    - WelcomeStep.tsx: `max-w-md` → `max-w-lg` on any container div (line ~22); also update `max-w-sm` on the subtitle paragraph (line ~17) to `max-w-md` for proportional scaling.

    max-w-md = 28rem (448px), max-w-lg = 32rem (512px) — a comfortable step up without going full-width.
  </action>
  <verify>
    <automated>grep -rn "max-w-md" /Users/mimo/Desktop/Tasker/taskflow/src/routes/onboarding/ | grep -v "node_modules"</automated>
  </verify>
  <done>No `max-w-md` remains in any onboarding step file; all replaced with `max-w-lg` (or `max-w-md` for the sub-paragraph in WelcomeStep that was previously `max-w-sm`).</done>
</task>

</tasks>

<verification>
1. `grep '"width"' taskflow/src-tauri/tauri.conf.json` → shows 1100
2. `grep '"height"' taskflow/src-tauri/tauri.conf.json` → shows 750
3. `grep -rn "max-w-md" taskflow/src/routes/onboarding/` → zero results (or only the WelcomeStep sub-paragraph that was promoted from max-w-sm)
</verification>

<success_criteria>
- tauri.conf.json: width=1100, height=750
- All five onboarding step outer containers use max-w-lg
- No regressions: `npm run build` (or `npm run typecheck`) in taskflow/ exits 0
</success_criteria>

<output>
After completion, create `.planning/quick/18-make-the-default-app-dimensions-a-little/18-SUMMARY.md`
</output>
