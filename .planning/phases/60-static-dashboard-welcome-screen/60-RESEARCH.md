# Phase 60: Static Dashboard / Welcome Screen — Research

**Researched:** 2026-05-21
**Domain:** React/TypeScript component authoring — TanStack Query, shadcn/ui, Tailwind v4, Jira REST API integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Hero section at top, full width, greeting centered. 3-column card grid below on desktop.
**D-02:** Hero uses subtle gradient background (`bg-gradient-to-br from-primary/5 to-background` light, `from-primary/10` dark). No illustrations on the hero itself.
**D-03:** Greeting is always "Welcome back, [displayName]" — no time-of-day variant. Source: `jiraUserDisplayName` from `useAuthStore`.
**D-04:** Each card has a colored icon accent in the header. Cards use `rounded-lg border border-border bg-card` style.
**D-05:** New `DashboardSprintCard` component — do NOT adapt `SprintHealthPanel` in place.
**D-06:** Card shows: sprint name, days remaining, and % complete progress bar. Claude has discretion on story point counts alongside the bar.
**D-07:** No active sprint: card shows "No active sprint" (card remains visible).
**D-08:** "In progress" filter: `issuetype.subtask === true && fields.assignee.name === jiraUsername && fields.status.statusCategory.key === 'indeterminate'`. Only sprint subtasks.
**D-09:** Data source: `fetchSprintIssues` with 4-element cache key `['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey]`. Filter client-side — zero extra API calls when cache warm.
**D-10:** Subtask click navigates to `/issue/:key` (full-page route, not slide-over).
**D-11:** Empty state: "No subtasks in progress — nice work!"
**D-12:** Show up to 3 subtasks. If more: show "and N more" (plain text, no link).
**D-13:** Jira fix versions only — no GitLab token. Reuse `fetchFixVersions`. "Soonest unreleased" = `released === false && releaseDate` set, sorted ascending.
**D-14:** No unreleased version with `releaseDate`: "No upcoming releases".
**D-15:** Today: "Today" + `Badge tone="blue"`. Overdue: "X days overdue" in amber/red. Future: "X days away".
**D-16:** Thin `index.tsx` loads Jira PAT via `readSecret('jira-pat')` in `useEffect`. Reads store values. Passes all as props to card sub-components. No card reads Stronghold directly.

### Claude's Discretion

- Inline SVG decorative elements / card icon choices (within lucide-react)
- Whether to show story point counts alongside the progress bar (add only if clean)
- Responsive breakpoints for the 3-card row (collapse to single column on narrow viewports)

