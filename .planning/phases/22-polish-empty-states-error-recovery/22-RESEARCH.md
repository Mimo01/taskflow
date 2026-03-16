# Phase 22: Polish -- Empty States + Error Recovery - Research

**Researched:** 2026-03-16
**Domain:** React UI components, TanStack Query error handling, shadcn/ui
**Confidence:** HIGH

## Summary

Phase 22 is a UI polish pass replacing inline empty/error JSX across 10 data views with two shared components (`EmptyState`, `ErrorState`) and a `StaleDataBanner`. The codebase already has all prerequisites: every view uses TanStack Query with `isLoading`/`isError`/`data`/`refetch`, the shadcn `Alert` component is installed, and Lucide icons are available. The Settings page defaults to the Connections section, so the Reconnect flow needs no special routing.

The main technical challenge is auth error detection. Current service functions throw plain `Error` objects without preserving HTTP status codes -- the status information is lost in the error message string. A custom error class (`ApiError` with a `status` field) or message-based heuristic is needed for the ErrorState component to distinguish auth errors from generic failures. Additionally, `fetchSprintIssues` (line 195 of jira.ts) throws a raw `Response` object on first-page failures, creating a second error shape to handle.

**Primary recommendation:** Create an `ApiError` class that preserves HTTP status, retrofit it into service throw sites for 401/403 cases, then build `EmptyState`/`ErrorState`/`StaleDataBanner` as shared components and sweep all 10 views.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Large muted Lucide icon (48-64px) above headline text -- no custom SVG illustrations
- Each view gets a unique contextual icon (ClipboardList, Columns3, Inbox, GitMerge, Bell, Package, Layers, SearchX, Users, BarChart3)
- Friendly casual tone for headlines
- Contextual CTA buttons: Backlog -> "Create Issue", Epics -> "Create Epic", MR Attention with no GitLab token -> "Connect GitLab", others -> no CTA
- Inline alert using shadcn Alert component for error states
- Plain language only -- never expose raw API errors to users
- Error messages are view-specific: "Couldn't load tasks", "Couldn't load merge requests", etc.
- Stale cached data + refetch fail: dismissible warning banner above stale data, keep stale content visible
- No cached data + fetch fail: full inline alert error state
- Auth errors detected via HTTP status: 401/403 -> auth error path
- Auth error CTA is "Reconnect" button navigating to /settings with Connections section active
- Non-auth errors -> generic "Couldn't load {view}" + Retry
- Create `<EmptyState>` and `<ErrorState>` shared components in src/components/ui/
- ErrorState auto-detects auth errors (401/403) and shows "Reconnect" CTA instead of "Retry"
- All 10+ views use shared components -- no inline empty/error JSX

### Claude's Discretion
- Exact icon sizes, spacing, and color tokens for empty/error states
- Banner component design for stale-data-with-error scenario
- How to pass auth error context (which service failed) through TanStack Query errors
- Whether ErrorState needs a `variant` prop or auto-detects everything from the error object
- Exact Lucide icon choices if the ones listed don't exist or feel wrong at implementation time

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| POLISH-01 | All list views show an illustrated empty state with headline and CTA when there is no data | EmptyState component pattern, per-view icon/copy mapping from UI-SPEC, existing empty state locations identified in all 10 views |
| POLISH-02 | All data views show an actionable error state with plain-language message and retry button on fetch failure | ErrorState component pattern, StaleDataBanner for cached-data-with-error, ApiError class for status preservation, existing error state locations identified |
| POLISH-03 | Authentication errors include a re-connect CTA navigating to Settings > Connections | Auth detection via ApiError.status or message heuristic, Settings defaults to Connections section (no special routing needed), existing ReAuthBanner pattern as reference |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | (existing) | Component framework | Already in use |
| TanStack Query | (existing) | Data fetching, caching, refetch | Already in use in all views |
| shadcn/ui Alert | (installed) | Error state container | Already installed, used by ReAuthBanner |
| lucide-react | (existing) | Icons for empty/error states | Already imported across app |
| react-router-dom | (existing) | Navigation for Reconnect flow | Already used for /settings routing |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-variance-authority | (existing) | Alert variants (destructive) | Already used by Alert component |
| @/lib/utils (cn) | (existing) | Class merging | Standard pattern across all components |

