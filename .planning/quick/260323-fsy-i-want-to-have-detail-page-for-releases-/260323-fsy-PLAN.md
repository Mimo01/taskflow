---
phase: quick-260323-fsy
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/jira/versions.ts
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
  - taskflow/src/routes/dashboard/ReleasesTab.tsx
  - taskflow/src/routes/routes.tsx
  - taskflow/src/main.tsx
autonomous: true
requirements: [RELEASE-DETAIL]

must_haves:
  truths:
    - "Clicking a release row in ReleasesTab navigates to /release/:versionId detail page"
    - "Release detail page shows version name, release date, description, status, and issue counts"
    - "User can edit release name, date, description, and toggle released/unreleased status"
    - "After saving edits, the page reflects updated values and the releases list cache is invalidated"
    - "Breadcrumb navigation shows Releases as origin and supports back navigation"
  artifacts:
    - path: "taskflow/src/services/jira/versions.ts"
      provides: "updateFixVersion API function"
      exports: ["fetchFixVersions", "updateFixVersion"]
    - path: "taskflow/src/routes/dashboard/ReleaseDetailPage.tsx"
      provides: "Full release detail page with inline editing"
      min_lines: 150
    - path: "taskflow/src/routes/routes.tsx"
      provides: "Route entry for /release/:versionId"
      contains: "/release/:versionId"
  key_links:
    - from: "taskflow/src/routes/dashboard/ReleasesTab.tsx"
      to: "/release/:versionId"
      via: "navigate() on row click"
      pattern: "navigate.*release"
    - from: "taskflow/src/routes/dashboard/ReleaseDetailPage.tsx"
      to: "taskflow/src/services/jira/versions.ts"
      via: "useMutation calling updateFixVersion"
      pattern: "updateFixVersion"
    - from: "taskflow/src/routes/dashboard/ReleaseDetailPage.tsx"
      to: "jira-fix-versions query"
      via: "cache invalidation after edit"
      pattern: "invalidateQueries.*jira-fix-versions"
---

<objective>
Create a release detail page at `/release/:versionId` with inline editing capabilities for name, release date, description, and released/unreleased status.

Purpose: Allow users to view and edit release details directly within the app instead of switching to Jira.
Output: ReleaseDetailPage component, updateFixVersion service function, route wiring, and navigation from ReleasesTab.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260323-fsy-i-want-to-have-detail-page-for-releases-/260323-fsy-CONTEXT.md

<interfaces>
<!-- Key types and contracts the executor needs -->

From taskflow/src/services/jira/types.ts:
```typescript
export interface JiraFixVersion {
  id: string;
  name: string;
  releaseDate?: string; // "YYYY-MM-DD"
  released: boolean;
  description?: string;
}
```

From taskflow/src/services/jira/versions.ts:
```typescript
export async function fetchFixVersions(baseUrl: string, token: string, projectKey: string): Promise<JiraFixVersion[]>
```

From taskflow/src/stores/breadcrumb.store.ts:
```typescript
interface TrailEntry { path: string; label: string; }
interface BreadcrumbState {
  trail: TrailEntry[];
  push: (entry: TrailEntry) => void;
  pop: () => void;
  reset: () => void;
}
export const useBreadcrumbStore = create<BreadcrumbState>(...)
```

From taskflow/src/lib/apiFetch.ts:
```typescript
// apiFetch(source: 'jira' | 'gitlab', url: string, init: RequestInit, operation?: string): Promise<Response>
```

Jira REST API for version update:
- PUT /rest/api/2/version/{versionId}
- Body: { name?: string, releaseDate?: string, description?: string, released?: boolean }
- Returns 200 with updated version object

Existing detail page patterns (MergeRequestDetailPage, IssueDetailPage):
- Two-column layout: left content (flex-1), right sidebar (w-[42%] border-l)
- Breadcrumb header with ArrowLeft back button
- useBreadcrumbStore for trail navigation
- useNavigate + useParams from react-router-dom
- useQuery from @tanstack/react-query for data fetching
- readSecret('jira-pat') for token retrieval
- useAuthStore for jiraBaseUrl/activeJiraProject
- Skeleton component for loading states

