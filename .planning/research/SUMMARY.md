# Project Research Summary

**Project:** Taskflow v1.5 — Jira DC & GitLab Feature Parity
**Domain:** Desktop Jira/GitLab client (Tauri 2 + React 19)
**Researched:** 2026-03-22
**Confidence:** HIGH

## Executive Summary

Taskflow v1.5 is a feature expansion milestone for an existing, production-quality Tauri 2 + React 19 desktop application. The app already has a mature architecture (Zustand stores, TanStack Query, shadcn/ui, Biome, Vitest) with 30+ shipped phases behind it. The v1.5 work is well-scoped: add Jira Data Center feature parity (activity history, time tracking, attachments, watchers, board quick filters, saved filters, mention autocomplete, bulk operations) and introduce a configurable widget-based dashboard and customizable sidebar. Nearly all features integrate into existing routes and stores — this is enhancement work, not a rewrite.

The recommended approach is to tackle features in containment order: start with issue detail page enhancements (activity history, time tracking, attachments, watchers, mention autocomplete) because they are isolated from the rest of the app, then address filter system extensions (saved filters, board quick filters), then tackle global navigation (sidebar customization), and finally the two architecturally impactful features (widget dashboard redesign, bulk operations). The stack is nearly frozen — only 4 new dependencies are needed (react-grid-layout, react-pdf, yet-another-react-lightbox, react-mentions-ts), and multiple features that might seem to require libraries (timeline, bulk ops, sidebar reorder) can be built using the existing stack.

The primary risks are: (1) Jira DC API quirks that diverge from Cloud documentation — specifically attachment content URL auth, changelog pagination caps, watchers body format, and worklog duration syntax — all of which have confirmed workarounds; (2) the settings store migration chain (currently at v8 with 60+ fields) becoming fragile if new feature state is consolidated there rather than in dedicated stores; (3) the widget dashboard's re-render behavior during drag if layout state is not carefully isolated with `useRef`/`onDragStop` patterns. All three are avoidable with deliberate architecture choices made at phase start.

## Key Findings

### Recommended Stack

The existing stack covers nearly everything. Only 4 new npm dependencies are warranted for v1.5:

**New dependencies:**
- `react-grid-layout@^2.2.2` — drag/resize widget grid — purpose-built for dashboard layouts; building on @dnd-kit would require 500+ lines of custom collision/layout logic for capabilities react-grid-layout provides out of the box
- `react-pdf@^10.4.1` — PDF attachment preview — lightweight PDF.js wrapper; the only viable React 19-compatible PDF viewer option
- `yet-another-react-lightbox@^3.29.1` — image attachment lightbox — zero-dep core, keyboard/touch support, tree-shakeable plugins; all alternatives are unmaintained or jQuery-based
- `react-mentions-ts@^4.5.0` — @mention autocomplete — TypeScript-first React 19 fork of the unmaintained react-mentions; alternatives (TipTap, Draft.js, Slate) are full rich-text editors incompatible with Jira's wiki markup format

**Build with existing stack (no new dependency):**
- Activity timeline — Tailwind `border-l` + lucide icons + TanStack Virtual; ~50 lines of markup
- Sidebar reordering — @dnd-kit/core (already installed)
- Bulk operations UI — shadcn/ui Checkbox, DropdownMenu, Button
- Board quick filters — shadcn/ui ToggleGroup + existing filter store
- Saved filters — Zustand persist + LazyStore (same pattern used 4+ times already)
- Time tracking UI — shadcn/ui Input, Dialog

**Tauri-specific notes:** PDF.js worker needs `worker-src 'self' blob:` added to CSP in `tauri.conf.json`. Attachment content URLs require tauri-plugin-http fetch (not direct `<img src>`), and may need session-cookie auth as a fallback depending on the Jira DC instance version.

See full details: `.planning/research/STACK.md`

### Expected Features

