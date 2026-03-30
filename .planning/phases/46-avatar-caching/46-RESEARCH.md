# Phase 46: Avatar Caching - Research

**Researched:** 2026-03-30
**Domain:** Blob URL pool, disk persistence, Tauri plugin-http/plugin-store, React component pattern
**Confidence:** HIGH

## Summary

Phase 46 delivers in-memory blob URL caching for avatar images and disk persistence across app restarts. The codebase already has a working precedent for this entire pattern: `AuthImage.tsx` performs authenticated fetches via `@tauri-apps/plugin-http`, creates blob URLs with `URL.createObjectURL`, and revokes them on component unmount. The avatar cache service extends this per-component approach into a module-level `Map<url, blobUrl>` that survives re-renders and component unmounts.

Disk persistence can be done entirely with the already-installed `@tauri-apps/plugin-store` (LazyStore), storing avatar image data as base64 strings. This avoids adding `@tauri-apps/plugin-fs` as a new dependency (not in `Cargo.toml` or `default.json` capabilities), which would require Rust changes, capability JSON changes, and a new npm package. LazyStore already handles the persistence contract: `store.get/set/save` with Tauri IPC. The trade-off (base64 ~33% size inflation) is acceptable given avatars are small JPEG/PNG files (typically 2–10 KB each; base64 overhead is 0.7–3.3 KB per avatar).

The `<CachedAvatar>` component is a straightforward composition: show initials immediately, swap to `<img>` when the blob URL resolves from the cache. The UI-SPEC and CONTEXT.md are fully aligned on the visual contract. All 11 usage sites are already identified in CONTEXT.md and the component lives in `components/ui/cached-avatar.tsx`.

**Primary recommendation:** Build a singleton `avatarCacheService` (module-level, not React state) backed by a `Map<originalUrl, blobUrl>` for in-memory cache and a `LazyStore('avatar-cache.json')` for disk persistence. Initialize the cache on app startup by loading disk entries into the Map. Use `@tauri-apps/plugin-http` fetch (not `apiFetch`) for image byte fetching — avatars are not Jira/GitLab API calls and should not be logged as API calls.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use a blob URL pool — fetch image bytes once via plugin-http, create a blob URL (`URL.createObjectURL`), store in a `Map<originalUrl, blobUrl>` lookup. All `<img>` tags point to the blob URL. Zero network requests after first fetch.
- **D-02:** Lazy fetch on first render — each avatar is fetched the first time a component needs it. No eager prefetch on login. Subsequent renders get the cached blob URL instantly.
- **D-04:** TTL-based eviction — evict avatars not accessed in 30 days. Metadata tracks last-accessed timestamp per avatar URL.
- **D-05:** Create a shared `<CachedAvatar>` component (`url`, `name`, `size` props) that handles blob URL lookup, loading state, initials fallback, and onError. Replace all 12+ inline avatar `<img>` usages across the codebase.
- **D-06:** Show initials immediately as placeholder while image loads. When blob URL is ready, swap to the image. No skeleton circle — initials are already meaningful.