Outlet context available in main.tsx:
```typescript
context={{ onIssueClick, onEpicClick, openEdit, openClone, openAddSubtask, openCreateStory }}
```

Breadcrumb reset in main.tsx only preserves trail for /issue/ and /mr/ routes.
Must update to also preserve for /release/ routes.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add updateFixVersion service + route wiring + navigation from ReleasesTab</name>
  <files>
    taskflow/src/services/jira/versions.ts,
    taskflow/src/routes/routes.tsx,
    taskflow/src/routes/dashboard/ReleasesTab.tsx,
    taskflow/src/main.tsx
  </files>
  <action>
1. In `taskflow/src/services/jira/versions.ts`, add an `updateFixVersion` function below `fetchFixVersions`:
   - Signature: `export async function updateFixVersion(baseUrl: string, token: string, versionId: string, fields: { name?: string; releaseDate?: string | null; description?: string; released?: boolean }): Promise<JiraFixVersion>`
   - PUT to `${base}/rest/api/2/version/${versionId}` using `apiFetch('jira', url, { method: 'PUT', headers: {...}, body: JSON.stringify(fields) }, 'Update Release')`
   - On non-ok response: throw ApiError for 401/403, generic Error otherwise (same pattern as `updateIssueField` in issues.ts)
   - On success: parse and return response JSON as `JiraFixVersion`
   - Import `ApiError` from `../../lib/api-error` (already used in versions.ts via the fetchFixVersions error path — wait, check: it uses `new Error` and `new ApiError` already, so the import is present)

2. In `taskflow/src/routes/routes.tsx`:
   - Add import: `import ReleaseDetailPage from './dashboard/ReleaseDetailPage';`
   - Add route: `{ path: '/release/:versionId', element: <ReleaseDetailPage /> }` after the `/releases` route

3. In `taskflow/src/routes/dashboard/ReleasesTab.tsx`:
   - Add `import { useNavigate } from 'react-router-dom';`
   - Add `import { useBreadcrumbStore } from '@/stores/breadcrumb.store';`
   - Inside `ReleasesTab()`, add: `const navigate = useNavigate();` and `const breadcrumbPush = useBreadcrumbStore((s) => s.push);` and `const breadcrumbReset = useBreadcrumbStore((s) => s.reset);`
   - Add a `handleReleaseClick` function that: (a) calls `breadcrumbReset()`, (b) calls `breadcrumbPush({ path: '/releases', label: 'Releases' })`, (c) navigates to `/release/${version.id}`
   - On the release row div (the one with `data-testid="release-row"`), add `onClick={() => handleReleaseClick(version.id)}` and `className` add `cursor-pointer` to existing classes
   - Add `role="button"` and `tabIndex={0}` for accessibility
   - Add `onKeyDown={(e) => { if (e.key === 'Enter') handleReleaseClick(version.id); }}` for keyboard nav

4. In `taskflow/src/main.tsx`:
   - Update the breadcrumb reset effect (line ~212-216) to also preserve trail for `/release/` routes:
     Change: `if (!location.pathname.startsWith('/issue/') && !location.pathname.startsWith('/mr/'))`
     To: `if (!location.pathname.startsWith('/issue/') && !location.pathname.startsWith('/mr/') && !location.pathname.startsWith('/release/'))`
   - Add `/release/` label to `routeLabel` function: `if (pathname.startsWith('/release/')) return 'Release';`
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>updateFixVersion exported from versions.ts, route registered, ReleasesTab rows are clickable and navigate to /release/:versionId, breadcrumb trail preserved for release routes</done>
</task>

<task type="auto">
  <name>Task 2: Build ReleaseDetailPage with inline editing</name>
  <files>taskflow/src/routes/dashboard/ReleaseDetailPage.tsx</files>
  <action>
Create `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` following MergeRequestDetailPage patterns:

**Structure:** Two-column layout matching existing detail pages.

