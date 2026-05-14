# Phase 55: AIO Project Selection in Settings - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Move AIO project selection from the `/aio-projects` list page (Phase 52) into the existing Settings → Integrations section so a single configured project drives the app. Persist the choice in `useSettingsStore` as `selectedAioProjectKey`, gate the sidebar "AIO Projects" entry on both `aioEnabled` AND a non-null selection, and make that sidebar entry deep-link directly to `/aio-project/${selectedAioProjectKey}` instead of routing to a multi-project list. The list page (`AioProjectsPage.tsx` + skeleton + tests + `/aio-projects` route) is deleted — the picker subsumes its purpose. No changes to the project overview page, cycle detail page, header pinning, issue-detail AIO section, or AIO service modules.

</domain>

<decisions>
## Implementation Decisions

### Picker placement (Settings)
- **D-01:** Picker lives inside the existing `IntegrationsSection.tsx` — same subsection as the `aioEnabled` toggle, no new Settings sidebar entry. The Settings nav stays at its current 8 entries (Connections, Appearance, Sidebar, Notifications, Workflow, Integrations, Updates, Advanced). "Integrations" continues to be the container for cross-tool integrations and AIO is its first inhabitant.
- **D-02:** Picker is **hidden** when `aioEnabled === false`. `IntegrationsSection.tsx` renders the toggle unconditionally; the picker (and its loading/error/empty states) renders only when `aioEnabled === true`. Disabled-but-visible was rejected — you can't pick a project for an off integration.

### Picker UI
- **D-03:** Use the shadcn `<Select>` primitive from `taskflow/src/components/ui/select.tsx`. Mirror the existing project picker pattern in `taskflow/src/routes/onboarding/GitLabStep.tsx:107-136`:
  ```
  <Select value={selectedAioProjectKey ?? ''} onValueChange={setSelectedAioProjectKey}>
    <SelectTrigger ...>
      <span>{selected ? selected.name : 'Choose a project...'}</span>
    </SelectTrigger>
    <SelectContent>
      {projects.map(p => <SelectItem key={p.projectKey} value={p.projectKey}>{p.name}</SelectItem>)}
    </SelectContent>
  </Select>
  ```
  No search input. Native Radix Select handles keyboard navigation. ~80 projects on this instance is acceptable scroll length for an infrequently-used Settings control. Selected value: display project `name`; stored value: `projectKey` (matches the URL param of `/aio-project/:projectKey`).
- **D-04:** Picker fetches projects with `fetchAioProjects(jiraBaseUrl, token)` from `taskflow/src/services/aio/projects.ts` — same call the deleted list page used. Cache key: `['aio', jiraBaseUrl, 'projects']` (existing key, no change). Credentials loaded via `readSecret('jira-pat')` in a `useEffect` + `useAuthStore` for `jiraBaseUrl`, mirroring the loader pattern in the (now-deleted) `AioProjectsPage.tsx`.
- **D-05:** Picker states inside `IntegrationsSection.tsx`:
  - Loading: small inline spinner or `<Skeleton>` next to the picker label (Settings uses inline patterns, not full-page skeletons)
  - Error: inline error message under the picker with retry — pattern from `ConnectionsSection.tsx` test-connection feedback. No `<ErrorState>` component (too heavy for a settings sub-control).
  - Empty (`projects.length === 0`): show a disabled Select with placeholder text "No AIO projects available" instead of the dropdown.

### Settings store
- **D-06:** Add `selectedAioProjectKey: string | null` to `SettingsState` in `taskflow/src/stores/settings.store.ts`. Default: `null`. Setter: `setSelectedAioProjectKey: (key: string | null) => void`. Place the field declaration adjacent to `aioEnabled` (lines 115-117) for grouping.
- **D-07:** Bump persist version `16 → 17` with migration:
  ```ts
  if (version < 17) {
    if (s.selectedAioProjectKey === undefined) s.selectedAioProjectKey = null;
  }
  ```
  Follow the existing sequential-guard pattern at `settings.store.ts:366-441`.
