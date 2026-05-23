---
phase: 50-draggable-sidebar-resize
reviewed: 2026-05-10T17:27:45Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - taskflow/src/hooks/useResizable.ts
  - taskflow/src/stores/settings.store.ts
  - taskflow/src/stores/settings.store.test.ts
  - taskflow/src/components/app/Sidebar.tsx
  - taskflow/src/routes/dashboard/IssueDetailPage.tsx
  - taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
findings:
  critical: 2
  warning: 5
  info: 2
  total: 9
status: issues_found
---

# Phase 50: Code Review Report

**Reviewed:** 2026-05-10T17:27:45Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This phase adds drag-to-resize to the sidebar, issue detail, MR detail, and release detail panels. The `useResizable` hook itself is sound — the ref-based anti-stale-closure pattern, global cursor lock, and event listener teardown are all correct. The settings store migration at version 14 correctly seeds the four new width fields.

The main defects are: (1) a perpetual "Loading..." display in the ReleaseDetailPage MR Labels row when no GitLab milestone is matched, (2) a JQL injection vector in the release page's local fetch helpers, (3) an infinite loop risk in the paginated issue fetch if the API ever returns an empty `issues` array with a non-zero `total`, (4) the sidebar's `prefetchTimerRef` is never cleared on component unmount, and (5) the `useResizable` hook silently ignores external `initialWidth` changes after mount, meaning a persisted store reload (e.g., Tauri storage hydration completing after the component first renders) leaves the hook stuck on the stale initial value.

---

## Critical Issues

### CR-01: JQL injection via unvalidated `versionId` route param

**File:** `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx:65` and `:95`

**Issue:** Both `fetchVersionIssueCounts` and `fetchFixVersionIssues` interpolate `versionId` directly into a JQL string before URL-encoding it:

```ts
const baseJql = `fixVersion = ${versionId} AND issuetype not in subtaskIssueTypes()`;
// line 95:
const jql = `fixVersion = ${versionId} AND issuetype not in subtaskIssueTypes() ORDER BY rank ASC`;
```

`versionId` comes from `useParams`, which is controlled by the URL. A crafted URL such as `/release/10001%20OR%20project%20%3D%20SECRET` will inject into the JQL query sent to the Jira API, allowing a local attacker or a malicious deep-link to exfiltrate data from arbitrary Jira projects. Although this is a desktop Tauri app, the threat model includes malicious links opening the app at a crafted route.

**Fix:** Validate that `versionId` is a bare numeric string before use, and/or quote it in the JQL:

```ts
// Validate at call site (both functions share the same pattern):
if (!/^\d+$/.test(versionId)) throw new Error(`Invalid versionId: ${versionId}`);
const baseJql = `fixVersion = ${versionId} AND issuetype not in subtaskIssueTypes()`;
```

If numeric validation is too strict (Jira version IDs are always numeric), the check `!/^\d+$/.test(versionId)` is sufficient. Alternatively quote the value: `fixVersion = "${versionId}"`, though quoting alone does not prevent all injection.

---

### CR-02: Perpetual "Loading..." shown for MR Labels when no milestone is matched

**File:** `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx:997-1040`

**Issue:** The `MR Labels` sidebar row gates its display on `milestoneMRs && labelCoverage`. When `gitlabMatch.type === 'none'`, the `milestoneMRs` query is never enabled (its `enabled` flag requires `gitlabMatch.type !== 'none'`), so `milestoneMRs` stays `undefined` forever. Meanwhile `labelCoverage` is computed from `releaseMrs` which falls back to `[]`, so `labelCoverage` is `null` (the IIFE returns `null` when `releaseMrs.length === 0`). The condition `milestoneMRs && labelCoverage` is therefore `false`, and the fallback `"Loading..."` is rendered indefinitely — even though there is no loading in progress and the user has already been told no milestone was matched.

```tsx
// Current — will show "Loading..." forever when gitlabMatch.type === 'none':
{milestoneMRs && labelCoverage ? (
  ...
) : (
  <span className="text-muted-foreground">Loading...</span>
)}
```

**Fix:** Add an explicit "not applicable" branch:

```tsx
{gitlabMatch.type === 'none' ? (
  <span className="text-muted-foreground">—</span>
) : milestoneMRs && labelCoverage ? (
  labelCoverage.allLabeled ? (
    <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
      <Check className="size-3" />
      All {labelCoverage.total} MRs labeled
    </span>
  ) : (
    // ... unlabeled list ...
  )
) : (
  <span className="text-muted-foreground">Loading...</span>
)}
```

---

## Warnings

### WR-01: Infinite loop if Jira returns `issues: []` with `total > 0`

**File:** `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx:101-111`

