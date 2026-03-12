---
phase: quick-10
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/components/app/ReAuthBanner.tsx
  - taskflow/src/main.tsx
autonomous: true
requirements:
  - QUICK-10
must_haves:
  truths:
    - "When gitlabConnected is false (after onboarding), a visible banner appears telling the user GitLab connection is lost"
    - "The GitLab banner includes a link to Settings identical in style to the Jira banner"
    - "When both Jira and GitLab are disconnected, both banners are visible (stacked)"
    - "When gitlabConnected is true the GitLab banner is absent — no false positives"
  artifacts:
    - path: "taskflow/src/components/app/ReAuthBanner.tsx"
      provides: "Jira and GitLab disconnection banners"
      contains: "gitlabConnected"
    - path: "taskflow/src/main.tsx"
      provides: "Mounts GitLab banner in AppLayout alongside the existing Jira banner"
  key_links:
    - from: "taskflow/src/components/app/ReAuthBanner.tsx"
      to: "useAuthStore"
      via: "gitlabConnected selector"
      pattern: "gitlabConnected"
    - from: "taskflow/src/main.tsx"
      to: "ReAuthBanner"
      via: "Rendered inside AppLayout"
      pattern: "GitLabReAuthBanner"
---

<objective>
Surface a visible amber banner when GitLab fails to connect, mirroring the existing Jira banner pattern.

Purpose: When GitLab connection is lost (token expired, URL unreachable, timeout from quick-9), the app currently shows nothing — the user has no signal that data is stale or missing. The fix is one additional banner that reads from the existing `gitlabConnected` store field.
Output: ReAuthBanner.tsx exports a second `GitLabReAuthBanner` component; main.tsx renders it below the Jira banner in AppLayout.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

<!-- Key interfaces the executor needs — no codebase exploration required -->
<interfaces>
From taskflow/src/stores/auth.store.ts:
```typescript
interface AuthState {
  jiraConnected: boolean;
  gitlabConnected: boolean;
  // ...
}
export const useAuthStore: () => AuthState & Actions;
```

From taskflow/src/stores/settings.store.ts (used in existing ReAuthBanner):
```typescript
// useSettingsStore exposes:
onboardingComplete: boolean;
```

Existing ReAuthBanner structure (renders only when jiraConnected=false AND onboardingComplete=true):
```tsx
export default function ReAuthBanner() {
  const { jiraConnected } = useAuthStore();
  const { onboardingComplete } = useSettingsStore();
  if (jiraConnected || !onboardingComplete) return null;
  return <Alert className="rounded-none border-x-0 border-t-0 border-amber-400 ...">
    <AlertDescription ...>
      <span>Jira connection lost — check your URL and token in Settings</span>
      <Link to="/settings" ...>Go to Settings</Link>
    </AlertDescription>
  </Alert>;
}
```

AppLayout in main.tsx renders the Jira banner:
```tsx
{!jiraConnected && <ReAuthBanner />}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add GitLabReAuthBanner export to ReAuthBanner.tsx</name>
  <files>taskflow/src/components/app/ReAuthBanner.tsx</files>
  <action>
    Add a second named export `GitLabReAuthBanner` to the existing file. It follows the exact same pattern as the default `ReAuthBanner`:
    - Reads `gitlabConnected` from `useAuthStore`
    - Reads `onboardingComplete` from `useSettingsStore`
    - Returns null if `gitlabConnected` is true OR `onboardingComplete` is false
    - Renders the same amber Alert with text "GitLab connection lost — check your URL and token in Settings" and a "Go to Settings" Link to "/settings"

    Keep the existing default export unchanged. Only add the new named export below it. Do not alter any classNames — copy them verbatim from the Jira banner so both banners look identical.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | grep ReAuthBanner || echo "no ReAuthBanner errors"</automated>
  </verify>
  <done>ReAuthBanner.tsx exports both `default ReAuthBanner` (Jira) and named `GitLabReAuthBanner`, both compile cleanly</done>
</task>

<task type="auto">
  <name>Task 2: Mount GitLabReAuthBanner in AppLayout</name>
  <files>taskflow/src/main.tsx</files>
  <action>
    In `main.tsx`:
    1. Import `GitLabReAuthBanner` from `./components/app/ReAuthBanner` (add to existing import line).
    2. Destructure `gitlabConnected` from `useAuthStore()` inside `AppLayout` (it already destructures `jiraConnected`).
    3. Render `{!gitlabConnected && <GitLabReAuthBanner />}` immediately below the existing Jira banner line `{!jiraConnected && <ReAuthBanner />}`.

    Do not change any other part of `AppLayout` or the router config.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | grep -E "(main|ReAuthBanner)" || echo "no errors in main/ReAuthBanner"</automated>
  </verify>
  <done>AppLayout renders GitLabReAuthBanner when gitlabConnected is false, TypeScript compiles with no errors</done>
</task>

</tasks>

<verification>
Full TypeScript compile passes:
`cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit`

Grep confirms both banners are wired:
`grep -n "GitLabReAuthBanner\|gitlabConnected" /Users/mimo/Desktop/Tasker/taskflow/src/main.tsx`
`grep -n "GitLabReAuthBanner\|gitlabConnected" /Users/mimo/Desktop/Tasker/taskflow/src/components/app/ReAuthBanner.tsx`
</verification>

<success_criteria>
- `GitLabReAuthBanner` exported from ReAuthBanner.tsx, renders amber alert with "GitLab connection lost" text and Settings link
- AppLayout in main.tsx renders `GitLabReAuthBanner` conditionally on `!gitlabConnected`
- When both are disconnected, two stacked banners appear
- No change to existing Jira banner behaviour
- TypeScript compilation passes with no new errors
</success_criteria>

<output>
After completion, create `.planning/quick/10-when-gitlab-fails-to-connect-there-is-no/10-SUMMARY.md`
</output>
