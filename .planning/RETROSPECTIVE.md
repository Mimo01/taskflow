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

## Cross-Milestone Trends

| Metric | v1.0 | v1.1 | v1.2 | v1.3 |
|--------|------|------|------|------|
| Phases | 4 | 4 (5-8) | 9 (9-17) | 7 (18-24) |
| Plans | 20 | 24 | 29 | 27 |
| Quick tasks | 0 | 20 | 0 | 40+ |
| Timeline (days) | 2 | 2 | 2 | 5 |
| LOC (TypeScript) | ~11,017 | ~15,856 | ~23,607 | ~32,173 |
| Gap/fix plans | 7 (35%) | 7 (29%) | 6 (21%) | 2 (7%) |
| Requirements hit | 35/35 (100%) | 22/22 (100%) | 27/27 (100%) | 31/31 (100%) |
