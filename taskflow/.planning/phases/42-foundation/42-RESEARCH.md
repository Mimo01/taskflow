# Phase 42: Foundation - Research

**Researched:** 2026-03-29
**Domain:** React code splitting, React Compiler, Vite bundle analysis — Tauri 2 / React 19 / Vite 8 desktop app
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Lazy-load only the 6 heavy routes: sprint board, backlog, issue detail, epics, workload, sprint progress
- **D-02:** Keep onboarding, dashboard shell, settings, my-tasks, MR pages, releases, dev-tools as eager imports for instant navigation
- **D-03:** One chunk per lazy route — no domain grouping. Each of the 6 heavy routes gets its own separate chunk
- **D-04:** Simple centered spinner as the Suspense fallback while lazy route chunks load — chunk loads are fast (local files), elaborate skeletons here are redundant with Phase 44
- **D-05:** Error boundary shows "Something went wrong loading this page" with a Retry button (reloads the chunk) and a link back to dashboard. Reuses existing ErrorPage styling from `src/routes/error/ErrorPage.tsx`
- **D-06:** Enable React Compiler globally across the entire codebase — auto-memoizes all components and hooks. No per-directory opt-in
- **D-07:** Pin `babel-plugin-react-compiler` to exact version `1.0.0` — compiler upgrades should be deliberate
- **D-08:** Remove existing manual `memo`, `useMemo`, and `useCallback` calls in this phase — the compiler handles memoization automatically and keeping both is noise
- **D-09:** Use `rollup-plugin-visualizer` with env-flag opt-in (`ANALYZE=true vite build`) — not part of normal builds
- **D-10:** Generate the analysis report AND act on findings — eliminate any dead code or oversized dependencies discovered. Deliver actual size reduction, not just a report

### Claude's Discretion

- Exact spinner component/styling for the lazy route Suspense fallback
- Error boundary retry mechanism implementation details
- Which specific manual memo/useMemo/useCallback calls to remove (all of them, per D-08)
- How to structure the bundle analysis findings (inline comments, separate doc, etc.)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROUT-01 | App startup is faster with heavy routes (sprint board, backlog, issue detail, epics, workload, sprint progress) loaded on demand via code splitting | `React.lazy()` + dynamic imports in `routes.tsx` split each heavy route into its own chunk; Vite 8 automatic code splitting handles chunk emission |
| ROUT-02 | User sees a skeleton fallback (not blank screen) while a lazy-loaded route chunk loads | `<Suspense fallback={<RouteSpinner />}>` wrapping each lazy route; `RouteSpinner` is a centered `Loader2` spinner per UI-SPEC |
| ROUT-03 | User sees a meaningful error boundary (not white screen) when a lazy-loaded chunk fails | `ChunkErrorBoundary` class component (React class error boundaries required for catching render-phase errors including lazy load failures); adapts `ErrorPage` styling |
| ROUT-04 | React Compiler auto-memoizes all components at build time, eliminating manual memo overhead | `babel-plugin-react-compiler@1.0.0` + `@rolldown/plugin-babel` in `vite.config.ts` via `reactCompilerPreset`; 133 existing useMemo/useCallback/memo calls to remove |
| ROUT-05 | Bundle analysis identifies and eliminates dead code or oversized dependencies | `rollup-plugin-visualizer@7.0.1` with `ANALYZE=true` env-flag opt-in; run, inspect, act on findings |
</phase_requirements>

---

## Summary

Phase 42 delivers three independent but reinforcing changes to app startup performance: route-level code splitting via `React.lazy`, React Compiler auto-memoization at build time, and a one-time bundle analysis pass to eliminate dead code.

The codebase is well-positioned for this phase. All 16 routes are currently defined as flat eager imports in `routes.tsx`. Converting the 6 heavy routes to `React.lazy()` is a surgical change — no router config restructuring needed since `createHashRouter` with the flat `children: routes` array already supports lazy routes with `<Suspense>` wrapping. The router setup in `main.tsx` already has `errorElement: <ErrorPage />` at the root — the chunk-load error boundary is a new `ChunkErrorBoundary` class component that wraps each lazy route individually (not the router root) and reuses `ErrorPage` styling.