- **D-08:** Toggling `aioEnabled` to `false` does **NOT** clear `selectedAioProjectKey`. The toggle is a gate; the selection is data. Re-enabling AIO restores the previously chosen project. No cross-field coupling in `setAioEnabled`.

### Sidebar gating
- **D-09:** The sidebar 'AIO Projects' nav item is hidden when `aioEnabled === false` **OR** `selectedAioProjectKey === null`. Update the filter at `taskflow/src/components/app/Sidebar.tsx:277`:
  ```ts
  !(nav.section === 'testing' && (!aioEnabled || !selectedAioProjectKey))
  ```
  `useSettingsStore` destructure (line 70) gains `selectedAioProjectKey`.
- **D-10:** The 'aio-projects' nav item in `taskflow/src/components/app/sidebar-items.ts` keeps its `id` (`'aio-projects'`) — no settings-store sidebar-items migration needed; the user's existing visibility/order entries stay valid. The item's `path` field is no longer a static literal; `Sidebar.tsx` computes the `to` prop at render time as `/aio-project/${selectedAioProjectKey}`. Planner decides whether to leave `path: '/aio-projects'` as a placeholder, change it to a sentinel like `null`/`/aio`, or extend the `SidebarItem` type to support a `resolvePath: (state) => string` function — pick the cleanest representation. Label and icon (`FlaskConical`) unchanged.

### List page removal
- **D-11:** Delete the following files (Phase 52 artifacts):
  - `taskflow/src/routes/dashboard/AioProjectsPage.tsx`
  - `taskflow/src/routes/dashboard/AioProjectsPage.test.tsx`
  - `taskflow/src/routes/dashboard/AioProjectsSkeleton.tsx`
- **D-12:** Remove the `/aio-projects` route entry from `taskflow/src/routes/routes.tsx:52`. Lazy import of `AioProjectsPage` removed alongside it. The `/aio-project/:projectKey` route (Phase 52 D-14) stays — it's the destination the new sidebar entry deep-links to.
- **D-13:** REQUIREMENTS.md `AION-02` ("User can view a list of all AIO test projects") is **no longer** satisfied by a dedicated list page. The picker dropdown in Settings → Integrations is the new "list" surface — the user sees every AIO project they can pick from there. Planner / Phase 55 verifier must update the AION-02 traceability row in `.planning/REQUIREMENTS.md` to point at Phase 55 (or annotate that the surface changed within v1.8) and add a note in the requirement description if needed.

### Selection-change UX
- **D-14:** Silent persist. `setSelectedAioProjectKey` writes the store and returns. No `useEffect` watching the value, no `useNavigate`, no banner, no redirect. Routes opened against an older key (`/aio-project/:oldKey`, `/aio-cycle/:oldKey/:cycleKey`, pinned cycle tabs from Phase 53) keep rendering — their react-query caches are scoped by route params, not by the global selection. The next sidebar click uses the new key.
- **D-15:** Header pinned-cycle tabs (Phase 53) are not auto-cleaned when the selected project changes. Pinned tabs for a different project key remain pinned and clickable. Cleanup is out of scope for Phase 55 (pinning is its own persistence surface).

### Claude's Discretion
- Exact label / helper text for the picker in `IntegrationsSection.tsx` ("AIO Project" / "Active AIO Project" / etc.) — planner picks something concise consistent with other Settings labels.
- Placeholder copy when no project is chosen — sensible default: `"Choose a project..."` (matches `GitLabStep.tsx:123`).
- Whether to show `projectKey` next to `name` in the dropdown items (e.g., `"My Project (PROJ)"`) — planner decides based on whether project names are likely ambiguous (~80 projects on this instance).
- Test coverage shape — at minimum: `IntegrationsSection.test.tsx` covers picker hidden when `aioEnabled=false`, picker renders projects when `aioEnabled=true`, selecting an item updates the store, sidebar entry hidden when `selectedAioProjectKey=null`. `Sidebar.test.tsx` and `settings.store` migration tests get updates. The deleted page's tests are removed wholesale.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior phase context
- `.planning/phases/51-aio-service-layer/51-CONTEXT.md` — D-04/D-05/D-06 establish `aioEnabled` toggle and settings store migration pattern. D-09 establishes credential loading (`apiFetch('jira', ...)` + Stronghold key `'jira-pat'`). D-16 confirms `AioProject` shape `{id, projectKey, name}`.
- `.planning/phases/52-aio-navigation-project-pages/52-CONTEXT.md` — D-01/D-02 sidebar "Testing" section + 'aio-projects' item. D-04 sidebar `aioEnabled` gate at `Sidebar.tsx:277`. D-14 route conventions (`/aio-projects`, `/aio-project/:projectKey`, `/aio-cycle/:projectKey/:cycleKey`).

