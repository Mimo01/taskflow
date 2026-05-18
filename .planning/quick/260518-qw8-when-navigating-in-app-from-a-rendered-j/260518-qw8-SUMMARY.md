---
quick_id: 260518-qw8
status: complete
date: 2026-05-18
---

# Quick Task 260518-qw8: Breadcrumb push on internal-link navigation

## What Was Done

When a Jira or GitLab link in rendered wiki content navigates in-app, the source page is now pushed onto the breadcrumb trail so the user can go back.

### Modified: `taskflow/src/routes/dashboard/WikiRenderer.tsx`

Added `deriveSourceCrumb(pathname)` helper that maps the current route to a `{ path, label }` TrailEntry. Wired `useLocation` + `useBreadcrumbStore.push` into the anchor `handleClick`. The push fires only inside the internal-hit branch (before `navigate()`), never on the `openUrl` fallthrough or early returns (anchor, image).

### Modified: `taskflow/src/routes/dashboard/DiscussionThreads.tsx`

Same `deriveSourceCrumb` + `push` wiring added to `useGitLabLinkComponents` anchor handler.

### Tests: `WikiRenderer.test.tsx`

4 new tests in `describe('breadcrumb trail (260518-qw8)')`:
- Jira link from issue page → pushes source crumb, navigates in-app
- GitLab MR link from issue page → pushes source crumb, navigates in-app
- Host-mismatch URL → does NOT push, calls openUrl
- In-document anchor → does NOT push, does NOT call openUrl

## Commits

| Hash | Description |
|------|-------------|
| 90071753 | feat: push source page breadcrumb on internal-link navigation |
| 2505df37 | test: assert breadcrumb push fires on internal-link click |
