### Phase 86: Redesign dashboard to new screenshot layout and remove old widgets

**Goal:** The Dashboard renders exactly the 3 approved screenshot regions — hero greeting with sprint-day subline, a top row of MY ISSUES (segmented sprint-progress, issue counts) + UPCOMING RELEASES (up-to-3-dot readiness timeline), and a full-width PAST 7 DAYS dual-axis hours/commits chart — all from existing data sources (no new API surface), with every old Phase 83–85 widget deleted and zero dead code (npm run check GREEN).
**Requirements**: D-01..D-14 (CONTEXT decisions — see 86-CONTEXT.md)
**Depends on:** Phase 85
**Plans:** 3/4 plans executed

Plans:
- [x] 86-01-PLAN.md — MyIssuesCard + UpcomingReleasesTimeline (top-row cards, D-02..D-08) [wave 1]
- [x] 86-02-PLAN.md — HoursCommitsChart dual-axis rolling-7 chart (D-09..D-12, D-14) [wave 1]
- [x] 86-03-PLAN.md — Rewrite index.tsx (3-region + sprint-day subline) + delete old widgets/helpers + extend removal guard (D-01, D-13) [wave 2]
- [ ] 86-04-PLAN.md — Human UAT: dual-axis chart + visual fidelity in Tauri WebKit (D-10, D-14) [wave 3]