### Requirements (traceability update needed)
- `.planning/REQUIREMENTS.md` §v1.8 — `AION-02` row must be re-pointed at Phase 55 once the list page is deleted, since the picker dropdown becomes the new "list of AIO test projects" surface. No new requirement IDs introduced by Phase 55 (it refactors existing UX).

### Settings store + section (primary edit surface)
- `taskflow/src/stores/settings.store.ts` — at version 16. Add `selectedAioProjectKey: string | null` field + `setSelectedAioProjectKey` setter, bump to v17 with migration. Adjacent to `aioEnabled` (lines 115-117).
- `taskflow/src/routes/settings/IntegrationsSection.tsx` — current home of `aioEnabled` toggle. Add picker below the toggle, gated by `aioEnabled === true`.
- `taskflow/src/routes/settings/IntegrationsSection.test.tsx` — extend with picker tests (gating, render, change handler, empty state).

### Picker UI pattern to mirror
- `taskflow/src/routes/onboarding/GitLabStep.tsx:107-136` — Existing `<Select>` project picker pattern. Same `SelectTrigger`/`SelectContent`/`SelectItem.map` shape applies to AIO.
- `taskflow/src/components/ui/select.tsx` — shadcn/Radix Select primitive. No new dependency.

### Sidebar (edit surfaces)
- `taskflow/src/components/app/Sidebar.tsx` — `useSettingsStore` destructure (line 70), `sectionedItems` filter (line 277). Add `selectedAioProjectKey` to destructure, extend filter, compute dynamic `to` for the 'aio-projects' item.
- `taskflow/src/components/app/sidebar-items.ts` — 'aio-projects' item (lines 76-83). `path` becomes effectively dynamic; planner picks the representation.
- `taskflow/src/components/app/Sidebar.test.tsx` — covers sidebar item visibility; add cases for the new `selectedAioProjectKey` gate.

### AIO service (read-only — no changes)
- `taskflow/src/services/aio/projects.ts` — `fetchAioProjects(baseUrl, token)`. Used by the picker. No modifications.
- `taskflow/src/services/aio/types.ts` — `AioProject` `{id, projectKey, name}`. Field used: `projectKey` for storage, `name` for display.