**Must have — table stakes (P1):**
- Issue Activity History + Unified Timeline — every Jira user clicks "History" daily; Taskflow's differentiator is merging changelog + comments + worklogs into one chronological feed
- Time Tracking / Worklog CRUD — mandatory in enterprise Jira; PM dashboard already shows time columns but the write path is missing
- Watchers / Starring — "Am I watching this?" is visible on every Jira issue page; trivial API, high expectation
- Board Quick Filters — filter chips above sprint board used dozens of times per standup
- Saved Filters / JQL — power users live in saved filters; syncs server-side to Jira
- Comment Edit/Delete — users strongly expect to fix typos; currently Taskflow is post-only
- Due Date Overdue Highlighting — `duedate` already in type; trivial red badge
- Sprint Goal Banner — `JiraActiveSprint.goal` already fetched; trivial display addition
- Customizable Sidebar — replaces hard-coded role-based nav with user-controlled ordering/visibility

**Should have — competitive differentiators (P2):**
- Attachments Viewer + Upload — `JiraAttachment[]` type exists but no UI; medium complexity due to auth negotiation
- Mention Autocomplete — @mention is muscle memory; complex primarily due to cursor-relative popover positioning
- Customizable Widget Dashboard — Jira's gadgets require admin; Taskflow offers instant personal layout
- Bulk Operations with Progress — Jira's bulk wizard is 6+ clicks; multi-select bar is dramatically better UX

**Defer to v3+:**
- Full JQL editor with syntax highlighting — months of work; let users paste JQL from Jira
- Attachment inline annotation — image editing is a separate application domain
- Real-time comment collaboration — Jira DC has no WebSocket API
- Burndown/velocity charts — requires historical snapshots Jira DC does not expose
- Issue voting, comment reactions — low daily value; reactions not available on Jira DC

**Bonus additions discovered (not in original scope):**
- Issue cloning — low complexity, weekly frequency; copy fields from source issue
- Keyboard-driven time logging — natural language input ("2h 30m") as part of worklog UX

See full details: `.planning/research/FEATURES.md`

### Architecture Approach

All v1.5 features integrate into the existing app structure — no new top-level routing paradigm, no new data transport, no new auth model. The integration is: new service modules in `services/jira/`, new Zustand stores for new concerns (dashboard layout, selection, starring), extensions to existing stores (settings v9, filter with view-scoping), and new components/sections within existing routes (issue detail page, dashboard, sprint board).

**Major new components:**
1. `ActivityTimeline.tsx` — unified changelog + comments + worklogs feed on issue detail; lazy-fetched only when Activity tab is active (not on issue load) to avoid payload bloat
2. `TimeTrackingSection.tsx` + `WorklogDialog.tsx` — worklog CRUD within issue detail sidebar
3. `AttachmentsSection.tsx` — file list with inline preview; attachment data already fetched with issue
4. `routes/dashboard/widgets/` directory — widget registry + self-contained widget components; each reads auth from store directly (zero prop threading in dashboard parent)
5. `BulkOperationsBar.tsx` — floating action bar driven by `selection.store.ts`; fully decoupled from list views via Zustand
6. `BoardQuickFilters.tsx` — one-click toggle chips above sprint board columns
7. `MentionAutocomplete.tsx` + `useMentionAutocomplete` hook — @-triggered popover in CommentComposer; pre-fetches assignable users to avoid per-keystroke API calls

**New stores (separate files, not merged into settings.store):**
- `dashboard.store.ts` — persisted widget layout (Tauri LazyStore)
- `selection.store.ts` — session-only multi-select for bulk ops (no persistence)
- `starred.store.ts` — client-side issue starring (Tauri LazyStore)

**Modified stores:**
- `settings.store.ts` — add `sidebarItems[]`, version bump to 9 (with migration guards on every new field)
- `filter.store.ts` — add view scoping for saved filters

**No new top-level routes required.** All features integrate into existing routes. A `/saved-filters` route is optional and can be a settings sub-page instead.

See full details: `.planning/research/ARCHITECTURE.md`

### Critical Pitfalls

