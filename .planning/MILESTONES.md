# Milestones

## v1.0 MVP (Shipped: 2026-03-12)

**Phases completed:** 4 phases, 20 plans
**Timeline:** 2026-03-10 → 2026-03-12 (2 days)
**Codebase:** ~11,017 lines TypeScript, 348 files
**Git range:** feat(01-01) → style(04)

**Key accomplishments:**
1. Tauri 2 portable desktop app with OS keychain PAT storage (Stronghold), CORS-free Jira/GitLab access, and cross-platform portable build
2. Developer dashboard: My Tasks, Sprint Board, and MR Attention tabs with live 60s polling and last-refreshed timestamps
3. Automatic task-to-MR linking via Jira ticket key parsing from MR titles and commit messages, with review health badges
4. Jira write actions: workflow status transitions (optimistic update + rollback) and inline comments with per-row error recovery
5. Unified notifications hub: Jira mentions + GitLab MR thread activity, OS desktop notifications, in-app badge, read/unread state
6. PM dashboards (sprint progress, team workload, releases with GitLab milestone links) and global search across all Jira tasks and MRs

---

