# Retrospective: Taskflow

---

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-12
**Phases:** 4 | **Plans:** 20

### What Was Built

- Tauri 2 portable desktop app with Stronghold OS keychain, CORS-free Jira/GitLab API access, role selection, and dark/light/system theme
- Developer dashboard: My Tasks (current sprint), Sprint Board (status columns), MR Attention list with live 60s polling
- Automatic task-to-MR linking via Jira ticket key parsing from MR titles and commit messages; review health badges on sprint board
- Jira write actions: workflow status transitions with optimistic update/rollback; inline comments with per-row error recovery
- Unified notifications hub: Jira mentions + GitLab MR thread activity, delta polling, OS desktop notifications, in-app badge, read/unread state
- PM dashboards: sprint progress (status buckets + story points), team workload (per-assignee), releases (fix versions with date-matched GitLab links), global search

### What Worked

- **TDD wave structure** — writing failing tests first (Wave 0 scaffolds) before implementation gave clear red/green contracts and caught regressions early
- **Single tauriService abstraction** — isolating `@tauri-apps/api/core` behind `tauri.ts` made the entire service layer testable without a Tauri runtime
- **Incremental UAT gap closure** — catching broken behavior through UAT and creating targeted gap-closure plans kept forward momentum without rewriting phases
- **Parallel Phase 3 + Phase 4** — Phases 3 and 4 both depended on Phase 2 and could execute concurrently; this significantly compressed the timeline
- **TanStack Query as poll coordinator** — single shared cache keys across tabs eliminated duplicate fetches and race conditions

### What Was Inefficient

- **ROADMAP.md checkbox drift** — Phase 3 plan checkboxes and Phase 2 UAT plan checkboxes were never updated in ROADMAP.md despite being completed; required manual correction at milestone close
- **STATE.md stale `Current focus` field** — the Project Reference section still said "Phase 2 — Dashboard (Plans 01 and 02 complete)" at milestone close; should be kept current after each phase
- **tauri-plugin-http discovery late** — originally assumed plain `fetch()` would work; CORS errors in Phase 1 UAT revealed this was wrong, requiring a gap-closure plan (01-05). Should validate API connectivity earlier
- **vi.stubGlobal vs vi.mock confusion** — multiple phases had to fix the same pattern; a shared test utility or documented convention would have prevented this recurring

### Patterns Established

- `vi.mock('@tauri-apps/plugin-http')` at module scope — the correct way to intercept the named ES module binding; `vi.stubGlobal` only patches `globalThis.fetch`
- Tailwind v4: `@tailwindcss/vite` in `vite.config.ts` only — no `postcss.config.js`, no `tailwind.config.js`
- Jira paginated envelope: responses are `{ values: [...] }` not bare arrays — always unwrap with `?? []` fallback
- Jira Server vs Cloud ADF: server returns plain strings for descriptions, Cloud returns ADF objects — handle both defensively with `adfToPlainText`
- `readIds` as `string[]` not `Set` in Zustand persistent stores — `Set` serializes as `{}` in JSON

### Key Lessons

1. **Validate API connectivity in Phase 1** — don't assume fetch/CORS behavior in desktop apps; write a real API call test against the actual target in the first phase
2. **Keep ROADMAP.md checkboxes current** — update plan checkboxes immediately when a plan is completed, not only at phase close
3. **Document vi.mock patterns once** — a single shared `setupTests.ts` convention note would have prevented the vi.stubGlobal recurring issue across Phases 1–3
4. **Parallel phases are high-leverage** — identify dependency graph early and schedule independent phases for concurrent execution

### Cost Observations

- Sessions: ~20 plans across 4 phases
- Notable: Phase 2 UAT gap closure required 3 additional plans (05–07) — good quality gate but plan for it upfront

---

## Milestone: v1.1 — Polish

**Shipped:** 2026-03-13
**Phases:** 4 (5-8) | **Plans:** 24 | **Quick Tasks:** 20

### What Was Built

- Extended Jira API layer: parent/subtask/time-tracking fields, two-query subtask strategy, story-points field discovery
- Fixed Releases tab: correct Jira Server endpoint (`/project/{key}/versions`), newest-to-oldest sort, released/unreleased/overdue/countdown badges
- WorkloadTab rewrite: subtask exclusion from point totals, time tracking columns, done stories as expandable sub-rows
- SprintProgressTab enrichment: stacked status breakdown, sprint-wide time totals, per-assignee breakdown table
- Story/subtask hierarchy in My Tasks and Sprint Board: grouped under collapsible parent story headers; orphan badges for out-of-sprint subtasks
- MR Attention: open-only filter fixed; subtask-linked MR inclusion (MRAT-02); userId race condition fix
- Developer dashboard: SubtasksPanel (DASH-01), MrHealthPanel (DASH-02), SprintHealthPanel (DASH-03), NotificationsPanel (DASH-04)
- Full-page /notifications route with accordion expand, mark-all-read, Bell sidebar NavLink
- 20 quick tasks shipped in parallel: API logging, custom error page, comment count badges, WorkloadTab subtask nesting, role extensions, timeout handling, GitLab project selection, MR-Jira link improvements, broader notifications, richer notification UI

### What Worked

- **Gap closure plans embedded in phases** — adding 05-05 through 05-08 within Phase 5 (instead of a new phase) kept the work scoped and traceable to requirements; Nyquist validation surfaced these gaps reliably
- **Quick tasks as a parallel track** — 20 quick tasks completed alongside the 4 phases without blocking phase execution; the separation of concerns was clean
- **TDD wave structure continued to pay off** — Wave 0 stubs in Phase 8 gave clear contracts before implementation, catching the `sprintData?.issues` type mismatch early
- **onMutate cache shape fix caught by TDD** — the `{ issues, myIssueKeys }` shape bug in Phase 7 was discovered by tests that expected the correct shape, not by a runtime crash

### What Was Inefficient

- **ROADMAP.md checkbox drift (again)** — Phase 7 was left unchecked in ROADMAP.md despite all 5 plans having SUMMARY.md files; the progress table was also inconsistent (showed 4/5). Same issue as v1.0 — checkbox updates need to be part of the plan commit, not deferred
- **Stale `percent: 0` in STATE.md** — the progress percentage stayed at 0 throughout v1.1 despite completed phases; the metric is stale and misleading
- **Duplicate function in gitlab.ts** — a `fetchProjectMilestonesInRange` function was added in an uncommitted diff that had to be reverted in Phase 07-05; the uncommitted state leaked across sessions
- **Notifications store id coercion** — numeric id values in the persisted store caused row-click failures discovered late in Phase 8; earlier schema validation or a migration guard in the store definition would have prevented this

### Patterns Established

- **Jira Server project versions endpoint returns bare array** — `/rest/api/2/project/{key}/versions` returns `[]` not `{ values: [] }`; use `Array.isArray(data) ? data : []`
- **Zustand + Tauri persist: use `setState()` in `onRehydrateStorage`** — direct object mutation is overwritten by async Tauri storage hydration; only `setState()` persists
- **TanStack Query userId race guard** — include async-resolved identifiers (userId) in both `queryKey` and `enabled` to prevent stale-cache race conditions when auth resolves
- **WorkloadTab conditional increment** — push all stories into assignee map unconditionally; gate `count` and `points` increments behind `!isDone` — allows done stories as visible sub-rows without inflating summary totals
- **Dashboard as thin wiring layer** — `dashboard/index.tsx` loads tokens and passes props; each panel owns its own TanStack Query calls — no prop drilling into queries

### Key Lessons

1. **Update ROADMAP.md checkboxes atomically with the plan commit** — deferred updates cause drift that requires manual correction at milestone close; consider making it a mandatory step in the summary template
2. **Guard TanStack Query on async-resolved values** — `enabled: !!userId` + `queryKey: [..., userId]` is the correct pattern for any query that depends on a value that resolves after mount
3. **Validate Jira Server API shapes early** — endpoint paths and response shapes differ from Jira Cloud docs; write a test against the actual endpoint in the first plan that uses it
4. **Uncommitted diffs leak across sessions** — if a function is added in one session but not committed, the next session picks it up invisibly; always commit or discard before stopping

### Cost Observations

- Sessions: 24 plans + 20 quick tasks
- Notable: Phase 8 required 3 gap-closure plans (06–08) — UAT continues to be a reliable gap-detection mechanism; plan for ~25-30% gap closure overhead per phase

---

## Milestone: v1.2 — Jira Parity

**Shipped:** 2026-03-15
**Phases:** 9 (9-17) | **Plans:** 29

### What Was Built

