# Project Research Summary

**Project:** Taskflow v1.6 — Release Pipeline, Auto-Update & Version Management
**Domain:** Desktop app release automation, in-app auto-update, version enforcement (Tauri 2)
**Researched:** 2026-03-24
**Confidence:** HIGH

## Executive Summary

Taskflow v1.6 is a well-scoped infrastructure milestone: add a production release pipeline and in-app auto-update system to an existing Tauri 2 desktop app. The domain is mature — Tauri's official updater plugin, tauri-action, and GitHub Releases together form an established pattern with high-quality documentation. All four research areas converge on the same implementation: official Tauri plugins (no third-party updater required), GitHub Releases as the CDN endpoint (no custom server), and a private-to-public repo publishing model that keeps source code proprietary while distributing binaries openly. Existing app architecture (plugin bridge services, LazyStore persistence, TanStack Query polling, shadcn/ui dialogs, settings section pattern) maps directly to all new components — this is additive work, not a rewrite.

The recommended approach is a sequential 7-phase build: (1) signing + plugin/config foundation, (2) service/store layer, (3) update detection and prompt UI, (4) force-update policy enforcement, (5) settings integration, (6) About dialog and menu integration, (7) full CI workflow. Every feature except the CI pipeline can be developed and tested locally before the first real release. The CI pipeline phase is intentionally last because it is the only step requiring external setup (Apple Developer account, Windows code signing cert, GitHub PAT, public repo configuration) and depends on all app-side code being correct first.

The dominant risk in this domain is irreversibility: losing the Ed25519 signing private key permanently breaks auto-updates for every installed copy, with no recovery path. The second critical risk is platform security gating — macOS Gatekeeper hard-blocks unnotarized apps and Windows SmartScreen degrades user trust for unsigned binaries. Both must be addressed in Phase 1 before any external distribution. A secondary but important concern is the force-update policy: an incorrectly configured `version-policy.json` or a policy check that fails closed (blocks on network error) can lock out all users simultaneously — the design must fail-open from the start.

## Key Findings

### Recommended Stack

The existing Taskflow stack already provides everything needed on the frontend: `react-markdown` renders changelogs, `tauri-plugin-http` handles CORS-free GitHub API fetches, TanStack Query manages polling and caching, Zustand + tauri-plugin-store persists update preferences, and shadcn/ui Dialog provides update and About modals. Only five new dependencies are needed.

