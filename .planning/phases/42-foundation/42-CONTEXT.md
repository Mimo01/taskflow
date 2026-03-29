# Phase 42: Foundation - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

App startup is faster and component re-renders are eliminated automatically. This phase delivers route-level code splitting, React Compiler integration, and bundle analysis with dead code elimination. Skeleton screens and data-loading UX belong to Phase 44.

</domain>

<decisions>
## Implementation Decisions

### Code Splitting Strategy
- **D-01:** Lazy-load only the 6 heavy routes: sprint board, backlog, issue detail, epics, workload, sprint progress
- **D-02:** Keep onboarding, dashboard shell, settings, my-tasks, MR pages, releases, dev-tools as eager imports for instant navigation
- **D-03:** One chunk per lazy route — no domain grouping. Each of the 6 heavy routes gets its own separate chunk

### Skeleton Fallback UX
- **D-04:** Simple centered spinner as the Suspense fallback while lazy route chunks load — chunk loads are fast (local files), elaborate skeletons here are redundant with Phase 44
- **D-05:** Error boundary shows "Something went wrong loading this page" with a Retry button (reloads the chunk) and a link back to dashboard. Reuses existing ErrorPage styling from `src/routes/error/ErrorPage.tsx`

### React Compiler
- **D-06:** Enable React Compiler globally across the entire codebase — auto-memoizes all components and hooks. No per-directory opt-in
- **D-07:** Pin `babel-plugin-react-compiler` to exact version `1.0.0` — compiler upgrades should be deliberate
- **D-08:** Remove existing manual `memo`, `useMemo`, and `useCallback` calls in this phase — the compiler handles memoization automatically and keeping both is noise

### Bundle Analysis
- **D-09:** Use `rollup-plugin-visualizer` with env-flag opt-in (`ANALYZE=true vite build`) — not part of normal builds
- **D-10:** Generate the analysis report AND act on findings — eliminate any dead code or oversized dependencies discovered. Deliver actual size reduction, not just a report

### Claude's Discretion
- Exact spinner component/styling for the lazy route Suspense fallback
- Error boundary retry mechanism implementation details
- Which specific manual memo/useMemo/useCallback calls to remove (all of them, per D-08)
- How to structure the bundle analysis findings (inline comments, separate doc, etc.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Route system
- `taskflow/src/routes/routes.tsx` — Current route definitions (all 16 routes, all eager imports)
- `taskflow/src/main.tsx` — Router setup (`createHashRouter`, `RouterProvider`, `QueryClientProvider`)
- `taskflow/src/routes/error/ErrorPage.tsx` — Existing error page component to reuse for error boundaries

### Build configuration
- `taskflow/vite.config.ts` — Current Vite 8 config (plugins, defines, server settings)
- `taskflow/package.json` — Dependencies: React 19.1, Vite 8, @vitejs/plugin-react v6

### Research
- `.planning/research/STACK.md` — v1.7 stack research: React Compiler setup, rollup-plugin-visualizer, @rolldown/plugin-babel configuration examples

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ErrorPage` component (`src/routes/error/ErrorPage.tsx`): Already handles route-level errors via `errorElement` on the router — can be adapted for chunk-load error boundaries
- Spinner patterns: Existing loading states across views use similar spinner patterns that can inform the Suspense fallback

### Established Patterns
- `createHashRouter` with a single `AppLayout` wrapper and flat `children: routes` array — lazy routes slot in via `React.lazy()` + `<Suspense>` in the route config
- Vite 8 + `@vitejs/plugin-react` v6 with `@tailwindcss/vite` — React Compiler integrates via `reactCompilerPreset` helper from the plugin
- `@rolldown/plugin-babel` is the correct Babel pipeline for Vite 8/Rolldown (legacy `rollup-plugin-babel` does not work)

### Integration Points
- `routes.tsx` — Convert 6 heavy route imports from static to `React.lazy()`
- `vite.config.ts` — Add React Compiler via `@rolldown/plugin-babel` + `reactCompilerPreset`, add conditional `rollup-plugin-visualizer`
- `package.json` — Add 3 dev dependencies: `babel-plugin-react-compiler@1.0.0`, `@rolldown/plugin-babel`, `rollup-plugin-visualizer`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 42-foundation*
*Context gathered: 2026-03-29*
