---
phase: quick-260329-kyx
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/package.json
  - taskflow/.husky/pre-commit
  - taskflow/.husky/pre-push
  - taskflow/scripts/release.sh
  - taskflow/scripts/bump-version.mjs
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
autonomous: false
requirements: [QUICK]

must_haves:
  truths:
    - "Lint and format checks run automatically before every commit"
    - "Typecheck and tests run automatically before every push"
    - "No GitHub Actions CI workflow exists — all checks are local"
    - "Running release.sh builds macOS universal binary, creates GitHub release, uploads artifacts, and updates README — all locally"
    - "No GitHub Actions release workflow exists — release is fully local"
    - "bump-version.mjs no longer prints 'Release workflow triggered' since there is no workflow"
  artifacts:
    - path: "taskflow/.husky/pre-commit"
      provides: "Pre-commit hook running lint + format check"
    - path: "taskflow/.husky/pre-push"
      provides: "Pre-push hook running typecheck + tests"
    - path: "taskflow/scripts/release.sh"
      provides: "Full local release lifecycle: build + sign + create release + upload + README"
  key_links:
    - from: "taskflow/.husky/pre-commit"
      to: "npm run lint && npm run format:check"
      via: "husky hook execution"
      pattern: "npm run lint"
    - from: "taskflow/.husky/pre-push"
      to: "npm run check && npx vitest run"
      via: "husky hook execution"
      pattern: "vitest run"
    - from: "taskflow/scripts/release.sh"
      to: "https://api.github.com/repos/Mimo01/taskflow-releases/releases"
      via: "curl with RELEASES_REPO_TOKEN"
      pattern: "curl.*api.github.com.*releases"
---

<objective>
Replace GitHub Actions CI and release workflows with fully local processes.

Purpose: Eliminate GitHub Actions runtime costs by moving all checks to git hooks and all release building/publishing to local scripts.
Output: Husky git hooks for CI, extended release.sh for full local release lifecycle, both GitHub Actions workflows removed.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260329-kyx-replace-github-actions-with-local-proces/260329-kyx-CONTEXT.md
@.planning/quick/260329-kyx-replace-github-actions-with-local-proces/260329-kyx-RESEARCH.md

Key existing files:
- taskflow/scripts/release.sh — current release script (runs tests/lint, calls bump-version.mjs)
- taskflow/scripts/bump-version.mjs — bumps versions, generates changelog, commits, tags, pushes
- taskflow/scripts/inject-version.cjs — build-time version injection
- .github/workflows/ci.yml — CI to remove
- .github/workflows/release.yml — Release to remove

Proven pattern from quick-260327-edt:
- Local macOS universal build: `npm run tauri:build -- --target universal-apple-darwin`
- GitHub Releases API upload with curl to Mimo01/taskflow-releases
- TAURI_SIGNING_PRIVATE_KEY from ~/.tauri/taskflow.key (empty password)
- Upload URL: https://uploads.github.com/repos/Mimo01/taskflow-releases/releases/{id}/assets
- latest.json with darwin-universal, darwin-x86_64, darwin-aarch64 platform keys

Monorepo layout: Git root is /Tasker/, npm project is /Tasker/taskflow/. Husky hooks must account for this.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install husky, configure git hooks, remove ci.yml</name>
  <files>taskflow/package.json, taskflow/.husky/pre-commit, taskflow/.husky/pre-push, .github/workflows/ci.yml</files>
  <action>
1. Install husky as a dev dependency in taskflow/:
   ```
   cd taskflow && npm install --save-dev husky
   ```

2. Initialize husky. Because the git repo root is the PARENT of taskflow/, the prepare script must be configured specially (per research Pitfall 1):
   - Add to taskflow/package.json scripts: `"prepare": "cd .. && husky taskflow/.husky"`
   - Run `npm run prepare` to set up core.hooksPath

3. Create `taskflow/.husky/pre-commit` hook (fast checks, < 5s):
   ```bash
   cd taskflow
   npm run lint
   npm run format:check
   ```
   Make executable: chmod +x

4. Create `taskflow/.husky/pre-push` hook (heavier checks, < 60s):
   ```bash
   cd taskflow
   npm run check
   npx vitest run
   ```
   Make executable: chmod +x

5. Delete `.github/workflows/ci.yml` entirely. If `.github/workflows/` directory is now empty (after release.yml is also removed in Task 2), leave it — Task 2 will clean up.

