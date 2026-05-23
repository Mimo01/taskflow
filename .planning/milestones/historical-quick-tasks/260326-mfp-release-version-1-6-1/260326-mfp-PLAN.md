---
phase: quick
plan: 260326-mfp
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/package.json
  - taskflow/src-tauri/Cargo.toml
  - taskflow/src-tauri/Cargo.lock
  - taskflow/src-tauri/tauri.conf.json
  - .planning/debug/knowledge-base.md
  - .planning/debug/updater-acl-error.md
  - .planning/phases/38-updater-foundation-service-layer/38-01-SUMMARY.md
autonomous: true
must_haves:
  truths:
    - "Git tag v1.6.1 exists and is pushed to origin"
    - "CI release workflow is triggered by the tag push"
    - "All uncommitted changes are cleanly committed before tagging"
  artifacts:
    - path: "git tag v1.6.1"
      provides: "Release tag for v1.6.1"
  key_links:
    - from: "git tag v1.6.1"
      to: "CI release workflow"
      via: "git push origin v1.6.1 triggers workflow"
---

<objective>
Release version 1.6.1 of Taskflow.

Purpose: Ship all accumulated fixes and improvements since v1.6 as a patch release.
Output: Git tag v1.6.1 pushed to origin, triggering the CI release workflow.
</objective>

<context>
Current state:
- Latest git tag: v1.6
- Version in config files: 1.6.0 (from inject-version.cjs, unstaged)
- There are uncommitted changes: version bumps in package.json/Cargo.toml/tauri.conf.json/Cargo.lock,
  plus .planning docs (debug knowledge-base, updater-acl-error, 38-01-SUMMARY)
- The release.sh script requires a clean working tree before tagging
- inject-version.cjs will auto-update version files from the git tag at build time

Release flow: commit pending changes -> run `npm run release v1.6.1` -> script runs tests/lint,
creates annotated tag with auto-generated changelog, pushes main + tag to origin
</context>

<tasks>

<task type="auto">
  <name>Task 1: Commit all pending changes</name>
  <files>
    taskflow/package.json
    taskflow/src-tauri/Cargo.toml
    taskflow/src-tauri/Cargo.lock
    taskflow/src-tauri/tauri.conf.json
    .planning/debug/knowledge-base.md
    .planning/debug/updater-acl-error.md
    .planning/phases/38-updater-foundation-service-layer/38-01-SUMMARY.md
  </files>
  <action>
    Commit all uncommitted changes to get a clean working tree. The version file changes
    (package.json, Cargo.toml, Cargo.lock, tauri.conf.json) are from inject-version.cjs
    updating 0.1.0 -> 1.6.0. The .planning files are docs from recent work.

    Also check if `taskflow/.planning/` (the untracked directory) contains anything meaningful.
    If it does, either commit or .gitignore it. If empty or irrelevant, add to .gitignore
    or leave untracked (release.sh only checks `git diff-index`, not untracked files).

    Stage all modified files and the untracked .planning docs. Commit with message:
    "chore: sync version files and add planning docs"

    Do NOT stage taskflow/.planning/ unless it contains project-relevant content.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker && git diff-index --quiet HEAD --</automated>
  </verify>
  <done>Working tree is clean (no uncommitted changes), ready for release.sh</done>
</task>

<task type="auto">
  <name>Task 2: Run release script for v1.6.1</name>
  <files>None (release.sh creates git tag and pushes)</files>
  <action>
    From the taskflow directory, run: npm run release v1.6.1

    This will:
    1. Validate tag format (v1.6.1 starts with v + digit)
    2. Check for uncommitted changes (should pass after Task 1)
    3. Run vitest tests
    4. Run lint + typecheck (biome check + tsc --noEmit)
    5. Auto-generate categorized changelog from commits since v1.6
    6. Create annotated git tag v1.6.1 with changelog as body
    7. Push main branch to origin
    8. Push v1.6.1 tag to origin (triggers CI release workflow)

    If tests or lint fail, fix the issues and retry. Do NOT skip tests.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker && git tag -l v1.6.1 | grep -q v1.6.1 && echo "Tag exists"</automated>
  </verify>
  <done>Tag v1.6.1 exists locally and has been pushed to origin, CI release workflow triggered.</done>
</task>

</tasks>

<verification>
- `git tag -l v1.6.1` shows the tag
- `git log --oneline -1 v1.6.1` shows the tagged commit
- `git tag -l --format='%(contents:body)' v1.6.1` shows the auto-generated changelog
</verification>

<success_criteria>
- All tests and lint pass
- Git tag v1.6.1 is created with auto-generated changelog
- Tag and main branch are pushed to origin
- CI release workflow is triggered
</success_criteria>

<output>
After completion, create `.planning/quick/260326-mfp-release-version-1-6-1/260326-mfp-SUMMARY.md`
</output>
