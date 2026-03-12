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

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Phases | 4 |
| Plans | 20 |
| Timeline (days) | 2 |
| LOC (TypeScript) | ~11,017 |
| UAT gap plans | 7 (35% of total) |
| Requirements hit | 35/35 (100%) |