Note: Do NOT install lint-staged — keep it simple with full lint on commit since the codebase is small enough. Per Claude's discretion on hook configuration details.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && node -e "const p=require('./package.json'); if(!p.devDependencies.husky) throw 'no husky'; if(!p.scripts.prepare) throw 'no prepare'" && test -x .husky/pre-commit && test -x .husky/pre-push && test ! -f ../.github/workflows/ci.yml && echo "PASS"</automated>
  </verify>
  <done>Husky installed, pre-commit runs lint+format:check, pre-push runs check+tests, ci.yml deleted. Running `git commit` triggers lint. Running `git push` triggers full checks.</done>
</task>

<task type="auto">
  <name>Task 2: Extend release.sh for full local release lifecycle, remove release.yml</name>
  <files>taskflow/scripts/release.sh, taskflow/scripts/bump-version.mjs, .github/workflows/release.yml</files>
  <action>
1. Rewrite `taskflow/scripts/release.sh` to handle the FULL release lifecycle locally. The script takes a version argument (e.g., `./scripts/release.sh 1.7.0`) and does everything:

   **Phase A — Pre-flight checks (keep existing):**
   - Validate semver format (bare X.Y.Z)
   - Check for uncommitted changes
   - Run `npx vitest run` and `npm run check`
   - Check that RELEASES_REPO_TOKEN env var is set (fail with clear message if not)
   - Check that TAURI_SIGNING_PRIVATE_KEY env var is set (fail with clear message if not)

   **Phase B — Version bump (delegate to existing bump-version.mjs):**
   - Run `node scripts/bump-version.mjs "$VERSION"` — this handles version files, changelog, commit, tag, push

   **Phase C — Local macOS build:**
   - Run inject-version.cjs: `eval $(node scripts/inject-version.cjs)`
   - Build: `npm run build && npx tauri build --target universal-apple-darwin`
   - After build, restore version-injected files to avoid dirty state (per research Pitfall 5):
     `git checkout -- src-tauri/tauri.conf.json package.json src-tauri/Cargo.toml`

   **Phase D — Create GitHub release on Mimo01/taskflow-releases:**
   - Extract tag body: `git tag -l --format='%(contents:body)' "v$VERSION"`
   - Create release via curl POST to `https://api.github.com/repos/Mimo01/taskflow-releases/releases`
     - tag_name: "v$VERSION", name: "Taskflow v$VERSION", body: tag annotation body
     - draft: false, prerelease: false
   - Extract RELEASE_ID from response using python3 json parsing
   - Check for errors in response (if no 'id' field, print response and exit 1)

   **Phase E — Upload artifacts:**
   - Upload URL base: `https://uploads.github.com/repos/Mimo01/taskflow-releases/releases/$RELEASE_ID/assets`
   - Find and upload these files from `src-tauri/target/universal-apple-darwin/release/bundle/`:
     - DMG: `dmg/Taskflow_${VERSION}_universal.dmg`
     - App tarball: `macos/Taskflow.app.tar.gz`
     - Signature: `macos/Taskflow.app.tar.gz.sig`
   - For each upload, use: `curl -s -X POST -H "Authorization: token $RELEASES_REPO_TOKEN" -H "Content-Type: application/octet-stream" "$UPLOAD_URL?name=$(basename $FILE)" --data-binary @"$FILE"`
   - Check each upload response for errors

   **Phase F — Generate and upload latest.json (Tauri updater manifest):**
   - Read signature from .sig file
   - Build latest.json with version, notes (tag body), pub_date (ISO 8601), and platforms:
     - darwin-universal, darwin-x86_64, darwin-aarch64 all pointing to same Taskflow.app.tar.gz URL
     - URL format: `https://github.com/Mimo01/taskflow-releases/releases/download/v$VERSION/Taskflow.app.tar.gz`
   - Upload latest.json as release asset

   **Phase G — Update README in releases repo:**
   - Use GitHub Contents API (per research) to update README.md in Mimo01/taskflow-releases
   - GET current README SHA, then PUT with updated content
   - README content: download links for macOS only (DMG link)
   - Note in README that Windows/Linux builds are not yet available

   **Phase H — Summary:**
   - Print release URL: `https://github.com/Mimo01/taskflow-releases/releases/tag/v$VERSION`
   - Print list of uploaded artifacts
   - Print reminder about Windows/Linux builds not included

   Use `set -euo pipefail` throughout. Use AUTH_HEADER variable for DRY auth headers.
   All GitHub API calls use RELEASES_REPO_TOKEN (not GITHUB_TOKEN, not gh CLI — per locked decisions).

