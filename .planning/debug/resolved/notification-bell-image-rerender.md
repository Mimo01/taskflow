---
status: resolved
trigger: "When clicking bell icon to open notification popover, images in issue detail fully reload/re-render"
created: 2026-03-17T00:00:00Z
updated: 2026-03-17T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - WikiRenderer recreates markdownComponents (including img function) on every render, causing react-markdown to remount AuthImage components which re-fetch images from scratch
test: Memoize markdownComponents and wrap WikiRenderer in memo
expecting: Images stay stable when notification popover opens
next_action: Apply fix to WikiRenderer.tsx

## Symptoms

expected: Clicking the bell icon should open the notification popover without affecting images displayed in the issue detail view.
actual: Images in the issue detail fully disappear and reload from scratch when the notification popover opens.
errors: None reported
reproduction: Open an issue detail that has images/attachments, then click the bell icon to open notifications.
started: Not sure when it started, may have always been this way.

## Eliminated

## Evidence

- timestamp: 2026-03-17T00:10:00Z
  checked: AppLayout state management in main.tsx
  found: notifPopoverOpen is useState in AppLayout (line 101). Changing it re-renders entire AppLayout including Outlet.
  implication: Any state change in AppLayout cascades to all child routes.

- timestamp: 2026-03-17T00:11:00Z
  checked: Outlet context in main.tsx line 380
  found: context object is recreated every render (new object literal). handleIssueClick is not useCallback-wrapped.
  implication: IssueDetailPage receives new context reference on every AppLayout render, triggering re-render.

- timestamp: 2026-03-17T00:12:00Z
  checked: WikiRenderer.tsx markdownComponents (lines 116-148)
  found: markdownComponents object with img component function is created inside render body on every call. Not memoized.
  implication: react-markdown sees different component type for img on each render, unmounts old AuthImage, mounts new one.

- timestamp: 2026-03-17T00:13:00Z
  checked: AuthImage.tsx useEffect (lines 29-70)
  found: useEffect resets blobUrl to null on mount (line 32), fetches image, creates new blob URL. Cleanup revokes old blob URL.
  implication: Each remount = image disappears (skeleton shown) then reloads from network.

## Resolution

root_cause: WikiRenderer recreates markdownComponents object (including the img component function) on every render. When AppLayout re-renders due to notifPopoverOpen state change, the cascade reaches WikiRenderer via Outlet context -> IssueDetailPage -> IssueDetailContent -> WikiRenderer. react-markdown sees a new function reference for the img component, unmounts old AuthImage instances and mounts new ones, which resets blobUrl state and re-fetches images.
fix: Wrapped WikiRenderer in React.memo and memoized markdownComponents with useMemo (stable img component function reference via useCallback for handleImageClick). This prevents react-markdown from remounting AuthImage when parent re-renders due to unrelated state changes.
verification: TypeScript compiles cleanly (pre-existing test errors only, unrelated).
files_changed: [taskflow/src/routes/dashboard/WikiRenderer.tsx]