**Issue:** The pagination loop in `fetchFixVersionIssues` breaks only when `allIssues.length >= data.total`. If the Jira API returns an HTTP 200 with `{ issues: [], total: N }` (which can happen on JQL errors or permission boundaries), `allIssues.length` never grows and the loop hangs indefinitely, blocking the query function and exhausting network connections.

```ts
while (true) {
  // ...
  allIssues.push(...data.issues);       // data.issues could be []
  if (allIssues.length >= data.total) break;  // never true if issues is always []
  startAt = allIssues.length;           // startAt stays 0 forever
}
```

**Fix:** Add a guard that breaks if no new results were returned:

```ts
const before = allIssues.length;
allIssues.push(...data.issues);
if (allIssues.length >= data.total || allIssues.length === before) break;
```

---

### WR-02: `prefetchTimerRef` is never cleared on Sidebar unmount

**File:** `taskflow/src/components/app/Sidebar.tsx:92` and `:84-90`

**Issue:** `prefetchTimerRef` is cleared in `handleNavMouseLeave` during normal interaction, but there is no `useEffect` cleanup that runs `clearTimeout(prefetchTimerRef.current)` when the `Sidebar` component unmounts. If the user navigates away (causing unmount) while a hover debounce timer is pending, the timer fires after unmount and calls `prefetchForPath`, which calls `queryClient.prefetchQuery` and `queryClient.fetchQuery` on an unmounted component's captured closures. The `fetchQuery` chain inside `prefetchForPath` also calls `setJiraToken` (a separate `useState`) captured by closure — that state setter call on an unmounted component will produce a React warning and may cause stale renders.

**Fix:** Add a cleanup return to the existing `useEffect` (or add a dedicated one):

```ts
useEffect(() => {
  return () => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
    }
  };
}, []);
```

---

### WR-03: `useResizable` does not sync when `initialWidth` changes after mount

**File:** `taskflow/src/hooks/useResizable.ts:33`

**Issue:** `useState(initialWidth)` captures `initialWidth` only at mount time. If the persisted settings store hydrates asynchronously after the component's first render (which is the normal Tauri store behaviour — the Zustand persist middleware hydrates on the next microtask after mount), the component receives `initialWidth` derived from the store's un-hydrated default, not the persisted value. After hydration the store updates `sidebarWidth` / `mrDetailPanelWidth` / etc., but the hook's `width` state is never updated because there is no `useEffect` that watches `initialWidth`.

This means every session after the first one will show the persisted width momentarily only to snap back to the default, and then correct itself only after the user next drags the handle (which writes `onCommit`).

**Fix:** Add a synchronising effect inside `useResizable`:

```ts
// Add after the existing widthRef sync effect:
useEffect(() => {
  if (!isDragging) {
    setWidth(initialWidth);
    widthRef.current = initialWidth;
  }
}, [initialWidth, isDragging]);
```

This is safe because `isDragging` guards against overwriting an in-progress drag.

---

### WR-04: Drag handle border color leaks `var(--ring)` after drag ends if mouse leaves during drag

**File:** `taskflow/src/components/app/Sidebar.tsx:209-221` (same pattern in `IssueDetailPage.tsx:439-448`, `MergeRequestDetailPage.tsx:283-292`, `ReleaseDetailPage.tsx:776-785`)

**Issue:** The drag handle `onMouseLeave` handler only resets `borderColor` when `!isDragging`:

```tsx
onMouseLeave={(e) => {
  if (!isDragging) (e.currentTarget as HTMLElement).style.borderColor = '';
}}
```

When the user drags fast enough to exit the handle div during a drag (which is common), `isDragging` is `true` so the leave handler is suppressed. On `mouseup`, `isDragging` is set to `false` via `setIsDragging(false)`, but no code resets the inline `borderColor` on the handle element. The handle therefore remains highlighted with `var(--ring)` until the user hovers over it again and leaves.

The `style={{ borderColor: isDragging ? 'var(--ring)' : undefined }}` JSX attribute does reset to `undefined` on re-render, which should clear the CSS property — but only if the inline `onMouseEnter` handler hasn't overwritten it with the direct `.style.borderColor` DOM mutation, which takes priority over React's reconciled style prop. Since both mechanisms touch the same property and React's `undefined` value does **not** remove a previously set inline style (it leaves it as-is), the highlight persists.

**Fix:** Use consistent state-driven styling rather than mixing direct DOM mutation with JSX props. Replace the `onMouseEnter`/`onMouseLeave` direct mutations with a `useState(false)` hover flag, and derive the border color purely from `isDragging || isHandleHovered`:

