# Requirements: Taskflow

**Defined:** 2026-03-29
**Core Value:** Developers and PMs can see everything they need — tasks, MRs, sprint state, and notifications — in one place, without switching between Jira and GitLab.

## v1.7 Requirements

Requirements for v1.7 Performance & Perceived Speed. Each maps to roadmap phases.

### Loading UX

- [x] **LOAD-01**: User sees layout-matched skeleton screens instead of spinners on all major data views (sprint board, backlog, my tasks, workload, epics, releases, notifications, dashboard widgets)
- [ ] **LOAD-02**: User sees cached data instantly when navigating back to a previously visited view (stale-while-revalidate)
- [ ] **LOAD-03**: User sees sprint board story headers immediately while subtasks load progressively beneath them
- [ ] **LOAD-04**: User sees backlog issue list immediately while epic metadata loads progressively
- [x] **LOAD-05**: User does not see skeleton flicker when data loads within 200ms (delayed loading hook)

### Route & Bundle

- [ ] **ROUT-01**: App startup is faster with heavy routes (sprint board, backlog, issue detail, epics, workload, sprint progress) loaded on demand via code splitting
- [ ] **ROUT-02**: User sees a skeleton fallback (not blank screen) while a lazy-loaded route chunk loads
- [ ] **ROUT-03**: User sees a meaningful error boundary (not white screen) when a lazy-loaded chunk fails
- [x] **ROUT-04**: React Compiler auto-memoizes all components at build time, eliminating manual memo overhead
- [x] **ROUT-05**: Bundle analysis identifies and eliminates dead code or oversized dependencies

### Query Optimization

- [ ] **QOPT-01**: Sprint board loads faster by parallelizing independent API calls (sprint metadata + quick filters fetched simultaneously)
- [ ] **QOPT-02**: Backlog loads faster by parallelizing independent queries where dependency chains allow
- [ ] **QOPT-03**: User experiences pre-warmed cache when clicking sidebar navigation (data prefetched on hover/focus)
- [ ] **QOPT-04**: App pauses polling for views not currently visible (smart polling with background pause)
- [ ] **QOPT-05**: App pauses all polling when minimized and refetches active view on restore (visibility-aware polling)

### Caching

- [ ] **CACH-01**: Avatar and user images are cached in memory during the session (no re-fetch on re-render)
- [ ] **CACH-02**: Avatar cache persists to disk and survives app restarts (via @tauri-apps/plugin-fs)

## Future Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Advanced Optimization

- **ADVN-01**: Memoization audit driven by React DevTools profiler data (targeted, not blanket)
- **ADVN-02**: Infinite scroll replacing pagination in backlog
- **ADVN-03**: TanStack Router migration with built-in lazy routes and loaders

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Service Worker caching | Tauri uses plugin-http which bypasses webview fetch — Service Workers cannot intercept |
| WebSocket/SSE real-time updates | Jira DC on-premise has no WebSocket support; GitLab webhooks require a server |
| Global `staleTime: Infinity` | Breaks optimistic mutation rollbacks on sprint board drag-to-transition |
| Web Workers for parallelization | Thread contention is not the bottleneck; sequential await chains are |
| Streaming/chunked API responses | Jira REST API v2 does not support streaming |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LOAD-01 | Phase 44 | Complete |
| LOAD-02 | Phase 43 | Pending |
| LOAD-03 | Phase 44 | Pending |
| LOAD-04 | Phase 44 | Pending |
| LOAD-05 | Phase 44 | Complete |
| ROUT-01 | Phase 42 | Pending |
| ROUT-02 | Phase 42 | Pending |
| ROUT-03 | Phase 42 | Pending |
| ROUT-04 | Phase 42 | Complete |
| ROUT-05 | Phase 42 | Complete |
| QOPT-01 | Phase 45 | Pending |
| QOPT-02 | Phase 45 | Pending |
| QOPT-03 | Phase 45 | Pending |
| QOPT-04 | Phase 43 | Pending |
| QOPT-05 | Phase 43 | Pending |
| CACH-01 | Phase 46 | Pending |
| CACH-02 | Phase 46 | Pending |

**Coverage:**
- v1.7 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-29*
*Last updated: 2026-03-29 after roadmap creation (phases 42-46)*
