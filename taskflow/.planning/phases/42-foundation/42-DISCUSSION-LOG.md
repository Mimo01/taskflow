# Phase 42: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-29
**Phase:** 42-Foundation
**Areas discussed:** Code splitting strategy, Skeleton fallback UX, React Compiler setup, Bundle analysis output

---

## Code Splitting Strategy

### Which routes to lazy-load?

| Option | Description | Selected |
|--------|-------------|----------|
| Only heavy routes | Lazy-load the 6 heavy routes (sprint board, backlog, issue detail, epics, workload, sprint progress). Keep lighter routes eager. | ✓ |
| All routes except onboarding | Lazy-load everything except onboarding. Maximum code splitting. | |
| All 16 routes | Lazy-load every route including onboarding. Smallest initial bundle. | |

**User's choice:** Only heavy routes (Recommended)
**Notes:** None

### Chunk grouping strategy?

| Option | Description | Selected |
|--------|-------------|----------|
| One chunk per route | Each lazy route gets its own chunk. Fine-grained — 6 separate chunks. | ✓ |
| Group by domain | Bundle related routes together (e.g., sprint board + sprint progress). Fewer but larger chunks. | |

**User's choice:** One chunk per route (Recommended)
**Notes:** None

---

## Skeleton Fallback UX

### What shows while a lazy route chunk loads?

| Option | Description | Selected |
|--------|-------------|----------|
| Simple centered spinner | Minimal spinner in content area. Chunk loads are fast; elaborate skeletons redundant with Phase 44. | ✓ |
| Generic page skeleton | Basic skeleton layout (header bar + content placeholders). More polished but potentially redundant. | |
| Blank with subtle fade-in | Show nothing during chunk load, then fade in. Risks blank flash if >200ms. | |

**User's choice:** Simple centered spinner (Recommended)
**Notes:** None

### Error boundary behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Retry + home link | "Something went wrong" with Retry button and dashboard link. Reuses ErrorPage styling. | ✓ |
| Reuse ErrorPage as-is | Use existing ErrorPage unchanged. | |

**User's choice:** Retry + home link (Recommended)
**Notes:** None

---

## React Compiler Setup

### Scope of React Compiler?

| Option | Description | Selected |
|--------|-------------|----------|
| Entire codebase | Enable globally — auto-memoizes all components and hooks. Compiler skips what it can't optimize. | ✓ |
| Opt-in per directory | Start with specific directories, expand. More cautious but more config overhead. | |
| Opt-out exclusions only | Global by default with 'use no memo' escape hatch per file. | |

**User's choice:** Entire codebase (Recommended)
**Notes:** None

### Remove existing manual memoization?

| Option | Description | Selected |
|--------|-------------|----------|
| Remove in this phase | Clean up redundant memo/useMemo/useCallback. Compiler handles it; both together is noise. | ✓ |
| Leave for now | Keep existing manual memos. Harmless but noisy. | |
| You decide | Claude's discretion based on count and risk. | |

**User's choice:** Remove in this phase (Recommended)
**Notes:** None

---

## Bundle Analysis Output

### How should analysis be triggered?

| Option | Description | Selected |
|--------|-------------|----------|
| Env flag opt-in | ANALYZE=true npm run build — generates interactive treemap HTML. Not part of normal builds. | ✓ |
| Separate npm script | Add "analyze" script to package.json. More discoverable but functionally identical. | |
| Both | Env flag + npm script alias. | |

**User's choice:** Env flag opt-in (Recommended)
**Notes:** None

### What to do with analysis results?

| Option | Description | Selected |
|--------|-------------|----------|
| Generate + act on findings | Run analysis AND eliminate dead code/oversized deps found. Delivers size reduction. | ✓ |
| Generate report + flag issues | Document largest chunks and dead code candidates. Action if warranted. | |
| Generate report only | Purely informational treemap. No action items. | |

**User's choice:** Generate + act on findings
**Notes:** User chose the most aggressive option — wants actual size reduction delivered in this phase, not just a report.

---

## Claude's Discretion

- Spinner component/styling for Suspense fallback
- Error boundary retry mechanism details
- Which specific memo/useMemo/useCallback calls to remove (all, per D-08)
- Bundle analysis findings format

## Deferred Ideas

None — discussion stayed within phase scope
