# Phase 55: AIO Project Selection in Settings — Research

**Researched:** 2026-05-14
**Domain:** Zustand persist store migration, Settings React component extension, Sidebar dynamic routing, React Query cache lifecycle
**Confidence:** HIGH (all findings verified against live codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Picker lives inside `IntegrationsSection.tsx`, no new Settings sidebar entry
- **D-02:** Picker hidden when `aioEnabled === false`; toggle always visible
- **D-03:** Use shadcn `<Select>` primitive, mirror `GitLabStep.tsx:107-136`; no search; stored: `projectKey`; displayed: `name`
- **D-04:** `fetchAioProjects(jiraBaseUrl, token)` with cache key `['aio', jiraBaseUrl, 'projects']`; credentials via `readSecret('jira-pat')` + `useAuthStore.jiraBaseUrl`
- **D-05:** Loading → inline spinner/Skeleton; Error → inline message + Retry (`ConnectionsSection.tsx` pattern); Empty → disabled Select with placeholder
- **D-06:** `selectedAioProjectKey: string | null` in `SettingsState`; default `null`; setter `setSelectedAioProjectKey`; adjacent to `aioEnabled`
- **D-07:** Bump persist v16 → v17; migration guard: `if (version < 17) { if (s.selectedAioProjectKey === undefined) s.selectedAioProjectKey = null; }`
- **D-08:** Toggling `aioEnabled` to `false` does NOT clear `selectedAioProjectKey`
- **D-09:** Sidebar 'AIO Projects' hidden when `aioEnabled === false` OR `selectedAioProjectKey === null`
- **D-10:** `id` of sidebar item stays `'aio-projects'`; `path` field handling is planner's discretion (placeholder vs sentinel vs `resolvePath`)
- **D-11:** Delete `AioProjectsPage.tsx`, `AioProjectsPage.test.tsx`, `AioProjectsSkeleton.tsx`
- **D-12:** Remove `/aio-projects` route and lazy import from `routes.tsx`; `/aio-project/:projectKey` stays
- **D-13:** Update AION-02 traceability in `REQUIREMENTS.md` to point at Phase 55
- **D-14:** Silent persist on selection; no redirect, no banner, no toast
- **D-15:** Header pinned-cycle tabs not auto-cleaned on project change

### Claude's Discretion

- Exact label/helper text for the picker
- Placeholder copy (default: `"Choose a project..."`)
- Whether to show `projectKey` alongside `name` in dropdown items
- Test coverage shape (minimum outlined in D-13 discretion section)

### Deferred Ideas (OUT OF SCOPE)

- Multi-project AIO support
- In-picker search/filter
- Auto-clean header pinned tabs on project selection change
- Settings-side "Browse all AIO projects" link
- Onboarding-style first-run prompt
</user_constraints>

---

## Summary

Phase 55 is a refactoring phase: it moves AIO project selection from a dedicated list page into the existing `IntegrationsSection.tsx` settings component, replaces the sidebar's static `/aio-projects` route with a dynamic deep-link to `/aio-project/${selectedAioProjectKey}`, and deletes the list page. The codebase is confirmed at store version 16 (verified in source). No new dependencies are introduced — the phase reuses the existing shadcn `<Select>` primitive, `fetchAioProjects` service, and `readSecret` credential loader.

The key technical questions this research resolves: (1) the store migration is straightforward — no `partialize` allowlist exists, so the new field auto-persists without any allowlist changes; (2) the cleanest sidebar representation for the dynamic `to` prop is computing it at render time using the existing stored `selectedAioProjectKey`, leaving `path` in `sidebar-items.ts` as a non-routed placeholder; (3) `IntegrationsSection.tsx` mounts inside the Settings page which stays mounted during the user's session in the same tab, so lifecycle concerns differ from the deleted page — the `useEffect` / `readSecret` pattern from `AioProjectsPage.tsx` is correct to mirror; (4) the `QueryClient` is configured with `gcTime: Infinity` — the projects cache never evicts during a session, so the deleted page's warm cache persists; (5) `AioTestRunsSection.tsx` calls `fetchAioProjects` internally (does not depend on the list page at all) — Phase 55 deletion leaves Phase 54 intact.

**Primary recommendation:** Follow CONTEXT.md decisions exactly. The only meaningful design choice left for the planner is D-10 (sidebar `path` representation) — the recommended approach is `path: '/aio'` as a non-routed sentinel, with `Sidebar.tsx` overriding the `to` prop when rendering the `'aio-projects'` item. This is a 2-line diff to `sidebar-items.ts` and keeps all existing sidebar item consumers working.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Project selection persistence | Settings Store (Zustand) | — | `selectedAioProjectKey` is user preference state; belongs with other persisted settings |
| Picker UI + credential load | Frontend Component (`IntegrationsSection.tsx`) | AIO service layer | Component reads credentials, fires react-query, renders shadcn Select |
| Project list fetch + cache | React Query (`['aio', jiraBaseUrl, 'projects']`) | AIO service (`fetchAioProjects`) | Query layer owns cache lifecycle; service owns HTTP |
| Sidebar deep-link routing | Frontend Component (`Sidebar.tsx`) | Settings store (reads `selectedAioProjectKey`) | Sidebar computes `to` at render from store state |
| Route removal | Router config (`routes.tsx`) | — | Route table owns URL→component mapping |
| AION-02 traceability | Planning artifact (`REQUIREMENTS.md`) | — | Documentation update |

---

## Standard Stack

### Core (all existing — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | ^5.0.11 | Settings store with persist | Already used; `selectedAioProjectKey` field added to existing store |
| @tanstack/react-query | ^5.90.21 | `useQuery` for `fetchAioProjects` | Already used with `gcTime: Infinity` global default |
| shadcn Select | existing in `src/components/ui/select.tsx` | Picker UI primitive | Established by `GitLabStep.tsx`; no new install |
| shadcn Skeleton | existing in `src/components/ui/skeleton.tsx` | Loading inline state | Already used throughout settings |
| shadcn Label | existing in `src/components/ui/label.tsx` | Picker label | Already used in Settings |
| lucide-react (`Loader2`, `XCircle`) | existing | Inline loading/error icons | Already imported elsewhere in the codebase |

**Installation:** None required — all primitives already present.

[VERIFIED: live codebase — `taskflow/src/components/ui/select.tsx`, `skeleton.tsx`, `label.tsx` exist; `Loader2`/`XCircle` used in `ConnectionsSection.tsx`]

---

## Architecture Patterns

### System Architecture Diagram

```
User opens Settings → Integrations
         │
         ▼
IntegrationsSection.tsx
  │  reads: aioEnabled, setAioEnabled
  │  reads: selectedAioProjectKey, setSelectedAioProjectKey
  │       from useSettingsStore
  │
  ├─ [aioEnabled === false] ──► render toggle only
  │
  └─ [aioEnabled === true]
       │
       ├─► useEffect: readSecret('jira-pat') → setToken
       │            + useAuthStore.jiraBaseUrl
       │
       ├─► useQuery(['aio', jiraBaseUrl, 'projects'])
       │         queryFn: fetchAioProjects(jiraBaseUrl, token)
       │         gcTime: Infinity (global default from main.tsx)
       │
       ├─ [isLoading] ──► inline Loader2 spinner row
       ├─ [isError]   ──► XCircle + "Couldn't load..." + Retry button
       ├─ [empty]     ──► disabled Select with placeholder
       └─ [data]      ──► shadcn Select
                            onValueChange → setSelectedAioProjectKey(projectKey)
                            value = selectedAioProjectKey ?? ''

Zustand persist (Tauri Store 'settings.json')
  selectedAioProjectKey ──► survives page reload / toggle off

Sidebar.tsx
  reads: aioEnabled, selectedAioProjectKey, sidebarItems
  filter: section==='testing' && (!aioEnabled || !selectedAioProjectKey) → exclude
  NavLink to = `/aio-project/${selectedAioProjectKey}` (computed inline)
       └─► AioProjectOverviewPage (route: /aio-project/:projectKey)
```

### Recommended Project Structure (unchanged — files modified)

```
taskflow/src/
├── stores/
│   └── settings.store.ts        EDIT — add field + setter + v17 migration
├── routes/settings/
│   ├── IntegrationsSection.tsx  EDIT — add picker block
│   └── IntegrationsSection.test.tsx  EDIT — add picker tests
├── components/app/
│   ├── Sidebar.tsx              EDIT — extend destructure + filter + dynamic to
│   ├── Sidebar.test.tsx         EDIT — add selectedAioProjectKey gate tests
│   └── sidebar-items.ts         EDIT — change 'aio-projects' path to sentinel
├── routes/routes.tsx            EDIT — remove /aio-projects entry + lazy import
└── routes/dashboard/
    ├── AioProjectsPage.tsx      DELETE
    ├── AioProjectsPage.test.tsx DELETE
    └── AioProjectsSkeleton.tsx  DELETE
```

---

## D-10 Resolution: Sidebar Dynamic `to` Representation

Three options were mapped against the actual `Sidebar.tsx` and `sidebar-items.ts` code:

### Option A — Leave `path: '/aio-projects'` as a dead placeholder
- `sidebar-items.ts`: no change
- `Sidebar.tsx`: intercepts the `'aio-projects'` item by `nav.id` before passing `to`, substitutes `/aio-project/${selectedAioProjectKey}`
- **Type cost:** none — path stays `string`
- **Diff size:** +4 lines in `Sidebar.tsx` (if `nav.id === 'aio-projects'` branch before NavLink)
- **Risk:** `path: '/aio-projects'` is a stale value that would route somewhere wrong if the item ever bypassed the intercept

### Option B — Sentinel `path: '/aio'` (non-existent route)
- `sidebar-items.ts`: change `path: '/aio-projects'` → `path: '/aio'` (1 line)
- `Sidebar.tsx`: same id-based intercept as Option A; the sentinel makes the placeholder clearly invalid as a route
- **Type cost:** none
- **Diff size:** +1 line `sidebar-items.ts`, +4 lines `Sidebar.tsx`
- **Risk:** slightly clearer that `/aio` is not a real route; fails more obviously if intercept is ever removed

### Option C — Extend `SidebarNavDef` with `resolvePath?: (state: SettingsState) => string`
- `sidebar-items.ts`: add optional field to interface, add function to 'aio-projects' item
- `Sidebar.tsx`: call `nav.resolvePath?.(settingsState) ?? nav.path` in NavLink `to`
- **Type cost:** `SidebarNavDef` interface grows; `Sidebar.tsx` needs full store state for the resolver call
- **Diff size:** largest — ~10 lines across both files; `useSettingsStore` destructure expands
- **Risk:** over-engineered for a single use case; no other items will ever need dynamic paths

**Recommendation: Option B (sentinel `/aio`)**

Rationale: cleanest diff, sentinel is self-documenting, no over-engineering. The `Sidebar.tsx` intercept pattern using `nav.id === 'aio-projects'` matches how Phase 51/52 already handle the `aioEnabled` gate by item section — consistent approach. The `NavLink` rendering loop (lines 342-360 in `Sidebar.tsx`) already passes `nav.path` directly as `to`; the intercept inserts a ternary before that assignment.

[VERIFIED: `Sidebar.tsx` lines 342-360 confirmed — NavLink renders `to={nav.path}` directly; no existing abstraction for dynamic paths]

---

## Settings Store Migration — Verified Facts

**Current version:** 16 [VERIFIED: `settings.store.ts` line 365 `version: 16`]

**No `partialize` option:** The `persist()` config at lines 362-444 has no `partialize` key — the entire store state is persisted. Adding `selectedAioProjectKey` to `SettingsState` and the initial state object automatically persists it. No allowlist to update. [VERIFIED: `settings.store.ts` lines 362-444 read in full]

**Migration pattern confirmed:** Sequential `if (version < N)` guards mutate `s` in-place. The guard style used in v15 and v16 is `if (s.field === undefined) s.field = defaultValue` — identical to what D-07 specifies. [VERIFIED: `settings.store.ts` lines 433-440]

**v16 migration reference:** It calls `appendAioItemIfMissing(s.sidebarItems)` — a helper function defined at line 181. The v17 migration is simpler (scalar field, no helper needed). [VERIFIED: lines 181-184 and 436-440]

**Partial state hydration:** Zustand persist with `createTauriStorage` merges persisted state with store defaults — a fresh install gets `selectedAioProjectKey: null` from the default; an upgrading user with v16 state gets it from the migration guard. No edge case with partial state — the `if (s.field === undefined)` pattern already handles it.

**`appendAioItemIfMissing` is already in the module scope** (line 181) — used by v16 migration; Phase 55 does not need to add a new helper.

---

## Picker Credential Loading Lifecycle — Verified Facts

The deleted `AioProjectsPage.tsx` used this pattern [VERIFIED: lines 17-22]:
```typescript
const [token, setToken] = useState<string | null>(null);
useEffect(() => {
  readSecret('jira-pat')
    .then(setToken)
    .catch(() => setToken(null));
}, []);
```

`IntegrationsSection.tsx` is rendered inside `Settings.tsx`, which is a direct route component mounted when the user navigates to `/settings`. Unlike `AioProjectsPage.tsx` (which unmounted when navigating away from `/aio-projects`), `Settings.tsx` stays mounted while the user stays on any `/settings` route — but the settings route itself unmounts when navigating away. So the lifecycle is identical: `IntegrationsSection` mounts/unmounts with the `/settings` route.

**The same `useEffect` + `readSecret` pattern is correct** for `IntegrationsSection.tsx`. Dependencies: `[]` is correct (read once on mount); `jiraBaseUrl` should be added if the user can change it mid-session (they can via `ConnectionsSection.tsx`), making the dependency `[jiraBaseUrl]`.

**Race condition with `aioEnabled` toggle:** When `aioEnabled` is toggled OFF, the picker block unmounts (D-02). The `useEffect` cleanup runs — but there is no async cancellation needed for `readSecret` since React 18 strict mode runs effects twice in dev, and `setToken` calls on unmounted components are safe (React 18 removed the warning, and the state setter is a no-op on unmounted components). No race condition with `aioEnabled` toggle.

**`ConnectionsSection.tsx` does not load credentials on mount** — it calls `readSecret` only inside the `handleTest` button handler (line 73). The `AioProjectsPage.tsx` mount-time pattern is the correct precedent for the picker because the picker needs credentials to fire `useQuery`.

[VERIFIED: `AioProjectsPage.tsx` lines 17-22, `ConnectionsSection.tsx` lines 69-80, `IntegrationsSection.tsx` full file]

---

## React Query Cache Lifecycle — Verified Facts

**`gcTime: Infinity` is the global default** [VERIFIED: `main.tsx` lines 55-63]:
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: Infinity,          // never evict cache during session (LOAD-02)
      retry: 1,
    },
  },
});
```

**Consequence:** The `['aio', jiraBaseUrl, 'projects']` cache entry populated by `AioProjectsPage.tsx` — or by any prior mount of the picker — **never evicts during the session**. After the list page is deleted, the first time the user opens Settings with `aioEnabled=true`, the picker fires the query. If the user navigates away from Settings and back, the cache is warm (staleTime: 5 min). Fresh-on-first-mount is acceptable and consistent with all other queries in the app.

**Recommendation:** Do NOT set an explicit `gcTime` on the picker query. Accept `gcTime: Infinity` from the global default — consistent with LOAD-02 and every other query in the app.

---

## Empty/No-Credentials State — Cross-Section UX Precedent

**Scenario:** `aioEnabled === true` BUT `readSecret('jira-pat')` returns `null` (no PAT configured).

`AioProjectsPage.tsx` handled this by keeping `token` as `null` and the `useQuery` `enabled: !!jiraBaseUrl && !!token` flag preventing the query from firing — resulting in a perpetual loading/idle state with no user feedback.

For the picker inside `IntegrationsSection.tsx`, the recommended pattern is:
1. If `token === null` after `readSecret`, set a local `credentialsMissing` boolean
2. Render the picker in its error state with a message like "Jira PAT not configured. Set it in Connections." linking the user semantically to `ConnectionsSection`

This is **not addressed by CONTEXT.md D-05** (which specifies the network error state, not the missing-credentials state). The planner should decide whether to (a) silently show the loading state indefinitely (matches AioProjectsPage behavior), or (b) distinguish missing-credentials from network error.

**UX precedent from `ConnectionsSection.tsx`:** Credentials are entered there; the section does not cross-reference other sections' credential state. The AIO picker is downstream — it can surface "Configure Jira in Connections first" as a helper text below the picker label when `token === null && jiraBaseUrl !== null`.

[VERIFIED: `AioProjectsPage.tsx` lines 27-31; `ConnectionsSection.tsx` full file]

---

## Phase 54 Cross-Impact Analysis

**Phase 54 `AioTestRunsSection.tsx` uses `fetchAioProjects` independently** [VERIFIED: line 429]:
```typescript
const projects = await fetchAioProjects(jiraBaseUrl, token);
const aioProject = projects.find((p) => p.projectKey === projectKey);
```

This call is inside the `queryFn` of a per-issue query — it derives the AIO project from the Jira issue key's prefix (`issueKey.split('-')[0]`), not from any global `selectedAioProjectKey`. Phase 55 deletion of `AioProjectsPage.tsx` has zero impact on Phase 54 components.

**Phase 54 does not depend on the deleted list page in any way.** The list page's only consumers were: (1) the sidebar nav link to `/aio-projects`, (2) the route entry in `routes.tsx`, and (3) its own test file — all of which Phase 55 removes or replaces.

**`selectedAioProjectKey` is NOT consumed by Phase 54 components.** `AioTestRunsSection.tsx` resolves the project from the issue key, not from global selection. This is correct and consistent with D-15 (no coupling intended).

**Phase 53 cross-impact (header pinning, D-15):** Phase 53 PLAN files are not yet written. The D-15 decision (pinned tabs not auto-cleaned) is stated in CONTEXT.md and is consistent with Phase 53's architecture — pinned tabs store cycle metadata independently in `pinned-tabs.store` and are already agnostic of `selectedAioProjectKey`. No Phase 53 conflict.

[VERIFIED: `AioTestRunsSection.tsx` lines 404-450; `main.tsx` pinned tabs handling; Phase 54 plans 06/07 grep for list-page dependencies]

---

## AION-02 Traceability Update Mechanics — Verified Facts

**Current REQUIREMENTS.md structure** [VERIFIED: full file read]:
```markdown
| AION-02 | Phase 52 | Pending |
```

**Convention used elsewhere:** All traceability rows have exactly `| Req | Phase N | Status |` — no secondary phases, no annotations. No row in the table has multiple phase references.

**Planner action:** Overwrite the Phase 52 reference with Phase 55. Also update the requirement description or add a note if the requirement text needs to reflect the picker-as-list-surface change.

The AION-02 requirement text is: `"User can view a list of all AIO test projects"`. This remains technically satisfied — the picker dropdown shows all 80 projects in a scrollable list. The wording does not require a dedicated page. No requirement text change is needed; only the traceability phase number changes from 52 to 55.

**Full update:** Two changes in `REQUIREMENTS.md`:
1. Traceability table row: `| AION-02 | Phase 52 | Pending |` → `| AION-02 | Phase 55 | Pending |`
2. Footer timestamp: update "Last updated" line

[VERIFIED: `REQUIREMENTS.md` lines 66 and 87]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dropdown with keyboard nav | Custom `<select>` or `<ul>` | shadcn `<Select>` (Radix) | Focus trap, typeahead, aria-haspopup, aria-expanded all handled |
| Store persistence | Custom localStorage adapter | `createTauriStorage` (already wired) | Tauri Store plugin handles atomic writes and platform storage |
| Credential loading | Custom auth fetch | `readSecret('jira-pat')` from stronghold | Secure enclave; already used by all credential reads |
| Project list fetching | Inline `fetch` in component | `fetchAioProjects` from `services/aio/projects.ts` | Already built, tested, handles auth headers |

---

## Common Pitfalls

### Pitfall 1: Forgetting `enabled` in the picker `useQuery`
**What goes wrong:** `useQuery` fires immediately with `null` credentials, hitting the AIO endpoint with no auth header, getting a 401, showing an error state before the user even has a PAT configured.
**Why it happens:** Copying the query without the `enabled: !!jiraBaseUrl && !!token` guard that `AioProjectsPage.tsx` used (lines 27-31).
**How to avoid:** Mirror the `enabled` condition from `AioProjectsPage.tsx` exactly.
**Warning signs:** Error state on first Settings open before network call completes.

### Pitfall 2: `Sidebar.tsx` not re-rendering on `selectedAioProjectKey` change
**What goes wrong:** User selects a project in Settings; sidebar still shows/hides based on stale state.
**Why it happens:** `Sidebar.tsx` line 70 destructures `{ devToolsEnabled, sidebarItems, aioEnabled }` from `useSettingsStore()`. Zustand subscriptions are shallow-equal by default. If `selectedAioProjectKey` is not in the destructure, the sidebar does not re-render when it changes.
**How to avoid:** Add `selectedAioProjectKey` to the destructure at line 70. This is a 1-line change and triggers automatic re-render via Zustand's subscription model. No `React.memo` override needed — `Sidebar` is not memoized.
[VERIFIED: `Sidebar.tsx` line 70 — current destructure shown; no `React.memo` wrapper on the component]
**Warning signs:** Sidebar entry stays hidden after picking a project until page refresh.

### Pitfall 3: Zustand `setState` during React render (controlled/uncontrolled Select)
**What goes wrong:** If `selectedAioProjectKey` is initialized from persisted state but the `<Select value>` is set before projects load, the Select renders with a stored key that has no matching `<SelectItem>` — Radix Select shows a blank trigger, not the stored project name.
**Why it happens:** The `value` is the `projectKey` string, but the display label requires the project `name` from the loaded `data` array.
**How to avoid:** Display the project name with a lookup: `const selected = data?.find(p => p.projectKey === selectedAioProjectKey)`. Trigger renders `selected ? selected.name : placeholder`. This is the same pattern as `GitLabStep.tsx:117-126`.
[VERIFIED: `GitLabStep.tsx` lines 117-126 — uses `projects.find(p => p.id === selectedProjectId)` for display]
**Warning signs:** Blank trigger text despite a stored selection on Settings open.

### Pitfall 4: `vi.mock` for `useSettingsStore` in tests missing `selectedAioProjectKey`
**What goes wrong:** Existing `Sidebar.test.tsx` and `IntegrationsSection.test.tsx` mocks return objects without `selectedAioProjectKey`, causing destructuring to produce `undefined`, triggering the `!selectedAioProjectKey` gate and hiding the sidebar entry even when `aioEnabled = true`.
**Why it happens:** Mock objects are static; new fields must be explicitly added.
**How to avoid:** Update `Sidebar.test.tsx` line 66-93 mock to include `selectedAioProjectKey: null` (for hidden tests) and `selectedAioProjectKey: 'PROJ'` (for visible tests). Update `IntegrationsSection.test.tsx` `mockStore` similarly.
[VERIFIED: `Sidebar.test.tsx` lines 66-93; `IntegrationsSection.test.tsx` lines 5-8]
**Warning signs:** Tests pass when they should fail, or fail when they should pass after Phase 55 changes.

### Pitfall 5: `path: '/aio-projects'` left in sidebar-items.ts becoming a stale real route
**What goes wrong:** A developer later adds a `/aio-projects` route stub or a test navigates to `/aio-projects` and lands somewhere unexpected because the path still exists in `sidebar-items.ts` as a real-looking value.
**How to avoid:** Change to sentinel `'/aio'` (Option B recommended above) so the value is clearly not a real route.
**Warning signs:** `navigate('/aio-projects')` in test suites succeeds when it should 404.

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 + @testing-library/react ^16.3.2 |
| Config file | `taskflow/vite.config.ts` (vitest config co-located) |
| Quick run command | `cd taskflow && npm test -- --reporter=verbose --run` |
| Full suite command | `cd taskflow && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| D-06 (store field) | `selectedAioProjectKey` defaults to `null` | unit | `npm test -- settings.store.test` | ✅ needs extension |
| D-07 (migration) | v16→v17 migration sets `null` when field absent | unit | `npm test -- settings.store.test` | ✅ needs extension |
| D-08 (no clear on toggle) | `setAioEnabled(false)` leaves `selectedAioProjectKey` intact | unit | `npm test -- settings.store.test` | ✅ needs extension |
| D-02 (picker gating) | Picker hidden when `aioEnabled=false` | component | `npm test -- IntegrationsSection.test` | ✅ needs extension |
| D-03 (picker render) | Projects render as SelectItems when `aioEnabled=true` | component | `npm test -- IntegrationsSection.test` | ✅ needs extension |
| D-03 (value change) | Selecting item calls `setSelectedAioProjectKey(projectKey)` | component | `npm test -- IntegrationsSection.test` | ✅ needs extension |
| D-05 (loading) | Loading state shows spinner | component | `npm test -- IntegrationsSection.test` | ✅ needs extension |
| D-05 (error) | Error state shows retry | component | `npm test -- IntegrationsSection.test` | ✅ needs extension |
| D-05 (empty) | Empty list shows disabled Select | component | `npm test -- IntegrationsSection.test` | ✅ needs extension |
| D-09 (sidebar gate) | Sidebar item hidden when `selectedAioProjectKey=null` AND `aioEnabled=true` | component | `npm test -- Sidebar.test` | ✅ needs extension |
| D-09 (sidebar gate) | Sidebar item visible when both `aioEnabled=true` AND `selectedAioProjectKey='PROJ'` | component | `npm test -- Sidebar.test` | ✅ needs extension |
| D-09 (dynamic to) | Sidebar NavLink `href` = `/aio-project/PROJ` when `selectedAioProjectKey='PROJ'` | component | `npm test -- Sidebar.test` | ✅ needs extension |
| D-11/12 (deletions) | `/aio-projects` route does not exist in routes array | smoke | manual grep or test | ❌ no existing test |

