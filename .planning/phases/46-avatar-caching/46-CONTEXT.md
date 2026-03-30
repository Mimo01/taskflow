# Phase 46: Avatar Caching - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Avatar and user images never re-fetch within a session and survive app restarts. This phase delivers an in-memory blob URL cache, disk persistence for cross-session caching, and a shared `<CachedAvatar>` component replacing all inline avatar `<img>` tags. Skeleton screens are Phase 44. Query optimization is Phase 45.

</domain>

<decisions>
## Implementation Decisions

### Caching Approach
- **D-01:** Use a blob URL pool — fetch image bytes once via plugin-http, create a blob URL (`URL.createObjectURL`), store in a `Map<originalUrl, blobUrl>` lookup. All `<img>` tags point to the blob URL. Zero network requests after first fetch.
- **D-02:** Lazy fetch on first render — each avatar is fetched the first time a component needs it. No eager prefetch on login. Subsequent renders get the cached blob URL instantly.

### Disk Persistence
- **D-03:** Claude's discretion on persistence mechanism — either `@tauri-apps/plugin-fs` writing binary files to `appDataDir/avatars/{hash}.ext`, or `@tauri-apps/plugin-store` (LazyStore) with base64. Claude picks based on implementation trade-offs.
- **D-04:** TTL-based eviction — evict avatars not accessed in 30 days. Metadata tracks last-accessed timestamp per avatar URL.

### Component Pattern
- **D-05:** Create a shared `<CachedAvatar>` component (`url`, `name`, `size` props) that handles blob URL lookup, loading state, initials fallback, and onError. Replace all 12+ inline avatar `<img>` usages across the codebase.
- **D-06:** Show initials immediately as placeholder while image loads. When blob URL is ready, swap to the image. No skeleton circle — initials are already meaningful.

### Cache Scope
- **D-07:** Claude's discretion on exact scope. At minimum, Jira user `avatarUrls['48x48']` and GitLab user `avatar_url`. May extend to other small, frequently-repeated images (project icons, issue type icons) if the implementation naturally supports it without added complexity.

### Claude's Discretion
- Persistence mechanism choice (plugin-fs vs LazyStore base64)
- Exact cache scope beyond user avatars
- Blob URL revocation strategy (on eviction, on app close, or never)
- How the cache initializes on app startup (read disk cache into memory Map)
- Whether `<CachedAvatar>` lives in `components/ui/` or `components/app/`
- Test strategy for the caching layer (mock plugin-http responses)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — CACH-01 (session memory cache for avatars), CACH-02 (disk persistence across restarts)

### Avatar usage sites (all need <CachedAvatar> replacement)
- `taskflow/src/routes/dashboard/TaskCard.tsx` — Sprint board task cards (Jira assignee avatar)
- `taskflow/src/routes/dashboard/BacklogRow.tsx` — Backlog rows (Jira assignee avatar)
- `taskflow/src/routes/dashboard/EpicsPage.tsx` — Epic list (Jira assignee avatar)
- `taskflow/src/routes/dashboard/IssueDetailContent.tsx` — Issue detail (assignee avatars on linked stories/subtasks)
- `taskflow/src/routes/dashboard/MergeRequestListPage.tsx` — MR list (GitLab author avatar)
- `taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx` — MR detail (GitLab author avatar)
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` — Release detail (both Jira and GitLab avatars)
- `taskflow/src/routes/dashboard/MentionPopover.tsx` — @mention autocomplete (Jira user avatar)
- `taskflow/src/routes/dashboard/issue-detail/WorklogEntry.tsx` — Worklog entries (Jira author avatar)
- `taskflow/src/routes/dashboard/issue-detail/MergeRequestsSection.tsx` — Linked MRs (GitLab author avatar)
- `taskflow/src/routes/notifications/NotificationRow.tsx` — Notification rows (both Jira and GitLab avatars)

### Image type sources
- `taskflow/src/services/jira/types.ts` — `JiraIssue.fields.assignee.avatarUrls['48x48']`, `JiraComment.author.avatarUrls`, `JiraWorklog.author.avatarUrls`
- `taskflow/src/services/jira.ts` — Issue detail types with assignee/reporter avatarUrls
- `taskflow/src/services/gitlab.ts` — `GitLabMergeRequest.author.avatar_url`
- `taskflow/src/services/notifications.ts` — `authorAvatarUrl` from both Jira and GitLab sources

### Existing patterns
- `taskflow/src/services/tauri.ts` — tauriService abstraction for Tauri API isolation
- `taskflow/src/main.tsx` — QueryClient setup, app initialization
- `taskflow/src/routes/dashboard/TaskCard.tsx` lines 106-130 — Current avatar rendering with onError fallback and initials (reference pattern to replace)

### Prior phase context
- `.planning/phases/43-cache-correctness/43-CONTEXT.md` — gcTime: Infinity, staleTime tuning, QueryClient defaults

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@tauri-apps/plugin-http` fetch: Already used for all API calls — can fetch avatar image bytes through the same CORS-bypassing path
- `@tauri-apps/plugin-store` (LazyStore): Existing persistence pattern for JSON data — candidate for avatar metadata storage
- `tauriService` abstraction (`services/tauri.ts`): Wraps Tauri APIs for testability — new cache service should follow this pattern
- `getInitials()` in TaskCard.tsx: Initials generation logic to extract into the shared component

### Established Patterns
- Plain `<img>` tags with onError fallback to initials `<div>` — current pattern across all 12+ avatar sites
- `@tauri-apps/plugin-http` fetch for all HTTP (not browser fetch) — avatar image fetches must use this too
- LazyStore for persistent data (settings, pinned tabs, recent items) — potential pattern for avatar cache metadata
- No existing image caching or blob URL usage anywhere in the codebase

### Integration Points
- Every component listed in canonical_refs needs `<img>` replaced with `<CachedAvatar>`
- New avatar cache service/hook needs to integrate with app startup (load disk cache → memory Map)
- `@tauri-apps/plugin-fs` may need to be added to dependencies and Tauri capabilities (if chosen for disk storage)
- Blob URLs should be revoked on cache eviction to prevent memory leaks

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 46-avatar-caching*
*Context gathered: 2026-03-30*