### Files to delete
- `taskflow/src/routes/dashboard/AioProjectsPage.tsx`
- `taskflow/src/routes/dashboard/AioProjectsPage.test.tsx`
- `taskflow/src/routes/dashboard/AioProjectsSkeleton.tsx`
- `/aio-projects` route entry at `taskflow/src/routes/routes.tsx:52` (and its lazy import)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useSettingsStore` (`stores/settings.store.ts`): Zustand persist store with versioned migration. Adding `selectedAioProjectKey` follows the exact same shape as `aioEnabled` (Phase 51): field declaration in the interface + initial value in the create() + setter + version bump + migration guard.
- `fetchAioProjects(baseUrl, token)` (`services/aio/projects.ts`): Already built. Returns `AioProject[]`. The picker calls it via `useQuery` with key `['aio', jiraBaseUrl, 'projects']` — same key the deleted page used, so the cache stays warm if the user toggled away and back.
- `<Select>`, `<SelectTrigger>`, `<SelectContent>`, `<SelectItem>` (`components/ui/select.tsx`): Existing shadcn primitives. Used elsewhere via the GitLab onboarding step.
- `<Skeleton>` (`components/ui/skeleton.tsx`): Inline-sized for the picker loading state.
- `readSecret('jira-pat')` + `useAuthStore.jiraBaseUrl`: Credential loading. Same pattern AioProjectsPage used.

### Established Patterns
- **Settings store version migration:** Sequential `if (version < N)` guards in the `migrate` callback. Version field on the persist options AND the guard. Reference: `settings.store.ts:362-441`.
- **Settings section component:** Single-default-export React component, named `XxxSection.tsx` with sibling `XxxSection.test.tsx`. Renders `<h2>` heading + content. Mirrors `IntegrationsSection.tsx` (existing), `WorkflowSection.tsx`, `NotificationsSection.tsx`.
- **Conditional sub-control render:** `if (!aioEnabled) return null` (or fragment-skip) — gate at the top of the picker block inside `IntegrationsSection.tsx`. Same approach Phase 54 uses for the issue-detail AIO section.
- **Sidebar item filter:** Currently `nav.section === 'testing' && !aioEnabled`. Extending with `|| !selectedAioProjectKey` is a one-line edit, no structural change.
- **Project-picker UX (Select with selected-value display):** `GitLabStep.tsx:111-134` is the closest analog. AIO mirrors it.
- **AIO query key prefix:** `['aio', jiraBaseUrl, ...]` (Phase 51). Picker reuses `['aio', jiraBaseUrl, 'projects']`.

### Integration Points
- `settings.store.ts`: New field + setter + version bump v16 → v17.
- `IntegrationsSection.tsx`: Add picker block + `useQuery` + credential loader + Select.
- `Sidebar.tsx`: Extend `useSettingsStore` destructure + extend filter at line 277 + compute dynamic `to` for the 'aio-projects' item when rendering its `<NavLink>`.
- `sidebar-items.ts`: `path` field on the 'aio-projects' item becomes a placeholder/dynamic (planner decision).
- `routes.tsx`: Remove `/aio-projects` route entry + lazy import.
- File deletions: `AioProjectsPage.tsx`, `AioProjectsSkeleton.tsx`, `AioProjectsPage.test.tsx`.
- REQUIREMENTS.md: Update AION-02 traceability row to Phase 55.

</code_context>

<specifics>
## Specific Ideas

- Picker must render in the same visual block as the `aioEnabled` toggle inside `IntegrationsSection.tsx` — feels like a single "AIO Test Management" subsection with the toggle on top and the project picker below, not two unrelated controls.
- Picker UI mirrors `GitLabStep.tsx:107-136` exactly — same `<Select>` shape, same "Choose a project..." placeholder phrasing. No bespoke combobox; consistency with existing project-picking UX wins.
- Stored value is `projectKey` (the URL param of `/aio-project/:projectKey`), not the AIO internal `id`. Display value is `name`. This keeps the sidebar-deep-link computation trivial — `to={\`/aio-project/${selectedAioProjectKey}\`}` with no `id → projectKey` lookup.
- Sidebar entry is hidden — not disabled, not redirected — when no project is selected. Settings is the only entry point for first-time selection. Sidebar is "transport once configured," not "configure here."

</specifics>

<deferred>
## Deferred Ideas

- **Multi-project AIO support** (selecting multiple AIO projects to display in parallel) — not a v1.8 goal. Single-project is the configured model. Captured in REQUIREMENTS.md's "Out of Scope" as "Cross-project AIO aggregation."
- **In-picker search/filter for >80 projects** — Phase 55 uses native shadcn `<Select>` scroll. If users complain about scroll length, a future phase can swap the trigger for a `<Popover>` + `<Command>` searchable combobox without changing the storage shape.
- **Auto-clean header pinned tabs when project selection changes** — Phase 53's pinned-tab system is independent of the selected project. Stale pins from a previous project survive a selection change. A future cleanup pass (or a "Clear pinned tabs" Settings action) can handle this; out of scope for Phase 55.
- **Settings-side "Browse all AIO projects" link** — explicitly rejected as redundant with the picker dropdown.
- **Onboarding-style first-run prompt to pick an AIO project after enabling the toggle** — not asked for. Today's flow is "enable toggle → manually open picker." A future polish phase could surface a nudge.

</deferred>

---

*Phase: 55-AIO Project Selection in Settings*
*Context gathered: 2026-05-14*