### Test Mocking Patterns

**`readSecret` mocking:** `vi.mock('@/services/stronghold', () => ({ readSecret: vi.fn().mockResolvedValue('test-jira-token') }))` — established pattern in `AioProjectsPage.test.tsx` line 20, `Sidebar.test.tsx` line 37.

**`fetchAioProjects` mocking:** `vi.mock('@/services/aio', () => ({ fetchAioProjects: vi.fn() }))` — established pattern in `AioProjectsPage.test.tsx` line 16-18. `IntegrationsSection.test.tsx` will need this added.

**`useSettingsStore` mocking:** Direct `mockStore` object pattern used in `IntegrationsSection.test.tsx` lines 5-8 — extend with `selectedAioProjectKey: null, setSelectedAioProjectKey: vi.fn()`. The `Sidebar.test.tsx` uses a selector-aware mock (lines 66-93) — extend the state object with `selectedAioProjectKey`.

**QueryClient in component tests:** Wrap with `<QueryClientProvider client={new QueryClient({...})} />` — established pattern in `AioProjectsPage.test.tsx` lines 24-26, `Sidebar.test.tsx` lines 95-97.

### Sampling Rate

- **Per task commit:** `cd taskflow && npm test -- settings.store.test IntegrationsSection.test Sidebar.test`
- **Per wave merge:** `cd taskflow && npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work 55`

