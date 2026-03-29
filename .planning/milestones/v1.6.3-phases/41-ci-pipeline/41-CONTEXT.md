# Phase 41: CI Pipeline - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

A git tag push on the private repo triggers automated cross-platform builds and publishes a release to the public repo — the full distribution pipeline works end-to-end. This phase wires up GitHub Actions, replaces all placeholder URLs from Phases 38-40, and validates the updater cycle. No app-side code changes beyond URL replacement.

</domain>

<decisions>
## Implementation Decisions

### Repo strategy
- **D-01:** CI on private repo (`Mimo01/taskflow`) builds artifacts and publishes a GitHub Release to public repo (`Mimo01/taskflow-releases`) using a deploy key or PAT.
- **D-02:** Updater endpoint: `https://github.com/Mimo01/taskflow-releases/releases/latest/download/latest.json`
- **D-03:** Version policy URL: `https://raw.githubusercontent.com/Mimo01/taskflow-releases/main/version-policy.json`
- **D-04:** GitHub Releases API for version history: `https://api.github.com/repos/Mimo01/taskflow-releases/releases`

### Code signing
- **D-05:** Skip code signing for both macOS and Windows in this phase. Ship unsigned binaries. macOS users bypass Gatekeeper via right-click > Open; Windows users dismiss SmartScreen warning. Signing deferred to a future phase when user base warrants the cert cost.

### Release workflow
- **D-06:** Release notes authored manually in git tag annotations (`git tag -a v1.6.0 -m "release notes here"`). CI extracts tag message body and uses it as GitHub Release body + changelog for the update dialog.
- **D-07:** Workflow triggers on push of tags matching `v[0-9]*` (semver format: v1.6.0, v1.6.1, etc.).
- **D-08:** Fully automatic pipeline — tag push triggers build + publish with no manual approval gate. Release timing controlled by when tags are pushed.

### Build matrix
- **D-09:** macOS: universal binary (single fat binary for aarch64 + x86_64). One build, one download for all Macs.
- **D-10:** Windows: x86_64 only.
- **D-11:** Linux: x86_64 only.
- **D-12:** Minimal artifact set per platform — updater artifact (.tar.gz/.zip) + one installer (.dmg for macOS, .msi for Windows, .AppImage for Linux). No duplicate installer formats.

### Claude's Discretion
- GitHub Actions runner versions (ubuntu-latest, macos-latest, windows-latest vs pinned)
- Cross-repo publish mechanism (deploy key vs PAT — both work)
- How to extract tag annotation for release notes (git command in CI)
- Tauri CLI build flags for universal binary
- Artifact naming convention
- Whether to run tests in CI before building (recommended but implementation detail)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Tauri build config
- `taskflow/src-tauri/tauri.conf.json` — Updater endpoint (PLACEHOLDER to replace with D-02), bundle config with `createUpdaterArtifacts: true`, version field written by inject-version
- `taskflow/src-tauri/Cargo.toml` — Rust dependencies including tauri-plugin-updater

### Version injection
- `taskflow/scripts/inject-version.cjs` — Reads git tag, writes version to tauri.conf.json, outputs APP_VERSION/APP_COMMIT_SHA/APP_BUILD_DATE for Vite define
- `taskflow/vite.config.ts` — Vite config where build-time constants are injected
- `taskflow/src/lib/build-info.ts` — Frontend build metadata consumption (version, commitSha, buildDate)

### Placeholder URLs to replace
- `taskflow/src-tauri/tauri.conf.json` — updater endpoint (`OWNER/RELEASES_REPO` placeholder)
- `taskflow/src/hooks/useVersionPolicyCheck.ts` — version policy URL (PLACEHOLDER)

### Rust entry point
- `taskflow/src-tauri/src/lib.rs` — Plugin registration, menu bar setup (no changes expected but context for understanding build)

### Requirements
- `.planning/REQUIREMENTS.md` — CI-01, CI-02

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/inject-version.cjs`: Complete version injection script — reads git tag, writes tauri.conf.json, exports env vars. CI workflow calls this before `tauri build`.
- `tauri.conf.json` with `createUpdaterArtifacts: true`: Tauri already configured to generate updater-compatible artifacts (latest.json + signed archives).
- Ed25519 updater signing: `tauri-plugin-updater` in Cargo.toml, updater plugin registered in lib.rs with `#[cfg(desktop)]` guard.

### Established Patterns
- Build command chain: `npm run build` (tsc + vite) configured as `beforeBuildCommand` in tauri.conf.json
- Version is `0.0.0-dev` in tauri.conf.json — overwritten by inject-version.cjs at build time
- Portable executable distribution — no system installer, no admin rights

### Integration Points
- `inject-version.cjs` must run before `tauri build` in CI (writes version to tauri.conf.json + exports env vars)
- Vite define constants (`APP_VERSION`, `APP_COMMIT_SHA`, `APP_BUILD_DATE`) must be set during CI build
- Public repo `Mimo01/taskflow-releases` receives: GitHub Release with artifacts + latest.json + version-policy.json (static file in repo root)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

- macOS code signing + notarization (Apple Developer ID $99/yr) — future phase when user base grows
- Windows code signing (Azure Trusted Signing or OV/EV cert) — future phase
- Multiple update channels (stable/beta/nightly) — explicitly out of scope per REQUIREMENTS.md

</deferred>

---

*Phase: 41-ci-pipeline*
*Context gathered: 2026-03-25*
