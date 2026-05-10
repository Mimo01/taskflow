---
phase: quick-260510-epf1fk
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/.husky/pre-commit
  - taskflow/.husky/pre-push
autonomous: true
requirements:
  - QUICK-260510-epf1fk
must_haves:
  truths:
    - "Every commit is gated by lint, format, type-check, and tests"
    - "npm run check covers biome lint + format + tsc --noEmit in one command"
    - "Tests run before the commit is accepted, not only before push"
  artifacts:
    - path: "taskflow/.husky/pre-commit"
      provides: "Hard gate: check + test before commit"
      contains: "npm run check"
    - path: "taskflow/.husky/pre-push"
      provides: "Lean pre-push (no duplication of commit gate)"
  key_links:
    - from: "taskflow/.husky/pre-commit"
      to: "taskflow/package.json"
      via: "npm run check && npm run test"
      pattern: "npm run (check|test)"
---

<objective>
Consolidate all quality gates (lint, format, type-check, tests) into the pre-commit hook so no commit is accepted without a clean build. The pre-push hook becomes a lean no-op or is removed to avoid redundant work.

Purpose: Catch errors at the earliest point — before a commit is created, not after.
Output: Updated pre-commit and pre-push hook files.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Current hook state (pre-investigated):

taskflow/.husky/pre-commit currently runs:
  cd taskflow && npm run lint && npm run format:check

taskflow/.husky/pre-push currently runs:
  cd taskflow && npm run check && npx vitest run

package.json scripts:
  check  = biome check ./src && tsc --noEmit   (covers lint + format + typecheck)
  test   = vitest run
  lint   = biome lint ./src
  format:check = biome format ./src

Goal: pre-commit runs `npm run check && npm run test`.
      pre-push becomes a no-op (keep file, clear body) to avoid double work.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update pre-commit hook to run check + tests</name>
  <files>taskflow/.husky/pre-commit</files>
  <action>
Replace the entire content of taskflow/.husky/pre-commit with:

```sh
cd taskflow
npm run check
npm run test
```

`npm run check` runs `biome check ./src && tsc --noEmit`, which covers lint, format, and type-checking in one pass — superseding the current separate `npm run lint` and `npm run format:check` calls. Adding `npm run test` (vitest run) makes tests a mandatory commit gate.

Do NOT add --no-verify bypass comments or any conditional logic. The hook must be unconditional.
  </action>
  <verify>
    <automated>grep -n "npm run check" /Users/mimo/Documents/Projects/taskflow/taskflow/.husky/pre-commit && grep -n "npm run test" /Users/mimo/Documents/Projects/taskflow/taskflow/.husky/pre-commit</automated>
  </verify>
  <done>pre-commit file contains exactly two npm commands: `npm run check` and `npm run test` (after the `cd taskflow` line). The old `npm run lint` and `npm run format:check` lines are gone.</done>
</task>

<task type="auto">
  <name>Task 2: Simplify pre-push hook to avoid duplicate work</name>
  <files>taskflow/.husky/pre-push</files>
  <action>
Replace the entire content of taskflow/.husky/pre-push with an empty body — keep the file so husky does not error, but remove the redundant check + test commands that are now enforced at commit time:

```sh
# Pre-push hook — quality gates are enforced at commit time (pre-commit)
```

This eliminates the double execution of biome check and vitest on every push while keeping the file present for future use.
  </action>
  <verify>
    <automated>grep -c "npm run" /Users/mimo/Documents/Projects/taskflow/taskflow/.husky/pre-push || true</automated>
  </verify>
  <done>pre-push file no longer contains any `npm run` commands. File exists and contains only a comment line.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| developer workstation → git | Hook runs untrusted developer code before commit is accepted |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-epf1fk-01 | Tampering | pre-commit hook | accept | Developer can bypass with --no-verify; this is a workflow aid, not a security control. Documented in project memory. |
</threat_model>

<verification>
After both tasks complete, verify the full gate works end-to-end:

1. Confirm pre-commit has `npm run check` and `npm run test` (no lint/format:check separately)
2. Confirm pre-push has no `npm run` commands
3. Optionally: run `cd taskflow && npm run check && npm run test` manually to confirm the gate passes on clean code
</verification>

<success_criteria>
- taskflow/.husky/pre-commit runs `npm run check` then `npm run test` before any commit
- taskflow/.husky/pre-push contains no redundant commands
- A commit with failing tests or type errors is rejected by the hook
</success_criteria>

<output>
After completion, create `.planning/quick/260510-epf1fk-add-proper-guard-to-committing-tests-and-linters/260510-epf1fk-SUMMARY.md`
</output>