### Wave 0 Gaps

None — existing test infrastructure covers all phase requirements. The test files (`settings.store.test.ts`, `IntegrationsSection.test.tsx`, `Sidebar.test.tsx`) already exist and use the correct patterns. Phase 55 extends them rather than creating new files.

---

## Code Examples

### Settings store field + setter (D-06)
```typescript
// Source: verified from settings.store.ts lines 115-117 (aioEnabled pattern to mirror)
// In SettingsState interface:
/** Selected AIO project key. Null until user picks a project. */
selectedAioProjectKey: string | null;
setSelectedAioProjectKey: (key: string | null) => void;

// In create() body, adjacent to aioEnabled:
selectedAioProjectKey: null,
setSelectedAioProjectKey: (key) => set({ selectedAioProjectKey: key }),
```

### Migration guard v17 (D-07)
```typescript
// Source: verified from settings.store.ts lines 433-435 (v15 pattern)
if (version < 17) {
  if (s.selectedAioProjectKey === undefined) s.selectedAioProjectKey = null;
}
```

### Sidebar filter + dynamic `to` (D-09, D-10 Option B)
```typescript
// Source: verified from Sidebar.tsx lines 270-279
// In useSettingsStore destructure (line 70):
const { devToolsEnabled, sidebarItems, aioEnabled, selectedAioProjectKey } = useSettingsStore();

// In sectionedItems filter (line 272-279):
const sectionedItems = SIDEBAR_SECTIONS.map((section) => ({
  ...section,
  items: SIDEBAR_NAV_ITEMS.filter(
    (nav) =>
      nav.section === section.id &&
      visibleIds.has(nav.id) &&
      !(nav.section === 'testing' && (!aioEnabled || !selectedAioProjectKey)),
  ),
})).filter((section) => section.items.length > 0);

// In NavLink to (line 345 area):
<NavLink
  key={nav.id}
  to={nav.id === 'aio-projects' ? `/aio-project/${selectedAioProjectKey}` : nav.path}
  ...
>
```

