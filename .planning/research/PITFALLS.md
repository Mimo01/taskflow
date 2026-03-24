# Pitfalls Research

**Domain:** Release pipeline, auto-update, version management, and force-update policy for Tauri 2 desktop app
**Researched:** 2026-03-24
**Confidence:** HIGH (verified against official Tauri 2 docs, GitHub docs, tauri-action source, and community issue reports)

## Critical Pitfalls

### Pitfall 1: Updater Signing Key Loss = Permanently Bricked Update Path

**What goes wrong:**
The Tauri updater requires a cryptographic signature on every update artifact. The private key is generated once via `tauri signer generate`. If this key is lost, every existing installation becomes permanently unable to receive auto-updates -- they must manually download a fresh copy. There is no key rotation mechanism. The signature verification cannot be disabled.

**Why it happens:**
The key is generated locally during initial setup. Developers treat it like any other config file, forget to back it up, or store it only as a CI secret without a separate secure backup. CI secret rotation, repository migration, or GitHub organization changes silently destroy the only copy.

**How to avoid:**
1. Generate the key pair in the very first CI setup step, before any other work: `npx tauri signer generate -w ~/.tauri/taskflow.key`
2. Store the private key in at least two independent secure locations: (a) GitHub repository secret `TAURI_SIGNING_PRIVATE_KEY`, (b) a team password manager or encrypted offline backup.
3. Store the public key content (not path) in `tauri.conf.json` under `plugins.updater.pubkey`.
4. Document the key location in the project runbook. Team must be able to answer "where is the updater signing key?" immediately.
5. The password for the key goes into `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secret. Note: `.env` files do NOT work for these variables -- they must be real environment variables.

**Warning signs:**
- No documented key backup procedure exists.
- Key exists only as a CI secret with no offline backup.
- Build produces artifacts without `.sig` files alongside them.

**Phase to address:**
Phase 1 (CI pipeline foundation) -- key generation must happen before the first build artifact is produced.

---

### Pitfall 2: macOS Gatekeeper Hard-Blocks Unsigned/Unnotarized Apps

**What goes wrong:**
On macOS Catalina and later, Gatekeeper requires both code signing AND notarization for any app distributed outside the App Store. Unlike Windows (where unsigned apps show a dismissible warning), macOS hard-blocks unsigned binaries with "App is damaged and can't be opened." The updater downloads the new version, but macOS refuses to launch it. This is not optional.

**Why it happens:**
Developers test on their own machines where Gatekeeper trusts locally-built apps. The issue only surfaces when a different user downloads the artifact. Code signing alone is insufficient -- Apple also requires notarization (uploading the binary to Apple's servers for automated malware scanning, which takes 1-15 minutes per build).

**How to avoid:**
1. Obtain an Apple Developer ID Application certificate ($99/year Apple Developer Program).
2. Configure CI with `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY` for code signing.
3. Configure CI with `APPLE_ID`, `APPLE_PASSWORD` (app-specific password, NOT Apple ID password), `APPLE_TEAM_ID` for notarization.
4. Use App Store Connect API key (recommended for CI) instead of Apple ID + password to avoid 2FA issues.
5. Test the full flow: download the CI-built `.dmg` on a clean Mac that has never seen the app before. It must open without any Gatekeeper warnings.
6. Accept that macOS CI builds will be 5-15 minutes slower due to notarization upload/wait.

**Warning signs:**
- "App is damaged and can't be opened" on a non-developer Mac.
- Users need to right-click > Open to bypass (this only works for signed-but-not-notarized, and only once).
- CI logs show "codesign" but no "notarytool" step.

**Phase to address:**
Phase 1 (CI pipeline) -- code signing and notarization must be configured in the build workflow before any external distribution.

---

### Pitfall 3: Cross-Repo Publishing Silently Fails with Default GITHUB_TOKEN

**What goes wrong:**
The architecture requires building in a private repo and publishing releases to a separate public repo. The default `GITHUB_TOKEN` is scoped to the repository running the workflow only. Using it with `tauri-action`'s `owner`/`repo` options to target the public repo results in "Resource not accessible by integration" or silent 403 errors. The CI job may appear to succeed but no release is created on the target repo. Worse: the release may be accidentally created on the private repo, exposing source code.

**Why it happens:**
`GITHUB_TOKEN` is automatically scoped to the current repository. Cross-repo operations require a Personal Access Token (PAT) or GitHub App token with explicit permissions on the target repository. Developers test with a single repo and everything works, then the cross-repo setup breaks silently.

**How to avoid:**
1. Create a fine-grained PAT (not classic) with `contents: write` permission scoped to only the public release repo.
2. Store it as a repository secret in the private repo (e.g., `RELEASE_REPO_TOKEN`).
3. Pass it as the `GITHUB_TOKEN` env var in the `tauri-action` step.
4. Set `owner` and `repo` inputs on `tauri-action` to point to the public repo.
5. Set `releaseCommitish` to a valid ref on the target repo (e.g., `main`), or omit it.
6. Add a CI verification step that checks the release appeared on the correct repo.
7. Never use classic PAT with broad `repo` scope -- a compromised token gives write access to ALL repos.

**Warning signs:**
- CI completes "successfully" but no release on public repo.
- Release accidentally created on private repo (potentially exposing source).
- 403 or "Resource not accessible by integration" buried in CI logs.

**Phase to address:**
Phase 1 (CI pipeline) -- token configuration is foundational to the entire release flow.

---

### Pitfall 4: Version Desync Across Three Files Breaks the Updater

**What goes wrong:**
Tauri reads the app version from `tauri.conf.json` (currently `"0.1.0"`). The Rust crate has its own version in `Cargo.toml` (also `"0.1.0"`). The frontend has version in `package.json`. If these drift apart, the updater compares the wrong version, the About dialog shows incorrect information, or builds fail. The updater specifically uses `tauri.conf.json` version for the update comparison.

**Why it happens:**
Developers manually bump one file and forget the others. Or CI automates version injection for one file but not all three. The problem is invisible until the updater either never finds updates (version already matches) or always finds updates (version stuck at old value).

**How to avoid:**
1. Single source of truth: derive the version from the git tag at build time.
2. In CI, extract version from tag (`v1.6.0` -> `1.6.0`) and write to all three files before building. Use `jq` for JSON files and `sed` for TOML.
3. Alternative: use Tauri CLI's `--config` flag to override version at build time: `tauri build --config '{"version":"1.6.0"}'`
4. Add a CI assertion that fails if versions across the three files do not match after injection.
5. Do NOT use semver build metadata (`1.6.0+1`) -- the `+` character breaks URL interpolation in updater endpoints.

**Warning signs:**
- About dialog shows different version than GitHub release.
- Updater says "you're up to date" when a new release exists.
- Updater always prompts for update even after installing latest.

**Phase to address:**
Phase 1 (CI pipeline) -- version injection from git tags must be automated from the start.

---

### Pitfall 5: Linux Updater Only Works with AppImage Format

**What goes wrong:**
Tauri's updater on Linux exclusively supports AppImage. If users download the `.deb` or `.rpm` instead, the updater throws "Cannot run updater on this Linux package. Currently only an AppImage can be updated." as an unhandled promise rejection. There is also a known bug where updated AppImages lose execute permissions after update (plugins-workspace#1608).

**Why it happens:**
The project currently has `"targets": "all"` in `tauri.conf.json`, which builds `.deb`, `.rpm`, AND `.AppImage` on Linux. All formats appear in the release. Users who install via `.deb` expect auto-update to work. It does not.

**How to avoid:**
1. Only publish the `.AppImage` artifact for Linux to the public release repo. Build `.deb`/`.rpm` if desired but do not upload them alongside the updater-compatible release.
2. Alternatively, publish all formats but handle the updater error gracefully: catch the promise rejection and show "Auto-update not available for this package format. Download the latest version manually" with a direct link.
3. After update, programmatically verify execute permissions on the new AppImage (workaround for the known bug).
4. The constraint also means Linux users must use AppImage, not install via package manager -- this aligns with the project's "portable executable, no installer" philosophy.

**Warning signs:**
- Linux users report "update failed" while macOS/Windows users succeed.
- Error logs: "Cannot run updater on this Linux package."
- Updated AppImage fails to launch (permission bug).

**Phase to address:**
Phase 1 (CI pipeline) -- bundle target selection. Phase 2 (updater integration) -- graceful error handling for unsupported formats.

---

### Pitfall 6: Updater Endpoint URL Variable Mangling

**What goes wrong:**
The updater endpoint URL uses `{{target}}`, `{{arch}}`, and `{{current_version}}` as template variables Tauri replaces at runtime. Developers replace these with literal values, use single braces, or configure a custom target that duplicates information. Known bug: setting a custom target produces malformed URLs like `darwin-aarch64-aarch64.json` (tauri#14703).

**Why it happens:**
The double-brace syntax looks like a placeholder to fill in. The `tauri-action` auto-generates a `latest.json` file that contains all platform URLs and signatures -- but the endpoint must point to where this file is hosted. If using GitHub Releases, the simplest pattern does not need `{{current_version}}` in the URL at all.

**How to avoid:**
1. Use the simplest endpoint pattern for GitHub Releases:
   `https://github.com/OWNER/PUBLIC-REPO/releases/latest/download/latest.json`
   This auto-generated file contains version, signatures, and platform-specific download URLs.