React Compiler integration requires two new dev dependencies (`babel-plugin-react-compiler@1.0.0` and `@rolldown/plugin-babel@^0.2.0`) and a small `vite.config.ts` change. The codebase has 133 existing `useMemo`/`useCallback`/`React.memo` call sites across ~30 files — all of these are removed per D-08. `rollup-plugin-visualizer@7.0.1` is the bundle analysis tool, wired as `ANALYZE=true vite build` and never part of the normal build pipeline.

**Primary recommendation:** Three discrete work units in dependency order — (1) lazy routes + Suspense fallback + error boundary, (2) React Compiler + memo removal, (3) bundle analysis + dead code elimination.

---

## Standard Stack

### Core (this phase — no new runtime dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `React.lazy` + `Suspense` | React 19 built-in | Route-level code splitting | Zero-dependency, Vite auto-splits each dynamic import into its own chunk |
| `react-router-dom` | `^7.13.1` (existing) | `createHashRouter` — flat `children: routes` already supports lazy routes | Already in project |

### New Dev Dependencies
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `babel-plugin-react-compiler` | `1.0.0` (exact pin, per D-07) | React Compiler — auto-memoizes components and hooks at build time | React Compiler 1.0 stable; React 19 native — no runtime shim needed |
| `@rolldown/plugin-babel` | `^0.2.0` (current: 0.2.2) | Babel transform pipeline for Vite 8 / Rolldown | Vite 8 uses Rolldown; legacy `rollup-plugin-babel` does NOT work |
| `rollup-plugin-visualizer` | `^7.0.1` (current: 7.0.1) | Interactive treemap of production bundle | Established, well-documented; one-time analysis |

**Version verification (confirmed 2026-03-29 via npm registry):**
- `babel-plugin-react-compiler`: latest = `1.0.0`
- `@rolldown/plugin-babel`: latest = `0.2.2`
- `rollup-plugin-visualizer`: latest = `7.0.1`

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@rolldown/plugin-babel` | `vite-plugin-babel` or `rollup-plugin-babel` | Both are incompatible with Vite 8 / Rolldown; `@rolldown/plugin-babel` is the correct peer dep for `@vitejs/plugin-react` v6 |
| Full compiler mode | `compilationMode: 'annotation'` (opt-in per component) | Per D-06, full global mode is the decision; annotation mode is a fallback only if a specific component misbehaves |
| `rollup-plugin-visualizer` | `vite-bundle-analyzer` (nonzzz) | Either works; visualizer has longer track record |

**Installation:**
```bash
# From taskflow/ directory
npm install --save-dev --save-exact babel-plugin-react-compiler@1.0.0
npm install --save-dev @rolldown/plugin-babel
npm install --save-dev rollup-plugin-visualizer
```

---

## Architecture Patterns

### Existing Structure (no changes needed)
```
taskflow/src/
├── routes/
│   ├── routes.tsx          # MODIFY: convert 6 heavy routes to React.lazy()
│   ├── error/ErrorPage.tsx # REUSE: styling reference for ChunkErrorBoundary
│   └── dashboard/          # Heavy route components live here
├── components/
│   ├── ui/
│   │   └── route-spinner.tsx     # NEW: centered Loader2 spinner (Suspense fallback)
│   └── ChunkErrorBoundary.tsx    # NEW: class error boundary for chunk failures
├── main.tsx                # MODIFY: wrap route outlet with <Suspense>
└── vite.config.ts (root)  # MODIFY: add babel plugin + visualizer
```

### Pattern 1: React.lazy Route Conversion
**What:** Replace static imports with `React.lazy()` + dynamic imports for the 6 heavy routes
**When to use:** Any component whose module would otherwise be in the initial bundle but is not needed at startup

```typescript
// Source: STACK.md (verified against react.dev/learn/react-compiler)
// routes.tsx — before
import SprintBoardTab from './dashboard/SprintBoardTab';
import BacklogPage from './dashboard/BacklogPage';
import IssueDetailPage from './dashboard/IssueDetailPage';
import EpicsPage from './dashboard/EpicsPage';
import WorkloadTab from './dashboard/WorkloadTab';
import SprintProgressTab from './dashboard/SprintProgressTab';

