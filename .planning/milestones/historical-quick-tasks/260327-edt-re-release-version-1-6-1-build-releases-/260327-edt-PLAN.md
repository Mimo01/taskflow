---
phase: quick-260327-edt
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: false
requirements: [RE-RELEASE-1.6.1]

must_haves:
  truths:
    - "macOS universal .dmg artifact exists for v1.6.1"
    - "GitHub release v1.6.1 exists in Mimo01/taskflow-releases with macOS artifacts uploaded"
    - "latest.json updater manifest is uploaded to the release"
  artifacts:
    - path: "taskflow/target/universal-apple-darwin/release/bundle/dmg/Taskflow_1.6.1_universal.dmg"
      provides: "macOS universal installer"
    - path: "taskflow/target/universal-apple-darwin/release/bundle/macos/Taskflow.app.tar.gz.sig"
      provides: "Updater signature for macOS"
  key_links:
    - from: "GitHub release v1.6.1"
      to: "latest.json endpoint"
      via: "updater checks https://github.com/Mimo01/taskflow-releases/releases/latest/download/latest.json"
---

<objective>
Build Taskflow v1.6.1 macOS universal binary locally and publish artifacts to the Mimo01/taskflow-releases GitHub release.

Purpose: GitHub Actions minutes are exhausted. The v1.6.1 tag already exists but the release artifacts need to be built locally and uploaded.
Output: GitHub release at Mimo01/taskflow-releases with macOS .dmg, updater .tar.gz, signature, and latest.json.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.github/workflows/release.yml
@taskflow/src-tauri/tauri.conf.json
@taskflow/package.json
@taskflow/scripts/inject-version.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build macOS universal binary locally</name>
  <files>taskflow/src-tauri/tauri.conf.json, taskflow/package.json, taskflow/src-tauri/Cargo.toml</files>
  <action>
Build the Tauri app for macOS universal target from the taskflow/ directory:

1. Ensure the aarch64-apple-darwin Rust target is installed:
   ```
   rustup target add aarch64-apple-darwin
   ```

2. Ensure we are on the v1.6.1 tag (or that git describe picks it up). Verify with:
   ```
   git describe --tags --match "v[0-9]*" --abbrev=0
   ```
   Must output `v1.6.1`. If not, run `git checkout v1.6.1` first.

3. Install frontend dependencies:
   ```
   cd taskflow && npm ci
   ```

4. Inject version (this updates tauri.conf.json, package.json, Cargo.toml to 1.6.1):
   ```
   eval $(node scripts/inject-version.cjs)
   ```
   Verify APP_VERSION=1.6.1.

5. The build needs the Tauri updater signing key. Check if TAURI_SIGNING_PRIVATE_KEY env var is set. If not, this task will pause and ask the user to provide it. The key is needed for `createUpdaterArtifacts: true` in tauri.conf.json. Also need TAURI_SIGNING_PRIVATE_KEY_PASSWORD.

6. Build the universal macOS binary:
   ```
   export APP_VERSION=1.6.1
   export APP_COMMIT_SHA=$(git rev-parse --short HEAD)
   export APP_BUILD_DATE=$(date +%Y-%m-%d)
   npx tauri build --target universal-apple-darwin
   ```

7. After build completes, verify artifacts exist at:
   - `target/universal-apple-darwin/release/bundle/dmg/Taskflow_1.6.1_universal.dmg`
   - `target/universal-apple-darwin/release/bundle/macos/Taskflow.app.tar.gz` (updater bundle)
   - `target/universal-apple-darwin/release/bundle/macos/Taskflow.app.tar.gz.sig` (updater signature)

IMPORTANT: Do NOT commit the version injection changes to git -- they are build-time artifacts only. After build, restore the files:
```
git checkout -- src-tauri/tauri.conf.json package.json src-tauri/Cargo.toml
```
  </action>
  <verify>
    <automated>ls -la taskflow/target/universal-apple-darwin/release/bundle/dmg/Taskflow_*.dmg taskflow/target/universal-apple-darwin/release/bundle/macos/Taskflow.app.tar.gz taskflow/target/universal-apple-darwin/release/bundle/macos/Taskflow.app.tar.gz.sig</automated>
  </verify>
  <done>Three artifacts exist: .dmg installer, .tar.gz updater bundle, and .sig signature file, all for version 1.6.1 universal-apple-darwin</done>
</task>

<task type="auto">
  <name>Task 2: Create GitHub release and upload artifacts via API</name>
  <files></files>
  <action>
Upload build artifacts to Mimo01/taskflow-releases as a GitHub release using curl and the GitHub API. Do NOT use gh CLI (user preference).

The user must have a GitHub personal access token with repo scope. Use the RELEASES_REPO_TOKEN env var (same name as in the CI workflow). If not set, ask the user to provide it.