```tsx
const [handleHovered, setHandleHovered] = useState(false);
// ...
<div
  aria-hidden="true"
  onMouseDown={handleMouseDown}
  onMouseEnter={() => setHandleHovered(true)}
  onMouseLeave={() => setHandleHovered(false)}
  style={{ borderColor: isDragging || handleHovered ? 'var(--ring)' : undefined }}
  className="absolute -right-px top-0 h-full w-3 cursor-ew-resize z-20 border-r border-border transition-colors duration-100"
/>
```

This pattern is already used for the sidebar's outer hover (the `hovered` state for the chevron button) and is idiomatic React.

---

### WR-05: `issueDetailPanelWidth` stays `null` until first drag — initial hook width of `400px` is committed to store on first drag, not the actual panel width before drag

**File:** `taskflow/src/routes/dashboard/IssueDetailPage.tsx:200-206` and `:435`

**Issue:** When `issueDetailPanelWidth` is `null` (first-time user), the panel renders at `'42%'` via the `style` prop (line 435). However, `useResizable` is initialized with `initialWidth: issueDetailPanelWidth ?? 400`, so it holds `400px` internally. If the user then drags the handle, the drag starts from `400px` — not from the actual rendered `42%` width — causing a visible jump. Additionally, on the first `mouseup`, `onCommit(400)` is called (since no drag distance was accumulated before drag start), which writes `400` to the store and changes the panel from `'42%'` to a fixed `400px`, potentially a dramatic layout shift.

**Fix:** Initialise `useResizable` from the real rendered width when `issueDetailPanelWidth` is null. Read `containerRef.current?.offsetWidth` to compute the 42% value:

```ts
const initialWidth = issueDetailPanelWidth ??
  Math.round((containerRef.current?.offsetWidth ?? 800) * 0.42);
```

However, since `containerRef` is not populated during the first render, the safest fix is to match the fallback in `max`: use `800 * 0.42 = 336` as the default, or better, make `initialWidth` a lazy initializer that reads the container on first drag:

```ts
// In useResizable, the startRef captures the live width at mousedown,
// so the hook's internal width only matters for initial render display.
// For the null case, render '42%' via CSS and let the hook start from
// the real offsetWidth on first drag by reading containerRef at mousedown time.
```

The real fix is to compute the numeric fallback from the container:

```tsx
const { width, isDragging, handleMouseDown } = useResizable({
  initialWidth: issueDetailPanelWidth ??
    Math.round((containerRef.current?.offsetWidth ?? 952) * 0.42),
  ...
});
```

Since `containerRef.current` is `null` during initial render, this is still `null ?? 952 * 0.42 = 400` on first render. The correct approach is to read the container width in `handleMouseDown` before the first drag, rather than using a hardcoded 400. This requires either moving the fallback calculation into `onCommit` (convert from CSS to pixels on first commit) or always storing a pixel value rather than allowing `null`.

---

## Info

### IN-01: Test description comment is stale — references old persist version number

**File:** `taskflow/src/stores/settings.store.test.ts:50-53`

**Issue:** The test at line 50 is titled `'persist version is 2 (bumped from 1 in Phase 19)'` and its comment references version 2, but the store is now at version 14 and the test body only checks for the presence of the `keyboardOverrides` key — it does not actually assert the version number. The description is misleading and will confuse future maintainers.

```ts
it('persist version is 2 (bumped from 1 in Phase 19)', () => {
  const state = useSettingsStore.getState();
  expect('keyboardOverrides' in state).toBe(true);
});
```

**Fix:** Rename the test to accurately describe what it asserts:

```ts
it('keyboardOverrides key is present in store state', () => {
```

---

### IN-02: No test coverage for the four new width fields' setter no-clamp behaviour

**File:** `taskflow/src/stores/settings.store.test.ts:214-261`

**Issue:** The Phase 50 test block verifies that the setters update values (e.g., `setSidebarWidth(280)` → `280`), but does not test out-of-bounds values. Unlike `setNotificationPollIntervalSecs` which clamps to `[30, 300]`, the four new width setters perform no clamping. If a caller ever passes `0`, `-1`, or `Infinity` (e.g., a corrupted persisted store migrated from an older format or a race condition), the value is stored as-is and `useResizable` will receive it as `initialWidth` with undefined visual results. A test like `setSidebarWidth(-1)` storing `-1` would document the known behaviour (no clamping) and alert future reviewers if someone adds clamping.

**Fix:** Add boundary tests to document the no-clamp contract, or add clamping to the setters (consistent with `setNotificationPollIntervalSecs`):

```ts
it('setSidebarWidth stores value without clamping (caller is responsible for bounds)', () => {
  act(() => useSettingsStore.getState().setSidebarWidth(9999));
  expect(useSettingsStore.getState().sidebarWidth).toBe(9999);
});
```

---

_Reviewed: 2026-05-10T17:27:45Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