**Imports:** useQuery/useMutation/useQueryClient from @tanstack/react-query, useNavigate/useParams from react-router-dom, ArrowLeft/Package/Calendar/FileText/Check/X/Pencil/ExternalLink/Loader2 from lucide-react, useState/useEffect/useMemo/useCallback from react, Badge from @/components/ui/badge, Button from @/components/ui/button, Skeleton from @/components/ui/skeleton, Input from @/components/ui/input, fetchFixVersions/updateFixVersion from @/services/jira/versions, readSecret from @/services/stronghold, useAuthStore from @/stores/auth.store, useBreadcrumbStore from @/stores/breadcrumb.store, openUrl from @tauri-apps/plugin-opener.

**Data fetching:**
- Use `useQuery` with key `['jira-fix-versions', activeJiraProject]` (same key as ReleasesTab so cache is shared) to get all versions, then find the matching one by `versionId` param using `useMemo`.
- Also reuse the `fetchVersionIssueCounts` logic from ReleasesTab (inline in this file or extract — inline is fine for now): query with key `['jira-version-counts', versionId]` to get issue counts.

**Left column — main content area:**
- Version name as h2 heading (same styling as MR detail: `text-xl font-semibold leading-snug`)
- Status badge: "Released" (green) or "Unreleased" (amber) — reuse same badge patterns from ReleasesTab
- Description section with `<h3>` heading, showing description text or "No description" italic placeholder
- Issue counts section: "X / Y issues done" with a simple progress indicator
- "Open in Jira" button at bottom right (link to `${jiraBaseUrl}/projects/${activeJiraProject}/versions/${versionId}`) using openUrl

**Right sidebar (w-[42%] border-l):**
- MetaRow component (same pattern as MergeRequestDetailPage): label-value pairs
- Rows: Status (Released/Unreleased badge), Release Date (formatted or "Not set"), Description (truncated preview)
- Edit button at the top of the sidebar: small "Edit" button with Pencil icon

**Edit mode (triggered by Edit button):**
- Replace sidebar content with an edit form:
  - Name: `<Input>` prefilled with current name, required
  - Release Date: `<input type="date">` styled with project Input classes, prefilled with current releaseDate or empty
  - Description: `<textarea>` (use Textarea from @/components/ui/textarea) prefilled with current description
  - Status: Toggle button or checkbox — "Mark as Released" / "Mark as Unreleased"
  - Save and Cancel buttons at the bottom
- Use `useMutation` calling `updateFixVersion` with the edited fields
- On success: invalidate `['jira-fix-versions', activeJiraProject]` and `['jira-version-counts', versionId]` query caches, exit edit mode
- On error: show inline error message
- Save button shows "Saving..." with Loader2 spinner when mutation is pending

**Breadcrumb header:**
- Same pattern as MergeRequestDetailPage: ArrowLeft button, trail entries, current page label showing version name
- `handleBack`: if trail.length > 0, pop and navigate to last trail entry; else navigate to '/releases'

**Loading state:**
- Skeleton matching MR detail skeleton layout

**MetaRow helper:** Inline same as MergeRequestDetailPage pattern.

Do NOT import from ReleasesTab — keep ReleaseDetailPage self-contained. Duplicate the MetaRow and any small helpers rather than creating shared modules.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>ReleaseDetailPage renders version detail in two-column layout, edit mode allows changing name/date/description/status, saves via Jira API, invalidates caches, breadcrumb navigation works</done>
</task>

</tasks>

<verification>
1. `cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit` — no type errors
2. `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run --reporter=verbose 2>&1 | tail -20` — existing tests pass
3. Visual: navigate to Releases tab, click a release row, confirm detail page loads with version data and edit works
</verification>

<success_criteria>
- /release/:versionId route renders ReleaseDetailPage
- Release rows in ReleasesTab are clickable and navigate to detail page
- Detail page shows version name, date, description, status, issue counts
- Edit mode allows modifying name, date, description, released status
- Save calls PUT /rest/api/2/version/{id} and invalidates React Query cache
- Breadcrumb shows "Releases" as origin with back navigation
- TypeScript compiles with no errors
</success_criteria>

<output>
After completion, create `.planning/quick/260323-fsy-i-want-to-have-detail-page-for-releases-/260323-fsy-SUMMARY.md`
</output>