1. Check if a v1.6.1 release already exists:
   ```
   curl -s -H "Authorization: token $RELEASES_REPO_TOKEN" \
     https://api.github.com/repos/Mimo01/taskflow-releases/releases/tags/v1.6.1
   ```
   If it exists, note the release ID. Delete existing assets if any (to re-upload clean), or delete and recreate the release.

2. If no release exists, create one:
   ```
   curl -s -X POST \
     -H "Authorization: token $RELEASES_REPO_TOKEN" \
     -H "Content-Type: application/json" \
     https://api.github.com/repos/Mimo01/taskflow-releases/releases \
     -d '{
       "tag_name": "v1.6.1",
       "target_commitish": "main",
       "name": "Taskflow v1.6.1",
       "body": "Re-release of v1.6.1 - macOS only (built locally)",
       "draft": false,
       "prerelease": false
     }'
   ```
   Save the release `id` and `upload_url` from the response.

3. Upload each artifact using the upload URL (replace `{?name,label}` with `?name=FILENAME`):
   - `Taskflow_1.6.1_universal.dmg`
   - `Taskflow.app.tar.gz` (rename to include version if needed for consistency)
   - `Taskflow.app.tar.gz.sig` (rename similarly)

   ```
   UPLOAD_BASE="https://uploads.github.com/repos/Mimo01/taskflow-releases/releases/RELEASE_ID/assets"

   curl -s -X POST \
     -H "Authorization: token $RELEASES_REPO_TOKEN" \
     -H "Content-Type: application/octet-stream" \
     "$UPLOAD_BASE?name=Taskflow_1.6.1_universal.dmg" \
     --data-binary @taskflow/target/universal-apple-darwin/release/bundle/dmg/Taskflow_1.6.1_universal.dmg
   ```

   Repeat for .tar.gz and .sig files.

4. Generate and upload latest.json for the Tauri updater. The format must match what the updater plugin expects:
   ```json
   {
     "version": "1.6.1",
     "notes": "Taskflow v1.6.1",
     "pub_date": "2026-03-27T00:00:00Z",
     "platforms": {
       "darwin-universal": {
         "signature": "<contents of .sig file>",
         "url": "https://github.com/Mimo01/taskflow-releases/releases/download/v1.6.1/Taskflow.app.tar.gz"
       },
       "darwin-x86_64": {
         "signature": "<contents of .sig file>",
         "url": "https://github.com/Mimo01/taskflow-releases/releases/download/v1.6.1/Taskflow.app.tar.gz"
       },
       "darwin-aarch64": {
         "signature": "<contents of .sig file>",
         "url": "https://github.com/Mimo01/taskflow-releases/releases/download/v1.6.1/Taskflow.app.tar.gz"
       }
     }
   }
   ```
   Read the signature from the .sig file and embed it. Use the actual ISO datetime for pub_date.
   Upload latest.json as a release asset.

5. Verify all assets are accessible:
   ```
   curl -s -H "Authorization: token $RELEASES_REPO_TOKEN" \
     https://api.github.com/repos/Mimo01/taskflow-releases/releases/tags/v1.6.1 | grep -o '"name":"[^"]*"'
   ```
   Should list all uploaded asset names.
  </action>
  <verify>
    <automated>curl -s -H "Authorization: token $RELEASES_REPO_TOKEN" https://api.github.com/repos/Mimo01/taskflow-releases/releases/tags/v1.6.1 | python3 -c "import sys,json; r=json.load(sys.stdin); assets=[a['name'] for a in r.get('assets',[])]; print('Assets:', assets); assert len(assets) >= 3, f'Expected >=3 assets, got {len(assets)}'; print('OK')"</automated>
  </verify>
  <done>GitHub release v1.6.1 exists at Mimo01/taskflow-releases with at minimum: .dmg, .tar.gz, .sig, and latest.json uploaded as assets</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verify release artifacts are accessible and installable</name>
  <files></files>
  <action>
User verifies the published release:
1. Visit https://github.com/Mimo01/taskflow-releases/releases/tag/v1.6.1
2. Confirm release assets are listed (dmg, tar.gz, sig, latest.json)
3. Download the .dmg and verify it installs correctly on macOS
4. Verify latest.json is accessible at https://github.com/Mimo01/taskflow-releases/releases/latest/download/latest.json
  </action>
  <verify>User confirms release is correct</verify>
  <done>User has approved the release artifacts as working</done>
</task>

</tasks>

<verification>
- GitHub release v1.6.1 exists at Mimo01/taskflow-releases
- At least 4 assets uploaded: .dmg, .tar.gz, .sig, latest.json
- latest.json contains correct version, signature, and download URLs
- .dmg file is a valid macOS installer
</verification>

<success_criteria>
- Taskflow v1.6.1 macOS universal .dmg is downloadable from the GitHub release
- The Tauri updater can find latest.json and the update bundle at the expected URLs
- No CI/GitHub Actions were used in this process
</success_criteria>

<output>
After completion, create `.planning/quick/260327-edt-re-release-version-1-6-1-build-releases-/260327-edt-SUMMARY.md`
</output>