2. Do NOT use `{{current_version}}` in the URL when using static JSON from GitHub Releases.
3. Do NOT set a custom `target` in the updater plugin config unless you have a specific reason.
4. Do NOT use version strings with `+` build metadata (e.g., `1.6.0+1`) -- the `+` breaks URL encoding.
5. Test the endpoint URL manually with `curl` before wiring it into the app.

**Warning signs:**
- Update check returns 404.
- URL in network logs contains doubled platform names or unresolved `{{variables}}`.
- Update check works on macOS but fails on Windows/Linux.

**Phase to address:**
Phase 2 (updater integration) -- endpoint configuration.

---

### Pitfall 7: Force-Update Policy Becomes a Denial-of-Service Against Your Own Users

**What goes wrong:**
A hard force-update (blocking the app until update) locks users out permanently if: (a) the update endpoint is unreachable, (b) the latest release has a broken binary, (c) the version policy file has a typo setting minimum to a future version, or (d) the user is behind a corporate proxy blocking GitHub. The app becomes completely unusable with no escape hatch.

**Why it happens:**
Force-update seems simple: compare local version to minimum, block if below. But the implementation does not account for the update infrastructure itself failing. A single misconfigured `version-policy.json` or a GitHub CDN outage turns force-update into a self-inflicted outage.

