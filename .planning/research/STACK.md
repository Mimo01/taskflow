# Stack Research

**Domain:** Release pipeline, auto-update, and version management for Tauri 2 desktop app
**Researched:** 2026-03-24
**Confidence:** HIGH

## Context: Existing Stack (DO NOT re-add)

These are already installed and validated. Listed here only to prevent duplicate recommendations:

- Tauri 2 + tauri-plugin-http/store/stronghold/notification/opener
- React 19.1, React DOM 19.1, React Router DOM 7.13
- TypeScript 5.9, Vite 8, Vitest 4
- Zustand 5, TanStack Query 5, TanStack React Virtual 3
- shadcn/ui (via @base-ui/react 1.2), Tailwind v4, tailwind-merge 3, CVA 0.7, clsx 2
- @dnd-kit/core 6.3, @dnd-kit/utilities 3.2, @dnd-kit/sortable 10, @dnd-kit/modifiers 9
- lucide-react 0.577, react-grid-layout 2.2
- react-markdown 10.1, jira2md 3.0, rehype-raw 7, remark-gfm 4
- react-hotkeys-hook 5.2, cmdk 1.1
- Biome 2.4, @testing-library/react 16.3

## Recommended New Dependencies

### Tauri Plugins (Rust + JS)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| tauri-plugin-updater (Rust crate) | 2 | In-app update check, download, install with signature verification | Official Tauri 2 updater plugin. Handles platform-specific binary replacement (NSIS on Windows, tar.gz on macOS/Linux), Ed25519 signature verification, and configurable install modes. Generates signed `.sig` files alongside bundles. Required for `createUpdaterArtifacts` in tauri.conf.json. |
| @tauri-apps/plugin-updater (JS) | ^2.10.0 | Frontend API: `check()`, `downloadAndInstall()` with progress events | JavaScript guest bindings. Version >= 2.10.0 required because tauri-action v1 now generates `latest.json` with `{os}-{arch}-{installer}` keys -- older JS bindings cannot parse this format. |
| tauri-plugin-process (Rust crate) | 2 | App relaunch after update install | Provides `relaunch()` capability. Required because after `downloadAndInstall()` completes, the app must restart to load the new binary. The updater plugin does not include relaunch -- it is a separate concern. |
| @tauri-apps/plugin-process (JS) | ^2.3.1 | Frontend `relaunch()` call | `import { relaunch } from '@tauri-apps/plugin-process'` -- called after update install. Also provides `exit()` if needed for force-update hard block. |

### Frontend Libraries

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| compare-versions | ^6.1.0 | Semver comparison for force-update policy | Zero-dependency, ~1KB gzipped, ESM-native. Needed to compare `getVersion()` against soft/hard minimum versions from the version policy file. The `semver` package (98KB) is overkill -- we only need `compareVersions(a, b)` returning -1/0/1, not range matching or coercion. |

### CI/CD Tools (GitHub Actions)

| Tool | Version/Ref | Purpose | Why Recommended |
|------|-------------|---------|-----------------|
| tauri-apps/tauri-action | v1 | Cross-platform Tauri build + GitHub Release creation + `latest.json` generation | Official action; v1 is current stable (v0 is legacy). Handles all platform-specific bundling, generates signed update artifacts, uploads to GitHub Releases, and creates the `latest.json` updater endpoint file. Supports `owner`/`repo` params for cross-repo publishing. |
| actions/checkout | v4 | Source checkout in CI | Standard; required by tauri-action |
| actions/setup-node | v4 | Install Node.js LTS in CI | Use with `cache: 'npm'` and `cache-dependency-path: 'taskflow/package-lock.json'` for fast installs |
| dtolnay/rust-toolchain | @stable | Install stable Rust in CI | Preferred over deprecated actions-rs/toolchain; simpler, maintained |
| swatinem/rust-cache | v2 | Cache Rust compilation artifacts | Saves 5-10 minutes per build; cache key auto-generated from Cargo.lock |

## Installation

