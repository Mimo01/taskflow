---
phase: quick-13
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/error/ErrorPage.tsx
  - taskflow/src/main.tsx
autonomous: true
requirements: [QUICK-13]

must_haves:
  truths:
    - "Navigating to an unknown route shows the custom error page, not the default React Router crash screen"
    - "The error page shows the error message and a button to return to the dashboard"
    - "The error page uses the app's color tokens (bg-background, text-foreground, muted-foreground) so it respects dark/light theme"
  artifacts:
    - path: "taskflow/src/routes/error/ErrorPage.tsx"
      provides: "Custom error boundary UI using useRouteError"
    - path: "taskflow/src/main.tsx"
      provides: "errorElement wired to root route"
  key_links:
    - from: "taskflow/src/main.tsx"
      to: "taskflow/src/routes/error/ErrorPage.tsx"
      via: "errorElement prop on root router object"
      pattern: "errorElement.*ErrorPage"
---

<objective>
Replace the default React Router error boundary with a branded custom error page.

Purpose: The default boundary shows a raw React stack trace and is unstyled. A custom page maintains the app's visual identity and gives the user a clear recovery path.
Output: ErrorPage.tsx component + errorElement wired into the root router entry in main.tsx.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

<!-- Router wiring lives entirely in main.tsx — createHashRouter with a single root route wrapping all children. No errorElement is currently set anywhere. -->
<!-- Style conventions from DebugLogs.tsx and Sidebar.tsx: Tailwind tokens bg-background, border-border, text-muted-foreground, hover:bg-accent. The app uses a hash router (createHashRouter), so navigation back to dashboard is `/#/dashboard` or via `useNavigate`. -->
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create ErrorPage component</name>
  <files>taskflow/src/routes/error/ErrorPage.tsx</files>
  <action>
Create `taskflow/src/routes/error/ErrorPage.tsx`. Use `useRouteError` from react-router-dom to obtain the thrown error. Display:

- A centered layout filling the viewport (`min-h-screen flex items-center justify-center bg-background`).
- An inner card (`max-w-md w-full mx-auto p-8 rounded-xl border border-border flex flex-col gap-4`).
- A heading: "Something went wrong" (`text-xl font-bold`).
- The error message in a muted pre block: cast error to `{ statusText?: string; message?: string }`, prefer `statusText`, fall back to `message`, fall back to `"An unexpected error occurred."`. Render in a `<p className="text-sm text-muted-foreground">`.
- A "Go to Dashboard" button styled consistently with other app buttons (`rounded-md border border-border px-4 py-2 text-sm hover:bg-accent transition-colors`) that calls `useNavigate()` with `{ to: '/dashboard' }` — use the `useNavigate` hook, not a hard-coded `href`, so the hash router handles navigation cleanly.

Do NOT import any store or render the Sidebar — this component must render standalone (it replaces the broken layout).
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | grep -i "ErrorPage\|error/Error" || echo "No ErrorPage type errors"</automated>
  </verify>
  <done>ErrorPage.tsx exists, compiles without type errors, uses useRouteError + useNavigate from react-router-dom</done>
</task>

<task type="auto">
  <name>Task 2: Wire errorElement into the router</name>
  <files>taskflow/src/main.tsx</files>
  <action>
In `taskflow/src/main.tsx`:

1. Import `ErrorPage` from `./routes/error/ErrorPage`.
2. Add `errorElement: <ErrorPage />` to the root route object (the one with `element: <AppLayout />`). The root route is the first and only top-level entry in the `createHashRouter` array — add `errorElement` as a sibling to `element` and `children`.

The result should look like:

```ts
const router = createHashRouter([
  {
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [
      ...
    ],
  },
]);
```

This catches both route-not-found (404) errors and any rendering errors thrown within the layout tree.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0 type errors"</automated>
  </verify>
  <done>main.tsx imports ErrorPage and includes errorElement on the root route; `npx tsc --noEmit` exits clean (pre-existing errors are out-of-scope per project decision)</done>
</task>

</tasks>

<verification>
After both tasks complete, run the full type check and confirm no new errors introduced:

```bash
cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | tail -20
```

Visually verify in the running app by navigating to `/#/does-not-exist` — the custom error page should appear with the heading "Something went wrong" and a "Go to Dashboard" button. Clicking the button should navigate to `/#/dashboard`.
</verification>

<success_criteria>
- ErrorPage.tsx exists and exports a default component using useRouteError
- main.tsx has errorElement: `<ErrorPage />` on the root route
- TypeScript compiles without NEW errors (pre-existing TS errors are out-of-scope)
- Custom page displays on unknown routes instead of the default React Router error UI
</success_criteria>

<output>
After completion, create `.planning/quick/13-add-a-custom-error-page-to-replace-the-d/13-SUMMARY.md` following the summary template.
</output>