### Alternatives Considered
None -- all libraries are already in use. No new dependencies needed.

## Architecture Patterns

### Recommended Project Structure
```
src/components/ui/
  empty-state.tsx          # NEW: shared EmptyState component
  error-state.tsx          # NEW: shared ErrorState component
  stale-data-banner.tsx    # NEW: shared StaleDataBanner component
src/lib/
  api-error.ts             # NEW: ApiError class with status field
```

### Pattern 1: ApiError Class for Status Preservation
**What:** A custom error class that carries the HTTP status code, enabling ErrorState to distinguish auth (401/403) from other errors.
**When to use:** All service functions that currently `throw new Error(...)` for HTTP failures.
**Why needed:** Current service code throws plain `Error` objects. The HTTP status is lost -- it is embedded in the message string inconsistently (sometimes "status 401", sometimes "Invalid token"). The ErrorState component needs a reliable way to detect auth errors.

```typescript
// src/lib/api-error.ts
export class ApiError extends Error {
  status: number;
  source: 'jira' | 'gitlab';

  constructor(message: string, status: number, source: 'jira' | 'gitlab') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.source = source;
  }
}

export function isAuthError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 401 || error.status === 403;
  }
  // Fallback: check Response object (fetchSprintIssues throws raw Response)
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    return status === 401 || status === 403;
  }
  // Last resort: message heuristic
  if (error instanceof Error) {
    return /\b(401|403)\b/.test(error.message)
      || error.message.includes('token has expired')
      || error.message.includes('lacks required permissions');
  }
  return false;
}

export function getErrorSource(error: unknown): 'jira' | 'gitlab' | null {
  if (error instanceof ApiError) return error.source;
  return null;
}
```

**Confidence:** HIGH -- this is the standard pattern for preserving HTTP context in JS/TS error handling.

### Pattern 2: Three-State Detection (Empty / Error / Stale Error)
**What:** TanStack Query provides `isError`, `data`, and `error` simultaneously. The combination determines which UI to show.
**When to use:** Every data view.

```typescript
// Detection logic per UI-SPEC:
// isError && !data         -> full ErrorState (no cached data)
// isError && data          -> StaleDataBanner above stale content
// !isLoading && !isError && data.length === 0 -> EmptyState
```

**Confidence:** HIGH -- this is documented TanStack Query behavior. When a query has cached data and a background refetch fails, `isError` is true AND `data` retains the stale cache.

### Pattern 3: Shared Component Props (from UI-SPEC)
**What:** EmptyState and ErrorState receive minimal, standardized props.

```typescript
// EmptyState
interface EmptyStateProps {
  icon: LucideIcon;        // Component reference, not element
  title: string;
  subtitle?: string;
  action?: React.ReactNode; // Caller provides <Button> if needed
}

// ErrorState
interface ErrorStateProps {
  error: Error | unknown;
  onRetry: () => void;
  viewName: string;         // "tasks", "merge requests", etc.
}

// StaleDataBanner
interface StaleDataBannerProps {
  onRetry: () => void;
  onDismiss: () => void;
}
```

### Anti-Patterns to Avoid
- **Exposing raw error messages to users:** The Error.message from services contains technical details like "Jira search failed with status 400". ErrorState must use a sanitized view-specific message like "Couldn't load tasks" and log the raw error to console.
- **Inline empty/error JSX per view:** Every view currently has bespoke empty/error `<div>` blocks. These must ALL be replaced with the shared components -- no holdouts.
- **Checking `error.message` for status codes as primary detection:** Fragile and inconsistent. Use `ApiError.status` as primary, message matching as fallback only.
- **Adding React Context for error state:** Project decision is prop-threading only, no createContext/useContext anywhere.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Alert container | Custom `<div>` with border/bg | shadcn `<Alert variant="destructive">` | Already installed, handles a11y role="alert", has title/description/action slots |
| Error detection | Per-view if/else chains checking error types | Shared `isAuthError()` + `getErrorSource()` helpers | Centralizes detection logic, handles all error shapes |
| Stale data detection | Manual cache inspection | TanStack Query's `isError && data` combo | Built-in behavior -- stale cache preserved when refetch fails |

