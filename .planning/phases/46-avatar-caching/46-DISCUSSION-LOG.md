# Phase 46: Avatar Caching - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 46-avatar-caching
**Areas discussed:** Caching approach, Disk persistence, Component pattern, Cache scope

---

## Caching Approach

### In-memory caching mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Blob URL pool | Fetch image bytes once via plugin-http, create blob URL. Map<originalUrl, blobUrl> lookup. Zero network after first fetch. | ✓ |
| Base64 data URLs | Fetch bytes, convert to base64 data: URI. Simpler but ~33% larger in memory. | |
| You decide | Claude picks based on performance characteristics. | |

**User's choice:** Blob URL pool
**Notes:** None

### Fetch timing

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy on first render | Each avatar fetched first time a component needs it. No upfront cost. | ✓ |
| Eager prefetch on login | Fetch all team member avatars after credential validation. | |
| Hybrid | Lazy default, prefetch current sprint assignees after sprint data loads. | |

**User's choice:** Lazy on first render
**Notes:** None

---

## Disk Persistence

### Storage mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| plugin-fs to app data dir | Add @tauri-apps/plugin-fs. Write image bytes to appDataDir/avatars/{hash}.ext. Binary files, no encoding overhead. | |
| LazyStore with base64 | Reuse existing LazyStore pattern. ~33% storage overhead, slower serialization. | |
| You decide | Claude picks based on implementation trade-offs. | ✓ |

**User's choice:** You decide
**Notes:** Deferred to Claude's discretion

### Cache eviction

| Option | Description | Selected |
|--------|-------------|----------|
| TTL-based | Evict avatars not accessed in 30 days. Metadata tracks last-accessed timestamp. | ✓ |
| Size-capped LRU | Cap at 50MB, evict least-recently-used. Avatars are tiny so unlikely to hit cap. | |
| No eviction | Avatars ~2-10KB each, 500 users = ~5MB. Not worth the complexity. | |
| You decide | Claude picks simplest approach. | |

**User's choice:** TTL-based (30 days)
**Notes:** None

---

## Component Pattern

### Shared component vs hook

| Option | Description | Selected |
|--------|-------------|----------|
| Shared <CachedAvatar> component | Handles blob URL lookup, loading, initials fallback, onError. Replace all 12+ usages. | ✓ |
| Hook only (useCachedAvatarUrl) | Returns cached blob URL. Keep existing <img> tags. Less refactoring but duplicated fallback logic. | |
| You decide | Claude picks balancing refactoring scope with maintainability. | |

**User's choice:** Shared component
**Notes:** None

### Loading state

| Option | Description | Selected |
|--------|-------------|----------|
| Initials immediately | Show initials from the start. Swap to image when ready. No visible loading state. | ✓ |
| Skeleton circle | Pulsing skeleton circle matching Phase 44 pattern. Consistent but less informative. | |
| You decide | Claude picks based on visual consistency. | |

**User's choice:** Initials immediately
**Notes:** None

---

## Cache Scope

| Option | Description | Selected |
|--------|-------------|----------|
| User avatars only | Jira user avatarUrls and GitLab user avatar_url. Most repetitive images. | |
| All small images | Also project icons, issue type icons, priority icons. | |
| Avatars + attachment thumbnails | User avatars plus file attachment thumbnails. | |

**User's choice:** You decide
**Notes:** Deferred to Claude's discretion — at minimum user avatars, may extend naturally

---

## Claude's Discretion

- Disk persistence mechanism (plugin-fs vs LazyStore base64)
- Exact cache scope beyond user avatars
- Blob URL revocation strategy
- Cache initialization on app startup
- CachedAvatar component location
- Test strategy for caching layer

## Deferred Ideas

None — discussion stayed within phase scope
