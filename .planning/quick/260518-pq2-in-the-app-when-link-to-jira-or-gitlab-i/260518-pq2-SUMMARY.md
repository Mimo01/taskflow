---
quick_id: 260518-pq2
status: complete
date: 2026-05-18
---

# Quick Task 260518-pq2: In-app routing for Jira / GitLab links

## What Was Done

Jira browse and GitLab MR links rendered in wiki content now navigate in-app instead of opening the OS browser.

### New file: `taskflow/src/lib/internalLinks.ts`

Pure `tryInternalPath(href, ctx)` helper. Given a URL and an auth context, returns an internal React Router path on a match or `null` to signal fallback. Supported patterns:

- `{jiraBaseUrl}/browse/{KEY}-{N}` → `/issue/{KEY}-{N}`
- `{jiraBaseUrl}/browse/{PROJECT}/fixforversion/{ID}` → `/releases/{PROJECT}/{ID}`
- `{gitlabBaseUrl}/{activeProjectPath}/-/merge_requests/{N}` → `/mr/{activeProjectId}/{N}`

Handles Jira instances at subpaths (e.g. `https://company.com/jira/browse/...`) via `normalizeBase` + `stripPathPrefix`.

### Modified: `taskflow/src/routes/dashboard/WikiRenderer.tsx`

Anchor `onClick` now calls `tryInternalPath` first; uses `navigate()` on a hit, falls through to `openUrl` on `null`. Priority chain (falsy → anchor → image → external) is unchanged.

### Modified: `taskflow/src/routes/dashboard/DiscussionThreads.tsx`

`useGitLabLinkComponents` hook updated with the same `tryInternalPath` intercept. This covers Jira/GitLab links inside GitLab MR comments/discussion notes — a separate renderer from WikiRenderer.

### Tests: `taskflow/src/lib/internalLinks.test.ts` + `WikiRenderer.test.tsx`

102 tests passing total. Covers: standard issue URLs, subpath Jira, fixforversion, MR matching/mismatching, all regression cases (anchor, image, external host).

## Commits

| Hash | Description |
|------|-------------|
| 45e315f3 | feat: add pure tryInternalPath helper with unit tests |
| 6509b815 | feat: wire tryInternalPath into WikiRenderer anchor handler |
| fdf7871d | fix: handle Jira/GitLab context paths in tryInternalPath |
| ad26e2d9 | fix: wire tryInternalPath into DiscussionThreads anchor handler |
| 50b61e31 | feat: map Jira fixforversion URLs to in-app releases route |
| 9e93b8b6 | fix: resolve merge conflict in WikiRenderer.test.tsx |
