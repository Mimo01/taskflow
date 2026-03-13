# Project Research Summary

**Project:** Taskflow — v1.2 Jira Parity
**Domain:** Desktop developer/PM tool — on-premise Jira Data Center issue management (Tauri 2, Jira DC v10.3.15)
**Researched:** 2026-03-13
**Confidence:** HIGH

## Executive Summary

Taskflow v1.2 adds five major Jira parity features to an already-shipped Tauri 2 + React 19 + TanStack Query desktop app: a full issue detail view, a redesigned sprint board with drag-and-drop subtask cards, a backlog view with sprint-grooming actions, a create/edit issue form, and epic management. The existing codebase provides a strong foundation — `StatusPopover`, `postComment`/`fetchComments`, `discoverStoryPointsField`, the `apiFetch`/`jira.ts` service layer, and the TanStack Query optimistic mutation pattern are all proven and reusable. The recommended approach is incremental delivery ordered strictly by the dependency graph: Issue Detail first (consumed by everything else), then Sprint Board Redesign, then Create/Edit Form, then Backlog View, then Epics.

The most important architectural decisions are already settled by the existing codebase and confirmed by research. Issue detail should render as a `shadcn <Sheet>` slide-over (keeping the board's `DndContext` mounted), not a navigation route. Drag-and-drop uses `@dnd-kit/core` v6 (the only maintained, React 19-compatible option). All custom field IDs — story points, epic link, epic name, and the team-specific Account field — must be discovered at startup via a single `GET /rest/api/2/field` call consolidated into `discoverCustomFields()`. The `createmeta` endpoint must be called before any create/edit form is wired to the API to discover which fields are present on the Orange instance's create screen.

The most dangerous risk in this milestone is the ADF vs. wiki markup confusion: Jira Data Center v2 returns description fields as wiki markup strings, not ADF JSON. ADF is a Cloud-only (v3) concept. Sending ADF JSON to the DC v2 create endpoint stores it as a literal string in Jira, corrupting the issue. A secondary risk is stale TanStack Query cache delivering responses that lack newly-added fields — issue detail must use its own independent query key (`['jira-issue-detail', key]`) and never reuse the sprint board cache. Both risks are straightforward to prevent if caught early, expensive to recover from if discovered after shipping.

## Key Findings

### Recommended Stack

The v1.2 stack adds three new npm packages to the existing Tauri 2 / React 19.1 / Vite 7 / Zustand 5 / TanStack Query 5 / shadcn+Tailwind 4 base. No changes to Tauri plugins, state management, or UI library are needed. All new Jira API calls extend the existing `apiFetch.ts` + `@tauri-apps/plugin-http` pattern with Bearer PAT auth.

**Core technologies (existing, validated):**
- `react ^19.1` / `vite ^7.0.4` / `vitest ^4.0` — build toolchain, no changes needed
- `@tanstack/react-query ^5` — all API calls, caching, optimistic updates; `refetchInterval` drives polling
- `zustand ^5.0.11` — UI state; `settingsStore` extended with `customFields` object
- `@base-ui/react ^1.2` (via shadcn) — Sheet, Select, and other primitives already cover all new UI needs

**New libraries (v1.2):**
- `@dnd-kit/core ^6.3.1` + `@dnd-kit/sortable ^10.0.0` + `@dnd-kit/utilities ^3.2.2` — drag-and-drop for the kanban board; the only maintained, React 19-compatible choice (`react-beautiful-dnd` archived; `@dnd-kit/react` new API not production-ready as of Nov 2025)
- `react-hook-form ^7.71.2` + `@hookform/resolvers ^5.2.2` + `zod ^3.24` — create/edit issue form; **use Zod v3, not v4** — `zodResolver` silently breaks with Zod v4 (open issues Aug–Sep 2025, `formState.errors` never populated)
- `simple-adf-formatter` (latest, < 2kB, zero deps) — ADF rendering if needed; on this DC instance descriptions will be wiki markup strings, so this library is likely not needed

**Critical version constraint:** Do not upgrade to Zod v4. The `zodResolver` in `@hookform/resolvers` throws `ZodError` instead of capturing it into `formState.errors`.

### Expected Features

**Must have (table stakes — all P1):**
- Issue detail view: description rendered (wiki markup), status transitions, assignee/story points inline edit, subtasks list, comments read/write, linked issues read, priority, reporter, labels, fix versions, epic link, open-in-Jira deep-link
- Sprint board redesign: subtasks as first-class draggable cards grouped under parent story headers; drag-to-move triggers status transition with optimistic update + rollback
- Create/edit issue form: summary, issue type, assignee (typeahead), story points, description, priority, epic link, fix version, labels, parent (for subtasks), Account custom field; built dynamically from `createmeta` response
- Backlog view: unstarted stories list with move-to-sprint action and client-side filtering by epic/label/assignee
- Open-in-Jira deep-link on every issue — non-negotiable escape hatch

**Should have (P2 — competitive):**
- Epic list with name, color, story count — filter sprint board and backlog by epic
- Epic detail page (stories under epic; reuses issue list pattern)
- Create epic (reuses create form with `issuetype = Epic`)
- MR health badge on issue detail (GitLab link via existing `linkEngine.ts`)
- Sprint "focus mode": one-click filter to current user's subtasks only

**Defer to v1.3+ (anti-features — do not scope):**
- ADF rich-text editor for description write — DC v2 uses wiki markup; a full ADF editor adds 8–12 MB to the bundle
- Drag-and-drop backlog rank reordering — Jira's rank API is unreliable on DC configurations without the ranking plugin
- Attachment upload — requires `tauri-plugin-fs` and multipart POST; excluded by PROJECT.md
- Real-time board updates (< 30s polling) — DC has no webhook push; existing 60s cadence is sufficient
- Issue history/changelog — rarely read; available via Jira deep-link
- Bulk issue edit — high API and UI complexity for low return on small teams

### Architecture Approach

The v1.2 architecture is additive to the existing router + service layer + query cache pattern. New routes (`/backlog`, `/epics`, `/issue/:key`) are added to `createHashRouter`. Two shared Sheet overlays — `IssueDetailSheet` and `IssueCreateSheet` — are consumed from any view (board, backlog, tasks) without navigating away, keeping the board's `DndContext` mounted. All new service functions live in `jira.ts`. The `settingsStore` gains a `customFields` object replacing the single `storyPointsFieldKey` field. A single `discoverCustomFields()` call at startup resolves all four field IDs in one request.

**Major components (new):**
1. `IssueDetailPanel` / `IssueDetailSheet` / `IssueDetailPage` — shared issue detail content rendered as Sheet overlay (from board/backlog) or full-page route (from search/notifications)
2. `IssueCreateSheet` — create/edit form driven by `createmeta` response; dynamically-built Zod schema via `react-hook-form` + `zodResolver`
3. `BacklogTab` — paginated JQL query using compound sprint clause, move-to-sprint action, client-side filters
4. `EpicsTab` / `EpicDetailSheet` — epic list via JQL (`issuetype = Epic`), issues per epic via `${epicLinkFieldKey} = EPIC-KEY`
5. `SprintBoardTab` (redesigned) — `DndContext` wrapping `SortableContext` per column, `DragOverlay` ghost card, `localOrder` component state as drag source of truth

**New service functions in `jira.ts`:**
`discoverCustomFields`, `fetchIssueDetail`, `fetchBacklogIssues`, `fetchEpics`, `fetchEpicIssues`, `createIssue`, `updateIssueFields`, `postIssueLink`, `fetchIssueLinkTypes`, `moveIssuesToSprint`, `searchUsers`

**New TanStack Query keys:**
- `['jira-issue-detail', issueKey, jiraBaseUrl]` — issue detail (independent, never shares sprint board cache)
- `['jira-issues', 'backlog', activeJiraProject, storyPointsFieldKey]` — backlog
- `['jira-epics', boardId]` — epic list
- `['jira-issue-link-types']` — link type list (long TTL, rarely changes)

### Critical Pitfalls

1. **ADF is Cloud-only — Jira DC v2 description is always a wiki markup string** — Never send ADF JSON to the DC v2 create/update endpoint; it stores the raw JSON object as literal text in Jira. For reading: implement a wiki markup renderer (evaluate `jira2md` npm package; fallback is extending the existing `adfToPlainText()` walker). For writing: send a plain string. Existing defensive pattern (`typeof description === 'string'`) is the model to follow.

2. **Epic link field ID is instance-specific — discover via `schema.custom === 'com.pyxis.greenhopper.jira:gh-epic-link'`** — Hardcoding `customfield_10014` breaks on DC instances where the field was created at a different time. Consolidate all field discovery into a single `discoverCustomFields()` call. Never use the display name "Epic Link" in JQL; always use the discovered field key.

3. **Backlog JQL `sprint is EMPTY` silently misses issues from closed sprints** — Atlassian's own KB documents this limitation. Use the combined clause: `sprint is EMPTY OR sprint not in (openSprints(), futureSprints())`. Test against the Orange instance with at least one issue that was in a completed sprint and returned to the backlog.

4. **Create issue `createmeta` must precede form build — "field not on screen" 400s are instance-specific** — The Orange instance's create screen may not include all fields the form sends. Call `GET /rest/api/2/issue/createmeta?projectKeys=X&expand=projects.issuetypes.fields` first; only send fields confirmed present. Parse the `errors` map from 400 responses and display per-field messages.

5. **Drag-and-drop optimistic updates flicker when TanStack Query cache is the sole drag state source** — Maintain `localOrder` in component `useState` as the drag source of truth. On drop, set `localOrder` synchronously (no flicker). Fire the mutation. Rollback `localOrder` on error. Call `invalidateQueries` on settle to sync server state.

6. **Issue detail must use its own query key — stale sprint board cache will serve responses without new fields** — Adding `issuelinks`, `description`, `comment` to `fetchSprintIssues` both pollutes the board payload and creates a cache-staleness trap. The `['jira-issue-detail', key]` query fetches full fields independently on demand.

7. **Issue link type names are admin-configurable — never hardcode** — Discover via `GET /rest/api/2/issueLinkType` at session start. Build the link type dropdown from the API response. Use `type.name` (e.g., `"Blocks"`) for write operations, not the `inward`/`outward` direction strings.

## Implications for Roadmap

Research confirms a clear dependency graph that dictates phase order. Issue Detail is the foundation that every other feature consumes. Create/Edit Form is the deepest dependency for Backlog and Epics. Sprint Board Redesign can proceed in parallel with Create/Edit Form after Issue Detail is stable.

### Phase 1: Custom Field Discovery + Issue Detail Foundation

**Rationale:** Every subsequent feature depends on `customFields` (epic link, account, story points field keys) and on `IssueDetailPanel`. Build the shared infrastructure before any feature that consumes it. Issue detail delivers immediate user value — no more opening Jira just to read a description or check comments. Establishes the optimistic field edit mutation pattern that all later phases reuse.

**Delivers:** `discoverCustomFields()` replacing `discoverStoryPointsField()`; `settingsStore.customFields` object; `IssueDetailPanel` + `IssueDetailSheet` + `/issue/:key` route; `fetchIssueDetail` service function; optimistic field edit mutations (assignee, story points); wiki markup description rendering; comments read/write; linked issues read (display only); subtasks list; open-in-Jira link.

**Addresses:** All P1 Issue Detail table stakes from FEATURES.md; MR health badge (P2)

**Avoids:** ADF/wiki markup confusion (Pitfall 1); stale cache from sprint board (Pitfall 6); issue link field missing from `?fields=` (Pitfall 7 read side); three separate field discovery calls (Architecture Anti-Pattern 4)

**Research flag:** Standard patterns throughout. Wiki markup renderer library selection (jira2md vs. custom) is the only decision to make at plan time — verify jira2md maintenance status before adopting.

---

### Phase 2: Sprint Board Redesign (Subtask-as-Card + Drag-to-Move)

**Rationale:** Highest developer-visible impact after Issue Detail. Depends on `IssueDetailSheet` (card click triggers it). Can begin as soon as Phase 1 ships. The `DndContext` component structure and `localOrder` pattern must be established before wiring to the API to avoid the drag-drop flicker pitfall.

**Delivers:** `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` added to project; `SprintBoardTab` redesigned with subtask cards as first-class kanban items grouped under parent story headers; drag-to-column triggers `postTransition` with optimistic update + rollback; `DragOverlay` ghost card; `refetchInterval: isDragging ? false : 60_000` pattern; assignee filter.

**Uses:** `@dnd-kit/core ^6.3.1` (stable v6 API — not the pre-stable `@dnd-kit/react`); `PointerSensor` + `KeyboardSensor` for accessibility.

**Avoids:** Drag-drop flicker (Pitfall 5 — `localOrder` hybrid pattern); route navigation destroying `DndContext` (Architecture Anti-Pattern 1); pre-fetching transitions for all issues at board load (Architecture Anti-Pattern 6 — lazy fetch on `onDragStart`).

**Research flag:** Standard patterns. dnd-kit is well-documented with multiple 2025 tutorials. Optimistic update pattern already proven in codebase via `StatusPopover`.

---

### Phase 3: Create/Edit Issue Form

**Rationale:** Required by Backlog (create story), Epics (create epic), and Sprint Board (edit from card). Building it before Backlog and Epics unblocks those phases. It is the most complex single feature and benefits from being built standalone before being embedded in multiple surfaces.

**Delivers:** `react-hook-form` + `@hookform/resolvers` + `zod ^3` added to project; `IssueCreateSheet` component; `createIssue` and `updateIssueFields` service functions; dynamic form built from `createmeta` response; fields: summary (required), issue type, assignee (typeahead via `user/assignable/search`), story points, description (plain textarea), priority, epic link, fix version, labels, parent (for subtasks), Account custom field; `POST /rest/api/2/issue` for create; `PUT /rest/api/2/issue/{key}` for edit; issue link creation (serial `POST /rest/api/2/issueLink`); per-field error messages from 400 responses.

**Avoids:** "Field not on screen" 400s (Pitfall 4 — `createmeta` first, dynamic field inclusion); hardcoded link type names (Pitfall 7 — write side, discover from `issueLinkType` endpoint); sending ADF JSON on create (Pitfall 1); Zod v4 breakage (STACK.md constraint — pin to `^3.24`).

**Research flag:** The Account custom field type on the Orange instance is unknown. During plan creation, call `createmeta` against the live instance to determine whether Account is a user picker or string field before designing that form component. Also evaluate whether the paginated `createmeta` variant (DC 8.4+) is needed if the non-paginated endpoint is slow.

---

### Phase 4: Backlog View

**Rationale:** Depends on Issue Detail (row click opens Sheet) and Create/Edit Form (create story in backlog). Self-contained after Phase 1 and 3 ship. Move-to-sprint is the primary grooming action and requires the active sprint ID (already cached by `fetchActiveSprint`).

**Delivers:** `BacklogTab` route; `fetchBacklogIssues` service function with correct compound JQL (`sprint is EMPTY OR sprint not in (openSprints(), futureSprints())`); move-to-sprint via `POST /rest/agile/1.0/sprint/{sprintId}/issue` with 50-issue chunking; client-side filters (epic, label, assignee); create-story-in-backlog (opens Phase 3 form); point total / issue count summary.

**Avoids:** Backlog JQL closed-sprint gap (Pitfall 3 — compound clause); move-to-sprint 403 silent failure (Pitfall 4 API — explicit user-visible error); Agile Board backlog API as data source (Architecture Anti-Pattern 5 — use JQL instead).

**Research flag:** Validate the compound JQL against the Orange instance before building the UI — confirm that a known closed-sprint issue appears in results. This is a 15-minute manual verification, not a full research phase.

---

### Phase 5: Epic Management

**Rationale:** Depends on Issue Detail (epic detail shows stories as rows) and Create/Edit Form (create epic reuses form with `issuetype = Epic`). Last because Epics are the least-blocking missing capability — the team can manage epics in Jira directly until this phase ships. Epic field keys are already discovered in Phase 1 (`discoverCustomFields()`), so no new infrastructure is required.

**Delivers:** `EpicsTab` route; `EpicDetailSheet`; `fetchEpics` (JQL: `issuetype = Epic AND project = X`) and `fetchEpicIssues` (JQL: `${epicLinkFieldKey} = EPIC-KEY`) service functions; epic list with name, color, story count, point total; filter sprint board and backlog by epic; create epic (Phase 3 form with `issuetype = Epic`).

**Avoids:** Agile API for epic issues list (Pitfall 8 — use JQL `${epicLinkFieldKey} = KEY` not `/rest/agile/1.0/epic/{id}/issue`); "Epic Link" display name in JQL (Pitfall 2 — always use discovered field key); fetching all epic issue lists on backlog load (Performance Trap — fetch on demand only).

**Research flag:** Standard patterns. Epic data model and JQL strategies are fully researched and documented. No additional phase research needed.

---

### Phase Ordering Rationale

- **Issue Detail before everything:** Both the board and backlog require a detail view on card/row click. Building them without it produces dead-end interactions. The optimistic mutation pattern established here is reused by every later phase.
- **Sprint Board before Backlog/Epics:** Higher developer-day value; unblocks daily standup use-case. Independent of Create/Edit Form (board editing re-uses Issue Detail's inline edit mutations).
- **Create/Edit Form before Backlog and Epics:** The backlog "create story" action and epic "create epic" action both require the form. Building Backlog/Epics without the form produces read-only views with placeholder buttons.
- **Custom field discovery in Phase 1:** All later phases require `epicLinkFieldKey` and `accountFieldKey`. Consolidating into `discoverCustomFields()` prevents three redundant API calls at startup.
- **Backlog before Epics:** The backlog is the primary grooming surface; epic filtering of the backlog (Phase 5) is more valuable once the backlog exists.

### Research Flags

Phases needing additional research or validation during plan creation:
- **Phase 3 (Create/Edit Form):** Account custom field type on the Orange instance is unknown. Verify via `createmeta` against the live instance before designing the Account field component. Also evaluate paginated `createmeta` endpoints if performance is an issue.
- **Phase 4 (Backlog):** Validate the compound JQL clause against the Orange instance with a known closed-sprint backlog issue before building UI. Confirm `futureSprints()` JQL function is available (almost certain since `openSprints()` works, but worth checking).

Phases with standard patterns (skip research-phase):
- **Phase 1 (Custom Fields + Issue Detail):** Field discovery, Sheet overlay UX, optimistic mutations, wiki markup rendering — all well-documented patterns, several already proven in the codebase.
- **Phase 2 (Sprint Board Redesign):** dnd-kit patterns are thoroughly documented with 2025 tutorials; optimistic update + rollback already proven via `StatusPopover`.
- **Phase 5 (Epic Management):** Fully researched; relies on field discovery infrastructure from Phase 1.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core stack is already shipped and running (React 19.1, Vite 7, Zustand 5, TanStack Query 5 confirmed via codebase on 2026-03-13). New libraries verified against npm registry on 2026-03-13 with peer dep checks. Zod v4 breakage confirmed via multiple open GitHub issues. |
| Features | HIGH | Scope derived from PROJECT.md goals + Atlassian official documentation for DC v10.3.15. Anti-feature decisions are well-justified with concrete reasons. Account custom field type is the one unknown (MEDIUM for that specific field). |
| Architecture | HIGH | Existing codebase read directly on 2026-03-13. Integration patterns (Sheet vs. route, optimistic mutation, query key strategy) verified against official TanStack Query v5 docs and dnd-kit docs. Backlog JQL verified against Atlassian official KB. |
| Pitfalls | HIGH | 9 of 10 pitfalls confirmed via Atlassian KB, community documentation with staff responses, or GitHub issues. Drag-drop flicker confirmed via dnd-kit Discussion #1522. ADF/wiki markup distinction confirmed by multiple community sources. |

**Overall confidence:** HIGH

### Gaps to Address

- **Account custom field type:** The field named "Account" on the Orange Jira instance may be a user picker, a string field, or a different custom type. During Phase 3 planning, call `createmeta` against the live instance to discover the field type before designing the Account field component.

- **Wiki markup renderer library:** The research recommends either `jira2md` (converts Jira wiki markup to Markdown) or a custom regex-based renderer extending the existing `adfToPlainText()` walker. The `jira2md` package maintenance status in 2026 is not confirmed. Verify during Phase 1 planning before adopting; the custom walker extension is the safe fallback.

- **`futureSprints()` JQL availability on Orange:** Almost certainly available since `openSprints()` already works. Confirm during Phase 4 planning with a test query.

- **`createmeta` performance on Orange's DC instance:** Large DC instances have reported this endpoint being slow with `expand=projects.issuetypes.fields`. The paginated variant (DC 8.4+, which DC v10.3 satisfies) may be preferable. Measure during Phase 3 planning.

## Sources

### Primary (HIGH confidence)
- Existing Taskflow codebase (`/Users/mimo/Desktop/Tasker/taskflow/src/`) — read directly on 2026-03-13; architecture, existing patterns, actual runtime versions
- npm registry (live, 2026-03-13) — `@dnd-kit/core` 6.3.1, `@dnd-kit/sortable` 10.0.0, `@dnd-kit/utilities` 3.2.2, `react-hook-form` 7.71.2, `@hookform/resolvers` 5.2.2, `zod` 4.3.6 peer deps verified
- Atlassian Jira Software Data Center REST API 9.14.0 docs — epic, backlog, sprint, board endpoints; version field behavior; `createmeta` discovery
- Atlassian Support KB — backlog JQL gap (`sprint is EMPTY` limitation explicitly documented), epic link via REST API, issue links via REST API
- Atlassian Developer docs — `createmeta` field discovery, issue create/update REST API examples, custom field schema types
- TanStack Query v5 official docs — optimistic updates, query key patterns, `cancelQueries` in `onMutate`
- dnd-kit official docs — `DndContext`, `SortableContext`, `DragOverlay`, sensor configuration

### Secondary (MEDIUM confidence)
- GitHub: clauderic/dnd-kit Discussion #1842 — `@dnd-kit/react` not production-ready (Nov 2025)
- GitHub: react-hook-form/resolvers Issues #799, #813, #768 — Zod v4 + zodResolver breakage (Aug–Sep 2025)
- GitHub: clauderic/dnd-kit Discussion #1522 — drag-drop flicker with TanStack Query as sole state source; `localOrder` pattern recommended
- GitHub: dixahq/simple-adf-formatter — zero deps, < 2kB, JSX output confirmed
- Atlassian community — ADF is Cloud v3 only; DC v2 returns wiki markup strings (multiple staff confirmations)
- Atlassian community — epic link field ID varies; stable schema type `com.pyxis.greenhopper.jira:gh-epic-link` confirmed
- Atlassian community — `@atlaskit/renderer` bundle size: 3.51 MB unpacked, 12 MB bundle growth in practice
- tkdodo.eu — concurrent optimistic updates in React Query

### Tertiary (needs validation during planning)
- `POST /rest/agile/1.0/sprint/{id}/issue` max 50 issues and permissions behavior — confirm against Orange instance during Phase 4 planning
- jira2md npm package — wiki markup to Markdown converter; maintenance status as of 2026 not confirmed — verify before Phase 1 adoption
- `futureSprints()` JQL function availability on Orange's DC instance — confirm during Phase 4 planning

---
*Research completed: 2026-03-13*
*Ready for roadmap: yes*