## Common Pitfalls

### Pitfall 1: Error Object Shape Inconsistency
**What goes wrong:** ErrorState receives errors of different shapes -- `Error` (most services), `Response` (fetchSprintIssues first page), or potentially unknown types from TanStack Query.
**Why it happens:** Service functions were written at different times with no shared error convention.
**How to avoid:** The `isAuthError()` helper must handle all three shapes: `ApiError` (new), raw `Response` (has `.status` property), and plain `Error` (message heuristic). Retrofit `ApiError` into 401/403 throw sites, but keep fallbacks for any code paths missed.
**Warning signs:** ErrorState shows "Retry" when it should show "Reconnect" for auth failures.

### Pitfall 2: fetchSprintIssues Throws Raw Response
**What goes wrong:** Line 195 of jira.ts does `throw response` (a raw Response object). This is NOT an Error instance -- `instanceof Error` will be false, `.message` won't exist.
**Why it happens:** Historical design choice to let callers inspect status/body.
**How to avoid:** Either retrofit this to throw `ApiError` (preferred) or ensure `isAuthError()` checks for `.status` property on non-Error objects.
**Warning signs:** Uncaught errors or "undefined" rendering in error states for Sprint Board/Sprint Progress/Workload views (which all use fetchSprintIssues).

### Pitfall 3: Settings Navigation for Reconnect
**What goes wrong:** Navigating to `/settings` works, but the user doesn't know which service (Jira or GitLab) needs attention.
**Why it happens:** Settings page defaults to Connections section, but both Jira and GitLab are visible.
**How to avoid:** The `ApiError.source` field tells ErrorState which service failed. The Reconnect button can pass state via `useNavigate('/settings', { state: { highlight: 'jira' } })` -- but CONTEXT.md says Connections is the default section so basic navigation may suffice. The existing ReAuthBanner already uses a simple `<Link to="/settings">` without service highlighting.
**Warning signs:** User clicks Reconnect but doesn't know which token to check.

### Pitfall 4: Stale Data Banner Dismissed Then Error Persists
**What goes wrong:** User dismisses the StaleDataBanner, but the underlying error persists. On next background refetch, the banner should reappear.
**Why it happens:** Dismiss state stored in component local state persists across refetch cycles.
**How to avoid:** Reset the dismissed state when `dataUpdatedAt` changes (successful refetch) or when `error` changes (new error from new refetch attempt). Track dismissed state per error instance, not globally.

### Pitfall 5: EpicsPage Missing isError/refetch
**What goes wrong:** EpicsPage currently only destructures `{ data: epicsData, isLoading }` from useQuery -- no `isError`, `error`, or `refetch`.
**Why it happens:** Error handling was deferred during initial implementation.
**How to avoid:** Add `isError, error, refetch` to the useQuery destructuring before wiring ErrorState.

### Pitfall 6: NotificationPopover is Not a TanStack Query Consumer
**What goes wrong:** NotificationPopover reads from a Zustand store (`useNotificationsStore`), not directly from useQuery. It has no `isError`/`refetch` of its own.
**Why it happens:** Polling logic lives in TopBar/useNotificationPolling hook; the popover is a pure display component.
**How to avoid:** Either pass error/refetch down from the polling hook via props, or add error state to the notifications Zustand store so NotificationPopover can read it. The simpler approach: add `fetchError` and `retryFetch` to the notifications store, set them from the polling hook.

## Code Examples