- Full issue detail panel (IssueDetailSheet) accessible from all app entry points: sprint board, my tasks, search, notifications — with inline field editing, comment thread, and Open in Jira deep link
- Rebuilt sprint board with Jira-workflow columns, story swimlane layout, collapsible headers, drag-and-drop status transitions (dnd-kit), and QuickCreateInput per column
- Create/edit Jira issue form with dynamically discovered fields from createmeta API — account and all required custom fields, issue type switcher, issue links with type selection, edit mode for existing issues
- Backlog view: paginated list of unassigned issues, bulk move-to-sprint, create story, filter by epic/label/assignee
- Epic management: EpicsPage with live Jira data, sprint board + backlog epic filter bar, CreateEpicDialog, epic detail via IssueDetailSheet isEpic=true branch
- 3 post-integration fixes in Phase 14: QuickCreateInput wiring into SprintBoardTab (BOARD-04), cache invalidation key (BACK-03), CreateEpicDialog credential source (EPIC-04)
- Phases 15-17 (gap closure): BOARD-04 statusId numeric fix, missing VERIFICATION.md files for Phases 10+11, Nyquist compliance validated across all 6 v1.2 phases

### What Worked

- **Audit-driven gap closure** — running `/gsd:audit-milestone` before closing identified 3 broken E2E flows (BOARD-04, BACK-03, EPIC-04) that were caught before calling the milestone done; Phase 14 fixed all of them in 3 targeted plans
- **Nyquist validation as quality gate** — the Nyquist compliance audit (Phase 17) surfaced test coverage gaps across all 6 phases; all gaps closed with automated tests before milestone ship
- **IssueDetailSheet as reusable entry point** — lifting the sheet to AppLayout level in Phase 9 paid forward to Phases 10-13, which all got click-to-detail for free via the shared onIssueClick prop
- **createmeta for field discovery** — fetching required fields from the live Jira instance at create time (not hardcoding) meant the Account custom field and all required fields appeared correctly without any config changes
- **Phase 14 as explicit wiring phase** — rather than forcing every phase to be self-contained, a dedicated integration phase to close cross-phase wiring bugs was clean and focused

### What Was Inefficient

- **ROADMAP.md phase scope drift** — milestones section said "Phases 9-13" but the milestone grew to include Phases 14-17; the milestone header was never updated during development; fixed at milestone close
- **Phase 15-17 were formal phases with empty directories** — these were planned as phases in the roadmap but executed directly (no formal PLAN.md/SUMMARY.md files); created empty directories and checkboxes that roadmap analyze showed as "empty" — lightweight fixes don't need the full phase scaffolding
- **VERIFICATION.md backfill** — Phases 10 and 11 completed without VERIFICATION.md files being written; Phase 16 was a dedicated phase just to create these artifacts; writing VERIFICATION.md should be part of the human verification plan

### Patterns Established

- **AppLayout-level IssueDetailSheet**: `useState<string|null>(null)` at AppLayout root; threaded as `onIssueClick` to TopBar → SearchOverlay and NotificationPopover; route-level components get their own sheet instance for subtask panels
- **Optional onIssueClick with browser fallback**: `onIssueClick ? onIssueClick(key) : openJiraIssue(url, key)` — progressive enhancement without breaking existing behavior
- **useAuthStore for Jira credentials in mutations**: Never read `useSettingsStore` for Jira credentials — auth credentials live in `useAuthStore` + `readSecret('jira-pat')` from Stronghold
- **Numeric statusId for workflow transitions**: Column category keys (strings like "indeterminate") never match transition `to.id` (numeric strings); always pass the numeric ID from `workflowStatuses`
- **VERIFICATION.md as mandatory phase artifact**: Write at the same time as the human verification plan — never defer to a gap-closure phase

### Key Lessons

1. **Write VERIFICATION.md during the human verification plan** — deferring creates a Phase 16 situation; make it mandatory in the last plan of every phase
2. **Update milestone scope in ROADMAP.md header when phases are added** — phases 14-17 were added but the milestone header still said "Phases 9-13"; update immediately when scope expands
3. **Run audit before milestone close** — the audit caught 3 broken E2E flows (BOARD-04 wiring, BACK-03 cache key, EPIC-04 credentials) that would have shipped as silent bugs
4. **Lightweight fixes don't need formal phase scaffolding** — BOARD-04 statusId bug and VERIFICATION.md backfills don't warrant PLAN.md/SUMMARY.md; note directly in ROADMAP and commit

### Cost Observations

- Sessions: 29 plans across 6 core phases + 3 gap closure phases
- Notable: Phase 14 (integration fixes) added +3 plans but prevented silent E2E failures from shipping; audit-driven gap closure is worth the overhead

---

## Milestone: v1.3 — UX & Branding

**Shipped:** 2026-03-19
**Phases:** 7 (18-24) | **Plans:** 27 | **Quick Tasks:** 40+

### What Was Built

- Custom abstract/geometric app icon via SVG-to-icon pipeline across all platforms (macOS .icns, Windows .ico, Linux PNG, Android, iOS)
- Multi-page Settings with sidebar navigation: Connections (test-connection feedback), Appearance (theme + density), Notifications (poll interval + per-event toggles), Workflow (stale MR threshold + sprint prefs)
- Keyboard shortcuts system: centralized registry (shortcuts.ts), react-hotkeys-hook global listener, Cmd+/ help panel, J/K list navigation in My Tasks and Backlog
- Command palette (Cmd+K): fuzzy search across cached issues/MRs, navigation actions, app actions (create issue, toggle theme), live Jira search tail item, recent items default state
- Header redesign: Taskflow branding moved to sidebar, PinnedTabStrip below top bar with persistence via LazyStore, overflow indicator at 7+ tabs
- Recent items: RecentItemsPopover (clock icon) showing last 10 opened issues/MRs with cache-backed title resolution
- Illustrated empty states (EmptyState component) and actionable error recovery (ApiError class, ErrorState with auth detection, StaleDataBanner) across 10+ data views
- 40+ quick tasks shipped in parallel: full-page issue detail with breadcrumb navigation, MR detail/list pages, collapsible sidebar, redesigned notifications (tabbed, time-grouped, avatar-led), rich comments with wiki rendering, unified filters, and many UI polish items

### What Worked

- **Audit-driven gap closure (again)** — milestone audit found 3 gaps (J/K guard, missing VERIFICATION.md, KEYS-05 scope); phases 23+24 closed them cleanly; audit status escalated from `gaps_found` to `tech_debt` (all requirements met)
- **Architectural resolution over code patches** — Phase 23 (J/K guard) was resolved by recognizing that quick task 260316-r0x (full-page routes) already eliminated the problem; zero code changes needed
- **LazyStore persistence pattern reuse** — pinned tabs and recent items stores both copied the exact same Tauri Store pattern from settings store; zero new patterns to learn or debug
- **Quick tasks as rapid iteration** — 40+ quick tasks during v1.3 allowed fast user-driven polish without blocking the phase pipeline; quick tasks like breadcrumb navigation and sidebar redesign significantly improved UX
- **Three-state error detection pattern** — isError && !data → ErrorState, isError && data → StaleDataBanner, !isError && empty → EmptyState — applied consistently across 10+ views with no edge cases

### What Was Inefficient

- **Phase 23 created as a formal phase for zero code changes** — the J/K guard issue was architecturally resolved by a prior quick task; Phase 23 exists only as a CONTEXT.md documenting this; could have been a note in the audit instead
- **VERIFICATION.md backfill (again)** — Phase 22 completed without VERIFICATION.md; Phase 24 was a dedicated phase to create it; same v1.2 lesson not yet baked into the execution workflow
- **SUMMARY.md missing one_liner field** — the summary-extract CLI couldn't extract accomplishments because no SUMMARY.md files had one_liner in their frontmatter; had to read phases manually
- **Nyquist validation partial across all phases** — all VALIDATION.md files are draft with nyquist_compliant: false; the validation step isn't being completed within phase execution

### Patterns Established

