---
quick_id: 261102-gyd
mode: quick
files_modified:
  - taskflow/src/routes/dashboard/aio-cycle/ExecutionsList.tsx
  - taskflow/src/routes/dashboard/aio-cycle/RunDefectsSection.tsx
---

# Quick 261102-gyd: AIO cycle detail — assignee wraps in Executions table

Executed inline. The diagnosis was precise and the fix is a few lines.

## Diagnosis

`UserChip`'s name span has `truncate`, but ExecutionsList passes
`nameClassName="sr-only @[720px]:not-sr-only"`. Tailwind's `not-sr-only` sets
`white-space: normal; overflow: visible`, and the container-variant rule is emitted
after the base `.truncate`, so it wins. The name wraps instead of ellipsising.
Verified by compiling the utilities with @tailwindcss/node 4.2.2.
`RunDefectsSection` (`truncate sr-only @[560px]:not-sr-only`) has the same bug.

## Tasks

1. Re-apply truncate at the same breakpoint (`@[720px]:truncate` / `@[560px]:truncate`).
   It is emitted after `not-sr-only`, so it wins.
2. Widen the Executions assignee column at roomy containers: `@[1024px]:w-52` (was a fixed
   w-44). The header shares `COL.assignee`, so it stays aligned.

Verify: biome check, tsc, AIO tests, full vitest suite (pre-commit).