### Current Empty State Pattern (to be replaced)
```typescript
// MyTasksTab.tsx lines 361-366 -- BEFORE
{!isLoading && !isError && data && data.length === 0 && (
  <div className="py-8 text-center text-sm text-muted-foreground">
    No tasks — you are all caught up!
  </div>
)}
```

### Target Empty State Pattern (after)
```typescript
// MyTasksTab.tsx -- AFTER
import { EmptyState } from '@/components/ui/empty-state';
import { ClipboardList } from 'lucide-react';

{!isLoading && !isError && data && data.length === 0 && (
  <EmptyState
    icon={ClipboardList}
    title="You're all caught up!"
    subtitle="No tasks assigned to you in the active sprint"
  />
)}
```

### Current Error State Pattern (to be replaced)
```typescript
// MyTasksTab.tsx lines 355-359 -- BEFORE
{isError && (
  <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
    {(error as Error)?.message ?? 'Failed to load tasks'}
  </div>
)}
```

### Target Error State Pattern (after -- no cached data)
```typescript
// MyTasksTab.tsx -- AFTER
import { ErrorState } from '@/components/ui/error-state';

{isError && !data && (
  <ErrorState error={error} onRetry={refetch} viewName="tasks" />
)}
```

### Target Stale Data + Error Pattern (after)
```typescript
// MyTasksTab.tsx -- AFTER
import { StaleDataBanner } from '@/components/ui/stale-data-banner';

const [bannerDismissed, setBannerDismissed] = useState(false);

// Reset dismissed state when error changes (new refetch attempt)
useEffect(() => { setBannerDismissed(false); }, [error]);

{isError && data && !bannerDismissed && (
  <StaleDataBanner onRetry={refetch} onDismiss={() => setBannerDismissed(true)} />
)}
// ...then render stale data normally below
```

### ApiError Retrofit Example
```typescript
// In service function -- BEFORE
if (!response.ok) {
  throw new Error(`Failed to fetch assigned MRs: status ${response.status}`);
}

// AFTER
if (!response.ok) {
  if (response.status === 401 || response.status === 403) {
    throw new ApiError(
      response.status === 401 ? 'Token expired or invalid' : 'Insufficient permissions',
      response.status,
      'gitlab'
    );
  }
  throw new ApiError(`Failed to fetch assigned MRs`, response.status, 'gitlab');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Plain `<div>` empty states | Shared EmptyState component with icon/title/subtitle/CTA | This phase | Consistency across 10 views |
| Raw error.message display | Sanitized view-specific error messages | This phase | User-friendly error communication |
| No retry buttons | ErrorState with Retry/Reconnect CTAs | This phase | Actionable error recovery |
| Silent background refetch failures | StaleDataBanner preserving stale data | This phase | Users know data may be outdated |

## Open Questions

1. **NotificationPopover error propagation**
   - What we know: NotificationPopover reads from Zustand store, not TanStack Query directly. Polling happens in useNotificationPolling hook.
   - What's unclear: Whether to thread error/refetch via props from the polling hook or add error state to the notifications store.
   - Recommendation: Add `fetchError` and `retryFetch` to the notifications store -- keeps NotificationPopover as a pure store consumer, consistent with its current pattern.

2. **ApiError retrofit scope**
   - What we know: ~20+ throw sites across jira.ts and gitlab.ts. Only 401/403 cases strictly need ApiError for auth detection.
   - What's unclear: Whether to retrofit ALL throw sites or just 401/403 ones.
   - Recommendation: Retrofit all `!response.ok` throw sites to use ApiError (preserves status for future use), but prioritize 401/403 cases. Keep `fetchSprintIssues` raw Response throw as-is but handle it in `isAuthError()`.

3. **Search results empty state location**
   - What we know: CommandPalette.tsx handles search results. The UI-SPEC maps SearchX icon to "No results found."
   - What's unclear: Whether this applies to the cmdk filtered results or only the live Jira search tail item.
   - Recommendation: Apply to the cmdk "no results" state (the built-in `[cmdk-empty]` element), which fires when typed filter matches nothing.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.x + @testing-library/react |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run --reporter=verbose` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| POLISH-01 | EmptyState component renders icon, title, subtitle, action | unit | `cd taskflow && npx vitest run src/components/ui/empty-state.test.tsx -x` | No -- Wave 0 |