### Claude's Discretion
- Persistence mechanism choice (plugin-fs vs LazyStore base64)
- Exact cache scope beyond user avatars
- Blob URL revocation strategy (on eviction, on app close, or never)
- How the cache initializes on app startup (read disk cache into memory Map)
- Whether `<CachedAvatar>` lives in `components/ui/` or `components/app/`
- Test strategy for the caching layer (mock plugin-http responses)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CACH-01 | Avatar and user images are cached in memory during the session (no re-fetch on re-render) | Module-level `Map<url, blobUrl>` singleton; `AuthImage.tsx` proves blob URL pattern works in this Tauri app |
| CACH-02 | Avatar cache persists to disk and survives app restarts (via @tauri-apps/plugin-fs, or LazyStore) | LazyStore already installed and in use; base64 storage approach confirmed viable; REQUIREMENTS.md says "via @tauri-apps/plugin-fs" but D-03 gives Claude discretion to pick LazyStore instead |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tauri-apps/plugin-http` | 2.5.7 (installed) | Fetch avatar image bytes through CORS bypass | Already used for ALL API calls in this app; avatars served from Jira/GitLab require this path |
| `@tauri-apps/plugin-store` (LazyStore) | 2.4.2 (installed) | Disk persistence for base64 avatar data + TTL metadata | Already registered in `lib.rs`, declared in `capabilities/default.json` (`store:default`), no new setup required |
| `URL.createObjectURL` | Browser API | Convert Blob to local URL safe for `<img src>` | Used in AuthImage.tsx already; standard Web API available in Tauri webview |
| `URL.revokeObjectURL` | Browser API | Release memory when evicting blob URLs | Paired with createObjectURL; prevents memory leaks |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tauri-apps/api/path` (appDataDir) | Already installed | Resolve app data directory for store file path | Only needed if using plugin-fs (not needed for LazyStore approach) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| LazyStore base64 | `@tauri-apps/plugin-fs` binary files | plugin-fs requires: new npm package, new Cargo.toml entry, new capabilities permission, `appDataDir` path resolution, binary read/write logic. LazyStore is already wired. Base64 overhead (~33%) is negligible for avatars (2–10 KB). Use LazyStore. |
| Module singleton | React Context / TanStack Query | Query cache is for server data with TTL invalidation. Avatar blob URLs are not server data — they're derived local resources. Module singleton is correct scope. |
| Separate fetch for images | Reuse `apiFetch` | `apiFetch` logs all calls as Jira/GitLab API calls. Avatar image fetches are not API calls and should not pollute the debug log. Use direct `fetch` from `@tauri-apps/plugin-http` instead. |

**Installation:** No new packages needed. LazyStore approach uses only already-installed dependencies.

**Version verification:** `@tauri-apps/plugin-store@2.4.2` (current as of 2026-03-30), `@tauri-apps/plugin-http@2.5.7` (current as of 2026-03-30).

---

## Architecture Patterns

### Recommended Project Structure
```
taskflow/src/
├── services/
│   └── avatarCache.ts           # Singleton cache service (module-level Map + LazyStore)
├── hooks/
│   └── useAvatarCache.ts        # React hook wrapping the service (triggers re-render on resolve)
├── components/ui/
│   └── cached-avatar.tsx        # <CachedAvatar> component (per UI-SPEC)
└── test/
    └── setup.ts                 # Already mocks plugin-store — no changes needed
```

### Pattern 1: Module-Level Singleton Cache Service

**What:** A single TypeScript module (`avatarCache.ts`) exports functions over a shared `Map<string, string>` and a single `LazyStore` instance. No class instantiation — plain module state.

**When to use:** Whenever state must survive React component unmounts but does not need React reactivity at the storage layer.

**Example:**
```typescript
// taskflow/src/services/avatarCache.ts
import { fetch } from '@tauri-apps/plugin-http';
import { LazyStore } from '@tauri-apps/plugin-store';

// In-memory blob URL pool (survives component unmounts within session)
const memoryCache = new Map<string, string>(); // originalUrl -> blobUrl

// Disk persistence store (survives app restarts)
const diskStore = new LazyStore('avatar-cache.json');

// Pending fetches (prevents duplicate in-flight requests for same URL)
const inflight = new Map<string, Promise<string | null>>();

const TTL_DAYS = 30;
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

interface AvatarDiskEntry {
  base64: string;
  mimeType: string;
  lastAccessed: number; // Date.now() ms
}

/** Initialize: load disk cache into memory Map on app startup */
export async function initAvatarCache(): Promise<void> {
  const keys = await diskStore.keys().catch(() => [] as string[]);
  const now = Date.now();
  for (const key of keys) {
    const entry = await diskStore.get<AvatarDiskEntry>(key).catch(() => null);
    if (!entry) continue;
    // Evict stale entries during init
    if (now - entry.lastAccessed > TTL_MS) {
      await diskStore.delete(key).catch(() => {});
      continue;
    }
    // Reconstruct blob URL from base64
    const bytes = Uint8Array.from(atob(entry.base64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: entry.mimeType });
    const blobUrl = URL.createObjectURL(blob);
    memoryCache.set(key, blobUrl);
  }
  await diskStore.save().catch(() => {});
}

/** Get blob URL from memory cache (null if not cached) */
export function getCachedBlobUrl(originalUrl: string): string | null {
  return memoryCache.get(originalUrl) ?? null;
}

/** Fetch avatar, cache in memory + disk, return blob URL */
export async function fetchAndCacheAvatar(originalUrl: string): Promise<string | null> {
  // Return from memory if already cached
  const cached = memoryCache.get(originalUrl);
  if (cached) return cached;

  // Deduplicate in-flight requests for the same URL
  const pending = inflight.get(originalUrl);
  if (pending) return pending;

  const promise = (async (): Promise<string | null> => {
    try {
      const response = await fetch(originalUrl);
      if (!response.ok) return null;
      const blob = await response.blob();
      if (blob.size === 0) return null;

      const blobUrl = URL.createObjectURL(blob);
      memoryCache.set(originalUrl, blobUrl);

      // Persist to disk as base64
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const base64 = btoa(String.fromCharCode(...bytes));
      const entry: AvatarDiskEntry = {
        base64,
        mimeType: blob.type || 'image/jpeg',
        lastAccessed: Date.now(),
      };
      await diskStore.set(originalUrl, entry).catch(() => {});
      await diskStore.save().catch(() => {});

      return blobUrl;
    } catch {
      return null;
    } finally {
      inflight.delete(originalUrl);
    }
  })();

  inflight.set(originalUrl, promise);
  return promise;
}

/** Evict a URL from memory + disk and revoke its blob URL */
export async function evictAvatar(originalUrl: string): Promise<void> {
  const blobUrl = memoryCache.get(originalUrl);
  if (blobUrl) URL.revokeObjectURL(blobUrl);
  memoryCache.delete(originalUrl);
  await diskStore.delete(originalUrl).catch(() => {});
  await diskStore.save().catch(() => {});
}
```