**New dependencies:**
- `@tauri-apps/plugin-updater` (JS, ^2.10.0): Frontend API for `check()`, `downloadAndInstall()` — version pinned to 2.10.0+ due to breaking `latest.json` key format change in tauri-action v1
- `tauri-plugin-updater` (Rust, 2): Binary download, Ed25519 signature verification, platform-specific install
- `@tauri-apps/plugin-process` (JS, ^2.3.1): `relaunch()` after update install
- `tauri-plugin-process` (Rust, 2): App restart capability (intentionally separate from the updater plugin by Tauri's design)
- `compare-versions` (JS, ^6.1.0): Zero-dependency 1KB semver comparison for version policy; the `semver` package (98KB) is overkill for simple gt/lt/gte checks

**CI/CD tooling:**
- `tauri-apps/tauri-action@v1`: Official action; generates `latest.json`, signs artifacts, cross-platform matrix, cross-repo publishing via `owner`/`repo` inputs
- `dtolnay/rust-toolchain@stable` + `swatinem/rust-cache@v2`: Preferred Rust setup; saves 5-10 minutes per build

**Existing dependencies reused without modification:** `react-markdown` + `remark-gfm` + `rehype-raw` (changelogs), `tauri-plugin-http` (GitHub API + version policy), TanStack Query (polling + caching), Zustand + tauri-plugin-store (preferences), shadcn/ui Dialog + AlertDialog, lucide-react icons.

See full details: `.planning/research/STACK.md`

### Expected Features

**Must have — table stakes for v1.6 (all P1):**
- Signing key generation — foundation; everything in the updater chain depends on this
- GitHub Actions CI pipeline — cross-platform matrix builds triggered by git tag push
- Private-to-public repo release publishing — source code stays private; binaries are public
- Version derived from git tag — single source of truth via `--config` JSON Merge Patch; no manual bumps
- Background update check on launch + configurable interval — silent, non-blocking
- Update notification with changelog — non-blocking dialog with "Update Now" / "Later" and download progress bar
- One-click download + install + restart — user always consents; Windows uses `installMode: "passive"`
- Two-tier force-update policy (`softMinimum` persistent banner + `hardMinimum` full-screen blocker) — fail-open on network error
- About dialog — version, build date, commit SHA, platform, update status
- Settings "Updates" section — check frequency, manual check trigger, current version display
- macOS menu bar "About Taskflow" item — platform convention

**Should have — add in v1.6.x after validation (P2):**
- Version history in Settings — scrollable release timeline fetched from GitHub API; needs multiple releases to be useful
- "What's New" post-update dialog — compare `lastSeenVersion` on launch
- Update available badge on Settings nav — subtle dot indicator

**Defer to v2+:**
- Staged rollouts, update adoption telemetry, admin-managed update policies, multiple update channels

**Anti-features (explicitly do not build):**
- Silent auto-install without consent — users lose work on unexpected restart
- Delta/differential updates — Tauri does not support them; 10MB binaries download in seconds
- Custom update server — GitHub Releases CDN is free, globally distributed, sufficient

See full details: `.planning/research/FEATURES.md`

### Architecture Approach

The architecture follows four clean layers: CI/CD pipeline (private repo builds, public repo distributes), Rust backend (plugin registration), service/store layer (update state machine + version policy), and React components (dialogs, banners, settings). Every new pattern mirrors an existing one in the codebase — plugin bridge service, LazyStore persist with migration, TanStack Query polling, Settings section extension, menu event to frontend action.

**Major new components:**
1. **GitHub Actions workflow** (`.github/workflows/release.yml`) — tag-triggered matrix build, signs artifacts, publishes to public repo via PAT; version injected at build time
2. **update.ts service** — plugin bridge wrapping `@tauri-apps/plugin-updater` + `@tauri-apps/plugin-process`; follows existing `stronghold.ts`/`tauri.ts` pattern for testability via `vi.mock`
3. **update.store.ts** (Zustand + LazyStore) — update state machine (`idle | checking | available | downloading | installing | error | up-to-date`), persists `lastCheckAt` and `dismissedVersions`
4. **version-policy.ts service** — fetches `version-policy.json` from public repo via `tauri-plugin-http`; fail-open on any error
5. **UpdatePromptDialog** — changelog (markdown via react-markdown), download progress bar, Update Now / Later buttons
6. **ForceUpdateBanner / ForceUpdateBlocker** — soft nag (dismissible per session) and hard block (full-screen, no dismiss) triggered by version comparison against policy
7. **AboutDialog** — `__APP_VERSION__`, `__BUILD_DATE__`, `__COMMIT_HASH__` (from vite.config.ts `define` block), update status from store; opened via `menu-about-taskflow` event
8. **UpdateSettingsSection / VersionHistorySection** — 7th Settings section added following the established 6-section pattern exactly

**Key architectural patterns to follow:**
- Update state machine in Zustand prevents impossible UI states
- Version policy as remote config — `version-policy.json` on the public repo, independently updatable without a new app release
- Build-time version injection via vite.config.ts `define` block for `__APP_VERSION__`, `__BUILD_DATE__`, `__COMMIT_HASH__`
- All GitHub API fetches use existing `tauri-plugin-http` / `apiFetch()` — never browser `fetch()` — to avoid CORS in Tauri's webview

See full details: `.planning/research/ARCHITECTURE.md`

### Critical Pitfalls

1. **Signing key loss is permanently unrecoverable** — Generate the key pair first, before any other work. Store the private key in GitHub Actions secrets AND an offline backup (team password manager). Losing it means every installed copy must manually download the next release.

2. **macOS Gatekeeper requires notarization, not just code signing** — "App is damaged" error hard-blocks launch on non-developer Macs. Requires Apple Developer ID cert ($99/yr) plus notarization via `notarytool`. Use App Store Connect API key in CI (not Apple ID + password; 2FA breaks CI). Test by downloading CI artifact on a clean Mac.

3. **Windows SmartScreen warns on unsigned binaries after every update** — OV/EV code signing cert ($200-700/yr) or Azure Trusted Signing ($10/mo) is required to prevent SmartScreen warnings. If deferred for initial release, document as a known issue; do not ship unsigned to external users without awareness.

4. **Cross-repo publishing silently fails with default `GITHUB_TOKEN`** — The default token is scoped to the running repo only. Cross-repo requires a fine-grained PAT with `contents: write` on the public repo, stored as a separate secret. Classic PAT with broad `repo` scope is a security risk.

5. **Force-update failing closed locks out all users** — Never block the app if the version policy fetch fails. Only block when the check succeeds AND the version is below `hardMinimum`. Cache the last successful policy with a 7-day TTL. Test explicitly with the network disabled.

See full details: `.planning/research/PITFALLS.md`

## Implications for Roadmap

The architecture research provides a well-reasoned 7-phase sequence with clear dependency ordering. Follow it closely — all dependencies are unidirectional and the rationale is solid.

### Phase 1: Foundation — Rust Plugins + Config + Signing
**Rationale:** Every subsequent phase depends on the plugins being available and configured. Signing key generation is the first irreversible decision — do it right before any artifacts are produced. macOS notarization and Windows code signing configuration also belong here, since fixing these after distributing unsigned builds requires user re-downloads.
**Delivers:** `tauri-plugin-updater` + `tauri-plugin-process` added to Cargo.toml and registered in lib.rs; `tauri.conf.json` configured with pubkey, endpoints, and `createUpdaterArtifacts: true`; capabilities updated; JS packages installed; vite.config.ts `define` block added; signing key generated and backed up in two locations.
**Addresses:** Signing key generation, updater plugin wiring, version injection setup (all FEATURES.md P1 blockers)
**Avoids:** Signing key loss (Pitfall 1), macOS Gatekeeper (Pitfall 2), Windows SmartScreen (Pitfall 8), cross-repo token failure (Pitfall 3), version desync (Pitfall 4)

### Phase 2: Update Service + Store
**Rationale:** UI components need the service bridge and state machine before they can function. Establishing the update state machine early prevents impossible states and scattered ad-hoc state across components.
**Delivers:** `src/services/update.ts` (plugin bridge), `src/services/version-policy.ts` (policy fetcher with fail-open), `src/stores/update.store.ts` (state machine + persistence), `updateCheckIntervalHours` added to settings store (migration v10), tests for all.
**Uses:** `@tauri-apps/plugin-updater`, `@tauri-apps/plugin-process`, `compare-versions`, existing LazyStore persist pattern
**Avoids:** Endpoint URL mangling (Pitfall 6), GitHub API rate limits (Pitfall 10), post-update Stronghold re-initialization (Pitfall 9) — audit startup flow during this phase

### Phase 3: Update Check + Prompt Dialog
**Rationale:** Core update UX — the minimum viable update experience users interact with. Depends entirely on Phase 2 service/store layer being complete.
**Delivers:** `src/hooks/useUpdateCheck.ts` (periodic polling via TanStack Query with configurable interval), `src/components/app/UpdatePromptDialog.tsx` (changelog, progress bar, Update Now / Later), mounted in AppLayout.
**Implements:** Update check flow + download + install flow from ARCHITECTURE.md
**Avoids:** Blocking UI during update check (anti-pattern), auto-install without consent (anti-pattern)

### Phase 4: Version Policy Enforcement
**Rationale:** Depends on the update service (Phase 2) and update prompt (Phase 3). `ForceUpdateBlocker` reuses the same update flow as `UpdatePromptDialog`. This phase completes the full version enforcement spectrum from soft nag to hard block.
**Delivers:** `src/components/app/ForceUpdateBanner.tsx` (soft nag, dismissible per session), `src/components/app/ForceUpdateBlocker.tsx` (hard block, no dismiss), mounted in AppLayout, `version-policy.json` template for the public repo.
**Avoids:** Force-update self-DoS (Pitfall 7) — fail-open design is mandatory; test with blocked network before marking complete

### Phase 5: Settings Integration + Version History
**Rationale:** All UI that surfaces update controls to the user. Lowest-risk phase — follows the established 6-section Settings pattern exactly. P2 features (version history) can be included here or deferred to v1.6.x.
**Delivers:** `UpdateSettingsSection.tsx` (check frequency dropdown, Check Now button, version display), `VersionHistorySection.tsx` (GitHub Releases API, markdown changelogs), Settings.tsx modified to add 7th section.
**Uses:** TanStack Query with staleTime: 1hr for version history, existing `apiFetch()` pattern for unauthenticated GitHub API calls

### Phase 6: About Dialog + Menu Integration
**Rationale:** Self-contained feature with one upstream dependency (update store for status display). macOS menu integration follows the existing `menu-nav-sprint` / `menu-command-palette` event pattern — no new patterns to introduce.
**Delivers:** `src/components/app/AboutDialog.tsx` (version, build date, commit SHA, update status), lib.rs modified to replace `PredefinedMenuItem::about` with custom event emitter, Help > About for cross-platform access.
**Uses:** `__APP_VERSION__`, `__BUILD_DATE__`, `__COMMIT_HASH__` from vite.config.ts define block; existing menu event pattern

### Phase 7: CI Pipeline
**Rationale:** Last because it requires all app-side code complete for end-to-end validation, and is the only phase requiring manual external setup (GitHub public repo, Apple Developer account, Windows cert, secrets configuration). The first real release proves the entire system.
**Delivers:** `.github/workflows/release.yml` (full matrix: macOS aarch64 + x86_64, Windows x64, Linux x64), signing key secrets configured, cross-repo PAT configured, version-from-tag injection working via `--config` override, draft release published to public repo, end-to-end update flow tested on each platform.
**Avoids:** All CI-related pitfalls (Pitfalls 1, 2, 3, 4, 5, 8)

### Phase Ordering Rationale

- **Foundation before everything:** Tauri plugin registration in lib.rs is a compile-time requirement. Components importing from `@tauri-apps/plugin-updater` fail to build if the Rust plugin is not registered.
- **Service/store before components:** The update state machine is shared across 4+ components. Establishing it centrally prevents per-component duplication.
- **All app features before CI:** CI cannot be fully validated until the app correctly handles the complete update lifecycle. Debugging CI and app code simultaneously is expensive.
- **Phases 5 and 6 are independent of each other:** They both depend on Phase 2 (store) but not on each other. Can be built in parallel if needed.
- **Force-update (Phase 4) after prompt dialog (Phase 3):** `ForceUpdateBlocker` logically extends the update prompt flow; sequencing mirrors the user experience escalation from notification to enforcement.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (macOS notarization):** If this is the team's first macOS notarization, the App Store Connect API key setup, keychain configuration on CI runners, and notarytool invocation have several CI-specific gotchas. Plan additional investigation time.
- **Phase 1 (Windows code signing decision):** A team decision is needed — Azure Trusted Signing ($10/mo, immediate SmartScreen trust) vs OV/EV certificate ($200-700/yr, reputation builds over time). This choice must be made before CI is configured.
- **Phase 7 (end-to-end validation):** The first real release will surface integration issues not caught locally (signing, notarization, cross-repo publish, `latest.json` format, platform key names). Plan for 1-2 CI iteration cycles.

Phases with standard patterns (can skip research-phase):
- **Phase 2 (service/store):** Follows existing `stronghold.ts` plugin bridge and `settings.store.ts` LazyStore migration patterns exactly.
- **Phase 3 (update prompt):** Tauri updater JS API is well-documented; `downloadAndInstall` progress events are clearly specified; standard shadcn Dialog + progress bar.
- **Phase 4 (force-update):** Version comparison logic is straightforward with `compare-versions`; fail-open pattern is documented.
- **Phase 5 (settings):** Mechanical extension of the existing 6-section Settings pattern; GitHub Releases API is public and unauthenticated.
- **Phase 6 (About dialog):** Existing menu event pattern handles macOS integration; vite.config.ts `define` block is standard Vite.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Tauri 2 updater plugin docs are authoritative and comprehensive. New package versions (plugin-updater ^2.10.0, plugin-process ^2.3.1) confirmed via npm — validate exact minimums during install. |
| Features | HIGH | Feature set derived from official Tauri docs + direct codebase inspection. All P1 features are clearly supported by the plugin API. |
| Architecture | HIGH | All patterns mirror documented Tauri plugin setup and existing codebase conventions. The 7-phase sequence has clean dependency ordering. |
| Pitfalls | HIGH | 10 pitfalls documented with official sources, Tauri community issue references (plugins-workspace#1608, tauri#14703), and GitHub docs. macOS notarization and Windows SmartScreen requirements are authoritative. |

**Overall confidence:** HIGH

### Gaps to Address

- **Apple code signing credentials:** Research assumes the team has or will obtain an Apple Developer ID cert. If not yet acquired, this is a blocking dependency for Phase 7. Apple Developer Program enrollment takes 24-48 hours; factor this into scheduling.
- **Windows code signing decision:** OV cert vs Azure Trusted Signing is a cost/UX tradeoff not resolved by research alone. Needs a team decision before Phase 7 CI configuration.
- **Public release repo:** A public GitHub repo for hosting releases must exist before Phase 7. If it does not exist yet, create a minimal repo (README + license, no source code) well before Phase 7 begins.
- **`@tauri-apps/plugin-updater` version 2.10.0 minimum:** STACK.md flags that 2.10.0+ is required for compatibility with tauri-action v1's new `latest.json` key format. Verify the exact minimum during `npm install` in Phase 1.
- **Stronghold startup re-initialization after updater restart:** Pitfall 9 identifies a Taskflow-specific risk — the updater-triggered restart must not land users on the onboarding screen. The existing startup flow must be audited during Phase 2 to confirm it always attempts vault unlock regardless of restart cause.

## Sources

### Primary (HIGH confidence)
- [Tauri v2 Updater Plugin docs](https://v2.tauri.app/plugin/updater/) — plugin setup, config, JS API, Ed25519 signing
- [Tauri GitHub Actions Pipeline guide](https://v2.tauri.app/distribute/pipelines/github/) — workflow YAML, matrix strategy, tauri-action usage
- [Tauri v2 macOS Code Signing & Notarization](https://v2.tauri.app/distribute/sign/macos/) — certificate types, notarization CI env vars
- [Tauri v2 Windows Code Signing](https://v2.tauri.app/distribute/sign/windows/) — SmartScreen, EV/OV certs, cross-compilation signing
- [Tauri v2 AppImage Distribution](https://v2.tauri.app/distribute/appimage/) — Linux updater AppImage-only constraint
- [tauri-apps/tauri-action GitHub](https://github.com/tauri-apps/tauri-action) — action inputs, cross-repo `owner`/`repo`, latest.json generation
- [Tauri Configuration Files docs](https://v2.tauri.app/develop/configuration-files/) — `--config` JSON Merge Patch (RFC 7396) for build-time version override
- [GitHub REST API: Rate Limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) — 60/hr unauthenticated per IP
- [GitHub REST API: Releases](https://docs.github.com/en/rest/releases/releases) — endpoints for release metadata and changelog body
- [compare-versions npm](https://www.npmjs.com/package/compare-versions) — zero-dep semver comparison
- Taskflow codebase: `tauri.conf.json`, `Cargo.toml`, `capabilities/default.json`, `Settings.tsx`, `settings.store.ts` — direct inspection

### Secondary (MEDIUM confidence)
- [Cross-repo GitHub Actions patterns](https://oneuptime.com/blog/post/2025-12-20-cross-repository-workflows-github-actions/view) — PAT requirements for cross-repo releases
- [Tauri v2 Auto-Update blog](https://thatgurjot.com/til/tauri-auto-updater/) — real-world setup walkthrough
- [Ship Tauri v2 with GitHub Actions](https://dev.to/tomtomdu73/ship-your-tauri-v2-app-like-a-pro-github-actions-and-release-automation-part-22-2ef7) — community CI guide
- [Private repo to public repo release strategy](https://github.com/tauri-apps/tauri/discussions/7553) — community discussion, verified against tauri-action docs
- [AppImage update permission bug (plugins-workspace#1608)](https://github.com/tauri-apps/plugins-workspace/issues/1608) — known Linux execute permission bug after update
- [Custom target URL mangling bug (tauri#14703)](https://github.com/tauri-apps/tauri/issues/14703) — endpoint URL pitfall

### Tertiary (LOW confidence — validate during implementation)
- `@tauri-apps/plugin-updater` npm version 2.10.0 — from npm search; verify exact minimum during Phase 1 install
- `@tauri-apps/plugin-process` npm version 2.3.1 — from npm search; verify during Phase 1 install

---
*Research completed: 2026-03-24*
*Ready for roadmap: yes*