// routes.tsx — after
import React from 'react';
const SprintBoardTab    = React.lazy(() => import('./dashboard/SprintBoardTab'));
const BacklogPage       = React.lazy(() => import('./dashboard/BacklogPage'));
const IssueDetailPage   = React.lazy(() => import('./dashboard/IssueDetailPage'));
const EpicsPage         = React.lazy(() => import('./dashboard/EpicsPage'));
const WorkloadTab       = React.lazy(() => import('./dashboard/WorkloadTab'));
const SprintProgressTab = React.lazy(() => import('./dashboard/SprintProgressTab'));
```

Keep as eager (D-02): `Onboarding`, `Dashboard`, `Settings`, `MyTasksTab`, `MrAttentionTab`, `ReleasesTab`, `ReleaseDetailPage`, `DevTools`, `MergeRequestListPage`, `MergeRequestDetailPage`.

### Pattern 2: Suspense Wrapping in routes.tsx
**What:** Each lazy route's `element` is wrapped in `<ChunkErrorBoundary>` then `<Suspense>`
**Why in routes.tsx:** Keeps the wrapping co-located with the lazy import; no change needed in `main.tsx`

```typescript
// routes.tsx — lazy route entries
import { Suspense } from 'react';
import { RouteSpinner } from '../components/ui/route-spinner';
import { ChunkErrorBoundary } from '../components/ChunkErrorBoundary';

// Each lazy route entry in the routes array:
{
  path: '/sprint-board',
  element: (
    <ChunkErrorBoundary>
      <Suspense fallback={<RouteSpinner />}>
        <SprintBoardTab />
      </Suspense>
    </ChunkErrorBoundary>
  )
}
```

### Pattern 3: RouteSpinner Component (per UI-SPEC)
**What:** Centered `Loader2` spinner with accessible label — Suspense fallback during chunk load

```typescript
// src/components/ui/route-spinner.tsx
// Source: UI-SPEC 42-UI-SPEC.md
import { Loader2 } from 'lucide-react';

export function RouteSpinner() {
  return (
    <div
      role="status"
      aria-label="Loading page"
      className="min-h-screen flex items-center justify-center"
    >
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
}
```

### Pattern 4: ChunkErrorBoundary Class Component (per UI-SPEC)
**What:** React class error boundary — catches chunk-load failures and renders ErrorPage-styled fallback
**Critical:** Must be a class component. React functional components cannot be error boundaries. `componentDidCatch` is the only mechanism to catch render-phase errors including dynamic import failures.

```typescript
// src/components/ChunkErrorBoundary.tsx
// Source: UI-SPEC 42-UI-SPEC.md + React docs on Error Boundaries
import React from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; }

export class ChunkErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="max-w-lg w-full space-y-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex items-center justify-center size-14 rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="size-7" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Something went wrong loading this page
              </h1>
              <p className="text-sm text-muted-foreground max-w-sm">
                The page failed to load. Check your connection and try again.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="ghost" size="lg" onClick={() => window.location.reload()}>
                <RefreshCw />
                Retry Loading
              </Button>
              <Button size="lg" onClick={() => window.location.assign('/#/dashboard')}>
                <Home />
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**Note on "Go to Dashboard" navigation:** `ChunkErrorBoundary` is a class component outside React Router's context tree at render time (error state). Use `window.location.assign('/#/dashboard')` (hash router path) rather than `useNavigate()` which is unavailable in class components.

### Pattern 5: React Compiler via vite.config.ts
**What:** Add `@rolldown/plugin-babel` with `reactCompilerPreset` to the Vite plugins array

```typescript
// taskflow/vite.config.ts — add after existing plugins
// Source: STACK.md (verified against react.dev/learn/react-compiler/installation)
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';

// In plugins array:
plugins: [
  tailwindcss(),
  react(),
  babel({ presets: [reactCompilerPreset()] }),
]
```