### Pattern 2: useAvatarCache Hook

**What:** A React hook that subscribes a component to a cached avatar URL. Uses local state to trigger a re-render when the blob URL resolves asynchronously.

**When to use:** Inside `<CachedAvatar>` only. Other components use `<CachedAvatar>`, not this hook directly.

**Example:**
```typescript
// taskflow/src/hooks/useAvatarCache.ts
import { useEffect, useState } from 'react';
import { getCachedBlobUrl, fetchAndCacheAvatar } from '@/services/avatarCache';

export function useAvatarCache(url: string | null | undefined): {
  blobUrl: string | null;
  loading: boolean;
} {
  const [blobUrl, setBlobUrl] = useState<string | null>(
    url ? getCachedBlobUrl(url) : null  // sync hit: no loading state
  );
  const [loading, setLoading] = useState<boolean>(
    url ? getCachedBlobUrl(url) === null : false
  );

  useEffect(() => {
    if (!url) return;

    // Already in memory — no async needed
    const cached = getCachedBlobUrl(url);
    if (cached) {
      setBlobUrl(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchAndCacheAvatar(url).then((result) => {
      if (!cancelled) {
        setBlobUrl(result);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [url]);

  return { blobUrl, loading };
}
```

### Pattern 3: CachedAvatar Component

**What:** Drop-in replacement for all inline `<img>` avatar patterns. Shows initials immediately, swaps to image when blob URL resolves.

**When to use:** Every avatar usage site listed in CONTEXT.md canonical_refs.

**Example:**
```typescript
// taskflow/src/components/ui/cached-avatar.tsx
import { cn } from '@/lib/utils';
import { useAvatarCache } from '@/hooks/useAvatarCache';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const SIZE_MAP = { 20: 'size-5', 24: 'size-6', 32: 'size-8', 40: 'size-10' } as const;

interface CachedAvatarProps {
  url: string | null | undefined;
  name: string;
  size?: 20 | 24 | 32 | 40;
  className?: string;
}

export function CachedAvatar({ url, name, size = 32, className }: CachedAvatarProps) {
  const { blobUrl } = useAvatarCache(url);
  const sizeClass = SIZE_MAP[size];
  const initials = getInitials(name);

  return (
    <div className={cn('relative', sizeClass, className)}>
      {/* Initials fallback — always rendered, hidden when image is shown */}
      <div
        className={cn(
          sizeClass,
          'rounded-full bg-muted flex items-center justify-center',
          'text-[10px] font-medium text-foreground',
          blobUrl ? 'hidden' : 'flex',
        )}
        role="img"
        aria-label={name}
      >
        {initials}
      </div>
      {/* Image — shown only when blob URL is available */}
      {blobUrl && (
        <img
          src={blobUrl}
          alt={name}
          className={cn(sizeClass, 'rounded-full object-cover')}
          onError={() => {/* blob URLs don't error; no-op */}}
        />
      )}
    </div>
  );
}
```

