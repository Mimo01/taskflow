---
quick_id: 261118-kbp
status: complete
commit: dca0e4a5
---
# Summary: scope the pre-commit hook

**Root cause:** the hook was not new. It had run the full suite since May. Two things made it expensive: the suite grew to 463 test files, and about half of all commits are .planning/ docs commits that still paid for tsc plus every test.

**Change:** taskflow/.husky/pre-commit (dca0e4a5)
- Docs-only commits skip every check.
- Commits with src changes run tsc plus `vitest related` on the staged files (the tests whose import graph reaches them).
- Changes to package.json, the lockfile, tsconfig, vitest/vite config or src/test/ run the full suite, and so do deleted or renamed src files.
- Commits with no TypeScript changes, such as src-tauri only, skip tsc and tests.

**Verified** with a temp index: nothing staged skipped; docs-only skipped; changing src/lib/table-sort.ts ran 9 test files and 342 tests in about 7s. The hook's own commit took the "no TS changes" path.

**Trade-off:** tests that reach a module only through vi.mock factories or dynamic imports may not count as "related". Run `npm run test` before pushing or releasing when that matters.

## Follow-up: pre-push safety net (7f2fc079)
taskflow/.husky/pre-push (previously a no-op) now runs the full suite once per push. It is skipped when no pushed commit touches taskflow/. When the remote base is unknown, it runs the suite anyway (fails safe). Verified: a docs-only range was skipped, and a range containing an app commit was detected.