1. **Changelog `expand=changelog` silently caps at 100 entries** — Use the dedicated paginated endpoint `GET /issue/{key}/changelog?startAt=0&maxResults=100` from the start; the `expand` approach has no `total` field and silently truncates issues with extensive history. Recovery if discovered late: MEDIUM (rewrite data layer).

2. **Attachment content URLs reject PAT Bearer token** — Attachment files are served outside the REST API scope; PAT auth redirects to the HTML login page with status 200 (undetectable without checking content-type). Prototype early: Bearer fetch first, detect `text/html` response, fall back to session-cookie auth via `/rest/auth/1/session`, then fall back to `shell.open()`. Build this negotiation into a `downloadAttachment()` helper before building any viewer UI.

3. **Widget dashboard remounts all widgets on every drag pixel** — `react-grid-layout` fires `onLayoutChange` continuously during drag. Storing layout in Zustand on each event causes every data-fetching widget to re-subscribe and flicker. Fix: use `useRef` during drag, commit to Zustand only on `onDragStop`/`onResizeStop`. Apply `React.memo` to all widget components with stable keys. Must be designed from day one.

4. **Settings store migration fragility** — Already at v8 with 60+ fields and 8 cumulative migrations. Adding dashboard layout, sidebar config, and saved filters here would push it past 80 fields. Create dedicated stores (`dashboard.store.ts`, `sidebar.store.ts`) following the existing `pinned-tabs.store.ts` pattern. Every new migration must guard new fields with `if (s.field === undefined)`.

5. **Bulk operations partial failure on Jira DC** — No native bulk API exists on Jira DC; every issue requires a separate PUT. Use `Promise.allSettled` (never `Promise.all`), cap concurrency at 5, respect `x-ratelimit-remaining` headers, and show per-issue progress with a "retry failed" action. Recovery cost if designed wrong: MEDIUM.

**Additional confirmed gotchas:**
- Watchers POST body must be a bare JSON string `"username"` — not an object; DC uses `name` not `accountId`
- Worklog `timeSpent` must use Jira format `"2h 30m"` — not ISO 8601 `PT2H30M`; build `formatJiraDuration()` utility before the worklog UI
- Mention autocomplete must pre-fetch assignable users (once, cached 30min) rather than querying on every keystroke
- The existing `quickFilters` in settings store and the new `savedFilters` feature are conceptually distinct — use separate types and a separate store to prevent naming collisions and migration risk

See full details: `.planning/research/PITFALLS.md`

## Implications for Roadmap

Based on the dependency graph and risk profile from combined research, a 7-phase structure is recommended. The ordering progresses from contained issue detail enhancements (low blast radius, high value shipped early) through filter system work, global navigation changes, and finally the two most architecturally impactful features.

### Phase 1: Issue Detail Enrichment
**Rationale:** Activity history, time tracking, and attachments are all isolated to the issue detail page, have zero dependencies on other new features, and some already have partial data (attachment type exists, worklog service exists, timetracking field already fetched). Low integration risk, high daily value shipped early.
**Delivers:** Unified activity timeline (changelog + comments + worklogs merged by timestamp), worklog CRUD with natural language time input, attachment viewer with upload
**Addresses:** Issue Activity History, Time Tracking/Worklog CRUD, Attachments Viewer (all P1/P2)
**Avoids:** N+1 query pitfall (changelog fetched lazily on tab select only, never on issue load); attachment PAT auth pitfall (prototype `downloadAttachment()` helper before UI); worklog format pitfall (build `formatJiraDuration()` first); custom field display names in changelog (use existing `discoverCustomFields` pattern)
**Research flag:** NEEDS RESEARCH — attachment PAT auth negotiation is a blocking technical investigation with multiple fallback paths; must be prototyped against the live instance before building UI

