# Quick Task 260603-fb8: Let users select which Jira board (fix wrong rapidViewId) - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Task Boundary

The Greenhopper/Agile sprint API needs the correct board id (rapidViewId). Today the app
fetches `/rest/agile/1.0/board?projectKeyOrId=PROJ&type=scrum`, which can return multiple
boards (e.g. id 6708 "Copy of Eshop Scrum Board" AND id 163 "Eshop Scrum Board"), and the
code blindly picks `values[0]` — the wrong board. Users must be able to choose which board
to use, both in the onboarding wizard's Jira step and in Settings → Connections.

**Known code anchors (from codebase exploration):**
- Bug: `taskflow/src/services/jira/sprints.ts:38` → `return data?.values?.[0]?.id ?? null;`
- Duplicate bug: `taskflow/src/services/jira.ts:1106` (legacy `fetchActiveSprint`)
- Resolution funnel: all sprint/backlog consumers go through `useBoardId` (`taskflow/src/hooks/useBoardId.ts`) → `fetchBoardId(...)`
- Selected board id is NOT persisted anywhere today; only project key lives in `auth.store.ts` (`activeJiraProject`)
- Wizard step: `taskflow/src/routes/onboarding/JiraStep.tsx`
- Settings editor: `taskflow/src/routes/settings/ConnectionsSection.tsx`
- rapidViewId consumers: `taskflow/src/services/jira/greenhopper/*` (data.ts, allData.ts), Sidebar prefetch, SprintBoardTab, BacklogPage

</domain>

<decisions>
## Implementation Decisions

### Fallback behavior (existing users / before first pick)
- Keep **auto-first board as a fallback**. When no board id is stored for the active project,
  resolve to `values[0]` exactly as today so nothing breaks for existing users.
- `useBoardId` MUST prefer the stored board id and fall back to the fetched first board only
  when nothing is stored. No "block until selected" gate on Sprint Board / Backlog.

### Wizard requirement (onboarding Jira step)
- After project selection, fetch the project's boards. **Auto-pick when exactly one board**
  exists (select it silently). When **multiple boards** exist, **require a choice** before the
  user can continue. When **no board** is found, allow continue (fallback applies).

### Storage & switching
- Store the chosen board id as a **per-project map** in `auth.store.ts`:
  `jiraBoardIds: Record<projectKey, number>` (plus a setter), persisted via the existing
  Tauri storage. Switching the active project keeps each project's own chosen board.
- `useBoardId` looks up `jiraBoardIds[activeJiraProject]` first, then falls back to fetch+first.

### Picker UX details
- **Show name + id** on each option (e.g. `Eshop Scrum Board (163)`) so near-duplicate names
  ("Copy of …") are distinguishable.
- **Auto-select single board**: when a project has exactly one board, select it automatically
  and present it read-only rather than a dropdown.
- **Loading + error states**: spinner while boards load; clear error + retry if the fetch fails.

### Claude's Discretion
- Exact React Query keys / staleTime for a new "list boards" query, the shared component shape
  for the board picker (reuse between wizard and settings if clean), and whether to also remove
  the legacy duplicate `fetchActiveSprint` in `jira.ts` (prefer fixing both call sites so the
  wrong board can't sneak back in). Match existing project-picker patterns in JiraStep.tsx and
  ConnectionsSection.tsx for visual consistency.

</decisions>

<specifics>
## Specific Ideas

Real-world example from the user's Jira instance (the motivating case):
```json
{
  "total": 2,
  "values": [
    { "id": 6708, "name": "Copy of Eshop Scrum Board", "type": "scrum" },
    { "id": 163,  "name": "Eshop Scrum Board",          "type": "scrum" }
  ]
}
```
We currently pick 6708 (wrong); the user wants 163. With a picker + per-project storage, the
user selects "Eshop Scrum Board (163)" and it sticks.

</specifics>

<canonical_refs>
## Canonical References

- Jira Agile REST: `GET /rest/agile/1.0/board?projectKeyOrId={key}&type=scrum` (returns `values[]` of `{id, name, type}`)
- Greenhopper sprint/backlog endpoints consume the board id as `rapidViewId`

</canonical_refs>