### Picker in IntegrationsSection (D-03/04)
```typescript
// Source: AioProjectsPage.tsx lines 17-31 (credential loader pattern)
//         GitLabStep.tsx lines 109-136 (Select pattern)
const { jiraBaseUrl } = useAuthStore();
const [token, setToken] = useState<string | null>(null);

useEffect(() => {
  readSecret('jira-pat')
    .then(setToken)
    .catch(() => setToken(null));
}, [jiraBaseUrl]); // re-run if URL changes

const { data: projects, isLoading, isError, refetch } = useQuery({
  queryKey: ['aio', jiraBaseUrl, 'projects'],
  queryFn: () => fetchAioProjects(jiraBaseUrl!, token!),
  enabled: !!jiraBaseUrl && !!token,
});

// Selected project name lookup (avoids blank trigger):
const selectedProject = projects?.find(p => p.projectKey === selectedAioProjectKey);

<Select
  value={selectedAioProjectKey ?? ''}
  onValueChange={setSelectedAioProjectKey}
>
  <SelectTrigger id="aio-project">
    <span>{selectedProject ? selectedProject.name : 'Choose a project...'}</span>
  </SelectTrigger>
  <SelectContent>
    {(projects ?? []).map(p => (
      <SelectItem key={p.projectKey} value={p.projectKey}>{p.name}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multi-project list page for AIO navigation | Single-project selection in Settings → sidebar deep-link | Phase 55 | `AioProjectsPage.tsx` deleted; picker subsumes its selection surface |
| `gcTime` unset (default eviction) | `gcTime: Infinity` (LOAD-02) | Phase 38 approx | Projects cache stays warm entire session; no need for per-query `gcTime` override |

---

## Assumptions Log

> All claims in this research were verified against the live codebase. No `[ASSUMED]` tags.

**If this table is empty:** All claims in this research were verified by direct source file reads — no user confirmation needed.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

---

## Open Questions

1. **Missing-credentials UX for picker**
   - What we know: `readSecret('jira-pat')` returns `null` when no PAT is set; `AioProjectsPage.tsx` left this as a perpetual loading/idle state (no user feedback)
   - What's unclear: D-05 specifies error/empty states for network failures but not for missing credentials; whether to show a cross-section "configure Jira first" message
   - Recommendation: Planner adds a `credentialsMissing` branch: when `token === null` after the `useEffect`, render helper text "Jira PAT not configured — set it in Connections" below the picker label rather than showing the loading state forever. This is better UX and requires ~4 lines.

2. **`'aio-projects'` sidebar test: asserting dynamic `to` value**
   - What we know: `Sidebar.test.tsx` mocks `NavLink` as a plain `<a>` with `href={String(to)}` (line 22-24); the existing test asserts text content only
   - What's unclear: the mock currently sets `href` from the `to` prop — after Phase 55, tests for the dynamic `to` can assert `getByText('AIO Projects').closest('a').href` includes `/aio-project/PROJ`
   - Recommendation: Planner includes an assertion on the `href` attribute of the AIO nav link when `selectedAioProjectKey='PROJ'`; mock is already set up correctly for this.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 55 is a code/config change only (no new external dependencies, no new CLI tools, no new services). All dependencies are pre-existing in the repo.

---

## Security Domain

> `security_enforcement` is absent from `.planning/config.json` — treated as enabled. Evaluated below.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No new auth flows; credentials read via existing `readSecret` |
| V3 Session Management | No | No session state changes |
| V4 Access Control | No | AIO is behind `aioEnabled` gate (existing) |
| V5 Input Validation | Partial | `selectedAioProjectKey` is a string from a server-controlled enum (`projectKey` values from `fetchAioProjects`); only set via `onValueChange` from validated SelectItem values — no free-text input |
| V6 Cryptography | No | No new cryptographic operations |

No new threat patterns introduced. The only new data flow is `projectKey` (a Jira project key string like `PROJ`) being stored in Zustand persist and used to construct a URL path. URL construction `\`/aio-project/${selectedAioProjectKey}\`` uses a value sourced from authenticated API response — not from user free-text input — so injection risk is negligible in this Tauri desktop context.

