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

## Cross-Milestone Trends

| Metric | v1.0 | v1.1 |
|--------|------|------|
| Phases | 4 | 4 (5-8) |
| Plans | 20 | 24 |
| Quick tasks | 0 | 20 |
| Timeline (days) | 2 | 2 |
| LOC (TypeScript) | ~11,017 | ~15,856 |
| UAT gap plans | 7 (35% of total) | 7 (29% of total) |
| Requirements hit | 35/35 (100%) | 22/22 (100%) |