**How to avoid:**
1. Never hard-block on failed version check -- only block if the check SUCCEEDS and the version is below the hard minimum. Network failure = allow the app to run.
2. Cache the last successful version policy response locally with a maximum cache age (e.g., 7 days). Use cached policy if network request fails.
3. Include an emergency bypass: allow N app launches (e.g., 3) even when blocked, or a settings toggle to temporarily disable force-update.
4. The version policy file must be independently deployable -- a plain JSON file on the public repo, not bundled inside the app.
5. Test the policy exhaustively: test with blocked version, test with unreachable endpoint, test with malformed JSON, test with version higher than any release.

**Warning signs:**
- No fallback behavior defined for "version check request failed."
- Policy file is bundled inside the app (cannot be updated independently).
- No way to disable force-update without shipping a new app version.
- Policy file only tested with "happy path" versions.

**Phase to address:**
Phase 3 (force-update policy) -- must be designed with failure modes in mind from the start.

---

### Pitfall 8: Windows Code Signing Certificate = SmartScreen Trust

**What goes wrong:**
Without a code signing certificate from a trusted CA, Windows SmartScreen shows "Windows protected your PC -- Microsoft Defender SmartScreen prevented an unrecognized app from starting." Users must click "More info" then "Run anyway." For the auto-updater, this warning appears after every update, training users to click through security warnings -- the opposite of good security practice. A self-signed certificate does NOT help; SmartScreen still warns.