### Phase 2: Issue Detail Social Features
**Rationale:** Watchers and mention autocomplete both live in the issue detail page scope and are slightly more complex than Phase 1 (new API endpoints, DC-specific auth format quirks, textarea integration). Sequencing after Phase 1 keeps all issue detail work grouped and ensures mention autocomplete works in edited comments as well.
**Delivers:** Watch/unwatch toggle with watcher count badge, @mention autocomplete in comment composer, comment edit/delete
**Addresses:** Watchers/Starring, Mention Autocomplete, Comment Edit/Delete (all P1/P2)
**Avoids:** Watchers body format pitfall (bare `"username"` string body, not an object); mention excessive requests pitfall (pre-fetch assignable users on project load, search locally); watcher permission graceful degradation (user can add self but not others without "Manage watcher list" permission)
**Research flag:** STANDARD PATTERNS — API endpoints confirmed; pre-fetch user cache pattern is straightforward

### Phase 3: Trivial Quality-of-Life Items
**Rationale:** Due date highlighting, sprint goal banner, and issue cloning are all trivial (data already fetched, minimal UI). Bundling them as a dedicated low-effort phase avoids polluting higher-complexity phases with one-liner tasks.
**Delivers:** Overdue due date red badge on sprint cards and issue detail, sprint goal displayed on board header, one-click issue clone
**Addresses:** Due Date Highlighting, Sprint Goal Banner (P1), Issue Cloning (P3)
**Avoids:** No meaningful pitfall exposure
**Research flag:** SKIP RESEARCH — all data already in existing types; no new API surface

### Phase 4: Filter System Extensions
**Rationale:** Saved filters and board quick filters both extend the existing filter infrastructure (`filter.store.ts`, `UnifiedFilterBar.tsx`). Board quick filters depend on the view-scoping changes made for saved filters. Filter work is self-contained and does not require sidebar or dashboard to be done first.
**Delivers:** Saved filter management page, server-synced favourite filters from Jira, one-click filter chips on sprint board, offline-ready filter caching
**Addresses:** Saved Filters/JQL, Board Quick Filters (both P1)
**Avoids:** quickFilters/savedFilters naming collision (separate types and stores, `QuickFilter` shape unchanged); JQL injection risk (store structured filter objects, generate JQL at query time, never store raw JQL); board ID discovery UX decision (persist boardId per project in store after first discovery)
**Research flag:** STANDARD PATTERNS — existing filter system and persistence patterns are proven; Jira filter API endpoints are straightforward

### Phase 5: Global Navigation (Customizable Sidebar)
**Rationale:** Sidebar customization modifies global navigation and affects the whole app. By Phase 5, all feature routes are stable and the full set of sidebar items is known. Doing this earlier risks building the sidebar config around an incomplete feature set.
**Delivers:** User-configurable sidebar ordering and visibility, role presets as quick-start configs, settings panel for sidebar customization
**Addresses:** Customizable Sidebar (P1)
**Avoids:** Settings store migration fragility (sidebar config in dedicated store or new `sidebarItems` field with strict migration guard); `role` field preservation (`role` stays as-is; presets reference it, not replace it); missing reset action (always include "Reset to [role] defaults" in sidebar settings)
**Research flag:** STANDARD PATTERNS — @dnd-kit reorder (already installed); Tauri LazyStore persist (used 4+ times in codebase)

### Phase 6: Widget Dashboard Redesign
**Rationale:** Most architecturally impactful change — replacing the fixed dashboard with a grid layout engine. Best done after all widget content (issue detail, filters, sprint health) is stable. The dashboard becomes a layout engine wrapping existing panels as self-contained widgets.
**Delivers:** Drag/resize widget grid, widget registry (subtasks, MR health, sprint health, recent activity, time tracking widgets), role presets, `dashboard.store.ts`
**Addresses:** Customizable Dashboard (P1)
**Uses:** `react-grid-layout` (new dep), `dashboard.store.ts` (new store), CSS Grid with manual positioning
**Avoids:** Widget remount on drag (useRef during drag, commit on onDragStop, React.memo on all widgets); prop threading credentials (widgets read from auth store directly); settings store bloat (dashboard config in `dashboard.store.ts`); hardcoded widget type IDs (use registry pattern from day one so new widgets can be added without layout migration)
**Research flag:** NEEDS RESEARCH — react-grid-layout integration in Tauri webview, CSS import with Tailwind v4 PostCSS pipeline, and widget layout migration strategy warrant a focused research phase