```bash
# Frontend (from taskflow/ directory)
npm install @tauri-apps/plugin-updater @tauri-apps/plugin-process compare-versions

# Rust (from taskflow/src-tauri/ directory)
cargo add tauri-plugin-updater --target 'cfg(any(target_os = "macos", windows, target_os = "linux"))'
cargo add tauri-plugin-process --target 'cfg(any(target_os = "macos", windows, target_os = "linux"))'

# One-time: generate signing keypair
npx tauri signer generate -- -w ~/.tauri/taskflow.key
```

No new dev dependencies needed.

## Configuration Changes Required

### tauri.conf.json additions

```jsonc
{
  "bundle": {
    "createUpdaterArtifacts": true  // NEW: generates .sig files + latest.json
  },
  "plugins": {
    "updater": {
      "pubkey": "<GENERATED_PUBLIC_KEY>",
      "endpoints": [
        "https://github.com/<ORG>/<PUBLIC_REPO>/releases/latest/download/latest.json"
      ]
    }
  }
}
```

The `version` field should be set to `"0.0.0-dev"` as a placeholder -- CI injects the real version from git tags (see Version Injection below).

### lib.rs additions

```rust
// Add to tauri::Builder::default().setup(|app| { ... })
#[cfg(desktop)]
app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
#[cfg(desktop)]
app.handle().plugin(tauri_plugin_process::init())?;
```

### Capabilities (src-tauri/capabilities/)

Add to the default capability file:
- `"updater:default"` -- allows check, download, install
- `"process:default"` -- allows relaunch and exit

## CI/CD Architecture

### Version Injection from Git Tags

Tauri reads `version` from `tauri.conf.json` at build time. The `--config` flag applies JSON Merge Patch (RFC 7396), allowing build-time overrides without modifying the source file.

**Strategy:**
1. **Tag format:** `v1.6.0` pushed to the private repo triggers the workflow
2. **Version extraction:** `APP_VERSION="${GITHUB_REF#refs/tags/v}"`
3. **Config override:** Pass to tauri-action via `args: --config '{"version":"${{ env.APP_VERSION }}"}'`
4. **Result:** `tauri.conf.json` keeps placeholder `"0.0.0-dev"`, CI builds with the real version, no manual bumps, no git dirty state

### Cross-Repo Release Publishing

The workflow runs on the **private** repo but publishes releases to a **public** repo:

1. **GitHub PAT:** Create a fine-grained personal access token with `contents: write` permission scoped to the public repo only. Store as `PUBLIC_REPO_RELEASE_TOKEN` in the private repo's secrets.
2. **tauri-action config:** Use `owner` and `repo` inputs:
   ```yaml
   - uses: tauri-apps/tauri-action@v1
     env:
       GITHUB_TOKEN: ${{ secrets.PUBLIC_REPO_RELEASE_TOKEN }}
     with:
       owner: <org>
       repo: <public-repo>
       tagName: v__VERSION__
       releaseName: "Taskflow v__VERSION__"
       releaseDraft: true
       generateReleaseNotes: true
   ```
3. `__VERSION__` is auto-replaced by tauri-action with the version from the (overridden) tauri.conf.json.
4. `releaseDraft: true` means releases are created as drafts -- a human reviews and publishes. Once published, the updater endpoint goes live.

**Why `GITHUB_TOKEN` (workflow token) does NOT work:** It is scoped to the repo running the workflow. Cross-repo writes require a PAT.

### GitHub Actions Matrix

```yaml
strategy:
  fail-fast: false
  matrix:
    include:
      - platform: macos-latest
        args: --target aarch64-apple-darwin
      - platform: macos-latest
        args: --target x86_64-apple-darwin
      - platform: ubuntu-22.04
        args: ""
      - platform: windows-latest
        args: ""
```

### Required GitHub Secrets (Private Repo)

| Secret | Purpose |
|--------|---------|
| `TAURI_SIGNING_PRIVATE_KEY` | Ed25519 private key content (NOT path) for signing update bundles |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for the signing key (set during `signer generate`) |
| `PUBLIC_REPO_RELEASE_TOKEN` | Fine-grained PAT with `contents: write` on the public repo |

### Build Environment Variables

```yaml
env:
  TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
```

