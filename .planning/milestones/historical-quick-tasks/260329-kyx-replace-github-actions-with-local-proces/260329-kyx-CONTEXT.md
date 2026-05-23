# Quick Task 260329-kyx: Replace GitHub Actions with local processes to minimize CI runtime - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Task Boundary

Replace GitHub Actions CI and release workflows with local processes. Goal: eliminate or minimize GitHub Actions runtime costs.

Current workflows:
- `ci.yml`: lint, typecheck, tests on push/PR to main
- `release.yml`: 3-platform Tauri build (macOS/Windows/Linux), publish to Mimo01/taskflow-releases, update README

</domain>

<decisions>
## Implementation Decisions

### CI Workflow Replacement
- Replace ci.yml with local git hooks (husky) for pre-commit/pre-push
- Run lint, typecheck, and tests locally before code reaches GitHub
- Remove ci.yml entirely — no cloud CI for checks

### Release Build Strategy
- Build all three platforms locally — user insists on no CI for builds
- macOS: native build (already proven with 260327-edt local build)
- Linux: Docker container cross-compilation (Ubuntu + WebKit2GTK + Rust)
- Windows: cross-compile via cargo-xwin (produces NSIS .exe; .msi may not be possible without real Windows)
- Remove release.yml entirely
- Research found cross-compile is experimental but user wants to try it

### Release Publishing
- Extend release.sh to handle full release lifecycle locally
- Use curl + GitHub REST API (not gh CLI) with personal access token
- Create GitHub release on Mimo01/taskflow-releases
- Upload built artifacts (dmg, exe, msi, deb, rpm, AppImage + signatures)
- Update releases repo README with download links
- Token stored in environment variable (not hardcoded)

### Claude's Discretion
- Husky hook configuration details (which hooks run which checks)
- Docker image selection for cross-compilation
- Error handling and retry logic in upload script

</decisions>

<specifics>
## Specific Ideas

- Existing release.sh already runs tests + lint + typecheck before bumping
- Local macOS build was successfully done in quick task 260327-edt
- inject-version.cjs and bump-version.mjs already exist for version management
- TAURI_SIGNING_PRIVATE_KEY needed for signed builds — must be available locally

</specifics>

<canonical_refs>
## Canonical References

- taskflow/scripts/release.sh — current release script
- taskflow/scripts/bump-version.mjs — version bumping
- taskflow/scripts/inject-version.cjs — build-time version injection
- .github/workflows/ci.yml — CI workflow to replace
- .github/workflows/release.yml — release workflow to replace

</canonical_refs>