---

## Sources

### Primary (HIGH confidence — verified from live codebase)
- `taskflow/src/stores/settings.store.ts` — persist version 16, migration chain, no partialize, `appendAioItemIfMissing` at line 181
- `taskflow/src/components/app/Sidebar.tsx` — full file read; `useSettingsStore` destructure at line 70; filter at lines 272-279; NavLink rendering at lines 342-360
- `taskflow/src/components/app/sidebar-items.ts` — `SidebarNavDef` interface, `'aio-projects'` item at lines 76-83
- `taskflow/src/routes/settings/IntegrationsSection.tsx` — full file; current toggle-only implementation
- `taskflow/src/routes/settings/IntegrationsSection.test.tsx` — full file; mock pattern
- `taskflow/src/routes/settings/ConnectionsSection.tsx` — full file; `readSecret` on-demand pattern, inline status row patterns
- `taskflow/src/routes/dashboard/AioProjectsPage.tsx` — full file; credential loading pattern, `useQuery` with `enabled`
- `taskflow/src/routes/dashboard/AioProjectsPage.test.tsx` — mock patterns
- `taskflow/src/components/app/Sidebar.test.tsx` — full file; mock structure, existing `aioEnabled` gate tests
- `taskflow/src/stores/settings.store.test.ts` — full file; existing migration test patterns, `describe` structure
- `taskflow/src/main.tsx` — `QueryClient` config: `gcTime: Infinity` at line 59
- `taskflow/src/routes/routes.tsx` — `/aio-projects` at line 52, all lazy imports
- `taskflow/src/routes/onboarding/GitLabStep.tsx` — Select pattern lines 107-136
- `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx` — `fetchAioProjects` call at line 429; no dependency on list page
- `.planning/REQUIREMENTS.md` — AION-02 traceability row structure
- `.planning/config.json` — `workflow.nyquist_validation: true`

### Secondary (MEDIUM confidence)
- `.planning/phases/54-aio-on-issue-detail/54-06-PLAN.md` — grep confirmed `fetchAioProjects` in mock factories; no list-page dependency

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in package.json and existing component files
- Architecture: HIGH — all patterns verified from live source code
- Pitfalls: HIGH — all verified from actual code paths (line numbers cited)
- Migration path: HIGH — sequential guards verified; no partialize to update

**Research date:** 2026-05-14
**Valid until:** 2026-06-14 (stable stack; only changes if dependencies are upgraded or store migration pattern changes)
