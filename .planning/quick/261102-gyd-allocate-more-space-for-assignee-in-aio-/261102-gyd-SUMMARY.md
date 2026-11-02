---
quick_id: 261102-gyd
status: complete
commit: 8a10caef
---

# Quick 261102-gyd Summary

**Root cause:** `@[720px]:not-sr-only` resets `white-space`/`overflow` and overrides the
name's base `truncate`, so assignee names wrapped even when the column was wide enough.

**Changes (8a10caef):**
- `ExecutionsList.tsx`: the name gets `@[720px]:truncate`. The assignee column is now
  `w-11 @[720px]:w-44 @[1024px]:w-52`.
- `RunDefectsSection.tsx`: the defect assignee name gets `@[560px]:truncate`. Same bug.

**Verification:** biome clean, tsc clean, full vitest suite 4179 passed. Not checked
visually in the app.

**Lesson:** `not-sr-only` is not neutral. Pair it with `truncate` at the same variant.