**Why it happens:**
Windows code signing requires a certificate from a recognized Certificate Authority. EV (Extended Validation) certificates provide immediate SmartScreen trust. OV (Organization Validation) certificates require building reputation through download volume. Developers skip this during development and forget it is required for distribution.

**How to avoid:**
1. Purchase an OV or EV code signing certificate from a CA (DigiCert, Sectigo, SSL.com). Cost: $200-500/year for OV, $300-700/year for EV.
2. Alternatively, use Azure Trusted Signing (newer, cloud-based, $10/month) which provides immediate SmartScreen reputation.
3. Configure CI with `TAURI_SIGNING_PRIVATE_KEY` for updater signatures AND the Windows code signing certificate separately -- these are two different signing systems.
4. For cross-compiling Windows from Linux CI runners, use a custom sign command since the default implementation only works on Windows hosts.
5. If budget is a constraint for initial release, accept the SmartScreen warning initially and plan to add code signing later. But document this as a known UX issue.

**Warning signs:**
- Users report SmartScreen warnings on every update.
- Download counts are low because users do not trust the "unrecognized app" warning.
- IT departments block the app installation.

**Phase to address:**
Phase 1 (CI pipeline) -- configure if certificate available. Can be deferred but must be planned for.

---

### Pitfall 9: Updater Restart Loses In-Memory State and Stronghold Lock

**What goes wrong:**
When the Tauri updater applies an update on Windows, the NSIS installer closes the app process to replace the binary. This terminates the app without the normal shutdown sequence. On macOS/Linux, the app restarts after update. In both cases, in-memory state (TanStack Query cache, Zustand non-persisted stores, Stronghold vault lock) is lost. If the app startup flow does not properly re-initialize, the user lands on a broken state after update.

**Why it happens:**
The existing app startup assumes a clean launch (onboarding or credential loading from Stronghold). An updater-triggered restart is a hybrid: it is not a first launch (credentials exist) but the vault must be re-opened. If the startup flow assumes vault is already open (because the user was just using the app), credentials appear missing and the user sees the onboarding screen.

**How to avoid:**
1. The app startup sequence must always attempt to unlock Stronghold, regardless of how the app was launched. The current vault password is derived from a random 32-byte hex key in Tauri Store -- this survives restart.
2. Set Windows install mode to `"passive"` (not `"quiet"`) so users see progress and know a restart will happen.
3. Warn users before triggering the update install: "The app will restart to apply the update. Any unsaved work will be lost."
4. On macOS, save critical ephemeral state to Tauri Store before triggering install, then restore on restart.
5. Test the full update-restart cycle on each platform, verifying credentials are available after restart without re-entering them.

**Warning signs:**
- Users see onboarding screen after update despite having configured credentials.
- Stronghold "vault not initialized" error after update restart.
- TanStack Query shows stale data from before the update.

**Phase to address:**
Phase 2 (updater integration) -- the restart/re-initialization flow must be tested as part of updater implementation.

---

### Pitfall 10: GitHub API Rate Limits on Update Checks

**What goes wrong:**
If the update check hits the GitHub REST API (e.g., `/repos/OWNER/REPO/releases/latest`), unauthenticated requests are limited to 60 per hour per IP address. In an office environment where multiple users share a corporate NAT IP, 60 requests across all users can be exhausted in minutes, causing all subsequent update checks to fail with 403.