**Full mode** (no `compilationMode` option) — global compilation of all components. Components that fail compiler rules are silently skipped; they still render correctly, just without auto-memoization.

### Pattern 6: rollup-plugin-visualizer (env-flag opt-in)

```typescript
// taskflow/vite.config.ts
// Source: STACK.md, rollup-plugin-visualizer README
import { visualizer } from 'rollup-plugin-visualizer';

// In plugins array, conditional:
...(process.env.ANALYZE === 'true'
  ? [visualizer({ open: true, gzipSize: true, brotliSize: true })]
  : []),
```

Run as: `ANALYZE=true vite build` — opens `stats.html` treemap in browser automatically.

### Anti-Patterns to Avoid
- **Keeping existing `useMemo`/`useCallback`/`React.memo` calls alongside the compiler:** Per D-08, all existing manual memoization is removed. Having both is noise — the compiler's memoization is more precise.
- **Using `reactCompilerPreset` without `@rolldown/plugin-babel`:** The `reactCompilerPreset` helper is exported from `@vitejs/plugin-react` v6 but requires `@rolldown/plugin-babel` as the pipeline. `vite-plugin-babel` and `rollup-plugin-babel` are not compatible with Vite 8 / Rolldown.
- **Putting `<Suspense>` above `<ChunkErrorBoundary>`:** Error boundary must be the outer wrapper. If `<Suspense>` is outer, the error boundary catches Suspense errors too, not just chunk failures.
- **Using `useNavigate` in ChunkErrorBoundary:** Class components cannot use hooks. Navigate via `window.location.assign`.
- **Adding `rollup-plugin-visualizer` unconditionally:** Adds overhead and auto-opens a browser tab on every build. The `ANALYZE=true` guard is mandatory per D-09.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Component memoization | Manual `React.memo` / `useMemo` / `useCallback` audit | `babel-plugin-react-compiler` | Compiler is more precise than human annotation — it tracks dependency graphs at the IR level, not the source level. 133 existing manual calls in this codebase alone |
| Bundle visualization | Custom Rollup stats script | `rollup-plugin-visualizer` | Produces interactive treemap, gzip + brotli sizes, module hierarchy — 7 years of maintained feature set |
| Chunk-load error recovery | Custom error handling in route components | React class error boundary pattern | Dynamic import failures throw during render, not in async code — only `componentDidCatch` / `getDerivedStateFromError` can catch them |

**Key insight:** React Compiler 1.0 (stable, Oct 2025) eliminates the need for any manual memoization audit. The compiler's IR-level analysis is more complete and accurate than any human-driven annotation pass, especially at this codebase's scale.

---

## Common Pitfalls

### Pitfall 1: Keeping Manual Memo Alongside React Compiler
**What goes wrong:** No immediate crash, but double-memoization creates maintenance confusion. Future devs don't know which memo calls are "owned" by the compiler vs hand-written. Compiler may re-memoize already-memoized components, which is safe but redundant.
**Why it happens:** Developers are cautious about removing existing annotations "just in case"
**How to avoid:** Remove ALL `React.memo()`, `useMemo()`, `useCallback()` per D-08 in the same PR as enabling the compiler
**Warning signs:** Any remaining `React.memo(` or `useMemo(` import after compiler is enabled

### Pitfall 2: Wrong Babel Plugin for Vite 8
**What goes wrong:** `vite-plugin-babel` or `rollup-plugin-babel` silently fail or throw build errors with Vite 8 / Rolldown. React Compiler transform never runs.
**Why it happens:** Legacy babel plugins don't implement the Rolldown plugin interface
**How to avoid:** Use only `@rolldown/plugin-babel` — it is the officially designated peer dep for `@vitejs/plugin-react` v6's `reactCompilerPreset`
**Warning signs:** Build completes without error but React DevTools does not show compiler annotations; or build fails with "plugin hook not implemented" style errors