Must be set on the build step; the Tauri CLI reads them to generate `.sig` signature files and the `latest.json` manifest.

## Fetching GitHub Release Notes in the App

Use the existing `tauri-plugin-http` to call the GitHub REST API. **No new dependencies needed** -- the public repo requires no authentication.

### API Endpoints

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `GET /repos/{owner}/{repo}/releases/latest` | Latest release with body (markdown changelog) | None (public repo) |
| `GET /repos/{owner}/{repo}/releases` | All releases for version history page | None (public repo) |
| `GET /repos/{owner}/{repo}/releases/tags/{tag}` | Specific release by tag | None (public repo) |

### Response Shape (relevant fields)

```typescript
interface GitHubRelease {
  tag_name: string;        // "v1.6.0"
  name: string;            // "Taskflow v1.6.0"
  body: string;            // Markdown changelog
  published_at: string;    // ISO 8601
  prerelease: boolean;
  html_url: string;        // Link to release page on GitHub
}
```

Render `body` with existing `react-markdown` + `remark-gfm` + `rehype-raw` pipeline -- already installed and used for Jira issue descriptions.

### Version Policy File

Host `version-policy.json` as a release asset on the public repo (or at a raw.githubusercontent.com URL):

```json
{
  "softMinimum": "1.5.0",
  "hardMinimum": "1.4.0",
  "message": "Please update for the latest features and bug fixes."
}
```

Fetch alongside release data. Use `compare-versions` to check `getVersion()` against thresholds.

## Existing Stack Reuse Summary

These existing dependencies cover v1.6 needs without new additions:

| Existing Dep | Reused For |
|--------------|------------|
| @tauri-apps/api | `getVersion()`, `getName()`, `getTauriVersion()` for About dialog |
| @tauri-apps/plugin-http | Fetching GitHub Releases API and version policy file |
| react-markdown + remark-gfm + rehype-raw | Rendering changelog markdown in update dialog and version history |
| TanStack Query | Caching release data with stale-while-revalidate; configurable `refetchInterval` for update checks |
| Zustand + tauri-plugin-store | Persisting update preferences (check frequency, dismissed versions, last check timestamp) |
| shadcn/ui Dialog + AlertDialog | Update prompt, force-update block, About modal |
| lucide-react | Icons: Download, RefreshCw, Info, AlertTriangle, CheckCircle |

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| tauri-plugin-updater | CrabNebula Cloud | If you need update analytics, staged rollouts, or a managed CDN; adds cost and vendor dependency -- unnecessary for this team size |
| GitHub Releases endpoint | Self-hosted update server | If GitHub is blocked on user machines or you need geographic CDN; GitHub Releases CDN is fast and free for public repos |
| compare-versions | semver (npm) | If you need range matching (`^1.2.3`, `~1.2.x`); compare-versions is sufficient for the gt/lt/eq checks that force-update policy requires |
| tauri-action v1 | Manual `tauri build` in CI | If you need non-standard artifact processing; tauri-action handles 95% of cases and auto-generates `latest.json` |
| Fine-grained PAT | GitHub App installation token | If the org has many repos needing cross-repo access; overkill for one target repo |
| `--config` JSON merge for version | sed/jq to edit tauri.conf.json | `--config` is cleaner -- no file mutations, no git dirty state, and is the officially documented approach |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| electron-updater | Electron-specific; incompatible with Tauri | tauri-plugin-updater |
| Sparkle (macOS framework) | macOS-only; Tauri already abstracts platform update mechanisms | tauri-plugin-updater handles all platforms |
| Polling from Rust main process | Adds HTTP complexity in Rust; existing patterns use renderer-side HTTP | Fetch from frontend with tauri-plugin-http + TanStack Query |
| `GITHUB_TOKEN` for cross-repo releases | Scoped to workflow repo; cannot write to other repos | Fine-grained PAT as `PUBLIC_REPO_RELEASE_TOKEN` |
| Manual version bumps in tauri.conf.json | Error-prone, merge conflicts, easy to forget | Git tag + `--config` override |
| semver (98KB) | Massive for simple comparison; includes range parsing, coercion, prerelease logic we do not need | compare-versions (1KB, zero deps) |
| Custom update server | Operational overhead for hosting, monitoring, and CDN | GitHub Releases (free, reliable, globally cached) |