**Why it happens:**
Developers use the GitHub API URL pattern for update checks instead of the raw CDN download URL. The GitHub API is rate-limited; the CDN asset download endpoint is not rate-limited the same way. The difference is subtle: `api.github.com/repos/...` vs `github.com/OWNER/REPO/releases/latest/download/latest.json`.

**How to avoid:**
1. Use the raw download URL, not the API: `https://github.com/OWNER/PUBLIC-REPO/releases/latest/download/latest.json` -- this goes through GitHub's CDN and bypasses API rate limits.
2. Set default update check interval to 24 hours (86400 seconds), user-configurable with a minimum of 1 hour.
3. Never check on every app launch -- check on a timer with randomized jitter to avoid thundering herd from office environments.
4. Cache the last update check result with a timestamp. Skip the check if the cached result is younger than the configured interval.
5. If the check fails (rate limit, network error), do not retry immediately -- back off to the next interval.

**Warning signs:**
- Users in same office all see "update check failed" simultaneously.
- 403 responses with `X-RateLimit-Remaining: 0` header.
- Update check works from home but fails from office.

**Phase to address:**
Phase 2 (updater integration) -- endpoint URL and check frequency configuration.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding version in `tauri.conf.json` instead of injecting from git tag | No CI setup needed for version | Manual bumps, version drift, missed updates, About dialog shows wrong version | Never -- automate from day one |
| Skipping Windows code signing | Faster CI, no certificate cost ($200-500/yr) | SmartScreen warns on every install/update; users trained to bypass security warnings | Internal-only testing; must sign before any external distribution |
| Skipping macOS notarization | 5-15 min faster CI builds | App hard-blocked by Gatekeeper on all non-developer Macs; no workaround | Local development only; never for distributed builds |
| Using `GITHUB_TOKEN` instead of dedicated PAT for cross-repo | Simpler CI setup | Silently fails for cross-repo publish; release lands on wrong repo | Never -- cross-repo always requires dedicated PAT |
| Checking for updates on every app launch | Ensures users always know about updates | Hammers GitHub; 60 req/hr rate limit shared across office users; slows app startup | Never -- use configurable timer with 24hr default |
| Bundling version policy JSON inside the app | No separate file to manage | Cannot change force-update thresholds without shipping a new app version; cannot fix a broken policy remotely | Never -- policy must be a remote file |
| Using `"targets": "all"` without filtering uploads | Simple CI, all formats available | Linux users download `.deb`, get broken updater; release page cluttered | MVP only -- filter to updater-compatible formats before uploading |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GitHub Releases CDN vs API | Using `/repos/OWNER/REPO/releases/latest` API endpoint for update checks (rate-limited at 60/hr per IP) | Use raw download URL `github.com/OWNER/REPO/releases/latest/download/latest.json` which goes through CDN |
| `tauri-action` cross-repo | Forgetting to set `releaseCommitish` when targeting a different repo, causing release to reference nonexistent commit | Set `releaseCommitish` to `main` on the target repo, or omit to use default branch |
| `tauri-action` cross-repo | Using `GITHUB_TOKEN` (repo-scoped) for cross-repo release | Use a fine-grained PAT stored as `RELEASE_REPO_TOKEN` secret with `contents: write` on public repo only |
| Apple notarization in CI | Using Apple ID password directly (fails with 2FA) | Use app-specific password or App Store Connect API key (recommended) |
| `createUpdaterArtifacts` | Setting to `true` but missing `TAURI_SIGNING_PRIVATE_KEY` in environment -- build succeeds but artifacts are unsigned, updater rejects them | CI must export both `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` as env vars (NOT `.env` files) |
| Updater pubkey in config | Setting `pubkey` to a file path | Must embed the actual key content string directly in `tauri.conf.json` -- path references do not work |
| Stronghold after updater restart | Assuming vault is already unlocked after app restart | Startup flow must always attempt vault unlock; the random password in Tauri Store survives restart |
| Windows NSIS installer | Using `installMode: "quiet"` for seamless updates | "quiet" requires admin privileges or user-wide installation; use `"passive"` (progress bar, no interaction required) |
| `latest.json` platform keys | Using wrong platform key format in static JSON | Keys must match Tauri's format: `linux-x86_64`, `windows-x86_64`, `darwin-x86_64`, `darwin-aarch64` |
| Version format in tags | Using `v1.6.0+1` (semver build metadata) | The `+` character breaks URL interpolation in updater endpoints; use plain `v1.6.0` |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Update check on every app launch | Slow startup; 403 rate limit errors in office | Timer-based check with 24hr default, randomized jitter, minimum 1hr | When 60+ users share a NAT IP |
| Downloading full binary before version comparison | Wasted bandwidth, slow "checking for updates" UX | Fetch only `latest.json` (tiny JSON, ~1KB) first; download binary only if update available | Immediately -- every check wastes bandwidth |
| macOS universal binary builds | 2x build time, 2x artifact size (100MB+ universal vs 50MB per-arch) | Build separate `x86_64` and `aarch64` binaries; Apple Silicon is majority now | CI time and artifact storage doubles |
| Sequential platform builds in CI | 30-45 minute pipeline | Use GitHub Actions matrix to build macOS/Windows/Linux in parallel | Immediately -- blocks releases for 30+ min |
| Fetching GitHub Release API for changelog display | Rate-limited; slow; returns markdown that needs parsing | Embed release notes in `latest.json` via the `notes` field (auto-populated by `tauri-action`) | Office environments with shared IP |
| Version policy check blocking app startup | App hangs on launch if GitHub is slow/unreachable | Async check with timeout (5s max); allow app to load; show result in banner | Any network-constrained environment |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Committing updater private key to repository | Anyone with repo access can sign malicious updates that all installations will trust | Store only as CI secret + offline backup; add `*.key` to `.gitignore` |
| Using classic PAT with broad `repo` scope for cross-repo | Token compromise gives write access to ALL repos, not just release repo | Use fine-grained PAT scoped to only the public release repo with `contents: write` only |
| Serving version policy over HTTP | MITM can modify force-update thresholds -- either blocking all users or preventing critical security updates | Tauri enforces TLS in production by default; ensure policy endpoint is also HTTPS (GitHub is) |
| Not validating version policy JSON schema | Malformed JSON could crash the version check, either blocking or allowing all versions | Define strict schema; if parsing fails, treat as "no policy" (allow app to run) |
| Apple Developer credentials in CI logs | Certificate password and notarization credentials leak in build output | Use GitHub `secrets` context exclusively; verify CI logs do not echo env vars; use `mask` for dynamic secrets |
| Updater endpoint on HTTP in development leaking to production | Updates could be intercepted and replaced with malicious binaries | Use `dangerousInsecureTransportProtocol: true` only in dev config; production config must enforce HTTPS |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Blocking app during update download | User cannot work while 50-100MB binary downloads on slow connection | Download in background; show progress in non-blocking banner; offer "Install Now" when complete |
| No changelog in update prompt | User does not know what changed; defaults to "Later" out of uncertainty | Display release notes from the `notes` field of `latest.json` in the update dialog |
| Force-update on first launch after long absence | User opens app for urgent task, gets blocked by mandatory update | Soft minimum: persistent nag banner allowing continued use. Hard minimum: only for critical security fixes with 24hr grace period |
| Silent update restart on Windows | NSIS installer closes app without warning; unsaved ephemeral state lost | Warn user before install; use `installMode: "passive"` not `"quiet"` |
| "Check for updates" button with no visible feedback | User clicks, nothing appears to happen (check is fast, no update available) | Always show result: "You're on the latest version (v1.6.0)" or "Update available: v1.7.0" with action button |
| Version history page empty on first install | New users see empty "Version History" section | Pre-populate with current version's notes; fetch historical releases from GitHub API (with cache) |
| About dialog shows "0.1.0" during development | Confusing during testing; might ship if version injection is misconfigured | Show build metadata: version + commit hash + build date; detect dev builds and show "Development Build" label |
| Update available but user on metered connection | Large download consumes mobile data | Detect metered/cellular connection if possible; at minimum, show download size before user confirms |