### Pattern 4: App Startup Cache Initialization

**What:** Call `initAvatarCache()` during app startup before the first render, so returning users see images immediately on first paint.

**When to use:** In `main.tsx` before `ReactDOM.createRoot(...).render(...)`.

**Example:**
```typescript
// taskflow/src/main.tsx — add before loadTheme().then(...)
import { initAvatarCache } from './services/avatarCache';

// Initialize avatar cache from disk before first render
// Errors are non-fatal — app functions without cached avatars
applyDensity('default');
Promise.all([
  loadTheme(),
  initAvatarCache().catch(() => {}),
]).then(() => {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(...)
});
```

### Anti-Patterns to Avoid
- **Using `apiFetch` for image fetches:** `apiFetch` logs to the debug store and marks disconnect on 401. Avatar fetch failures should be silent. Use `fetch` from `@tauri-apps/plugin-http` directly.
- **Per-component state for cache:** If each `<CachedAvatar>` instance manages its own cache, navigating away and back re-fetches everything. The Map must be module-level, not inside a hook or component.
- **Revoking blob URLs on component unmount:** `AuthImage.tsx` revokes on unmount because it has no shared cache. `CachedAvatar` must NOT revoke on unmount — the blob URL is still valid for other component instances using the same URL. Revoke only on TTL eviction.
- **`btoa` with large arrays:** `btoa(String.fromCharCode(...bytes))` fails with "Maximum call stack size exceeded" for large Uint8Arrays. For images > ~50 KB, use chunked processing. Avatars are typically small, but chunk defensively.
- **Storing entire base64 under one LazyStore key:** Store each avatar URL as a separate key in LazyStore. Storing all avatars in a single JSON object makes reads/writes O(N) where N is the total number of cached avatars.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CORS bypass for avatar images | Custom proxy / Rust command | `@tauri-apps/plugin-http` fetch | Already used for all API calls; Jira avatar URLs require auth which plugin-http handles naturally |
| Blob URL creation | Custom data URL encoding | `URL.createObjectURL(blob)` | Browser built-in; handles MIME types, memory management at OS level |
| Base64 encode/decode | Custom encoder | `btoa` / `atob` (with chunking for large inputs) | Web standard; available in Tauri webview |
| Disk persistence | Custom file I/O | `LazyStore` from `@tauri-apps/plugin-store` | Already installed, already mocked in test setup, already handles IPC serialization |
| Deduplication of concurrent requests | Queue/mutex | Module-level `inflight` Map with Promise reuse | Simple and effective; collapses concurrent requests for the same URL into one |

---

## Persistence Decision: LazyStore vs plugin-fs

**Recommendation: Use LazyStore (base64)**

Evidence:
1. `@tauri-apps/plugin-fs` is NOT in `Cargo.toml` (only `tauri-plugin-store` and `tauri-plugin-http` are). Adding plugin-fs requires: `Cargo.toml` change, `src-tauri/src/lib.rs` plugin registration, `capabilities/default.json` permissions (`fs:allow-read-file`, `fs:allow-write-file`, `fs:allow-app-data-dir`), new npm package install. That's 4 files changed for plumbing with no functional benefit.
2. `@tauri-apps/plugin-store` LazyStore is fully integrated: declared in capabilities, registered in `lib.rs`, mocked in `src/test/setup.ts` globally (all tests get the mock for free).
3. Base64 overhead: 10 KB avatar → ~13.3 KB stored. For 50 avatars (generous estimate) that's ~665 KB total. LazyStore files are stored in the OS app data directory, not memory — no size concern.
4. The REQUIREMENTS.md hint "(via @tauri-apps/plugin-fs)" is advisory, not locked. CONTEXT.md D-03 explicitly grants Claude discretion on the mechanism.

**Blob URL revocation strategy:**
- On TTL eviction during `initAvatarCache()`: revoke and delete
- On app close: do NOT revoke — OS reclaims memory automatically; revoking on close adds shutdown complexity with no benefit
- On component unmount: do NOT revoke — the URL is shared across all components