### Phase 7: Bulk Operations
**Rationale:** Bulk operations touch multiple list views (backlog, sprint board, my tasks) and are the most complex integration — multi-select state across views, floating action bar, concurrency-limited API iteration with no native bulk endpoint, per-issue progress tracking. All upstream list views must be stable before adding the selection layer.
**Delivers:** Multi-select checkbox on list views, floating bulk action bar, progress tracking with per-issue status, retry-failed capability, concurrency-capped iteration
**Addresses:** Bulk Operations (P2)
**Avoids:** Partial failure pitfall (`Promise.allSettled`, per-issue tracking, retry button); rate limiting (concurrency cap 5, check `x-ratelimit-remaining`); selection state polluting filter store (separate `selection.store.ts`); operation blast radius (cap batch size at 25-50 issues)
**Research flag:** STANDARD PATTERNS — well-understood UX pattern; Jira DC per-issue iteration approach is confirmed with documented workarounds

### Phase Ordering Rationale

- Issue detail phases (1-2) come first: isolated blast radius, high daily user value, no cross-feature dependencies
- Trivial items (3) bundled separately: avoids polluting larger phases with one-liner tasks
- Filter work (4) precedes sidebar (5): saved filters need to exist before sidebar can surface them as nav items
- Sidebar (5) precedes dashboard (6): sidebar config informs which widgets are surfaced; sidebar items must be finalized first
- Dashboard (6) before bulk ops (7): both are HIGH complexity; doing them last keeps phases 1-5 clean; dashboard is gated on stable widget content
- Bulk operations last: requires stable list views from all previous phases; highest complexity, highest integration surface

### Research Flags

Phases likely needing `/gsd:research-phase` during planning:
- **Phase 1 (Issue Detail Enrichment):** Attachment PAT auth negotiation in Tauri is a blocking technical investigation; must prototype against live Jira DC instance before building attachment UI
- **Phase 6 (Widget Dashboard):** react-grid-layout CSP/worker behavior in Tauri webview, Tailwind v4 + external CSS import coexistence, and widget layout migration strategy need dedicated research

Phases with standard patterns (skip research-phase):
- **Phase 2 (Social Features):** All API endpoints confirmed; pre-fetch user cache is a known TanStack Query pattern
- **Phase 3 (Trivial QoL):** Data already in types; no new API surface
- **Phase 4 (Filter Extensions):** Existing filter store patterns are proven; Jira filter API endpoints are straightforward
- **Phase 5 (Sidebar):** @dnd-kit + Tauri LazyStore persist used elsewhere in the codebase; no novel patterns
- **Phase 7 (Bulk Operations):** Iteration approach confirmed; standard progress tracking and concurrency limiting patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All new deps verified against React 19 peer deps; existing stack fully audited; Tauri-specific concerns (CSP, PDF worker, attachment auth) identified with documented approaches |
| Features | HIGH | Jira DC REST API v2 endpoints verified against Atlassian docs 9.14.0; all endpoints cross-referenced against existing codebase types; DC vs Cloud API differences explicitly documented |
| Architecture | HIGH | Based on full codebase audit (2026-03-22); all file locations, store patterns, and integration points verified against actual code; no assumptions made about file structure |
| Pitfalls | HIGH | Changelog cap, attachment PAT failure, watchers body format all verified against Atlassian community forums and official bug tracker (JRASERVER-72019); rate limiting confirmed against Jira DC v10.3.15 docs; widget remount issue traced to react-grid-layout issue #945 |

**Overall confidence:** HIGH

### Gaps to Address

