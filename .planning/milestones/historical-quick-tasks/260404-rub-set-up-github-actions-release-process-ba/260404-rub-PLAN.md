---
phase: quick
plan: 260404-rub
type: execute
wave: 1
depends_on: []
files_modified:
  - .github/workflows/release-cross-platform.yml
autonomous: true
must_haves:
  truths:
    - "Pushing a tag matching v[0-9]+.[0-9]+.[0-9]+ triggers a cross-platform CI build"
    - "Manual workflow_dispatch allows building for specific platform or all"
    - "Linux and Windows Tauri binaries are built and uploaded as artifacts"
    - "Upload job publishes artifacts to Mimo01/taskflow-releases with latest.json"
  artifacts:
    - path: ".github/workflows/release-cross-platform.yml"
      provides: "Cross-platform release CI workflow"
      min_lines: 200
  key_links:
    - from: ".github/workflows/release-cross-platform.yml"
      to: "taskflow/scripts/inject-version.cjs"
      via: "node scripts/inject-version.cjs in taskflow/ working dir"
      pattern: "inject-version"
    - from: ".github/workflows/release-cross-platform.yml"
      to: "Mimo01/taskflow-releases"
      via: "GitHub API upload to releases repo"
      pattern: "taskflow-releases"
---

<objective>
Create a GitHub Actions release workflow for Taskflow, adapted from the pmkar project's release-cross-platform.yml.

Purpose: Enable automated CI builds for Linux and Windows when a version tag is pushed, publishing artifacts to the Mimo01/taskflow-releases repo.
Output: `.github/workflows/release-cross-platform.yml`
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
Reference workflow (adapt from this):
@/Users/mimo/Desktop/pmkar/.github/workflows/release-cross-platform.yml

Taskflow-specific files to understand naming/paths:
@taskflow/src-tauri/tauri.conf.json
@taskflow/scripts/inject-version.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create cross-platform release workflow adapted for Taskflow monorepo</name>
  <files>.github/workflows/release-cross-platform.yml</files>
  <action>
Create `.github/workflows/release-cross-platform.yml` by adapting the pmkar workflow with these Taskflow-specific changes:

**Structure**: Keep the same overall structure — `build` matrix job (Linux + Windows) + `upload-to-releases` job.

**Triggers**: Same as pmkar — tag push `v[0-9]+.[0-9]+.[0-9]+` and workflow_dispatch with version/platform inputs.

**Build matrix**: Same two platforms:
- `ubuntu-22.04` / `x86_64-unknown-linux-gnu` / `linux`
- `windows-latest` / `x86_64-pc-windows-msvc` / `windows`

**Key adaptations for Taskflow monorepo** (all npm/build commands must run in `taskflow/` subdirectory):

1. **Working directory**: Add `defaults: run: working-directory: taskflow` at the job level for the build job. For steps that use `shell: bash` with explicit `run:` blocks that reference paths outside taskflow (like artifact collection), use absolute or relative-to-root paths carefully.

2. **npm cache**: In setup-node, set `cache-dependency-path: taskflow/package-lock.json` since package-lock is inside the subdirectory.

3. **Rust cache**: Set `workspaces: taskflow/src-tauri` (not just `src-tauri` like pmkar).

4. **inject-version.cjs**: Run `node scripts/inject-version.cjs` (this runs relative to taskflow/ working dir, so path is correct as-is). Use `shell: bash` and `eval "$(node scripts/inject-version.cjs)"`.

5. **tauri-action**: Add `projectPath: taskflow` to the `with:` block so it finds `src-tauri` inside the subdirectory.

6. **Artifact collection** — update all artifact names from `pmkar` to `taskflow`:
   - Linux: `taskflow_${VERSION}_amd64.AppImage.tar.gz`, `.sig`, `taskflow_${VERSION}_amd64.deb`
   - Windows: `taskflow_${VERSION}_x64-setup.exe`, `.sig`, `taskflow_${VERSION}_x64_en-US.msi`, `.sig`
   - Bundle path: `taskflow/target/${{ matrix.target }}/release/bundle` (prefix with taskflow/ since default working dir applies)
   - IMPORTANT: For artifact collection steps, override working-directory back to repo root since bundle paths are relative to repo root. Use `working-directory: .` on those steps OR use full paths like `taskflow/target/...`.

7. **Upload job** — update all references from `pmkar-releases` to `taskflow-releases`:
   - API URL: `https://api.github.com/repos/Mimo01/taskflow-releases/releases/tags/$TAG`
   - Upload URL: `https://uploads.github.com/repos/Mimo01/taskflow-releases/releases/$RELEASE_ID/assets`
   - latest.json download URL: `https://github.com/Mimo01/taskflow-releases/releases/download/$TAG/latest.json`
   - All artifact name references in latest.json Python script: `taskflow_` prefix instead of `pmkar_`
   - Base URL in latest.json: `https://github.com/Mimo01/taskflow-releases/releases/download/v{version}`

8. **Upload job working directory**: The upload job does NOT need `working-directory: taskflow` — it runs on a fresh ubuntu-latest and works with downloaded artifacts at repo root.

9. **Secrets**: Same secret names — GITHUB_TOKEN, TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD, RELEASES_REPO_PAT. These must be configured in the GitHub repo settings by the user.

10. **Workflow name**: "Cross-Platform Release Build" (same as pmkar, fine to keep).

11. **Tag body step**: The upload job needs the same tag resolution step as pmkar (duplicated in both jobs since they run on different runners).

Keep everything else identical to pmkar — the platform-skip logic, the existing-asset-deletion logic before upload, the latest.json merge logic with platform signatures.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker && cat .github/workflows/release-cross-platform.yml | grep -c "taskflow" && echo "---" && grep "taskflow-releases" .github/workflows/release-cross-platform.yml | head -5 && echo "---" && grep "working-directory\|projectPath\|cache-dependency-path" .github/workflows/release-cross-platform.yml</automated>
  </verify>
  <done>
    - Workflow file exists at `.github/workflows/release-cross-platform.yml`
    - All `pmkar` references replaced with `taskflow` equivalents
    - `taskflow-releases` used as releases repo (not pmkar-releases)
    - Monorepo working directory set to `taskflow/` for build job
    - `projectPath: taskflow` set on tauri-action
    - `cache-dependency-path: taskflow/package-lock.json` set on setup-node
    - `workspaces: taskflow/src-tauri` set on rust-cache
    - Artifact names use `taskflow_` prefix
    - latest.json URLs point to `Mimo01/taskflow-releases`
  </done>
</task>

</tasks>

<verification>
- `cat .github/workflows/release-cross-platform.yml` — file exists and is valid YAML
- No remaining references to `pmkar` anywhere in the file
- `grep -c "pmkar" .github/workflows/release-cross-platform.yml` returns 0
- Working directory adaptations present for monorepo structure
</verification>

<success_criteria>
A single workflow file that, when a version tag is pushed, will build Taskflow for Linux and Windows and publish binaries to Mimo01/taskflow-releases with an updated latest.json for the Tauri updater.
</success_criteria>

<output>
After completion, create `.planning/quick/260404-rub-set-up-github-actions-release-process-ba/260404-rub-SUMMARY.md`
</output>