## "Looks Done But Isn't" Checklist

- [ ] **Updater signing:** Often missing `.sig` files alongside artifacts -- verify every release artifact has a corresponding `.sig` file
- [ ] **Updater pubkey:** Often set as file path instead of content -- verify the actual base64 key string is in `tauri.conf.json`, not a path
- [ ] **macOS notarization:** Often only code-signed, not notarized -- verify downloaded `.dmg` launches on a clean Mac without Gatekeeper warning
- [ ] **Cross-repo release:** Often targets wrong repo -- verify release appears on the PUBLIC repo with correct tag, not the private one
- [ ] **Version sync:** Often only updates one file -- verify `tauri.conf.json`, `Cargo.toml`, AND `package.json` all show the git tag version in built artifacts
- [ ] **Linux AppImage update:** Often missing execute permission after update -- verify the updated AppImage is executable without manual `chmod`
- [ ] **Update check interval:** Often hardcoded or too frequent -- verify users can change frequency in Settings; default is 24hr, minimum 1hr
- [ ] **Force-update offline:** Often not tested -- verify app still launches when version policy endpoint is unreachable (network off)
- [ ] **Force-update bad policy:** Often not tested -- verify app handles malformed `version-policy.json` gracefully (does not crash or block)
- [ ] **Windows install mode:** Often left as default -- verify `"passive"` is set; test that users see progress during update
- [ ] **About dialog version:** Often hardcoded -- verify it reads the actual built version, not a constant `"0.1.0"`
- [ ] **Updater in dev mode:** Often crashes -- verify updater gracefully skips or shows "not available in dev mode" when running `tauri dev`
- [ ] **Changelog in update prompt:** Often empty -- verify release notes display in the update dialog, not just "Update available"
- [ ] **Post-update Stronghold:** Often broken -- verify credentials are available after updater-triggered restart without re-entering PATs

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Lost updater signing key | HIGH | Generate new key pair. ALL existing installations cannot auto-update -- every user must manually download the next version. The new version ships with the new public key. This is a one-time pain point but affects every installed user. |
| Version policy locks out all users | LOW | Fix `version-policy.json` on public repo (plain JSON push). Users recover on next version check. If file was deleted, app should fall back to "no policy" (allow). |
| Release published to wrong repo | LOW | Delete release from wrong repo; re-run CI with correct `owner`/`repo`. No user impact if no one downloaded. |
| Unsigned macOS build distributed | MEDIUM | Users who downloaded must manually delete and re-download. Publish signed+notarized build; notify affected users. |
| Version drift across config files | LOW | Fix CI version injection; cut a new release. Updater uses `tauri.conf.json` version -- if that one is correct, updates still work for existing users. |
| Corrupted update binary distributed | LOW | Tauri's signature verification rejects corrupted binaries automatically. Old version keeps running. Fix build; publish new release. User sees "update failed" and can retry. |
| GitHub rate limit on update checks | LOW | Switch from API endpoint to raw CDN URL. Users recover automatically when rate limit resets (1 hour). |
| Force-update blocks app after bad release | MEDIUM | Users cannot auto-update to the good version because the bad version crashes. Must lower the hard minimum in `version-policy.json` to un-block, then publish fixed version. |
| Windows SmartScreen blocks update | LOW | Purchase code signing certificate; re-sign and re-release. Users must re-download once. SmartScreen reputation builds over time with OV certs. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Signing key loss | Phase 1: CI Pipeline Setup | Key generated, backed up in 2+ locations, CI produces `.sig` files |
| macOS Gatekeeper blocks | Phase 1: CI Pipeline Setup | Downloaded `.dmg` opens on clean Mac without warnings |
| Cross-repo token failure | Phase 1: CI Pipeline Setup | Release appears on public repo; private repo has no releases |
| Version desync | Phase 1: CI Pipeline Setup | All three files match git tag; About dialog shows correct version |
| Linux AppImage-only updater | Phase 1: CI Pipeline + Phase 2: Updater | Only AppImage uploaded; updater error handled gracefully for other formats |
| Endpoint URL mangling | Phase 2: Updater Integration | `curl` of endpoint URL returns valid JSON with correct platform keys |
| Force-update self-DoS | Phase 3: Force-Update Policy | App launches when endpoint unreachable; blocked only when check succeeds AND version below hard minimum |
| Windows code signing / SmartScreen | Phase 1: CI Pipeline | If cert available: no SmartScreen warning. If deferred: documented as known issue. |
| Post-update Stronghold re-init | Phase 2: Updater Integration | After update restart, credentials available; no onboarding screen |
| GitHub API rate limits | Phase 2: Updater Integration | Endpoint uses CDN URL; check interval configurable; minimum 1hr |
| Windows silent restart | Phase 2: Updater Integration | Install mode `"passive"`; user warned before restart |

