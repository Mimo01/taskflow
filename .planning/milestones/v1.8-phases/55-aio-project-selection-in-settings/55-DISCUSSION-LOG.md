# Phase 55: AIO Project Selection in Settings - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 55-AIO Project Selection in Settings
**Areas discussed:** Picker placement & UI, Sidebar behavior when no project selected, Fate of /aio-projects list page, Selection-changed UX, Picker visibility w/ aioEnabled=false, Disable behavior on aioEnabled toggle

---

## Picker placement (Settings)

| Option | Description | Selected |
|--------|-------------|----------|
| Inside Integrations section | Picker next to existing aioEnabled toggle inside IntegrationsSection.tsx. One AIO subsection with toggle + picker. No new Settings nav entry. | ✓ |
| New dedicated 'AIO' section | Add a 9th Settings sidebar entry. Move aioEnabled toggle out of Integrations into the new AIO section so all AIO settings live together. | |
| Per-integration cards inside Integrations | Restructure Integrations as collapsible per-integration cards (one card per integration with its own toggle + config). | |

**User's choice:** Inside Integrations section
**Notes:** Keeps the "Integrations" container Phase 51 set up. AIO becomes the first inhabitant; future integrations can be added as additional subsections without restructuring.

---

## Picker UI control

| Option | Description | Selected |
|--------|-------------|----------|
| shadcn Select dropdown | Native-looking shadcn `<Select>`. Simple, no search. With 80 projects, long scroll list. | |
| Searchable Combobox (Popover + Command) | Popover trigger that opens a Command with CommandInput (search) + filtered list. | |
| Native `<select>` | Plain HTML select with browser-native type-to-jump search. | |
| (Freeform) Same pattern as Jira/GitLab project picker | User pointed at the existing project-picker pattern in the codebase. | ✓ |

**User's choice:** "the same as when i select jira or gitlab project"
**Notes:** Resolved to the existing pattern in `taskflow/src/routes/onboarding/GitLabStep.tsx:107-136` — shadcn `<Select>` with `SelectTrigger` + `SelectContent` + `SelectItem.map(projects)`. Selected project name shown in the trigger, "Choose a project..." placeholder when none. AIO picker mirrors this shape exactly.

---

## Sidebar behavior when no project is selected

| Option | Description | Selected |
|--------|-------------|----------|
| Hide entry until a project is selected | Sidebar filter requires BOTH aioEnabled AND selectedAioProjectKey. Settings is the only entry point for first-time selection. | ✓ |
| Show entry; clicking opens Settings → Integrations | Entry stays visible; clicking navigates to /settings with scroll/highlight to the AIO picker. | |
| Show entry; clicking shows an in-place empty state | A lightweight /aio route renders empty state with a "Choose project in Settings" CTA. | |

**User's choice:** Hide entry until a project is selected
**Notes:** Matches the "gate" pattern Phase 51 and Phase 52 already use (aioEnabled gates the Testing section). selectedAioProjectKey becomes a second gate on the same item. Settings remains the single configuration entry point.

---

## Fate of /aio-projects list page

| Option | Description | Selected |
|--------|-------------|----------|
| Delete it entirely | Remove AioProjectsPage.tsx + skeleton + tests + /aio-projects route. The picker subsumes the list. | ✓ |
| Keep the page, remove the sidebar entry | Page + route survive but are unlinked. Reachable via typed URL or bookmark. | |
| Keep reachable via a "Browse all projects" button in Settings | Redundant with the picker; two ways to pick. | |

**User's choice:** Delete it entirely
**Notes:** Picker dropdown in Settings is the new "list of AIO projects" surface. AION-02 traceability needs to move from Phase 52 to Phase 55 (or be annotated). No orphan code left behind.

---

## Selection-changed UX

| Option | Description | Selected |
|--------|-------------|----------|
| Silent persist — next click on the sidebar uses the new key | No navigation, no banner. Open AIO routes keep rendering their data. | ✓ |
| Redirect open AIO routes to the new project's overview | useEffect navigates away from /aio-project/:oldKey when selection changes. | |
| Show a banner on stale AIO routes prompting to switch | Dismissible banner; user decides when to navigate. | |

**User's choice:** Silent persist
**Notes:** React-query caches are scoped by route params, so stale routes keep working. Selection change is data-only. Pinned cycle tabs (Phase 53) from a different project also survive — cleanup is deferred.

---

## Picker visibility when aioEnabled is OFF

| Option | Description | Selected |
|--------|-------------|----------|
| Hide picker until AIO is enabled | IntegrationsSection.tsx renders the picker only when aioEnabled=true. | ✓ |
| Show picker but disabled/grayed | Picker always visible; control disabled when aioEnabled=false. | |

**User's choice:** Hide picker until AIO is enabled
**Notes:** Cleaner UI. Can't pick a project for a disabled integration. Subsection collapses to just the toggle when AIO is off.

---

## Behavior when aioEnabled is disabled (toggle → off)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep selectedAioProjectKey persisted | Toggle is a gate. Disabling AIO doesn't wipe the selection. Re-enabling restores the previous pick. | ✓ |
| Clear selectedAioProjectKey to null on disable | setAioEnabled(false) also resets selectedAioProjectKey to null. | |

**User's choice:** Keep selectedAioProjectKey persisted
**Notes:** Toggle is gating behavior; selection is data. No cross-field coupling in `setAioEnabled`. Less friction for users who toggle AIO off temporarily.

---

## Claude's Discretion

- Exact label / helper text for the picker in `IntegrationsSection.tsx` ("AIO Project" / "Active AIO Project" / etc.) — planner picks.
- Placeholder copy when no project is chosen — default to "Choose a project..." (matches GitLabStep.tsx).
- Whether to show `projectKey` next to `name` in dropdown items (e.g., "My Project (PROJ)") — planner decides.
- Whether to leave `path: '/aio-projects'` as a placeholder on the 'aio-projects' sidebar item, change it to `/aio`, or extend `SidebarItem` with a `resolvePath` function — planner picks the cleanest representation.
- Inline loading/error treatment for the picker (small skeleton row vs spinner vs no indicator) — planner picks based on what feels least intrusive next to the toggle.
- Test coverage shape — at minimum cover picker hidden when aioEnabled=false, picker renders when on, selecting an item updates the store, sidebar entry hidden when selectedAioProjectKey=null, settings migration v16 → v17 adds null default.

## Deferred Ideas

- **Multi-project AIO support** — out of scope; matches REQUIREMENTS.md "Out of Scope" entry.
- **Searchable combobox** (Popover + Command) — viable upgrade if scroll proves annoying; storage shape doesn't change.
- **Auto-clean header pinned tabs when selection changes** — Phase 53 pinning is independent; stale pins survive. Future cleanup or explicit Settings action.
- **Settings "Browse all AIO projects" link** — rejected as redundant with picker.
- **First-run onboarding prompt** after enabling AIO — not requested; users open Settings manually.