- **react-hotkeys-hook with code-name bindings** — use `mod+slash` (code name) not `mod+/` (symbol) to bypass the normalizer bug (#1125); input suppression via `enableOnFormTags: false`
- **cmdk custom backdrop** — use a custom overlay div instead of CommandDialog to avoid Radix Dialog conflicts with @base-ui/react
- **ApiError structured propagation** — `throw new ApiError(message, status, source)` at API layer; consumers use `isAuthError()` for auth detection, `getErrorSource()` for Jira/GitLab identification
- **Phase goals resolved by prior work need documentation, not code** — when a quick task or architectural change already satisfies a phase goal, document it in CONTEXT.md rather than writing code

### Key Lessons

1. **Bake VERIFICATION.md into phase execution** — two milestones in a row required dedicated gap-closure phases for missing VERIFICATION.md files; make it the final plan of every phase
2. **Quick tasks can architecturally resolve planned phases** — the full-page route migration (260316-r0x) eliminated the J/K guard requirement entirely; check quick task impact before planning gap-closure phases
3. **Populate one_liner in SUMMARY.md frontmatter** — the CLI summary-extract tool expects this field; without it, milestone accomplishment extraction fails silently
4. **Complete Nyquist validation within phase execution** — all v1.3 phases have draft VALIDATION.md; the validation step should be mandatory before phase completion

### Cost Observations

- Sessions: 27 plans + 40+ quick tasks across 5 days
- Notable: Phases 23+24 were both zero/minimal code — one architectural resolution, one documentation gap fill; plan for ~10% documentation overhead per milestone

---

## Milestone: v1.4 — Internal Quality & Performance

**Shipped:** 2026-03-20
**Phases:** 6 (25-30) | **Plans:** 21 | **Quick Tasks:** 2

### What Was Built

- Biome linter/formatter configured with CI-ready scripts (`npm run check`, `npm run fix`); all 162 source files auto-formatted with consistent code style (single quotes, 2-space indent, semicolons, 100 char lines)
- All pre-existing test regressions fixed: global LazyStore mock, selector-aware Zustand mocks, vitest globals type reference — suite went from 489 to 615+ passing tests with zero failures/warnings
- jira.ts monolith decomposed into 14 focused domain modules with barrel re-export preserving all 48+ import paths; CreateEditIssueModal and IssueDetailSidebar split into composable sub-components
- Zero `any` types and zero double-casts in production code; Biome noExplicitAny enabled as error; single safe cast pattern for Zustand migrate
- Shared `createTauriStorage()` utility replacing 4 duplicated LazyStore adapters; route config extracted; inline styles replaced with Tailwind classes
- @tanstack/react-virtual virtualization for BacklogPage, NotificationPopover, and SprintBoardTab — handles 200+ items without scroll jank; jsdom fallback renders all rows
- Unified Developer Tools page: Logs/Operations/Waterfall tabs, operation-level profiling with fetch grouping, per-operation scoped timelines, granular settings panel (6 independent toggles), hidden from Settings navigation (Cmd+Shift+D / command palette only)
- All npm dependencies updated to latest compatible versions; removed unused autoprefixer/postcss; zero high/critical audit vulnerabilities

### What Worked

- **Refactoring milestone as dedicated internal quality sprint** — separating refactoring from feature work meant zero user-facing risk; every change could be validated purely through tests
- **Barrel re-export pattern for jira.ts decomposition** — splitting 1,200+ line monolith into 14 modules without changing any consumer imports; barrel index.ts preserved all 48+ paths
- **In-memory Map-based LazyStore mock** — a single global mock in setup.ts eliminated 8 teardown warnings and made all store tests reliable without Tauri runtime
- **Audit-driven gap closure (third time)** — milestone audit found A11Y-01 test regression; Phase 30 closed it in 1 minute; audit status went from `gaps_found` to `tech_debt`
- **Fast execution** — 21 plans completed in ~134 minutes total (~6.4 min/plan average); the refactoring-only scope meant no API integration surprises

### What Was Inefficient

- **DevToolsSettings.tsx created but never mounted** — Plan 29-02 created a settings component that Plan 29-03 never imported into DevToolsPage; dead code shipped; settings accessible only through old DebugModeSection path
- **DebugModeSection not removed from Settings.tsx** — 29-03 SUMMARY claimed removal but it persisted; dead code path to old debug settings remains
- **debug-logs/ directory not deleted** — route was removed but the directory with components remains as dead code
- **SUMMARY.md still missing one_liner frontmatter** — same v1.3 issue; CLI summary-extract couldn't extract accomplishments automatically; had to read summaries manually
- **Nyquist validation still partial** — all 6 phases have VALIDATION.md but none are nyquist_compliant: true; the same pattern as v1.3

### Patterns Established

- **Biome as single lint+format tool** — `npm run check` = `biome check + tsc --noEmit`; CSS excluded (Tailwind v4 syntax unsupported); a11y rules at warn level
- **createTauriStorage() for store persistence** — single utility for LazyStore adapter; used by all stores needing Tauri persistence
- **jsdom/SSR virtualizer fallback** — when @tanstack/react-virtual returns 0 virtual items (no scroll container dimensions in jsdom), render all rows; production virtualizes normally
- **Per-operation scoped waterfall timelines** — each operation's waterfall uses its own time range, not global; prevents short operations from having invisible bars
- **Selector-aware Zustand mocks** — mock functions handle both `useStore()` (no args, returns full state) and `useStore(selector)` (returns selector output) patterns

### Key Lessons

1. **Verify component mounting end-to-end** — DevToolsSettings.tsx was created in one plan and never imported in the next; a quick grep for the component import at plan close would have caught this
2. **Track dead code deletion explicitly** — removing a route but not deleting its component directory creates tech debt; add "delete old directory" as a task when removing routes
3. **Populate one_liner in SUMMARY.md frontmatter (still)** — two milestones in a row with this issue; needs to be enforced in the summary template or commit hook
4. **Complete Nyquist validation within phases (still)** — four milestones with partial compliance; consider making it a blocking step before phase completion

### Cost Observations

- Sessions: 21 plans + 2 quick tasks across 2 days
- Notable: Average plan execution time of 6.4 min — fastest milestone by far; refactoring-only scope eliminates integration uncertainty

---

## Milestone: v1.5 — Dashboard Redesign & Feature Parity

**Shipped:** 2026-03-24
**Phases:** 7 (31-37) | **Plans:** 25

### What Was Built

- Unified activity timeline merging changelog, comments, and worklogs with type filter chips; comment edit/delete; watcher toggle with count; overdue badges; clone issue
- Time tracking: worklog CRUD with natural language duration parsing ("2h 30m"), sidebar summary with progress bar, worklog entries in activity timeline
- File attachments: upload (button + drag-drop), 80x80 thumbnail grid, lightbox with keyboard prev/next, file list with download
- @mention autocomplete: cursor-anchored popover in comment composer with debounced user search and [~username] wiki markup insertion
- Sprint goal banner, board quick filter chips (Jira QFs + label toggles) with client-side JQL evaluation
- Saved filter management: save/edit/delete Jira filters synced to server, sidebar list with context menu, command palette search, sprint board JQL integration with active filter banner
- Customizable sidebar: data-driven rendering, visibility toggles, drag-and-drop reorder via @dnd-kit/sortable, Dev/PM presets
- Widget-based dashboard: react-grid-layout responsive grid with drag/resize, 11 widget types (including Custom JQL), widget picker dialog, self-contained data fetching, layout persistence
- 3 gap-closure phases (35-37) restoring saved filters, sidebar drag-reorder, and sprint board filter wiring that were deleted by post-verification commits

### What Worked

- **Milestone audit before close** — audit found 2 partial requirements (FILT-02, FILT-04) where saved filters displayed but didn't actually filter the sprint board; 3 gap-closure phases fixed them before ship
- **Self-contained widget architecture** — each dashboard widget loads its own tokens from Stronghold and owns its TanStack Query calls; no prop-drilling from Dashboard; adding new widgets is trivial
- **Session-only store for saved filters** — fetching filters fresh from Jira each session avoids stale state; Zustand store provides cross-component reactivity without persistence complexity
- **Set-based intersection for filter results** — stored saved filter JQL results as Set<string> for O(1) intersection with sprint swimlane issue keys; no re-fetching sprint data needed
- **Gap-closure phases kept minimal** — Phases 35-37 were tightly scoped (3+1+1 plans); each restored exactly one deleted feature without scope creep

### What Was Inefficient

- **Post-verification commit destroyed 3 features** — commits 81d976d and 850ed04 deleted the entire saved filters feature and sidebar drag-reorder after verification passed; required 3 dedicated gap-closure phases (35-37) to restore them; ~7 plans of rework
- **Bulk operations (BOARD-04-07) implemented then user-deferred** — Phase 33 Plan 03 built the full bulk action system (checkboxes, floating action bar, progress indicator) but user removed it during visual review; wasted implementation effort for components that ship disconnected on disk
- **Duplicate SUMMARY.md accomplishments in Phase 33** — Phase 33 has a 33-00-SUMMARY.md (Nyquist stubs) that dilutes accomplishment extraction; test scaffolding plans shouldn't produce SUMMARY files
- **ROADMAP.md plan counts drifted** — several phases show lower plan counts than actual (34 shows 4/5, 35 shows 2/3, 36 shows 0/1) because roadmap checkboxes weren't updated during gap-closure plans

### Patterns Established

- **react-grid-layout CJS interop** — `import ReactGridLayout from 'react-grid-layout'` with type-cast for bundler moduleResolution; responsive layouts via breakpoint configs
- **Widget registry pattern** — centralized `WIDGET_REGISTRY` maps widget types to components, labels, sizes, icons; presets reference registry keys
- **Inline delete confirmation** — filter/item delete uses inline "Confirm?" state instead of nested dialog; avoids dialog-in-dialog UX issues
- **Sidebar favourite filters with useQuery** — sidebar fetches favourite filters via useQuery (2min staleTime) and syncs to Zustand store for cross-component access (command palette, widget)
- **data-sortable-item attribute** — custom data attribute on SortableItem components enables reliable test querying without brittle CSS class selectors

### Key Lessons

1. **Protect verified features from post-verification commits** — two commits after verification passed deleted entire features (saved filters, sidebar drag-reorder); consider freezing feature code after verification or tagging verified state
2. **Don't implement deferred features fully** — bulk operations consumed a full plan of implementation that was immediately removed; if a feature is likely to be deferred, stub it or skip it
3. **Update ROADMAP.md checkboxes in gap-closure plans** — gap-closure plans (35-03, 36-01) completed plans but didn't update roadmap checkboxes; include roadmap update in the commit
4. **Nyquist stubs don't need SUMMARY.md** — Wave 0 test scaffolding plans produce todo stubs, not deliverables; SUMMARY files for these pollute accomplishment extraction

### Cost Observations

- Sessions: 25 plans across 7 phases over 4 days (2026-03-21 to 2026-03-24)
- Notable: 3 gap-closure phases (35-37) = 28% of plans were rework caused by post-verification destructive commits; protecting verified state would have saved ~7 plans

---

## Milestone: v1.6.3 — Release & Auto-Update Pipeline

**Shipped:** 2026-03-29
**Phases:** 4 (38-41) | **Plans:** 10 | **Quick Tasks:** 13

### What Was Built

- Git-tag-to-runtime version pipeline: inject-version.cjs reads git tag, Vite injects APP_VERSION/COMMIT_SHA/BUILD_DATE as typed constants
- Tauri updater plugin with 6-state Zustand store, configurable polling (1h/6h/12h/24h/manual), and 7s launch delay
- Update prompt dialog with rendered markdown changelog, download/install/restart flow, and What's New dialog post-update
- Two-tier version policy enforcement: soft minimum nag banner (dismissible per session) + hard minimum blocking overlay; fail-open when policy unreachable
- About dialog with version/build/platform info via macOS native menu; Updates settings section with frequency control, Check Now, and version history
- Full release pipeline: local release.sh with husky hooks, git-cliff changelog generation, bump-version.mjs, Ed25519 signing
- 13 quick tasks: changelog tooling, local CI replacement, release script hardening, UI polish, debug investigations

### What Worked

- **Local release pipeline over GitHub Actions CI** — replacing GitHub Actions with local release.sh + husky hooks gave full control over the build process; faster iteration, no CI runner debugging, simpler cross-platform builds
- **git-cliff for automated changelogs** — convention-based changelog generation from git commits eliminated manual release note writing; cliff.toml categories map cleanly to user-facing changelog sections
- **Coarse phase granularity (4 phases for full milestone)** — fewer, larger phases reduced overhead; each phase had a clear deliverable without the micro-phase tax seen in v1.2 (9 phases)
- **Quick tasks for post-phase polish** — 13 quick tasks handled release script fixes, changelog rendering, UI refinements, and debug investigations without creating formal phases

### What Was Inefficient

- **SUMMARY.md one_liner extraction still broken** — Phase 40 summaries had garbage one_liner values ("One-liner:", "settings.store.ts (v12):"); the CLI summary-extract parsed raw text instead of meaningful descriptions; same issue as v1.3 and v1.4
- **Phase 41 plan 41-02 marked complete but was manual setup** — the plan was "manual setup + e2e verification" which was completed but then the entire CI approach was replaced by quick task 260329-kyx (local release.sh); the plan's work was effectively discarded
- **CI-03 and CI-04 requirements never checked off** — both requirements were implemented in Phase 38 but their checkboxes in REQUIREMENTS.md were never ticked; discovered at milestone close

### Patterns Established

- **inject-version.cjs for version sync** — single script reads git tag, normalizes to SemVer, writes to tauri.conf.json and package.json; Vite define injects as import.meta.env constants
- **Local release.sh as CI replacement** — husky pre-commit/pre-push hooks + release.sh handles version bump, changelog, build, sign, and publish; no GitHub Actions needed for small teams
- **git-cliff with cliff.toml categories** — conventional commits map to changelog sections (Features, Bug Fixes, Refactoring, etc.); `git cliff --unreleased` for incremental updates
- **Fail-open version policy** — when version-policy.json is unreachable, app runs normally; safe defaults (0.0.0/0.0.0) mean no enforcement until intentionally bumped

### Key Lessons

1. **Check off requirements as they ship, not at milestone close** — CI-03/CI-04 were implemented in Phase 38 but never checked; add requirement checkbox updates to phase completion workflow
2. **Plans can become obsolete mid-milestone** — Phase 41 Plan 02 was completed but its work was replaced by a quick task; accept that quick tasks can supersede formal plans
3. **Fix SUMMARY.md one_liner extraction** — three milestones with broken one_liner values; needs enforcement in the summary template or a validation step
4. **Local tooling beats CI for solo/small teams** — GitHub Actions added complexity (secrets, runners, YAML debugging) that local scripts eliminated; evaluate CI need based on team size

### Cost Observations

- Sessions: 10 plans + 13 quick tasks across 6 days
- Notable: Quick tasks (13) outnumbered formal plans (10) — the milestone was largely polish and tooling iteration after the core phases completed

---

## Milestone: v1.7 — Performance & Perceived Speed

**Shipped:** 2026-04-05
**Phases:** 9 (42-49) | **Plans:** 23

### What Was Built

- Route code-splitting for 6 heavy views with React.lazy(), skeleton fallbacks, and chunk error boundaries
- React Compiler auto-memoization replacing all manual useMemo/useCallback/React.memo across 35 source files
- Session-persistent caching with gcTime: Infinity, route-aware smart polling via useIsActiveRoute hook
- Layout-matched skeleton screens on all 8 major data views with 200ms flicker prevention (useDelayedLoading)
- Query parallelization for sprint board and backlog, sidebar hover prefetch for instant navigation
- Avatar caching with in-memory blob URL Map + LazyStore disk persistence, 30-day TTL eviction
- Backlog refactored to per-section queries (sprint stories, sprint list, backlog issues) with progressive epic loading
- All stale query keys updated after backlog refactor; all mutation sites invalidate correct cache keys

### What Worked

- **Milestone audit as development driver** — the audit identified both functional gaps (backlog regression from commit 702ff84) and doc debt, leading to Phases 47-49 that closed all gaps before ship
- **Per-section query architecture** — splitting monolithic fetchBacklogView into 4 independent queries enabled progressive rendering and eliminated sequential bottlenecks
- **React Compiler as wholesale cleanup** — enabling the compiler and removing all 35 files' manual memoization in one pass was clean; no per-component decision-making needed
- **Quick tasks for UX polish** — sprint board story header context menus, assignee display, animations, MR discussion threads, and backlog context menus shipped as quick tasks without blocking performance phases
- **gcTime: Infinity as default** — making all queries persist for the entire session eliminated most back-navigation loading states; users see cached data instantly

### What Was Inefficient

- **Backlog refactored twice** — Phase 47 (optimize backlog) did the per-section query work, then quick task 260401-ffx (context menu) reverted it by restoring monolithic fetchBacklogView; Phase 48 had to redo the same work
- **SUMMARY.md one_liner extraction still broken** — Phase 45 summaries had "One-liner:" as the extracted value; Phase 44-04 had just "LOAD-03"; same issue as v1.3/v1.4/v1.6.3 — four milestones with this problem
- **Two Phase 47 directories** — 47-v17-debt-cleanup and 47-optimize-backlog-view-performance created ambiguous numbering; the second Phase 47 should have been renumbered
- **VALIDATION.md body checklists never completed** — Phases 43, 44, 46 have nyquist_compliant: true in frontmatter but unchecked body checklists; the body validation step is consistently skipped

### Patterns Established

- **useDelayedLoading(isLoading, delay)** — 200ms threshold hook prevents skeleton flash on cache hits; used across all 8 major views
- **useIsActiveRoute(routePath)** — pathname-based hook that pauses polling for inactive routes; guards refetchInterval in useQuery options
- **Per-section backlog queries** — independent queries for sprint stories (shared cache with sprint board), sprint list, and backlog issues enable progressive rendering and targeted invalidation
- **CachedAvatar with blob URL cache** — in-memory Map of URL→blobURL with LazyStore disk persistence; 30-day TTL; inflight dedup via pending Map
- **Query key alignment across features** — sidebar prefetch, mutation invalidation, and component queries must all use the same cache keys; backlog refactor exposed 6 stale key references

### Key Lessons

1. **Protect refactored code from quick tasks** — the backlog per-section query work was undone by a quick task that restored the old monolithic approach; quick tasks touching refactored areas should be aware of in-progress architectural changes
2. **Fix SUMMARY.md one_liner extraction** — five milestones with broken values; the template or CLI needs enforcement; consider requiring one_liner as a non-empty string in frontmatter validation
3. **Avoid duplicate phase numbers** — two Phase 47 directories created confusion; use decimal numbering (47.1) or sequential numbering for inserted phases
4. **Complete VALIDATION.md body checklists** — frontmatter says compliant but body says unchecked; either automate the body checkoff or remove the body checklist if frontmatter is the source of truth
5. **Query key alignment is an integration concern** — after any query refactor, grep for all references to old cache keys across prefetch, invalidation, and component query sites

### Cost Observations

- Sessions: 23 plans across 9 phases over 8 days
- Notable: Phases 48-49 were rework/gap-closure (5 plans, 22% of total) caused by quick task regression and stale query key references; protecting refactored code would have saved ~5 plans

---

## Milestone: v1.9 — Tempo, Dashboard Redesign & Cleanup

**Shipped:** 2026-05-23
**Phases:** 6 (59-64) | **Plans:** 20 | **Quick tasks:** 10

### What Was Built

- Widget dashboard system + Workload page + react-grid-layout dependency fully removed in one coordinated atomic phase; settings store migrated v18→v19 without breakage
- Static dashboard / welcome screen with personalized greeting + en-GB date hero and a responsive 3-card grid (Sprint health with shadcn Progress, My In-Progress subtasks with outlet-context navigation + breadcrumb chain, Next Release countdown with live `fetchReleaseIssues` progress bar)
- Tempo service layer: live Bearer PAT probe on Jira DC confirmed `/rest/tempo-timesheets/3` path; `src/services/tempo/` module (client/types/worklogs/schedule) with 15 unit tests; `tempoEnabled` v20 settings store field with migration guard; Settings → Integrations toggle (default off)
- Tempo Worklog Viewer: `/worklogs` route gated by `tempoEnabled`, 6 date presets (This Week default, Last Week, This/Last Month, Last Working Day, Custom range with from≥to gate), single-select people filter, totals column + totals row + grand total, zero-hour cells blank, weekend/holiday columns colored via Tempo schedule API
- Saved Tempo filters with Zustand + Tauri Store persistence + right-click ContextMenu pill UX (save/load/rename/reorder/delete) matching established UnifiedFilterBar pattern
- Worklogs page redesign: Epic→Story→Subtask hierarchy with Layers/BookOpen/GitBranch icons + indented rows, sticky date header + sticky first column via pure CSS `position: sticky`, dependent Jira enrichment query, "No Epic" group for orphaned stories, unresolvable keys with strikethrough
- Per-cell WorklogCellPopover with EditWorklogForm (duration validation rejecting `abc`/empty), trash delete (no confirmation), and LogWorkPopover reused for Add entry; broad-prefix `['tempo', 'worklogs']` cache invalidation keeps totals reconciled

### What Worked

- **Probe-first phase architecture** — Phase 61 included a live curl probe as Wave 0 gate before any service-layer work; confirmed Bearer PAT + `aio-tcms-api/1.0` base path on the live instance before committing to any specific endpoint shape
- **Atomic deletion in single coordinated phase** — `settings.store.ts` hard-imports widget registry, so deleting widgets without removing the import would have broken compile; coordinating the deletion + import strip + stub creation in one phase kept the tree green throughout
- **Mid-milestone hierarchy redesign (Phase 64)** — when person×day pivot proved less useful than Epic→Story→Subtask hierarchy after first use, pulling forward TEMPO-08 from v2 backlog and replacing the table mid-milestone was the right call (vs. shipping the worse design and rewriting in v2)
- **3-source verification cross-reference** — VERIFICATION.md + plan SUMMARY frontmatter + REQUIREMENTS.md all triangulated for the milestone audit; missing one source falls back to others, surfacing drift early
- **User-confirmed UX overrides documented inline** — single-select people filter (TEMPO-03, D-01) and zero-cell popover behavior (Phase 64 Test 13) overrode plan specs based on user discussion; documenting these inline in DISCUSSION-LOG.md kept verifier from rejecting them
- **Live UAT batched at milestone close** — running Phase 60 / 62 / 64 UAT in a single Tauri session was efficient; the deferred items were grouped, not spread across phase closes

### What Was Inefficient

- **3-pass milestone audit cycle** — first audit found verification gaps (61/63/64 missing VERIFICATION.md), required write/re-audit cycle; would have been cleaner to enforce VERIFICATION.md creation as a phase-close gate, not a milestone-close audit finding
- **Spec drift between REQUIREMENTS/ROADMAP wording vs. implementation** — TEMPO-03 "multi-select" wording survived the user override that flipped it to single-select; same with SC #1 "Tempo" label vs. shipped "Worklogs" label; verifiers had to apply documented overrides instead of the specs reflecting reality
- **Two human_needed VERIFICATIONs deferred for live UAT** — Phase 62 13-step smoke test and Phase 64 popover CRUD (Tests 9-12) were marked human_needed because mechanical verification couldn't exercise live Tempo CRUD; live UAT at milestone close closed them, but ideally these would be exercised at phase close
- **154 historical quick-task dirs flagged by audit-open** — pre-v1.6 SUMMARY frontmatter convention drift meant scanner couldn't read status; rather than retrofit 145 files, archived to `milestones/historical-quick-tasks/` at this close; convention drift remains for future closes
- **`requirements_completed` SUMMARY frontmatter discipline still 1/17** — only 60-01 SUMMARY listed DASH-02; verifier had to fall back to plan-level claims, weakening the 3-source cross-reference

### Patterns Established

- **`'aio'` / Tempo source PAT sharing** — Tempo lives on the same Jira DC host, so the `'jira'` source PAT works without introducing a third credential type; same pattern as AIO
- **TZ-safe date bucketing** — never use `toLocaleDateString()` for date keys; use local-date components or ISO-string `.slice(0, 10)` for stable, sortable, comparable keys
- **Sticky-table without virtualization** — `position: sticky; top: 0` on `<thead>` and `position: sticky; left: 0` on first-column cells; works for bounded hierarchy datasets without intersection-observer plumbing
- **Cell popover with broad-prefix invalidation** — single mutation can affect multiple cells/totals; `queryClient.invalidateQueries({ queryKey: ['tempo', 'worklogs'] })` covers all derived states
- **Right-click ContextMenu for saved-filter management** — established by UnifiedFilterBar / SavedFilterList in v1.5; Tempo saved filters reused the same pattern for consistency (replaced the hover-× delete + dblclick rename Plan-02 spec at user-approved checkpoint)
- **Outlet-context navigation for breadcrumb chains** — Dashboard subtask click threads `onIssueClick` from `useOutletContext` to preserve breadcrumb push behavior; replaces direct `useNavigate()` which bypasses the breadcrumb store
- **Historical quick-task archival at milestone close** — `.planning/milestones/historical-quick-tasks/` bucket clears scanner noise and preserves slug → commit traceability via `git log`

### Key Lessons

1. **Enforce VERIFICATION.md as a phase-close gate, not a milestone-close discovery** — missing VERIFICATION.md was the largest single source of milestone audit churn; phase-execute workflows should refuse to mark a phase complete without VERIFICATION.md
2. **Update REQUIREMENTS.md wording when user overrides are accepted** — single-select TEMPO-03 lived as a verifier-applied override for the whole milestone; should have been a REQUIREMENTS edit at the override moment
3. **Live UAT for human_needed verifications should happen at phase close** — batching them at milestone close worked, but waiting risks shipping a phase the operator never live-tested
4. **Probe-first phases pay off** — Phase 61's Wave 0 curl probe gate caught the Tempo base path discovery before any service-layer code was committed; same pattern saved v1.8 Phase 51 from hardcoding wrong AIO paths
5. **Pulling forward future-milestone requirements when scope reveals a better design is correct** — TEMPO-08 hierarchy was v2; using it in v1.9 (Phase 64) after person×day pivot proved limiting was the right call vs. shipping the worse design

### Cost Observations

- Sessions: 20 plans + 10 quick tasks across 6 phases over 4 days
- Notable: 3-pass milestone audit cycle added ~1 day of doc-debt closure (write 3 VERIFICATION.md + reconcile REQUIREMENTS); enforcing VERIFICATION.md at phase close would save this
- Phase 64 was pulled forward from v2 backlog mid-milestone; this added ~1 day but produced a meaningfully better worklog UX than the original Phase 62 person×day pivot

---

## Milestone: v1.10 — Cleanup, Roles Removal & Standup Notes

**Shipped:** 2026-05-25
**Phases:** 6 (65-70) | **Plans:** 15 | **Quick tasks:** 17

### What Was Built

- Tech-debt cleanup pass (CLEAN-01..07): WorklogsPage `closeTimer` useEffect cleanup, cached-empty vs network-error distinction, keyed `<React.Fragment>` in hierarchy maps, `DatePreset` relocated to `services/tempo/types.ts`, stale sidebar test mock removed, AIO `TESTCASE_STATUS_MAP` 51/52 IDs, and `AIO_STATUS_MAP` replaced by a runtime map fetched from the live `/config` endpoint via `initializeAioStatusMap`/`normalizeStatusById`
- Developer/PM role concept removed app-wide (ROLES-01..06): `getDefaultSidebarItems` no-arg all-visible, settings store drops `role`/`setRole`/`applyPreset` with a v22 migration, onboarding wizard collapsed 5→4 steps, PresetButtons/RoleSection/RoleStep deleted, zero role-gated conditionals remaining
- Settings → Sidebar tightened to visibility-only (SETUI-01..03): `SidebarItemsList` rewritten 180→50 LOC checkbox list, `reorderSidebarItem` removed, all four `@dnd-kit/*` packages uninstalled
- Onboarding wizard Integrations step (WIZ-01..04): shared `AioBlock` (AIO toggle + project picker, reused by Settings → Integrations) + inline Tempo toggle, gated Back/Continue, writing both toggles + selected AIO project key directly to the settings store as the single source of truth
- Standup Notes Yesterday recap (STAND-01..06): `/standup-notes` route + all-visible sidebar entry + breadcrumb; last-working-day resolution (weekends + Tempo-schedule holidays skipped); four independently-loading sections (Tempo worklogs, Jira changelog, Git commits, MR activity) each degrading to per-section empty/error states; Copy-markdown + Refresh
- Standup Notes Today section (STAND-07): open sprint subtasks/tasks (assignee = me) grouped by parent story with nested participating MRs; pinned issues (STAND-08) and Log Work targets (STAND-09) descoped during the in-milestone redesign

### What Worked

- **Cleanup-first sequencing** — opening the milestone with a dedicated tech-debt phase (65) before adding the Standup Notes surface area kept later phases from building on shaky foundations (WorklogsPage timer/error bugs, AIO status map)
- **Removal phases are cheap and high-value** — roles removal (66) + settings cleanup (67) deleted four files, uninstalled four packages, and cut a wizard step while shrinking the store; verified clean via `grep -r` for role conditionals returning zero
- **Shared component extraction at the right moment** — `AioBlock` was extracted from `IntegrationsSection` (171→37 LOC) precisely when the wizard needed the same picker, so Settings and the wizard share one implementation with no duplicate logic
- **Independent-source standup architecture** — each Yesterday/Today source is its own `useQuery` with its own loading/error/empty state, so a disabled or unreachable integration never blanks the page; this degrade-gracefully design held up across the redesign
- **In-milestone redesign honored over spec** — when the Today column's Log Work + pinned sections proved to be noise during live use, dropping them (descoping STAND-08/09) was the right call vs. shipping clutter to satisfy the original requirement wording

### What Was Inefficient

- **Heavy quick-task churn on one surface** — 17 quick tasks, most of them iterative restyling/polish of the Standup Notes page (kfi, rtu, jrz, ltf, kza, g5z); a tighter UI-SPEC before Phase 69/70 might have folded several of these into the planned work
- **VERIFICATION.md gap recurred** — Phase 69 shipped without a VERIFICATION.md (the exact lesson flagged in the v1.9 retro); compensated by 12/12 UAT but still surfaced at milestone-audit time rather than phase close
- **Doc drift on store version** — Phase 66/67 VERIFICATION docs say store `version: 22` while the actual persisted version reached `23` (additive standup-notes migration); the audit caught it as doc-only drift
- **Late descope left dangling artifact** — `TodayColumnPlaceholder.tsx` deletion sat uncommitted in the working tree after the redesign; descopes should be committed atomically with the code that supersedes them

### Patterns Established

- **Runtime config-driven enums over hardcoded maps** — AIO status definitions fetched from `/config` at load with a normalized lookup, resilient to per-instance variation; the pattern generalizes to any vendor-defined ID set
- **Universal-access default** — dropping role gating means every nav item + surface is visible by default; migrations reset visibility maps to all-shown rather than preserving role-derived state
- **"Yesterday" = last working day** — schedule-aware date resolution (skip weekends + Tempo holidays) is the reusable primitive for any standup/recap surface
- **Wizard steps bind directly to the persistent store** — no wizard-local state to reconcile on completion; the wizard is just an alternate entry point to the same settings

### Key Lessons

1. **The VERIFICATION.md-at-phase-close gate is still not enforced** — this is the second consecutive milestone where a missing VERIFICATION.md surfaced at audit time (v1.9: 61/63/64; v1.10: 69). The fix remains the same: refuse to mark a phase complete without the artifact.
2. **Front-load a UI-SPEC for polish-heavy surfaces** — the Standup Notes page absorbed 17 quick tasks of iterative styling; a sharper visual contract before Phase 69 would have converted reactive polish into planned work
3. **Commit descopes atomically with their replacement** — removing Log Work/pinned from Today left a deleted placeholder uncommitted; the supersede and the deletion belong in one commit
4. **Removal phases are some of the highest-ROI work** — roles + dnd-kit removal reduced LOC, dependencies, and store surface with near-zero risk; worth scheduling proactively, not only as cleanup
5. **Keep version-referencing docs in sync with migrations** — additive store migrations (v22→v23) silently outran the verification docs; reference the live `settings.store.ts` version, not a snapshot

### Cost Observations

- Sessions: 15 plans + 17 quick tasks across 6 phases over 3 days, 271 commits
- Notable: the quick-task count (17) exceeded the plan count (15) — this milestone was as much iterative UI refinement as planned feature work, concentrated almost entirely on the Standup Notes page
- Milestone closed at status `tech_debt` (not `passed`): one missing VERIFICATION.md + two `human_needed` verifications, all low-risk and acknowledged

---

## Milestone: v1.11 — GreenHopper API Migration

**Shipped:** 2026-06-01
**Phases:** 5 (71-75) | **Plans:** 22

### What Was Built

- GreenHopper typed adapter layer: `services/jira/greenhopper/` module with `greenhopperFetch` wrapper, 12 response interfaces, `buildEntityMaps` resolvers, `adaptIssue` + `createAdapter`; wired into the project's 60-import `services/jira.ts` barrel; 4 redacted real-world JSON fixtures as vitest data
- Transitions cache: `useGhTransitions` / `getGhTransitions` / `invalidateGhTransitions` keyed by `projectId × issueTypeId → workflow → transitions[]`; per-issue REST `/transitions` GET hard-deleted from both `services/jira.ts` and `services/jira/transitions.ts`
- Sprint board single-call migration: `allData.json` replaces multi-call fetch; `timeInColumn` badge per card; unified "Reload board" toolbar; `fetchSprintSubtasks` hard-deleted; Sidebar prefetch swapped
- Backlog single-call migration: `data.json` replaces paginated REST; 5 mutation cache-invalidation sites migrated; `npm run check:legacy-backlog` static-grep guard prevents legacy symbol reappearance; `fetchBacklogIssues` / `fetchBacklogSprintStories` / `fetchBacklogView` / `BacklogViewData` hard-deleted
- Progressive issue detail rendering: `fetchIssueDetail` decomposed into slim base + 3 independent parallel section queries; TTFMP 1180ms (header); TTI 1682ms (changelog gates "fully loaded"); 200ms-gated per-section skeletons; per-section inline error/retry isolation; fanned-out cache invalidation; perf artifact `docs/perf/75-issue-detail-progressive.md`

### What Worked

- **Fixture-first foundation (Phase 71-01)** — capturing real GreenHopper responses as redacted fixtures before writing any adapter code gave all subsequent tests a realistic data contract; the fixture-driven pattern prevented the "adapter passes fake tests, breaks on real data" failure mode
- **Wave structure with hard-delete gates** — each phase ended with a hard-delete wave that removed the legacy fetcher and confirmed zero references via grep; having an explicit "delete the old thing" step as part of the plan made the migration scope unambiguous
- **Static-grep guard for backlog (Phase 74-01)** — scripting `npm run check:legacy-backlog` in Wave 0 before writing any replacement code meant the guard was already in place by the time the legacy symbols were deleted; it caught regressions in Wave 3 before they reached the full suite
- **Progressive rendering delivered equal UX win at lower risk** — descoping `details.json` migration mid-milestone (Phase 75 rescoped to progressive REST rendering) was the right trade-off: PERF-DETAIL-01/02/03 delivered the same user-facing improvement (no blank panel) without the complexity of migrating the issue detail API path
- **Milestone audit tooling** — running `/gsd-audit-milestone` 7 times across the milestone's lifetime caught real issues (missing barrel export, double-cast, dead query keys) that would otherwise have required manual auditing at close

### What Was Inefficient

- **transitionMutation.onSettled gap caught late** — the missing `invalidateGhAllData` after a status transition from issue detail was a cross-phase wiring gap that went undetected until the final milestone audit (run 1); it was the kind of integration hole that would normally surface during human UAT but the sprint board and issue detail were tested separately
- **WARNING-01/02 as post-audit cleanup** — `fetchIssueChangelog` missing from the `jira.ts` barrel and `buildEntityMaps` unknown-cast in BacklogPage were both post-audit quick-fix commits rather than issues caught at phase close; better phase-end cross-phase integration checks would have closed these during the phases that created them
- **`jira-board-quickfilters` system created and then deleted** — Phase 73 wired `jira-board-quickfilters` invalidation into the Reload board handler, but a post-verification quick task (`e1c098f0`) removed the entire system when it turned out GH allData.json doesn't return quickfilter data; the half-implemented system could have been caught earlier with a real-API integration test

### Patterns Established

- **Fixture-first migration pattern** — for any data-layer migration, capture real API responses as redacted fixtures in Wave 0; all adapter tests run against these fixtures, not synthetic data
- **Hard-delete wave as a migration phase gate** — each migration phase ends with a deletion + grep-guard wave; the phase is not complete until the legacy code is gone and the guard confirms zero references
- **Static-grep guards for banned symbols** — `npm run check:legacy-backlog` is the template; any migration that removes a symbol suite-wide should have a guard that makes reintroduction a CI failure
- **`cache.invalidateGhAllData` as cross-phase coordination point** — any mutation that could affect sprint board state (status transitions, sprint moves) must call `invalidateGhAllData`; this is now the canonical cross-surface invalidation hook

### Key Lessons

1. **Test cross-phase cache invalidation explicitly** — the `transitionMutation.onSettled` gap was a wiring issue that only surfaced at integration time; each mutation should have an explicit test asserting which cache keys it invalidates
2. **Check barrel exports at phase-close** — `fetchIssueChangelog` was added to the greenhopper module but not re-exported via `services/jira.ts`; a simple `grep -c fetchIssueChangelog src/services/jira.ts` check at Phase 75 plan 01 close would have caught it
3. **Validate API response shape assumptions early** — the `columnsData.columns[]` vs CATEGORY_COLUMNS decision (GH-BOARD-03) was forced by a mismatch between what the requirement assumed the API returned and what it actually returned; probe the response shape before speccing the adapter
4. **Descoping mid-milestone is healthy when the UX goal is still met** — the details.json migration was descoped from v1.11 and the user got the same perceived-performance improvement via progressive rendering; staying committed to the original technical scope would have added complexity without user-visible benefit

### Cost Observations

- Sessions: 22 plans across 5 phases over 4 days, 284 commits
- Milestone audit runs: 7 iterations (started at `gaps_found`, closed at `tech_debt` with 10 non-blocking items)
- Notable: the adapter foundation phase (71) with 6 plans was the most front-loaded milestone phase in the project; the investment paid off across all 4 subsequent phases that consumed the adapter without modification

---

## Milestone: v1.12 — Jira Experience Improvements

**Shipped:** 2026-06-07
**Phases:** 5 (76-80) | **Plans:** 19

### What Was Built

- Shared display primitives (`lib/issueDisplayUtils.ts`: `isDoneStatus`/`doneSummaryClass`/`issueTypeStripeClass`) giving the whole app one done-state strike treatment (Backlog, Standup Today, Dashboard) plus a WCAG-tuned issue-type card stripe on the sprint board; priority moved to a `PriorityIcon` footer image. Settings store → v25.
- Universal non-blocking issue peek: a CSS-squeeze slideover (no Dialog/backdrop/focus-trap) mounted at `AppLayout`, powered by a shared `IssueDetailView` extraction; body-click opens peek, key-click navigates full-page, issue-swap without closing, resizable persisted divider. Settings store → v26. Folded in DETAIL-01/02.
- Drag-to-rank on the Backlog: `@dnd-kit` sortable rows, optimistic `PUT /rest/agile/1.0/issue/rank` with `rankCustomFieldId` from cache, flicker gate through background polling, inline rollback.
- Drag-to-transition on the Sprint Board: cards drag between columns; multi-status columns split into per-transition drop zones via a pure `sprintBoardDragHelpers.ts` seam; optimistic move + rollback + board refresh.
- Subtask templates + bulk creation: Settings-managed createmeta-driven templates (`subtask-templates.json`), bulk modal with preview/inline-edit/reorder, sequential creation with per-row progress and retry-failed-only.

### What Worked

- **Shared-primitive-first sequencing** — Phase 76 shipped `issueDisplayUtils` and the settings-store bumps before any consumer phase, so 77-80 (and a swarm of quick tasks) consumed stable utilities without rework. Phase 80 depended only on 76, not the drag phases, which kept it parallelizable.
- **One `@dnd-kit` install for two drag features** — installing in Phase 78 and reusing the `justDragged` disambiguation + Pointer-Events approach in Phase 79 avoided a second integration; route-isolated DndContexts meant the backlog and board never conflicted.
- **Pure-seam extraction for drag logic** — `sprintBoardDragHelpers.ts` (14 tests, no React/dnd-kit imports) made the hardest part of Phase 79 (which transitions are droppable, how columns split) unit-testable in isolation before any UI wiring.
- **CSS-squeeze peek over a modal** — choosing a flex-row squeeze layout instead of a Dialog/Sheet sidestepped the `aria-hidden`/focus-trap/backdrop problems that would have violated the non-blocking requirement; the shared `IssueDetailView` meant peek and full-page never drifted.
- **Quick-task layer carried most of the polish** — ~30 quick tasks (not plans) handled the iterative UX refinement (peek header/elevation, icons, Standup overhaul), keeping the phase plans focused on the load-bearing capabilities.

### What Was Inefficient

- **Priority-stripe → issue-type-stripe churn** — Phase 76 shipped a priority-driven stripe (VISUAL-04/05), then quick task `260606-oyy` reversed it to an issue-type stripe + priority icon, leaving the requirement text, roadmap, and a dead `priorityStripeClass`/`rank.ts` orphaned until a dedicated cleanup task (`260607-ixt`) reconciled them at milestone-audit time. The design wasn't settled before implementation.
- **Peek redesigned repeatedly post-ship** — the peek header, parent-link placement, and Linked-Issues/MR ordering each took several inline UAT iterations across multiple quick tasks (`spj`, `ugr`, `ubz`, `oqf`) rather than landing in the Phase 77 spec.
- **Drag UAT can't fully close on macOS** — the Windows/WebView2 `mouseup`-loss scenario stayed deferred for both drag phases for lack of a Windows host; mitigations are in place but the real-platform check is outstanding.

### Patterns Established

- **Shared display utilities as a phase-zero deliverable** — when multiple surfaces need the same visual treatment, ship the pure utility + store migration first, then wire consumers.
- **Pure drag-logic seam, separate from the dnd-kit wiring** — model "what can be dropped where" as a pure tested function; keep `DndContext`/sensors/overlay in the component.
- **`div[role=button]` body + inner key `<button>` with `stopPropagation`** — the canonical key-vs-body click split, now applied across 6 list surfaces; avoids nested-interactive ARIA violations (use a sibling overlay button when the inner control is also a button).
- **Route-isolated DndContexts** — separate lazy routes never co-mount their drag contexts, so two drag features coexist without a shared coordinator.

### Key Lessons

1. **Settle visual-design decisions before the implementing phase** — the priority-vs-type stripe reversal created dead code and stale requirement text across three documents; a UI spike or sketch before Phase 76 would have avoided the churn and the audit-time cleanup.
2. **Fold expected UX iteration into the phase, or budget it as quick tasks deliberately** — the peek shipped functionally correct but needed ~5 follow-up tasks to feel right; either plan the iterations or accept the quick-task layer as the intended polish mechanism (it worked, but inflated the post-phase task count).
3. **Platform-specific UAT needs the platform** — drag-and-drop in a Tauri WebView2 has Windows-only failure modes (`mouseup` loss) that simply cannot be verified from macOS; acquire a Windows host before committing to drag-heavy milestones, or accept the deferral explicitly up front.
4. **Reconcile requirement text when a quick task reverses a shipped decision** — a mid-milestone reversal should update REQUIREMENTS.md/ROADMAP.md in the same task, not leave it for the milestone audit to catch.

### Cost Observations

- Sessions: 19 plans across 5 phases + ~30 quick tasks over 6 days, 441 commits
- Milestone audit: closed `passed` (32/32) after a same-day re-audit; first pass flagged 2 warnings (dead exports, spec drift) cleared by cleanup commits before re-audit
- Notable: quick tasks outnumbered plans (~30 vs 19) — this milestone's value was as much in the iterative polish layer as in the planned phases; the Standup Notes page alone absorbed ~8 quick tasks despite not being a v1.12 phase

---

## Milestone: v1.13 — Personal Workspace

**Shipped:** 2026-06-16
**Phases:** 6 (81-86) | **Plans:** 23

### What Was Built

- Charting foundation (Phase 81): the app's first charting dependency — Recharts v3 + `react-is` wired through the shadcn `chart` primitive (`components/ui/chart.tsx`), theme-token aware, with a reusable lazy chart-card wrapper that enforces explicit-height + responsive width to defeat Tauri WebKit/WebView2 0×0 collapse (animations off). Human-UAT confirmed.
- My Tasks page (Phase 82): a dedicated `/my-tasks` lazy route + sidebar entry, My Day smart sort, a count/filter strip, rich rows, inline actions, and a sprint↔all-assigned scope toggle backed by `fetchAllSearchPages` server-side pagination. A v27 settings-store migration (`appendMyTasksItemIfMissing`) injects the sidebar entry for existing installs.
- Dashboard build-up then redesign (Phases 83-85 → 86): stat tiles + sprint health (83), trend chart + activity strip (84), probe-gated velocity + burndown insights (85) — then a Phase 86 clean-slate rewrite to the 3 approved screenshot regions (hero + sprint-day subline, MyIssuesCard + UpcomingReleasesTimeline, full-width dual-axis hours/commits chart), deleting all 12 prior widget files and 4 orphaned helpers, zero dead code.

### What Worked

- **Charting-foundation-first, with a mandatory webview UAT gate** — Phase 81 shipped the charting dependency, theme integration, and the WebKit-safe wrapper (explicit-height + `'use no memo'`) before any consumer, and gated on a real Tauri smoke-chart UAT. Every downstream chart inherited a known-good wrapper, so the 0×0-collapse failure class (anticipated from the virtualized-table memory) never recurred.
- **Probe-gated insights kept speculative work cheap** — Phase 85's mandatory live Jira DC probe (no chart code before documented probe results) meant the velocity/burndown work was bounded and verifiable; when the Phase 86 redesign superseded it, only one phase's worth of code was discarded.
- **My Tasks built on existing primitives** — the page reused issue peek, StatusPopover, PriorityIcon, MR-health, and Tempo time data, so the load-bearing new work was the smart-sort ordering and the paginated all-assigned scope, not new infrastructure.
- **Pagination discipline held** — the all-assigned scope used `fetchAllSearchPages` with two named functions, directly applying the fetch-once page-cap memory; no client-side-filter shortcut crept in.

### What Was Inefficient

- **Built three dashboard iterations to ship one** — Phases 83 (stat tiles + sprint health), 84 (trend + activity), and 85 (insights) were largely deleted by the Phase 86 clean-slate redesign to an approved screenshot. ~11 plans of dashboard work collapsed into the final 4-plan redesign. The screenshot target arrived after the incremental build, not before it.
- **DASH-06 MR review queue built then rejected at UAT** — the review queue was implemented in Phase 84 and removed by product decision during UAT, a full round-trip of build-then-discard.
- **Requirement reconciliation deferred to a cleanup task again** — INSIGHT-01/02 stayed listed as "Pending (Conditional)" and orphaned `ChartWrapper`/burndown types lingered until quick-260616-mmw reconciled them at audit time — the same lag pattern flagged in the v1.12 retrospective.
- **MYTASK-01 sidebar-migration gap caught by audit, not by the phase** — Phase 82 added the nav item but not the store migration to inject it for existing installs; the milestone audit surfaced it as a blocker, fixed in quick-260616-ktv.

### Patterns Established

- **Charting wrapper as a phase-zero deliverable** — when introducing a webview-fragile rendering dependency, ship the safe wrapper (explicit-height, responsive, `'use no memo'`, animations off) + a real-platform UAT before any consumer.
- **Probe-before-code for cost-uncertain integrations** — gate speculative data work (closed-sprint velocity, GreenHopper burndown) on a documented live probe; build nothing until the data is confirmed obtainable at acceptable cost.
- **New sidebar nav item ⇒ settings-store migration** — a persisted sidebar list means any new nav entry needs an `append…IfMissing` migration (now v21 worklogs / v23 standup / v27 my-tasks) or it stays invisible to existing users.

### Key Lessons

1. **Get the visual target before the incremental build, not after** — three phases of dashboard work (83-85) were largely discarded once the screenshot redesign (86) defined the real target. A sketch/spike of the final layout before Phase 83 would have saved ~11 plans of build-then-delete. This is the v1.12 "settle design first" lesson at milestone scale.
2. **A persisted-store feature isn't done until its migration ships** — a new sidebar entry, store field, or default is invisible/broken for existing installs without an explicit version migration; treat the migration as part of the phase's definition of done, not an audit-time fix.
3. **Reconcile requirement/traceability text in the same task that changes scope** — INSIGHT-01/02 retirement and the descope of DASH-06 should have updated REQUIREMENTS.md as they happened, not at audit time (carried verbatim from the v1.12 retrospective — still unaddressed).
4. **Probe-gating works — extend it** — the Phase 85 probe-first discipline made discarding the insights cheap and clean; apply the same "prove it's viable before building" gate to any future cost-uncertain or platform-uncertain capability.

### Cost Observations

- Sessions: 23 plans across 6 phases + a tech-debt cleanup quick-task wave over 9 days, 411 commits
- Milestone audit: closed `tech_debt` (0 blockers); 17/18 committed requirements satisfied, DASH-06 descoped, INSIGHT-01/02 retired; 81 cross-project historical-noise items acknowledged as deferred
- Notable: high deletion ratio (+41,255/−21,884) reflects the build-then-redesign dashboard churn — roughly a third of the milestone's line changes were removals, much of it self-inflicted by superseding Phases 83-85 with Phase 86

---

## Cross-Milestone Trends

| Metric | v1.0 | v1.1 | v1.2 | v1.3 | v1.4 | v1.5 | v1.6.3 | v1.7 | v1.8 | v1.9 | v1.10 | v1.11 | v1.12 | v1.13 |
|--------|------|------|------|------|------|------|--------|------|------|------|-------|-------|-------|-------|
| Phases | 4 | 4 (5-8) | 9 (9-17) | 7 (18-24) | 6 (25-30) | 7 (31-37) | 4 (38-41) | 9 (42-49) | 9 (50-58) | 6 (59-64) | 6 (65-70) | 5 (71-75) | 5 (76-80) | 6 (81-86) |
| Plans | 20 | 24 | 29 | 27 | 21 | 25 | 10 | 23 | 45 | 20 | 15 | 22 | 19 | 23 |
| Quick tasks | 0 | 20 | 0 | 40+ | 2 | 6 | 13 | 20+ | n/a | 10 | 17 | — | ~30 | few |
| Timeline (days) | 2 | 2 | 2 | 5 | 2 | 4 | 6 | 8 | 7 | 4 | 3 | 4 | 6 | 9 |
| LOC (TypeScript) | ~11,017 | ~15,856 | ~23,607 | ~32,173 | ~37,520 | ~45k* | ~51,536 | ~57,000+ | ~68,000+ | ~73,264 | ~80,895 | ~80,895+ | ~80,895+ | ~80,895+ |
| Gap/fix plans | 7 (35%) | 7 (29%) | 6 (21%) | 2 (7%) | 1 (5%) | 7 (28%) | 0 (0%) | 5 (22%) | n/a | 3 (15%) | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) |
| Requirements hit | 35/35 (100%) | 22/22 (100%) | 27/27 (100%) | 31/31 (100%) | 27/27 (100%) | 30/34 (88%)** | 15/15 (100%) | 17/17 (100%) | n/a | 19/19 (100%)*** | 27/29 (93%)**** | 17/17 (100%) | 32/32 (100%) | 17/18 (94%)***** |

\* v1.5 LOC corrected from previous ~633k count
\*\* 4 requirements user-deferred (bulk operations BOARD-04–07)
\*\*\* 17 base v1.9 + 2 TEMPO-08/TEMPO-EDIT-01 pulled forward from v2 (Phase 64)
\*\*\*\* 27/27 in-scope satisfied; STAND-08 + STAND-09 descoped by user during Phase 70 redesign
\*\*\*\*\* 17/18 committed satisfied; DASH-06 (MR review queue) descoped at Phase 84 UAT; INSIGHT-01/02 conditional insights built in Phase 85 then retired by the Phase 86 redesign
