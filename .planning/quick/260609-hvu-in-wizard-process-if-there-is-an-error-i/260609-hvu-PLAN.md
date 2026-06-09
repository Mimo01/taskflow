---
phase: quick-260609-hvu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/onboarding/JiraStep.tsx
  - taskflow/src/routes/onboarding/GitLabStep.tsx
autonomous: true
requirements: [wizard-error-log]

must_haves:
  truths:
    - "When a wizard validation error occurs, the existing error message remains visible"
    - "A 'Show details' button appears below the error message"
    - "Clicking 'Show details' expands a scrollable monospace log panel showing step-by-step progress and the error"
    - "The log panel collapses when 'Hide details' is clicked"
    - "Starting a new validation attempt resets the expanded state and clears the prior log"
    - "The log narrates each step attempted: URL, each API call attempted, which call failed, and the error message"
  artifacts:
    - path: taskflow/src/routes/onboarding/JiraStep.tsx
      provides: "Expandable error log panel for Jira validation"
      contains: "showDetails"
    - path: taskflow/src/routes/onboarding/GitLabStep.tsx
      provides: "Expandable error log panel for GitLab validation"
      contains: "showDetails"
  key_links:
    - from: "mutationFn log array"
      to: "errorLogRef.current"
      via: "assigned in catch block before re-throw"
      pattern: "errorLogRef\\.current"
    - from: "showDetails toggle button"
      to: "pre block"
      via: "conditional render on showDetails"
      pattern: "showDetails &&"
---

<objective>
Add an expandable "Show details" panel below the error message in JiraStep and GitLabStep so users can see a step-by-step log of what happened during a failed wizard validation attempt.

Purpose: The current error display is a single line (mutation.error.message). When connections fail, users have no visibility into which step failed or why, making it impossible to diagnose misconfigurations.

Output: Both wizard step components gain a collapsible dev-details panel with: URL used, each service call attempted, which step failed, and the full error message. The panel is styled in monospace with a muted background, uses the existing ChevronDown/ChevronUp pattern, and resets on every new validation attempt.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/mimo/Documents/Projects/taskflow/.planning/STATE.md
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/onboarding/JiraStep.tsx
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/onboarding/GitLabStep.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add expandable error log panel to JiraStep</name>
  <files>taskflow/src/routes/onboarding/JiraStep.tsx</files>
  <action>
Modify JiraStep.tsx to collect a step-by-step log during mutationFn and expose it via an expandable panel when the mutation fails.

Imports to add: `useRef, useState` from react (useEffect is already imported); `ChevronDown, ChevronUp` from lucide-react (alongside the existing Loader2 import).

State and ref to add inside the component (before the mutation declaration):

  const [showDetails, setShowDetails] = useState(false);
  const errorLogRef = useRef<string>('');

Update handleValidate to reset both before each attempt:

  const handleValidate = () => {
    if (!jiraUrl || !jiraToken) return;
    setShowDetails(false);
    errorLogRef.current = '';
    mutation.mutate();
  };

Update mutationFn to collect a log array and attach it to errorLogRef on failure. The log structure must narrate each step. In the try body, write a log line before and after each await. In the catch, write the failure line and assign errorLogRef.current = log.join('\n') before re-throwing. The sequence for JiraStep is:

  - log.push(`[${new Date().toISOString()}] Starting Jira connection`)
  - log.push(`  URL: ${jiraUrl}`)
  - log.push('[step 1] Validating credentials...')
  - await validateJira(jiraUrl, jiraToken) → on success: log.push(`  OK — authenticated as ${user.displayName} (${user.name})`)
  - log.push('[step 2] Loading projects...')
  - await listJiraProjects(jiraUrl, jiraToken) → on success: log.push(`  OK — found ${projectList.length} project(s)`)
  - catch: log.push(`  FAILED: ${err instanceof Error ? err.message : String(err)}`), then if err instanceof Error && err.stack, append the stack as a separate log line; assign errorLogRef.current = log.join('\n'); rethrow