## Sources

- [Tauri 2 Updater Plugin Documentation](https://v2.tauri.app/plugin/updater/) -- signing requirements, endpoint format, platform artifacts, install modes
- [Tauri 2 GitHub Actions Pipeline](https://v2.tauri.app/distribute/pipelines/github/) -- workflow setup, matrix strategy, cross-repo options
- [Tauri 2 macOS Code Signing & Notarization](https://v2.tauri.app/distribute/sign/macos/) -- certificate types, notarization requirements, CI env vars
- [Tauri 2 Windows Code Signing](https://v2.tauri.app/distribute/sign/windows/) -- SmartScreen, EV/OV certificates, cross-compilation signing
- [Tauri 2 AppImage Distribution](https://v2.tauri.app/distribute/appimage/) -- Linux updater limitation, AppImage format
- [tauri-apps/tauri-action Repository](https://github.com/tauri-apps/tauri-action) -- `owner`/`repo` options, cross-repo release
- [GitHub REST API Rate Limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) -- 60/hr unauthenticated per IP
- [Cross-Repo Release Publishing](https://dev.to/oysterd3/how-to-release-built-artifacts-from-one-to-another-repo-on-github-3oo5) -- PAT requirements for cross-repo
- [Tauri v2 Auto-Updater Guide](https://thatgurjot.com/til/tauri-auto-updater/) -- practical setup walkthrough
- [Production macOS App with Tauri 2.0](https://dev.to/0xmassi/shipping-a-production-macos-app-with-tauri-20-code-signing-notarization-and-homebrew-mc3) -- end-to-end macOS distribution
- [AppImage Update Permission Bug (plugins-workspace#1608)](https://github.com/tauri-apps/plugins-workspace/issues/1608)
- [Custom Target URL Bug (tauri#14703)](https://github.com/tauri-apps/tauri/issues/14703)
- [Updater install() Never Returns (plugins-workspace#2558)](https://github.com/tauri-apps/plugins-workspace/issues/2558)
- Codebase: `taskflow/src-tauri/tauri.conf.json` -- current config with `"version": "0.1.0"`, `"targets": "all"`, no updater plugin
- Codebase: `taskflow/src-tauri/Cargo.toml` -- current deps include stronghold, store, http, notification plugins; no updater plugin yet

---
*Pitfalls research for: Taskflow v1.6 Release & Auto-Update Pipeline*
*Researched: 2026-03-24*