2. Update `taskflow/scripts/bump-version.mjs`:
   - Change the final console.log from `"Done. Release workflow triggered for v${newVersion}."` to `"Done. Version bumped to v${newVersion}."` — there is no release workflow anymore.

3. Delete `.github/workflows/release.yml`.

4. If `.github/workflows/` directory is now empty, delete it. If `.github/` directory is now empty, delete it too.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && test -f scripts/release.sh && grep -q "RELEASES_REPO_TOKEN" scripts/release.sh && grep -q "uploads.github.com" scripts/release.sh && grep -q "latest.json" scripts/release.sh && grep -q "Contents API\|contents/README" scripts/release.sh && test ! -f ../.github/workflows/release.yml && ! grep -q "Release workflow triggered" scripts/bump-version.mjs && echo "PASS"</automated>
  </verify>
  <done>release.sh handles full lifecycle: pre-flight, version bump, macOS build, GitHub release creation, artifact upload (DMG + tarball + sig + latest.json), README update. release.yml deleted. bump-version.mjs no longer references workflow. Running `cd taskflow && bash scripts/release.sh 1.7.0` with RELEASES_REPO_TOKEN and TAURI_SIGNING_PRIVATE_KEY set will perform a complete macOS-only release.</done>
</task>

<task type="checkpoint:decision" gate="blocking">
  <decision>Windows and Linux build strategy</decision>
  <context>
Research found that cross-compiling Tauri for Windows and Linux from macOS is NOT production-viable:
- Windows: cargo-xwin is experimental, MSI impossible without real Windows, code signing unsupported for cross-builds
- Linux: requires WebKit2GTK (Linux-only system library), Docker not installed on this machine
- The locked decision was "build all three platforms locally" but this hits a hard technical wall

The release script currently only builds macOS. A strategy is needed for Windows/Linux.
  </context>
  <options>
    <option id="option-a">
      <name>macOS-only for now</name>
      <pros>Ships immediately, no additional setup, proven approach</pros>
      <cons>No Windows/Linux downloads available</cons>
    </option>
    <option id="option-b">
      <name>Install Docker + attempt Linux builds</name>
      <pros>Adds Linux platform coverage</pros>
      <cons>Heavy setup (Docker + Ubuntu image with GTK dev libs), untested, still no Windows</cons>
    </option>
    <option id="option-c">
      <name>Keep minimal GitHub Actions for Windows/Linux only</name>
      <pros>Reliable multi-platform builds, only runs on tag push (minimal CI minutes ~10 min/release)</pros>
      <cons>Does not fully eliminate GitHub Actions (but reduces usage ~95%)</cons>
    </option>
    <option id="option-d">
      <name>Use a Windows VM/machine for Windows builds</name>
      <pros>Real Windows build environment, proper code signing possible</pros>
      <cons>Requires access to Windows machine, manual process</cons>
    </option>
  </options>
  <resume-signal>Select: option-a, option-b, option-c, or option-d (or describe a different approach). This decision can be implemented as a follow-up quick task.</resume-signal>
</task>

</tasks>

<verification>
1. Make a test commit in a branch — husky pre-commit hook should run lint + format:check
2. Attempt a push — husky pre-push hook should run check + tests
3. Verify no .github/workflows/ directory exists (or is empty)
4. Verify release.sh contains all phases A-H and references the correct GitHub API endpoints
5. Verify bump-version.mjs no longer mentions "Release workflow triggered"
</verification>

<success_criteria>
- `git commit` triggers local lint + format check via husky pre-commit hook
- `git push` triggers local typecheck + test suite via husky pre-push hook
- No GitHub Actions workflows exist in the repository
- `release.sh 1.7.0` (with proper env vars) would build macOS, create release, upload artifacts, update README — all locally
- User has decided on Windows/Linux strategy for future implementation
</success_criteria>

<output>
After completion, create `.planning/quick/260329-kyx-replace-github-actions-with-local-proces/260329-kyx-SUMMARY.md`
</output>