| POLISH-01 | Each view renders EmptyState when data is empty | unit | `cd taskflow && npx vitest run src/routes/dashboard/MyTasksTab.test.tsx -x` | Yes (needs update) |
| POLISH-02 | ErrorState component renders view-specific message and Retry button | unit | `cd taskflow && npx vitest run src/components/ui/error-state.test.tsx -x` | No -- Wave 0 |
| POLISH-02 | StaleDataBanner renders when isError && data, dismiss works | unit | `cd taskflow && npx vitest run src/components/ui/stale-data-banner.test.tsx -x` | No -- Wave 0 |
| POLISH-02 | Each view renders ErrorState on fetch failure | unit | `cd taskflow && npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx -x` | Yes (needs update) |
| POLISH-03 | ErrorState detects auth error and shows Reconnect CTA | unit | `cd taskflow && npx vitest run src/components/ui/error-state.test.tsx -x` | No -- Wave 0 |
| POLISH-03 | isAuthError handles ApiError, Response, and plain Error | unit | `cd taskflow && npx vitest run src/lib/api-error.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/ui/empty-state.test.tsx` -- covers POLISH-01 (EmptyState renders correctly)
- [ ] `src/components/ui/error-state.test.tsx` -- covers POLISH-02, POLISH-03 (ErrorState + auth detection)
- [ ] `src/components/ui/stale-data-banner.test.tsx` -- covers POLISH-02 (StaleDataBanner)
- [ ] `src/lib/api-error.test.ts` -- covers POLISH-03 (ApiError class + isAuthError helper)

## Inventory of Views to Update

Complete list of files requiring empty/error state changes:

| # | File | Current Empty | Current Error | Has refetch | Notes |
|---|------|--------------|---------------|-------------|-------|
| 1 | `MyTasksTab.tsx` | Plain div | Plain div with raw error | Yes | Standard pattern |
| 2 | `SprintBoardTab.tsx` | Plain div | Plain div with raw error | Yes | Standard pattern |
| 3 | `SprintProgressTab.tsx` | (shares SprintBoard data) | Plain div with raw error | Yes | Standard pattern |
| 4 | `BacklogPage.tsx` | Styled empty (partial) | Skeleton only (no error state) | Need to check | May need refetch added |
| 5 | `MrAttentionTab.tsx` | Plain div | Plain div with raw error | Yes | Needs "Connect GitLab" CTA variant |
| 6 | `WorkloadTab.tsx` | Plain div | Plain div with raw error | Yes | Standard pattern |
| 7 | `ReleasesTab.tsx` | Plain div | Plain div with raw error | Yes | Standard pattern |
| 8 | `EpicsPage.tsx` | Plain `<p>` | **MISSING** (no isError) | **MISSING** | Must add isError/error/refetch |
| 9 | `NotificationPopover.tsx` | Plain div | **MISSING** (store-based) | **MISSING** | Needs store-level error propagation |
| 10 | `CommandPalette.tsx` (search) | cmdk built-in | N/A (client-side filter) | N/A | Only empty state needed |

## Sources

### Primary (HIGH confidence)
- Codebase inspection: all 10 view files, service error patterns, alert component, settings navigation
- `22-CONTEXT.md` -- locked decisions from user discussion
- `22-UI-SPEC.md` -- component specs, copywriting, interaction contracts
- `REQUIREMENTS.md` -- POLISH-01, POLISH-02, POLISH-03 definitions

### Secondary (MEDIUM confidence)
- TanStack Query stale data behavior (training knowledge, well-documented): when a cached query refetch fails, `data` retains stale value and `isError` becomes true simultaneously

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- patterns derived from existing codebase conventions and UI-SPEC
- Pitfalls: HIGH -- identified from direct codebase inspection of all error throw sites and view query patterns

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable domain, no external dependency changes expected)