**Cache scope (D-07 — Claude's discretion):**
Stick to user avatars only (Jira `avatarUrls['48x48']` and GitLab `avatar_url`). Project icons and issue type icons are small SVGs often served inline or from static CDN paths — they don't have CORS/auth issues and the browser handles them. Adding them increases scope without clear benefit. The `url` prop on `<CachedAvatar>` accepts any string, so scope extension is a future change with zero API changes.

---

## Common Pitfalls

### Pitfall 1: `btoa` Stack Overflow on Large Blobs
**What goes wrong:** `btoa(String.fromCharCode(...new Uint8Array(buffer)))` throws "Maximum call stack size exceeded" for arrays larger than ~65,536 elements (varies by JS engine).
**Why it happens:** Spread operator `...` passes all bytes as individual function arguments, exhausting stack space.
**How to avoid:** Process in chunks:
```typescript
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
```
**Warning signs:** RangeError during disk persistence write for any avatar larger than ~64 KB.

### Pitfall 2: Duplicate In-Flight Requests
**What goes wrong:** Two components rendering simultaneously with the same avatar URL both call `fetchAndCacheAvatar` before either completes. Two network requests fire for the same image.
**Why it happens:** The memory cache is empty when both calls start; both miss the cache and start fetching.
**How to avoid:** Use the `inflight` Map pattern — store the in-progress Promise in the Map before awaiting it; subsequent calls for the same URL return the same Promise.
**Warning signs:** Network inspector shows 2+ requests for the same avatar URL during initial board render.

### Pitfall 3: Revoking Shared Blob URLs on Unmount
**What goes wrong:** `<CachedAvatar>` revokes its blob URL in a `useEffect` cleanup. Another mounted component using the same URL now has a broken `<img>` with a revoked URL.
**Why it happens:** Following `AuthImage.tsx` as a template — but `AuthImage` uses a per-instance blob URL, not a shared one.
**How to avoid:** Never call `URL.revokeObjectURL` in the hook's cleanup function. Only revoke in `evictAvatar()`.
**Warning signs:** Images render blank on re-mount of components that were previously mounted.

### Pitfall 4: LazyStore Keys with Special Characters
**What goes wrong:** Avatar URLs as LazyStore keys contain `https://`, slashes, query params. Some store implementations have issues with special characters as keys.
**Why it happens:** Tauri's LazyStore ultimately serializes to JSON; URL strings are valid JSON object keys. This is not actually a problem with LazyStore — it handles arbitrary string keys correctly.
**How to avoid:** Use the raw URL as the key (confirmed safe with LazyStore). Alternatively, hash the URL (SHA-256 truncated) for storage cleanliness, but raw URL is simpler and correct.
**Warning signs:** N/A — this is a false pitfall; raw URLs work fine as LazyStore keys.

### Pitfall 5: initAvatarCache Race with First Render
**What goes wrong:** `initAvatarCache()` is async and takes 50–200ms to read disk. Components render before it completes, miss the in-memory cache, and fire unnecessary fetches.
**Why it happens:** Parallel initialization — app renders before disk load completes.
**How to avoid:** Two acceptable strategies: (1) await `initAvatarCache()` before calling `ReactDOM.createRoot(...).render(...)` — simple, adds 50–200ms to startup for returning users but they get instant images; (2) let it race — components fall back to fetch, disk cache is advisory not blocking. Strategy (1) is correct for CACH-02 ("available immediately on the next app launch without re-fetching").
**Warning signs:** Network requests firing for avatars even on app restart.

---

## Code Examples

Verified patterns from existing codebase:

### Existing Blob URL Pattern (AuthImage.tsx)
```typescript
// Source: taskflow/src/routes/dashboard/AuthImage.tsx
const response = await fetch(src, { headers });  // plugin-http fetch
if (!response.ok) { setError(true); return; }
const blob = await response.blob();
if (blob.size === 0) { setError(true); return; }
const blobObjUrl = URL.createObjectURL(blob);
blobUrlRef.current = blobObjUrl;
setBlobUrl(blobObjUrl);
// On unmount (per-instance URL, safe to revoke):
URL.revokeObjectURL(blobUrlRef.current);
```

### Existing LazyStore Pattern (tauri-storage.ts)
```typescript
// Source: taskflow/src/lib/tauri-storage.ts
const store = new LazyStore(filename);
const value = await store.get<string>(name);
await store.set(name, value);
await store.save();  // REQUIRED — store only persists to disk on save()
await store.delete(name);
await store.save();
```

### Existing Initials + Fallback Pattern (TaskCard.tsx lines 106–130)
```typescript
// Source: taskflow/src/routes/dashboard/TaskCard.tsx
<img
  src={avatarUrl}
  alt={displayName}
  className="size-5 rounded-full"
  onError={(e) => {
    e.currentTarget.style.display = 'none';
    const sibling = e.currentTarget.nextElementSibling as HTMLElement | null;
    if (sibling) sibling.style.display = 'flex';
  }}
/>
<div className={cn('size-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium', avatarUrl ? 'hidden' : 'flex')}>
  {getInitials(displayName)}
</div>
```
`<CachedAvatar>` replaces this entire block. The `onError` DOM manipulation approach is eliminated — blob URLs do not have network errors after creation.

### Test Setup Mock (already covers LazyStore)
```typescript
// Source: taskflow/src/test/setup.ts
vi.mock('@tauri-apps/plugin-store', () => {
  class LazyStore {
    private data = new Map<string, unknown>();
    async get<T>(key: string): Promise<T | undefined> { return this.data.get(key) as T | undefined; }
    async set(key: string, value: unknown): Promise<void> { this.data.set(key, value); }
    async delete(key: string): Promise<void> { this.data.delete(key); }
    async save(): Promise<void> {}
    async load(): Promise<void> {}
  }
  return { LazyStore };
});
```
`avatarCacheService.test.ts` gets this mock for free via `setupFiles`. No additional mock setup needed for LazyStore.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-component blob URL (AuthImage.tsx pattern) | Shared module-level Map (avatarCache.ts) | Phase 46 | Eliminates re-fetch on component unmount/remount within session |
| Inline `<img>` with DOM `onError` manipulation | `<CachedAvatar>` component | Phase 46 | Centralizes avatar rendering; removes fragile DOM-level fallback hack |
| No avatar persistence | LazyStore base64 | Phase 46 | Avatars available immediately on app restart |

**Not deprecated:** `AuthImage.tsx` is NOT replaced by this phase — it handles authenticated Jira attachment images (full-page images in the issue detail panel), which are different from small user avatars. They are different use cases: attachments need per-render auth tokens; avatars can be fetched once anonymously or with a stored token.

---

## Open Questions

1. **Jira avatar URL authentication requirements**
   - What we know: Jira avatars served from Jira DC may require auth headers; `AuthImage.tsx` shows Jira attachment URLs require `Bearer` token; `plugin-http` fetch without auth sometimes works for avatars depending on Jira configuration
   - What's unclear: Whether `avatarUrls['48x48']` URLs require auth on the user's specific Jira DC instance; GitLab `avatar_url` typically does not require auth
   - Recommendation: Try unauthenticated fetch first. If the response is 401 or 403, add `Authorization: Bearer <jira-pat>` header. The implementation can read `useAuthStore.getState().jiraBaseUrl` to detect Jira URLs and conditionally add the header, mirroring what `AuthImage.tsx` does. This is a detail for the implementer to handle — the service should accept an optional `authHeader` parameter or detect URL origin internally.

2. **`LazyStore.keys()` API availability**
   - What we know: The `LazyStore` API documentation lists `keys()` as a method returning `Promise<string[]>` (verified in @tauri-apps/plugin-store@2.x API)
   - What's unclear: Whether the global test mock in `setup.ts` needs a `keys()` method added (it currently does not have one)
   - Recommendation: Add `async keys(): Promise<string[]> { return [...this.data.keys()]; }` to the mock in `setup.ts` as part of Wave 0 test gap work.

---

## Environment Availability

Step 2.6: Environment audit covers the Tauri-specific dependency changes needed.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@tauri-apps/plugin-http` | Image fetch | ✓ | 2.5.7 | — |
| `@tauri-apps/plugin-store` (LazyStore) | Disk persistence | ✓ | 2.4.2 | — |
| `@tauri-apps/plugin-fs` | Alternative disk persistence | ✗ (not installed) | — | Use LazyStore instead (recommended) |
| `URL.createObjectURL` | Blob URL creation | ✓ | Web API (Tauri webview) | — |
| Vitest + jsdom | Testing | ✓ | (existing) | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** `@tauri-apps/plugin-fs` — not needed; LazyStore is the chosen approach.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (globals enabled) |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npm run test -- --run` |
| Full suite command | `cd taskflow && npm run test -- --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CACH-01 | `fetchAndCacheAvatar(url)` called twice returns same blob URL without second network call | unit | `cd taskflow && npm run test -- --run src/services/avatarCache.test.ts` | ❌ Wave 0 |
| CACH-01 | Concurrent calls for same URL only fire one network request (inflight deduplication) | unit | `cd taskflow && npm run test -- --run src/services/avatarCache.test.ts` | ❌ Wave 0 |
| CACH-01 | `<CachedAvatar>` shows initials initially, then image after blob URL resolves | unit | `cd taskflow && npm run test -- --run src/components/ui/cached-avatar.test.tsx` | ❌ Wave 0 |
| CACH-02 | `initAvatarCache()` loads disk entries into memory Map, old entries evicted | unit | `cd taskflow && npm run test -- --run src/services/avatarCache.test.ts` | ❌ Wave 0 |
| CACH-02 | TTL eviction: entries older than 30 days are removed during init | unit | `cd taskflow && npm run test -- --run src/services/avatarCache.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd taskflow && npm run test -- --run`
- **Per wave merge:** `cd taskflow && npm run test -- --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `taskflow/src/services/avatarCache.test.ts` — covers CACH-01 (memory cache hit, inflight dedup) and CACH-02 (disk init, TTL eviction)
- [ ] `taskflow/src/components/ui/cached-avatar.test.tsx` — covers CACH-01 (component render states: initials, loaded, no-url)
- [ ] `taskflow/src/test/setup.ts` — add `keys()` method to LazyStore mock: `async keys(): Promise<string[]> { return [...this.data.keys()]; }`
- [ ] Mock for `@tauri-apps/plugin-http` fetch needed in test files (not globally mocked yet) — each test file mocks `fetch` from `@tauri-apps/plugin-http` using `vi.mock`

---

## Project Constraints (from CLAUDE.md)

No `CLAUDE.md` found at `/Users/mimo/Desktop/Tasker/CLAUDE.md`. No project-level constraints to document.

---

## Sources

### Primary (HIGH confidence)
- `taskflow/src/routes/dashboard/AuthImage.tsx` — existing blob URL pattern with plugin-http fetch; direct code inspection
- `taskflow/src/lib/tauri-storage.ts` — LazyStore usage pattern; direct code inspection
- `taskflow/src/test/setup.ts` — existing LazyStore global mock; direct code inspection
- `taskflow/src-tauri/Cargo.toml` — confirms plugin-fs NOT present, plugin-store IS present
- `taskflow/src-tauri/capabilities/default.json` — confirms `store:default` permission registered
- `taskflow/src-tauri/src/lib.rs` — confirms `tauri_plugin_store::Builder::new().build()` registered
- `taskflow/src/services/stronghold.ts` — another LazyStore usage pattern example; direct code inspection
- `.planning/phases/46-avatar-caching/46-CONTEXT.md` — all locked decisions
- `.planning/phases/46-avatar-caching/46-UI-SPEC.md` — visual contract for CachedAvatar

### Secondary (MEDIUM confidence)
- `taskflow/src/routes/dashboard/TaskCard.tsx` lines 106–130 — reference pattern for initials fallback
- npm registry: `@tauri-apps/plugin-fs@2.4.5` (latest) — confirmed available but not currently installed

### Tertiary (LOW confidence)
- LazyStore `keys()` API: documented in @tauri-apps/plugin-store but not directly verified against the specific installed version 2.4.2 — mark as needing implementation-time check

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies directly inspected from installed packages
- Architecture: HIGH — patterns derived from existing codebase (AuthImage.tsx, tauri-storage.ts, stronghold.ts)
- Pitfalls: HIGH for pitfalls 1–3 (confirmed from code patterns); MEDIUM for pitfall 5 (common Tauri async init issue)
- Disk persistence decision: HIGH — plugin-fs absence from Cargo.toml is definitive

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable libraries, no fast-moving dependencies)