### Pitfall 3: Error Boundary Inside Suspense (wrong nesting order)
**What goes wrong:** `<ChunkErrorBoundary>` inside `<Suspense>` means the error boundary never sees the chunk-load failure — Suspense intercepts the thrown promise first and shows the fallback instead of the error UI
**Why it happens:** Intuitive nesting (error boundary "closer" to the component) is actually wrong for this case
**How to avoid:** `<ChunkErrorBoundary>` must be the OUTER wrapper, `<Suspense>` the inner:
```tsx
<ChunkErrorBoundary>
  <Suspense fallback={<RouteSpinner />}>
    <SprintBoardTab />
  </Suspense>
</ChunkErrorBoundary>
```
**Warning signs:** Error state shows spinner indefinitely rather than error message

### Pitfall 4: React.lazy on Already-Rendered Components (Strict Mode double-invoke)
**What goes wrong:** In development with React StrictMode (which is enabled in `main.tsx`), components render twice. For lazy-loaded components, this means the dynamic import fires twice on first mount.
**Why it happens:** React StrictMode intentional double-invoke for detecting side effects
**How to avoid:** This is expected, not a bug. Dynamic imports are cached by the JS module system after the first call — second call returns the cached module. No action needed.
**Warning signs:** Console warnings about loading the same chunk twice in dev only — harmless

### Pitfall 5: `ANALYZE=true` Leaking into Production Builds
**What goes wrong:** `rollup-plugin-visualizer` with `open: true` auto-opens a browser tab on every CI/production build, and generates a `stats.html` artifact that adds noise to dist output
**Why it happens:** Plugin is unconditionally included in the plugins array
**How to avoid:** The `process.env.ANALYZE === 'true'` conditional guard is mandatory. Never include visualizer unconditionally.
**Warning signs:** `stats.html` appearing in `taskflow/dist/` on normal builds

### Pitfall 6: Dead Code Elimination Without Verifying Actual Usage
**What goes wrong:** Bundle analysis identifies large modules — developer removes them without checking if they are used at runtime (e.g., tree-shaken but still needed for side effects)
**Why it happens:** Visualizer shows static bundle size, not runtime call graphs
**How to avoid:** For each "dead code candidate" identified in the visualizer: search for import statements, check if used via barrel re-exports, verify TypeScript build still passes after removal
**Warning signs:** TypeScript type errors or runtime `undefined` after removing a "dead" module

---

## Code Examples

### Complete vite.config.ts with React Compiler + Visualizer

```typescript
// taskflow/vite.config.ts
// Source: STACK.md (verified against react.dev/learn/react-compiler/installation)
import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";
import { execSync } from "child_process";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

function gitVersion(): string { /* unchanged */ }
function gitSha(): string { /* unchanged */ }

export default defineConfig(async () => ({
  plugins: [
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    ...(process.env.ANALYZE === 'true'
      ? [visualizer({ open: true, gzipSize: true, brotliSize: true })]
      : []),
  ],
  // ... rest unchanged
}));
```

### Lazy Routes Array (routes.tsx)