- **Attachment download auth on the target instance:** The PAT Bearer auth failure is a known Jira DC bug, but behavior varies by instance version and configuration. Must prototype against the real Jira DC instance before building the attachment UI. If session-cookie approach also fails, `shell.open()` becomes the designed primary UX, not a fallback — Phase 1 planning must account for both outcomes.

- **Board ID discovery UX:** Taskflow currently queries sprints via JQL rather than the Agile board API. Board quick filters require a `boardId` discovered via `GET /rest/agile/1.0/board?projectKeyOrId={key}`. The mechanics are clear but the UX for persisting the board ID (per-project, during onboarding, or lazily on first board view) needs a decision during Phase 4 planning.

- **Settings store v9 migration test coverage:** The codebase has no automated migration test walking from version 0 through all versions. Adding this before the first new store version bump would prevent regression. Whether to address it in-band with v1.5 phases or as a separate maintenance task is a planning decision.

- **react-mentions-ts maturity:** This is a TypeScript-first fork of the unmaintained original, with React 19 support. It is the best available option but carries lower community visibility than the original. If integration issues surface during Phase 2, the confirmed fallback is a custom `useMentionAutocomplete` hook using a shadcn Popover positioned based on textarea cursor offset — described in full in ARCHITECTURE.md.

## Sources

### Primary (HIGH confidence)
- [Jira DC REST API v2 Reference 9.14.0](https://docs.atlassian.com/software/jira/docs/api/REST/9.14.0/) — all Jira endpoint signatures verified here
- [Jira Agile DC REST API 9.14.0](https://docs.atlassian.com/jira-software/REST/9.14.0/) — board and quick filter endpoints
- [Jira DC REST API Examples](https://developer.atlassian.com/server/jira/platform/jira-rest-api-examples/) — attachment, worklog, watcher patterns
- [Jira DC Rate Limiting](https://confluence.atlassian.com/adminjiraserver/improving-instance-stability-with-rate-limiting-983794911.html) — bulk operation throttling approach
- [Jira DC Personal Access Tokens](https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html) — auth scope limitations for attachment URLs
- Codebase audit: `taskflow/src/` (2026-03-22) — store patterns, service modules, type definitions, pagination utilities
- [GitLab Notes API](https://docs.gitlab.com/api/notes/) — cross-source activity enrichment
- [GitLab Time Tracking](https://docs.gitlab.com/ee/user/project/time_tracking.html) — GitLab equivalent endpoints

### Secondary (MEDIUM confidence)
- [Atlassian Community: Changelog 100-entry limit](https://community.atlassian.com/forums/Jira-questions/Rest-API-limiting-changelog-history-results-to-100-even-if/qaq-p/1466525) — silent truncation behavior confirmed
- [Atlassian Community: Changelog pagination](https://community.atlassian.com/forums/Jira-questions/Help-with-Pagination-for-Jira-On-Prem-Changelog-API/qaq-p/2961571) — dedicated endpoint approach
- [JRASERVER-72019](https://jira.atlassian.com/browse/JRASERVER-72019) — attachment PAT Bearer limitation on Jira DC
- [Jira DC attachment download session-cookie workaround](https://support.atlassian.com/jira/kb/how-to-download-attachments-using-rest-api-and-sso/)
- [Atlassian Community: Watchers username format](https://community.developer.atlassian.com/t/help-adding-a-watcher-using-rest-api-json/76677) — bare string body requirement confirmed
- [react-grid-layout issue #945](https://github.com/react-grid-layout/react-grid-layout/issues/945) — widget remount on drag behavior
- [ilert: React-Grid-Layout production dashboard](https://www.ilert.com/blog/building-interactive-dashboards-why-react-grid-layout-was-our-best-choice) — confirms production viability for dashboard use case

### Tertiary (LOW confidence — needs validation during implementation)
- [Shadcn Timeline template](https://www.shadcn.io/template/timdehof-shadcn-timeline) — confirms timeline is trivially buildable with existing primitives
- react-mentions-ts GitHub — React 19 support claimed; needs integration validation in Phase 2

---
*Research completed: 2026-03-22*
*Ready for roadmap: yes*