Resolved in UI-SPEC: >= 1024px: 3-col; 640–1023px: 2-col; < 640px: 1-col.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | Dashboard presents as a welcome/home screen with a personalized greeting (user's name) and today's date as the entry point | Hero section pattern; `jiraUserDisplayName` from `useAuthStore`; date format `toLocaleDateString('en-GB', ...)` |
| DASH-02 | Sprint health card shows the current sprint name, days remaining, and a % complete progress bar | `fetchActiveSprint` + `fetchSprintIssues` queries; shadcn `Progress` component (needs install); `getDaysRemaining` pattern from `SprintHealthPanel`; story-point % computation pattern |
| DASH-03 | My In Progress card shows up to 3 of the current user's active subtasks (status = In Progress) with links to open them | Cache-shared `fetchSprintIssues` query; client-side subtask filter; `useNavigate` for click-through; `useDelayedLoading` for skeleton |
| DASH-04 | Next release countdown card shows the soonest unreleased fix version's name and the number of days until it | `fetchFixVersions` with `['jira-fix-versions', activeJiraProject]` cache key; `getReleaseTimingLabel` pattern from `ReleasesTab`; `Badge` component with `tone` prop |
| DASH-05 | Dashboard is a static layout — no configuration, no drag/resize, no widget picker; pure information with visual warmth | No grid-layout library, no widget state, hero + 3 fixed cards; confirms Phase 59 removal of `react-grid-layout` |
</phase_requirements>

---

## Summary

Phase 60 replaces the empty stub `taskflow/src/routes/dashboard/index.tsx` with a static welcome screen. All data and patterns already exist in the codebase — this phase is primarily composition work, not new API integration. Three new card components (`DashboardSprintCard`, `DashboardInProgressCard`, `DashboardReleaseCard`) are created alongside the updated `index.tsx`. The `index.tsx` owns the PAT loading via `readSecret` and passes token + store values as props to all three cards.

**Key integration fact:** The sprint board cache key `['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey]` must be copied exactly. When the user navigates to SprintBoardTab first, the dashboard My In Progress card gets its data instantly from the warm cache with zero API calls.

**Critical typing note:** `JiraIssue.fields.assignee` is typed as `{ displayName: string; avatarUrls: ... } | null` — no `.name` field in the TypeScript interface. The Jira API does return `name` in the raw response and it is accessible via the `[key: string]: unknown` index signature. D-08's `assignee.name === jiraUsername` filter must cast: `(issue.fields.assignee as { name?: string } | null)?.name === jiraUsername`. Alternatively (safer), compare `issue.fields.assignee?.displayName === jiraUserDisplayName` using `jiraUserDisplayName` from the store — this is how `InlineComment.tsx` and `ActivityTimeline.tsx` already identify the current user's items. Both approaches are valid; the `displayName` comparison avoids the cast.

**Primary recommendation:** Implement in 3 tasks: (1) install shadcn Progress + create card component files, (2) implement `DashboardSprintCard` + `DashboardInProgressCard` + `DashboardReleaseCard`, (3) wire `index.tsx` hero + grid layout.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Token loading (`readSecret`) | Frontend (index.tsx) | — | PAT must stay in the component layer; no card reads Stronghold directly (D-16) |
| Store reads (displayName, username, baseUrl, project) | Frontend (index.tsx) | — | Thin orchestrator passes all as props |
| Sprint data fetching | Frontend (DashboardSprintCard) | TanStack Query cache | Shares cache with SprintBoardTab/SprintProgressTab |
| In-progress subtask filtering | Frontend (DashboardInProgressCard) | — | Client-side filter on already-fetched sprint board cache |
| Fix version fetching | Frontend (DashboardReleaseCard) | TanStack Query cache | Shares cache key with ReleasesTab |
| Date arithmetic (days remaining / overdue) | Frontend (each card) | — | Pure client computation, no server involvement |
| Routing (subtask click-through) | Frontend (DashboardInProgressCard) | React Router DOM | `useNavigate('/issue/:key')` |

---

## Standard Stack

No new packages required beyond one shadcn component install.

### Core (already in codebase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | existing | Data fetching + cache sharing | Established in project; `useQuery` with matching cache keys |
| `react-router-dom` | existing | `useNavigate` for subtask click-through | Project-wide routing primitive |
| `lucide-react` | existing | Card header icon accents | Project icon library per `components.json` |
| `@/components/ui/badge` | existing | Release timing badges (tone="blue"/"red") | `ChipTone` palette matches existing conventions |
| `@/components/ui/skeleton` | existing | Per-card loading skeletons | Existing pattern via `useDelayedLoading` |
| `@/hooks/useDelayedLoading` | existing | 200ms threshold before showing skeleton | Prevents flash on cache hits |

### Needs Install
| Library | Source | Purpose | Install Command |
|---------|--------|---------|-----------------|
| `@/components/ui/progress` | shadcn `base-nova` | Sprint % complete progress bar | `npx shadcn@latest add progress` (run from `taskflow/` directory) |

### Services (already in jira.ts)
| Function | Signature | Cache Key | staleTime |
|----------|-----------|-----------|-----------|
| `fetchActiveSprint` | `(baseUrl, token, projectKey) => JiraActiveSprint \| null` | `['jira-active-sprint', activeJiraProject]` | `5 * 60_000` |
| `fetchSprintIssues` | `(baseUrl, token, projectKey, false, storyPointsFieldKey) => JiraIssue[]` | `['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey]` | `30_000` |
| `fetchFixVersions` | `(baseUrl, token, projectKey) => JiraFixVersion[]` | `['jira-fix-versions', activeJiraProject]` | `5 * 60_000` |

**Version verification:** All packages are from the existing project `package.json` — no new npm installs for the runtime stack. The `progress` shadcn component is installed from the project's configured shadcn registry (official `ui.shadcn.com`).

---

## Package Legitimacy Audit

> Only one new package install is required — adding the shadcn `progress` component via the project's existing `shadcn` tooling (not a new npm package).

| Package | Registry | Source | slopcheck | Disposition |
|---------|----------|--------|-----------|-------------|
| `shadcn progress` component | shadcn official (`ui.shadcn.com`) | `components.json` `"$schema"` points to shadcn | N/A — not an npm package | Approved — installed via project's existing `npx shadcn@latest add progress` flow |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
[User navigates to /dashboard]
        |
        v
[index.tsx — orchestrator]
  - readSecret('jira-pat') → jiraToken (useEffect, keyed on jiraBaseUrl)
  - useAuthStore → {jiraBaseUrl, activeJiraProject, jiraUsername, jiraUserDisplayName}
  - useSettingsStore → {storyPointsFieldKey}
        |
        |──── props ────────────────────────────────────────┐
        |                                                    |
        v                                                    v
[Hero Section]                              [3-column card grid]
  "Welcome back, [displayName]"                    |
  Today's date (en-GB long format)                 |
                               ┌─────────────────┬─┴──────────────────┐
                               v                 v                    v
                    [DashboardSprintCard]  [DashboardInProgressCard] [DashboardReleaseCard]
                               |                 |                    |
                               v                 v                    v
                    useQuery(              useQuery(            useQuery(
                     'jira-active-sprint'  'jira-issues'        'jira-fix-versions'
                    )                      'sprint-board'       activeJiraProject
                    useQuery(              activeJiraProject    )
                     'jira-issues'         storyPointsFieldKey
                     'sprint-board'       ) — same cache key!
                     ...                  filter client-side:
                    )                      subtask + assignee + indeterminate
                               |                 |                    |
                               v                 v                    v
                    [shadcn Progress]  [up to 3 clickable rows] [countdown badge]
                    sprint name          → navigate('/issue/:key')  overdue/today/future
                    days remaining       overflow: "and N more"
```

### Recommended Project Structure

```
taskflow/src/routes/dashboard/
├── index.tsx                        # OVERWRITTEN — orchestrator (PAT load + hero + grid)
├── DashboardSprintCard.tsx          # NEW — sprint health card
├── DashboardSprintCard.test.tsx     # NEW — unit tests
├── DashboardInProgressCard.tsx      # NEW — my in-progress subtasks card
├── DashboardInProgressCard.test.tsx # NEW — unit tests
├── DashboardReleaseCard.tsx         # NEW — next release countdown card
├── DashboardReleaseCard.test.tsx    # NEW — unit tests
├── SprintHealthPanel.tsx            # UNCHANGED — do not touch
└── ... (all other existing files)  # UNCHANGED
```

### Pattern 1: Thin index.tsx Orchestrator (D-16)

**What:** `index.tsx` owns token loading and store reads. Cards receive everything as props. No card ever calls `readSecret` or `useAuthStore` directly.
**When to use:** Whenever a route has multiple data-consuming children that share the same auth context.

```typescript
// Source: MyTasksTab.tsx and ReleasesTab.tsx (established pattern)
export default function Dashboard() {
  const { jiraBaseUrl, activeJiraProject, jiraUsername, jiraUserDisplayName } = useAuthStore();
  const { storyPointsFieldKey } = useSettingsStore();
  const [jiraToken, setJiraToken] = useState<string | null>(null);

  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then((t) => setJiraToken(t))
        .catch(() => setJiraToken(null));
    }
  }, [jiraBaseUrl]);

  return (
    <div>
      {/* Hero */}
      {/* Cards */}
      <DashboardSprintCard
        jiraBaseUrl={jiraBaseUrl ?? ''}
        jiraToken={jiraToken ?? ''}
        activeJiraProject={activeJiraProject ?? ''}
        storyPointsFieldKey={storyPointsFieldKey}
      />
      ...
    </div>
  );
}
```

### Pattern 2: Cache Key Sharing

**What:** Use the exact same `queryKey` array as the existing tab that fetches the same data, so the TanStack Query cache is shared. No duplicate API calls.
**When to use:** When a dashboard card summarises data that a full tab also shows.

```typescript
// Source: SprintHealthPanel.tsx (verified in codebase)
// Sprint board issues — MUST match exactly:
queryKey: ['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey]

// Active sprint — MUST match exactly:
queryKey: ['jira-active-sprint', activeJiraProject]

// Fix versions — MUST match exactly (verified in ReleasesTab.tsx):
queryKey: ['jira-fix-versions', activeJiraProject]
```

### Pattern 3: Days-Remaining Computation

**What:** Safe integer ceiling of milliseconds difference; clamps to 0 when sprint is overdue.
**When to use:** Sprint card and release countdown card.

```typescript
// Source: SprintHealthPanel.tsx getDaysRemaining function (verified in codebase)
function getDaysRemaining(endDateIso: string | undefined): number | null {
  if (!endDateIso) return null;
  const ms = new Date(endDateIso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
```

### Pattern 4: Release Timing Label

**What:** String-comparison YYYY-MM-DD approach for overdue/today/future — timezone-safe.
**When to use:** DashboardReleaseCard countdown display.

```typescript
// Source: ReleasesTab.tsx getReleaseTimingLabel function (verified in codebase)
type TimingLabel = 'overdue' | 'due-today' | { daysUntil: number } | null;

function getReleaseTimingLabel(releaseDate: string | undefined, released: boolean): TimingLabel {
  if (released || !releaseDate) return null;
  const today = new Date().toISOString().slice(0, 10); // timezone-safe "YYYY-MM-DD"
  if (releaseDate < today) return 'overdue';
  if (releaseDate === today) return 'due-today';
  const msPerDay = 86_400_000;
  const days = Math.round((new Date(releaseDate).getTime() - new Date(today).getTime()) / msPerDay);
  return { daysUntil: days };
}
```

### Pattern 5: useDelayedLoading + Skeleton

**What:** Show skeleton only after 200ms of loading. On cache hit, skeleton never shows.
**When to use:** All three cards.

```typescript
// Source: ReleasesTab.tsx and MyTasksTab.tsx (verified in codebase)
const isLoading = issuesLoading || sprintLoading;
const showSkeleton = useDelayedLoading(isLoading);

{showSkeleton && (
  <div className="flex flex-col gap-2">
    {[0, 1, 2].map((i) => (
      <div key={i} className="h-4 rounded bg-muted animate-pulse" />
    ))}
  </div>
)}
```

### Pattern 6: Assignee Name Matching for D-08

**What:** Two valid approaches for filtering sprint board subtasks by current user.

**Option A — cast to access `.name` from raw API response (matches D-08 literal):**
```typescript
// The [key: string]: unknown index on JiraIssue.fields means name is present at runtime
const assigneeName = (issue.fields.assignee as { name?: string } | null)?.name;
const isMySubtask = assigneeName === jiraUsername;
```

**Option B — use displayName comparison (avoids cast, matches existing codebase conventions):**
```typescript
// Pattern used in InlineComment.tsx line 195 and ActivityTimeline.tsx line 180
const isMySubtask = issue.fields.assignee?.displayName === jiraUserDisplayName;
```

**Recommendation:** Option B (`displayName === jiraUserDisplayName`) is the safer choice — it uses the typed interface without casting, matches established project conventions, and `jiraUserDisplayName` is always set when `jiraUsername` is set (both come from the same `GET /rest/api/2/myself` validation). The planner should make this choice explicit in task actions.

### Anti-Patterns to Avoid

- **Calling `readSecret` inside a card component:** Violates D-16. Index.tsx is the sole PAT loader.
- **Using a different cache key for sprint issues:** `['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey]` must be exact. Typo = separate network request + cache miss.
- **Adapting `SprintHealthPanel` in place:** Explicitly forbidden by D-05. That component has its own tests and may be used elsewhere.
- **Showing a progress bar for `donePct` when `totalPoints === 0`:** Division-by-zero pitfall — guard with `totalPoints > 0 ? Math.round(done/total * 100) : 0` (as SprintHealthPanel does).
- **Using `toLocaleDateString()` for release date comparison:** Not timezone-safe. Always use `.toISOString().slice(0, 10)` for YYYY-MM-DD comparison (as ReleasesTab does).
- **Showing > 3 subtasks in the My In Progress card:** D-12 caps display at 3. Only show "and N more" text for overflow — no navigation link.
- **Installing the Progress component into the wrong directory:** Must run `npx shadcn@latest add progress` from `taskflow/` (not the monorepo root) so `components.json` is found.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Progress bar (%) | `<div>` with inline width style | shadcn `Progress` component | Accessible, animated, consistent with design system |
| Delayed skeleton | Custom timer + state | `useDelayedLoading` hook | Already in codebase; prevents flash on cache hit |
| Assignee "me" filtering | Custom fetch with JQL assignee filter | Client-side filter on cached `fetchSprintIssues` data | Zero extra API calls; reuses warm cache |
| Release timing arithmetic | Ad-hoc date math | `getReleaseTimingLabel` pattern (copy from ReleasesTab) | Handles timezone-safe string compare; prevents off-by-one errors |
| Badge colors | Inline Tailwind classes | `<Badge tone="blue|red|amber">` with existing `ChipTone` | Consistent with app-wide `CHIP_TONE_CLASS` palette |

**Key insight:** This phase is almost entirely composition. The Jira services, query hooks, skeleton utilities, badge components, and date math patterns are all already in the codebase. The primary work is writing the three card components and the updated index.tsx that wires them together.

---

## Common Pitfalls

### Pitfall 1: Cache Key Mismatch
**What goes wrong:** Dashboard card fires a new Jira API request even when SprintBoardTab has already loaded the data.
**Why it happens:** The cache key must be an exact array match. If even one element differs (e.g., `'sprint'` vs `'sprint-board'`), TanStack Query treats it as a separate query.
**How to avoid:** Copy the key verbatim from `SprintHealthPanel.tsx`: `['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey]`.
**Warning signs:** Network tab shows a new Jira request on dashboard load immediately after viewing SprintBoardTab.

### Pitfall 2: Progress Component Not Yet Installed
**What goes wrong:** `import { Progress } from '@/components/ui/progress'` fails at compile time.
**Why it happens:** `progress.tsx` is absent from `taskflow/src/components/ui/` — confirmed by directory scan.
**How to avoid:** First task must run `npx shadcn@latest add progress` from the `taskflow/` directory before any component imports it.
**Warning signs:** Build error `Module not found: @/components/ui/progress`.

### Pitfall 3: assignee.name Type Cast
**What goes wrong:** TypeScript error accessing `.name` on `JiraIssue.fields.assignee` — the typed interface only has `displayName` and `avatarUrls`.
**Why it happens:** `JiraIssue` was typed with only the fields the existing sprint board UI needed. The raw Jira API does return `name`, accessible via `[key: string]: unknown`.
**How to avoid:** Use `displayName === jiraUserDisplayName` comparison (no cast needed) OR cast to `{ name?: string }`. Document the approach in the task.
**Warning signs:** TypeScript error `Property 'name' does not exist on type '{ displayName: string; avatarUrls: ... }'`.

### Pitfall 4: shadcn add from Wrong Directory
**What goes wrong:** `npx shadcn@latest add progress` creates the file in the wrong location or can't find `components.json`.
**Why it happens:** Running from the monorepo root instead of `taskflow/`.
**How to avoid:** Run from `taskflow/` directory: `cd taskflow && npx shadcn@latest add progress`.
**Warning signs:** No `progress.tsx` appearing in `taskflow/src/components/ui/` after the command.

### Pitfall 5: Hero Gradient Tailwind v4 Syntax
**What goes wrong:** Gradient classes like `from-primary/5` may need Tailwind v4 CSS-variable syntax if `primary` is a CSS variable.
**Why it happens:** Tailwind v4 uses `oklch` variables; opacity modifiers (`/5`) work on CSS variables with `color-mix()` internally.
**How to avoid:** Verify gradient renders in dev mode. If `/5` opacity doesn't work with `var(--primary)`, use `bg-gradient-to-br` with explicit `from-[color-mix(in_oklch,var(--primary)_5%,transparent)]` fallback.
**Warning signs:** Hero background appears solid (not tinted) or shows a color error in browser devtools.

### Pitfall 6: Release Sort Order
**What goes wrong:** "Soonest unreleased" shows the wrong version.
**Why it happens:** ReleasesTab sorts unreleased versions by `releaseDate` descending (newest first for the list). The dashboard needs ascending sort (earliest date first = soonest).
**How to avoid:** Sort ascending: `versions.sort((a, b) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''))` before picking `[0]`.
**Warning signs:** Dashboard shows a release months away while a nearer release exists.

---

## Code Examples

### Hero Section
```tsx
// Derived from UI-SPEC and CONTEXT.md decisions
const today = new Date().toLocaleDateString('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}); // → "Thursday, 21 May 2026"

<section className="bg-gradient-to-br from-primary/5 to-background dark:from-primary/10 dark:to-background px-6 py-10">
  <h1 className="text-3xl font-semibold tracking-tight">
    Welcome back, {jiraUserDisplayName ?? 'there'}
  </h1>
  <p className="text-sm text-muted-foreground mt-1">{today}</p>
</section>
```

### Card Grid (responsive)
```tsx
// Source: UI-SPEC responsive breakpoints
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
  <DashboardSprintCard ... />
  <DashboardInProgressCard ... />
  <DashboardReleaseCard ... />
</div>
```

### Card Shell
```tsx
// Source: SprintHealthPanel.tsx card class + UI-SPEC card anatomy
<div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 min-h-[160px]">
  {/* Header */}
  <div className="flex items-center gap-2">
    <Zap className="size-4 text-amber-500" aria-hidden />
    <span className="text-xs text-muted-foreground uppercase tracking-wide">Sprint Health</span>
  </div>
  {/* Body */}
  ...
</div>
```

### My In Progress Filter (D-08)
```tsx
// Option B — displayName comparison, no type cast needed
const myInProgressSubtasks = sprintIssues.filter(
  (issue) =>
    issue.fields.issuetype.subtask &&
    issue.fields.status.statusCategory?.key === 'indeterminate' &&
    issue.fields.assignee?.displayName === jiraUserDisplayName,
);
const displayed = myInProgressSubtasks.slice(0, 3);
const overflow = myInProgressSubtasks.length - displayed.length;
```

### Subtask Row
```tsx
// Source: D-10, D-12, UI-SPEC interaction contract
<button
  type="button"
  key={issue.key}
  className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
  onClick={() => navigate(`/issue/${issue.key}`)}
  onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/issue/${issue.key}`); }}
>
  <span className="text-xs text-muted-foreground font-mono shrink-0">{issue.key}</span>
  <span className="text-sm truncate">{issue.fields.summary}</span>
</button>
{overflow > 0 && (
  <p className="text-xs text-muted-foreground px-2">and {overflow} more</p>
)}
```

### Release Countdown Rendering
```tsx
// Source: ReleasesTab.tsx timing pattern + D-15 copy
const timing = getReleaseTimingLabel(soonest.releaseDate, soonest.released);

{timing === 'due-today' && (
  <Badge tone="blue">Today</Badge>
)}
{timing === 'overdue' && (
  <span className="text-amber-600 dark:text-amber-400 text-sm">
    {Math.abs(daysFromToday)} days overdue
  </span>
)}
{timing && typeof timing === 'object' && 'daysUntil' in timing && (
  <span className="text-sm text-muted-foreground">{timing.daysUntil} days away</span>
)}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Widget-based customizable dashboard (`react-grid-layout`) | Static welcome screen (Phase 59 removal + Phase 60 replacement) | No drag/resize complexity; removed in Phase 59 |
| Progress bar as hand-rolled `<div>` (seen in `UpdateDialog`) | shadcn `Progress` component (to be installed in this phase) | Accessible, consistent |
| "Good morning/evening" greeting variants | Single "Welcome back, [name]" — no time-of-day split | Simpler, no edge cases (time zones, locale) |

**Deprecated:**
- `WidgetGrid`, `WidgetCard`, `WidgetPicker`: removed by Phase 59 before this phase begins.
- `dashboardLayout` in `settings.store.ts`: version 19 migration drops it implicitly.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `displayName === jiraUserDisplayName` is the safer assignee-match approach for D-08 | Code Examples / Pitfall 3 | If `jiraUserDisplayName` is somehow null when `jiraUsername` is not, filter returns 0 results — mitigation: also check `!!jiraUserDisplayName` before comparing, fall back to showing empty state |
| A2 | `npx shadcn@latest add progress` from `taskflow/` installs to `src/components/ui/progress.tsx` using `base-nova` style as configured in `components.json` | Package Legitimacy Audit | If shadcn CLI version incompatibility exists, may require `npx shadcn@2.x.x` pinned version |

**If this table is empty:** N/A — table contains 2 items.

---

## Open Questions

1. **Story points alongside progress bar (D-06 Claude's Discretion)**
   - What we know: D-06 says "Claude has discretion on whether to include story point counts alongside the bar if it reads naturally without clutter"
   - What's unclear: The executor should assess visual cleanliness at implementation time
   - Recommendation: Include points only if both `donePoints` and `totalPoints` are non-zero; render as `"18 / 42 pts"` in `text-xs text-muted-foreground` inline with the bar

2. **Phase 59 completion verified**
   - What we know: STATE.md says Phase 59 is complete. `react-grid-layout` package removal and widget system deletion should be done.
   - What's unclear: The `git status` shows `settings.store.ts` has uncommitted changes — executor should verify Phase 59 is fully merged before starting Phase 60
   - Recommendation: Executor checks `npm ls react-grid-layout` returns "empty" before starting

---

## Environment Availability

| Dependency | Required By | Available | Fallback |
|------------|------------|-----------|----------|
| `npx shadcn@latest` | Progress component install | Assumed (Node.js + npm present) | None — required for this install |
| `vitest` | Test suite | Yes — `vitest.config.ts` confirmed | — |
| `@testing-library/react` | Component tests | Yes — confirmed in existing test files | — |

**Missing dependencies with no fallback:** None confirmed blocking.

---

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + Testing Library React |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run --reporter=verbose src/routes/dashboard/DashboardSprintCard.test.tsx src/routes/dashboard/DashboardInProgressCard.test.tsx src/routes/dashboard/DashboardReleaseCard.test.tsx` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | Hero renders greeting with displayName and today's date | unit | `cd taskflow && npx vitest run src/routes/dashboard/DashboardSprintCard.test.tsx` (or index test) | No — Wave 0 |
| DASH-02 | Sprint card shows sprint name, days remaining, % progress bar; "No active sprint" empty state | unit | `cd taskflow && npx vitest run src/routes/dashboard/DashboardSprintCard.test.tsx` | No — Wave 0 |
| DASH-03 | In-progress card shows up to 3 subtasks filtered by assignee + indeterminate; overflow "and N more"; empty state | unit | `cd taskflow && npx vitest run src/routes/dashboard/DashboardInProgressCard.test.tsx` | No — Wave 0 |
| DASH-04 | Release card shows soonest unreleased version + correct timing label (overdue/today/future); empty state | unit | `cd taskflow && npx vitest run src/routes/dashboard/DashboardReleaseCard.test.tsx` | No — Wave 0 |
| DASH-05 | No drag handles, no widget picker, no configuration panel in the rendered output | unit (negative assertion) | included in smoke test of index.tsx | No — Wave 0 |

### Sampling Rate
- **Per task commit:** Run the specific new test file added in that task
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `taskflow/src/routes/dashboard/DashboardSprintCard.test.tsx` — covers DASH-02
- [ ] `taskflow/src/routes/dashboard/DashboardInProgressCard.test.tsx` — covers DASH-03
- [ ] `taskflow/src/routes/dashboard/DashboardReleaseCard.test.tsx` — covers DASH-04
- [ ] `taskflow/src/routes/dashboard/index.test.tsx` (optional) — covers DASH-01, DASH-05 if warranted

---

## Security Domain

> `security_enforcement` absent from config — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Dashboard is a read-only view; auth already established at app startup |
| V3 Session Management | No | No new session state introduced |
| V4 Access Control | No | No new permissions or routes requiring access checks |
| V5 Input Validation | No | No user input in this phase — all data is read from Jira API and displayed |
| V6 Cryptography | No | PAT is read from Stronghold (existing `readSecret` — no new crypto) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PAT token exposure in component state | Information Disclosure | Token held in `useState` (local, not persisted); cards receive it as prop and pass to service calls only — no render output |
| XSS via Jira display names / sprint names / version names | Tampering | React JSX escapes all string values automatically; no `dangerouslySetInnerHTML` used |

---

## Sources

### Primary (HIGH confidence)
- `taskflow/src/routes/dashboard/SprintHealthPanel.tsx` — cache key, `getDaysRemaining`, query patterns, card CSS classes; verified by direct read
- `taskflow/src/routes/dashboard/ReleasesTab.tsx` — `getReleaseTimingLabel`, `fetchFixVersions` usage, Badge tone conventions; verified by direct read
- `taskflow/src/routes/dashboard/MyTasksTab.tsx` — `readSecret` pattern in `useEffect`, token-as-prop pattern; verified by direct read
- `taskflow/src/services/jira.ts` — `JiraIssue`, `JiraFixVersion`, `JiraActiveSprint` interfaces; `fetchSprintIssues`, `fetchActiveSprint`, `fetchFixVersions` signatures; verified by direct read
- `taskflow/src/stores/auth.store.ts` — store field names and types; verified by direct read
- `taskflow/src/stores/settings.store.ts` — `storyPointsFieldKey` field; verified by direct read
- `taskflow/src/hooks/useDelayedLoading.ts` — hook signature and 200ms default; verified by direct read
- `taskflow/src/components/ui/badge.tsx` — `tone` prop and `ChipTone` type; verified by direct read
- `taskflow/src/lib/statusStyles.ts` — `ChipTone` values: `'blue' | 'green' | 'red' | 'orange' | 'amber' | 'purple' | 'muted'`; verified by direct read
- `taskflow/components.json` — shadcn `base-nova` style, `"registries": {}`; verified by direct read
- `.planning/phases/60-static-dashboard-welcome-screen/60-CONTEXT.md` — all locked decisions; verified by direct read
- `.planning/phases/60-static-dashboard-welcome-screen/60-UI-SPEC.md` — typography, spacing, color, responsive breakpoints; verified by direct read
- `.planning/config.json` — `nyquist_validation: true`; verified by direct read

### Secondary (MEDIUM confidence)
- `taskflow/src/routes/dashboard/SprintHealthPanel.test.tsx` — test mock patterns for `useQuery`, store mocks, fixture builders; verified by direct read

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all from verified codebase reads
- Architecture: HIGH — composition of proven existing patterns
- Pitfalls: HIGH — discovered from actual interface mismatch (assignee.name), missing file (progress.tsx), and code review of existing implementations

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (stable stack — shadcn, Vitest, TanStack Query are not fast-moving in this project)