```typescript
// Source: STACK.md + routes.tsx current state
import type { RouteObject } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { RouteSpinner } from '../components/ui/route-spinner';
import { ChunkErrorBoundary } from '../components/ChunkErrorBoundary';

// Eager (instant navigation, small modules):
import Dashboard from './dashboard/index';
import Onboarding from './onboarding/index';
import Settings from './settings/index';
import MyTasksTab from './dashboard/MyTasksTab';
import MrAttentionTab from './dashboard/MrAttentionTab';
import ReleasesTab from './dashboard/ReleasesTab';
import ReleaseDetailPage from './dashboard/ReleaseDetailPage';
import DevTools from './dev-tools/index';
import MergeRequestListPage from './dashboard/MergeRequestListPage';
import MergeRequestDetailPage from './dashboard/MergeRequestDetailPage';

// Lazy (heavy routes, on-demand chunks):
const SprintBoardTab    = lazy(() => import('./dashboard/SprintBoardTab'));
const BacklogPage       = lazy(() => import('./dashboard/BacklogPage'));
const IssueDetailPage   = lazy(() => import('./dashboard/IssueDetailPage'));
const EpicsPage         = lazy(() => import('./dashboard/EpicsPage'));
const WorkloadTab       = lazy(() => import('./dashboard/WorkloadTab'));
const SprintProgressTab = lazy(() => import('./dashboard/SprintProgressTab'));

function withLazy(Component: React.ComponentType) {
  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<RouteSpinner />}>
        <Component />
      </Suspense>
    </ChunkErrorBoundary>
  );
}

export const routes: RouteObject[] = [
  { path: '/',               element: <Onboarding /> },
  { path: '/dashboard',      element: <Dashboard /> },
  { path: '/settings',       element: <Settings /> },
  { path: '/my-tasks',       element: <MyTasksTab /> },
  { path: '/mr-attention',   element: <MrAttentionTab /> },
  { path: '/releases',       element: <ReleasesTab /> },
  { path: '/release/:versionId', element: <ReleaseDetailPage /> },
  { path: '/dev-tools',      element: <DevTools /> },
  { path: '/merge-requests', element: <MergeRequestListPage /> },
  { path: '/mr/:projectId/:iid', element: <MergeRequestDetailPage /> },
  // Lazy heavy routes:
  { path: '/sprint-board',   element: withLazy(SprintBoardTab) },
  { path: '/backlog',        element: withLazy(BacklogPage) },
  { path: '/issue/:key',     element: withLazy(IssueDetailPage) },
  { path: '/epics',          element: withLazy(EpicsPage) },
  { path: '/workload',       element: withLazy(WorkloadTab) },
  { path: '/sprint-progress', element: withLazy(SprintProgressTab) },
];
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `React.memo` / `useMemo` / `useCallback` | React Compiler 1.0 auto-memoization | Oct 2025 (stable release) | ~133 manual annotation sites become removable; compiler is more accurate |
| `vite-plugin-babel` for React Compiler with Vite | `@rolldown/plugin-babel` | Vite 8 / Rolldown (2025) | Old plugin incompatible with Rolldown internals |
| `react-compiler-runtime` shim for React 17/18 | No shim needed with React 19 | React 19 + Compiler 1.0 | React 19 has the compiler hooks built-in |

**Deprecated/outdated:**
- `rollup-plugin-babel`: Does not implement Rolldown plugin API — use `@rolldown/plugin-babel`
- `vite-plugin-babel`: Same issue — incompatible with Vite 8 + Rolldown pipeline
- `compilationMode: 'annotation'`: Only needed for gradual opt-in. Not appropriate for this codebase (D-06 mandates global)

---

## Open Questions

1. **useMemo calls in non-component contexts (hooks, utility files)**
   - What we know: `grep` identifies 133 `useMemo`/`useCallback`/`React.memo` call sites across ~30 files in `src/`
   - What's unclear: A small subset may be in custom hooks where the compiler does NOT auto-memoize (compiler only processes components, not hooks called outside a component tree)
   - Recommendation: Remove all instances. The React Compiler does handle hooks called within components. If a standalone utility function uses `useMemo` as a caching technique (not a React hook), it would be unusual and should be flagged during implementation.

2. **Dead code candidates from bundle analysis**
   - What we know: Analysis must be run after the phase is implemented (lazy routes reduce initial chunk size, revealing actual dead weight in remaining eager bundle)
   - What's unclear: Specific modules to eliminate — unknown until `ANALYZE=true vite build` runs and the treemap is inspected
   - Recommendation: Run bundle analysis as the final task after lazy routes + compiler are in place. D-10 mandates acting on findings, so implementation of dead code removal is part of this phase, not just generating the report.

---

## Environment Availability

Step 2.6: SKIPPED — this phase makes no use of external tools, services, runtimes, or CLI utilities beyond the project's own codebase and npm. The three new packages are npm dev dependencies installed in the normal build pipeline. No new CLIs, databases, or services required.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npm test -- --run` |
| Full suite command | `cd taskflow && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROUT-01 | Heavy routes load on demand (not at startup) | Build output verification | `ANALYZE=true vite build` — inspect chunk manifest for separate files | ❌ Wave 0 |
| ROUT-02 | Suspense fallback renders during chunk load | Unit (component render) | `npm test -- --run src/components/ui/route-spinner.test.tsx` | ❌ Wave 0 |
| ROUT-03 | Error boundary renders error UI on chunk failure | Unit (component render) | `npm test -- --run src/components/ChunkErrorBoundary.test.tsx` | ❌ Wave 0 |
| ROUT-04 | React Compiler active (no manual memo calls remain) | Static audit | `grep -rn "useMemo\|useCallback\|React\.memo" src/ --include="*.tsx" --include="*.ts"` — expect 0 results | manual |
| ROUT-05 | Bundle analysis run and dead code acted on | Build artifact check | `ls taskflow/dist/stats.html` after `ANALYZE=true vite build` | manual |

**Notes:**
- ROUT-01 can be verified by checking `dist/` for separate chunk files named after the heavy routes (Vite names them by the dynamic import path)
- ROUT-02 and ROUT-03 are standard React component render tests using the existing `@testing-library/react` + jsdom setup
- ROUT-04 is a grep-based static check — zero matches confirms D-08 compliance
- ROUT-05 is a manual developer step (run analysis, inspect, act)

### Sampling Rate
- **Per task commit:** `cd taskflow && npm test -- --run`
- **Per wave merge:** `cd taskflow && npm test -- --run`
- **Phase gate:** Full suite green + TypeScript clean (`tsc --noEmit`) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `taskflow/src/components/ui/route-spinner.test.tsx` — covers ROUT-02 (RouteSpinner renders, has correct aria-label)
- [ ] `taskflow/src/components/ChunkErrorBoundary.test.tsx` — covers ROUT-03 (renders error UI when child throws, Retry button calls `window.location.reload`, Dashboard button navigates)

*(All other test infrastructure — vitest, jsdom, @testing-library/react, setup.ts mocks — exists and requires no Wave 0 work)*

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md does not exist at the project root (`/Users/mimo/Desktop/Tasker/CLAUDE.md`). No project-level directives to enforce. Constraints come exclusively from CONTEXT.md decisions (captured in User Constraints section above).

---

## Sources

### Primary (HIGH confidence)
- `taskflow/src/routes/routes.tsx` — Current 16-route eager import structure (read directly)
- `taskflow/src/main.tsx` — `createHashRouter` + `AppLayout` + `<Outlet>` setup (read directly)
- `taskflow/src/routes/error/ErrorPage.tsx` — Styling reference for ChunkErrorBoundary (read directly)
- `taskflow/vite.config.ts` — Current Vite 8 config: `plugins: [tailwindcss(), react()]` (read directly)
- `taskflow/package.json` — React 19.1, Vite 8, `@vitejs/plugin-react@6.0.1`, Vitest 4.0.18 (read directly)
- `.planning/research/STACK.md` — v1.7 stack research: React Compiler setup, Rolldown plugin, visualizer config (read directly — HIGH, previously researched with official sources)
- `.planning/phases/42-foundation/42-UI-SPEC.md` — Component specs for RouteSpinner and ChunkErrorBoundary (read directly)
- `npm view` registry — `babel-plugin-react-compiler@1.0.0`, `@rolldown/plugin-babel@0.2.2`, `rollup-plugin-visualizer@7.0.1` (verified 2026-03-29)

### Secondary (MEDIUM confidence)
- STACK.md sources (previously verified): React Compiler 1.0 Blog Post (react.dev), React Compiler Installation Guide (react.dev), vitejs/vite-plugin-react issue #1144

### Tertiary (LOW confidence)
None — all findings have direct primary source support.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — packages verified via npm registry and STACK.md (previously researched from official docs)
- Architecture: HIGH — derived directly from reading `routes.tsx`, `main.tsx`, `vite.config.ts`, `ErrorPage.tsx`
- Pitfalls: HIGH for React class boundary / wrong nesting (React docs pattern); HIGH for Rolldown plugin incompatibility (STACK.md source); MEDIUM for dead code elimination caution (best practice, no single doc reference)

**Research date:** 2026-03-29
**Valid until:** 2026-04-29 (stable tooling; React Compiler 1.0 is a stable release)