## Platform-Specific Notes

### Windows
- Updater uses NSIS installer; `installMode` options: `"passive"` (progress bar, no interaction -- recommended), `"basicUi"`, `"quiet"`
- App process **exits** during NSIS install; the new version auto-launches afterward
- Consider `on_before_exit` hook only if app needs to save state before forced exit (unlikely -- Zustand persist already saves on change)

### macOS
- Uses `.tar.gz` bundle replacement; app does **not** exit during install
- `relaunch()` required to switch to the new version
- Two matrix entries needed: `aarch64-apple-darwin` (Apple Silicon) and `x86_64-apple-darwin` (Intel)
- Universal binary (`--target universal-apple-darwin`) is possible but requires both toolchains on the runner and doubles macOS build time

### Linux
- Uses `.AppImage` as primary format with `.tar.gz` for updates
- AppImage is portable (no installer) -- matches the project constraint
- Linux ARM64 runners only available for public repos on GitHub Actions free tier; private repos need self-hosted runners or emulation (slow)
- For this project, x86_64 Linux is sufficient unless ARM users emerge

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| tauri-plugin-updater 2.x | tauri 2.x (Cargo.toml) | Must match major version; use `2` for latest compatible minor |
| @tauri-apps/plugin-updater ^2.10.0 | @tauri-apps/api ^2 | >= 2.10.0 required for new `latest.json` format |
| tauri-plugin-process 2.x | tauri 2.x | Same plugin workspace; versions track together |
| @tauri-apps/plugin-process ^2.3.1 | @tauri-apps/api ^2 | Straightforward compatibility |
| tauri-action v1 | Tauri 2.x | Requires Node v24+ on runners (GitHub runner >= v2.327.1); `ubuntu-22.04` or `ubuntu-latest` both work |
| compare-versions ^6.1.0 | Any modern JS | Zero dependencies; ESM with CJS fallback; works in Vite/Tauri webview |

## Sources

- [Tauri v2 Updater Plugin docs](https://v2.tauri.app/plugin/updater/) -- plugin setup, config structure, JS API, signing workflow (HIGH confidence)
- [Tauri GitHub Actions pipeline guide](https://v2.tauri.app/distribute/pipelines/github/) -- workflow YAML, matrix strategy, tauri-action usage (HIGH confidence)
- [tauri-apps/tauri-action GitHub](https://github.com/tauri-apps/tauri-action) -- action inputs: `owner`, `repo`, `uploadUpdaterJson`, `args`, `tagName` (HIGH confidence)
- [Tauri Configuration Files docs](https://v2.tauri.app/develop/configuration-files/) -- `--config` JSON Merge Patch (RFC 7396) for build-time overrides (HIGH confidence)
- [GitHub REST API: Releases](https://docs.github.com/en/rest/releases/releases) -- endpoints for fetching release metadata and body (HIGH confidence)
- [@tauri-apps/plugin-updater npm](https://www.npmjs.com/package/@tauri-apps/plugin-updater) -- version 2.10.0 (MEDIUM confidence -- version from npm search, not verified via Context7)
- [@tauri-apps/plugin-process npm](https://www.npmjs.com/package/@tauri-apps/plugin-process) -- version 2.3.1 (MEDIUM confidence)
- [compare-versions npm](https://www.npmjs.com/package/compare-versions) -- zero-dep semver comparison (HIGH confidence)
- [Cross-repo GitHub Actions patterns](https://oneuptime.com/blog/post/2025-12-20-cross-repository-workflows-github-actions/view) -- PAT requirements for cross-repo releases (MEDIUM confidence)
- [Tauri updater + GitHub discussion](https://thatgurjot.com/til/tauri-auto-updater/) -- real-world setup walkthrough (MEDIUM confidence)

---
*Stack research for: Taskflow v1.6 release pipeline, auto-update, and version management*
*Researched: 2026-03-24*
