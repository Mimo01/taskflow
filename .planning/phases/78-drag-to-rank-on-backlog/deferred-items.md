# Deferred Items — Phase 78

Pre-existing `npm run check` failures present on HEAD 0490486a (before the 78-04
second gap-closure pass), in files OUTSIDE the gap-closure scope. Not fixed —
logged per executor SCOPE BOUNDARY.

- src/services/jira.ts:20 — assist/source/organizeImports (FIXABLE)
- src/services/jira/rank.test.ts:110 — lint/style/useConst (FIXABLE)
- src/test/package-deps.guard.test.ts — trailing-blank format (FIXABLE)