Replace the existing error display block (the single `<p role="alert">`) with a flex-col div that contains:
1. The existing `<p className="text-sm text-destructive" role="alert">` with mutation.error.message — unchanged
2. A `<button type="button">` with class `flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-fit transition-colors` that toggles showDetails. Show `<ChevronUp className="h-3 w-3" />` + "Hide details" when showDetails is true; `<ChevronDown className="h-3 w-3" />` + "Show details" when false.
3. When showDetails is true, render a `<pre>` with class `text-xs font-mono bg-muted/50 rounded-md p-3 max-h-48 overflow-y-auto whitespace-pre-wrap break-all border border-border` containing `errorLogRef.current || mutation.error.message`.

The outer wrapper for all three elements uses class `flex flex-col gap-2`. The entire block is still guarded by `{mutation.isError && mutation.error && (...)}.`
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow && npm run check 2>&1 | tail -20</automated>
  </verify>
  <done>JiraStep compiles cleanly; the error block contains showDetails state, ChevronDown/Up icons, and errorLogRef population in mutationFn.</done>
</task>

<task type="auto">
  <name>Task 2: Apply the same pattern to GitLabStep</name>
  <files>taskflow/src/routes/onboarding/GitLabStep.tsx</files>
  <action>
Mirror the exact same changes applied to JiraStep in GitLabStep.tsx.

Imports to add: `useRef, useState` from react; `ChevronDown, ChevronUp` from lucide-react (alongside Loader2).

State and ref inside the component before the mutation:

  const [showDetails, setShowDetails] = useState(false);
  const errorLogRef = useRef<string>('');

Update handleValidate to reset both:

  const handleValidate = () => {
    if (!gitlabUrl || !gitlabToken) return;
    setShowDetails(false);
    errorLogRef.current = '';
    mutation.mutate();
  };

Update mutationFn to collect a log for GitLab's two-step sequence:

  - log.push(`[${new Date().toISOString()}] Starting GitLab connection`)
  - log.push(`  URL: ${gitlabUrl}`)
  - log.push('[step 1] Validating credentials...')
  - await validateGitLab(gitlabUrl, gitlabToken) → on success: log.push(`  OK — authenticated as ${user.name} (@${user.username})`)
  - log.push('[step 2] Loading projects...')
  - await listGitLabProjects(gitlabUrl, gitlabToken) → on success: log.push(`  OK — found ${projectList.length} project(s)`)
  - catch: log.push the failure + stack if present; assign errorLogRef.current; rethrow

Replace the existing single-line error `<p>` with the same three-element flex-col div used in JiraStep:
1. `<p className="text-sm text-destructive" role="alert">` with mutation.error.message
2. Toggle button with ChevronDown/Up and "Show details" / "Hide details"
3. Conditionally rendered `<pre>` with the same classes as JiraStep

Wrapper: `flex flex-col gap-2`, guard: `{mutation.isError && mutation.error && (...)}`.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow && npm run check 2>&1 | tail -20</automated>
  </verify>
  <done>GitLabStep compiles cleanly with no type errors; pattern is identical to JiraStep; both files pass biome check and tsc.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| mutationFn → error log | Error message and stack trace from failed API call rendered in the DOM |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-hvu-01 | Information Disclosure | error log pre block | accept | Log renders locally in a Tauri app; no network transmission; stack traces visible only to the authenticated local user who triggered the wizard |
| T-hvu-02 | Tampering | errorLogRef | accept | Ref is written only inside the component's own mutationFn; no external write path |
</threat_model>

<verification>
1. Run `npm run check` — must exit 0 with no errors.
2. In the running app, open the onboarding wizard to the Jira step, enter an invalid URL/token, click "Test & Continue".
3. The error message appears. Below it, "Show details" button is visible.
4. Click "Show details" — the log panel expands showing at minimum the timestamp, URL, step 1 attempt, and the failure message.
5. Click "Hide details" — panel collapses.
6. Enter corrected credentials and retry — the panel closes and the log clears before the new attempt.
7. Repeat steps 2–6 for the GitLab step.
</verification>

<success_criteria>
- Both JiraStep and GitLabStep render a "Show details" toggle below any validation error message
- The expanded log panel shows step-by-step progress through the mutationFn sequence
- The panel is scrollable, monospace, muted-background styled, and collapses cleanly
- Starting a new validation attempt resets expanded state and clears the prior log
- `npm run check` passes with zero errors
</success_criteria>

<output>
Create `.planning/quick/260609-hvu-in-wizard-process-if-there-is-an-error-i/260609-hvu-SUMMARY.md` when done.
</output>
