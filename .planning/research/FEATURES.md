# Feature Research: v1.6 Release Pipeline, Auto-Update, and Version Management

**Domain:** Desktop app release pipeline, auto-update, version management, and About dialog
**Researched:** 2026-03-24
**Confidence:** HIGH (Tauri updater plugin well-documented; CI patterns mature; force-update is custom but straightforward)

> This file supersedes the v1.5 FEATURES.md.
> v1.0-v1.5 features are shipped and stable. This file focuses exclusively on v1.6 release pipeline and auto-update targets.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Background update check on launch** | Every modern desktop app checks silently. Users should never run stale versions unknowingly. VS Code, Slack, Discord all do this. | LOW | Tauri updater `check()` returns update object with `version`, `body`, `date`, or null if current. Call on app mount + setInterval. Not a TanStack Query concern -- this is a fire-and-forget side effect. |
| **Update notification (non-blocking)** | Users expect a toast or banner, not a modal that blocks workflow mid-task. | LOW | Toast or persistent banner in header/footer area. Must show new version number and "Update Now" / "Later" actions. Never interrupt active work. |
| **One-click download + install + restart** | Users expect "Update Now" to handle everything. No manual file downloads, no drag-to-Applications. | MEDIUM | Tauri `update.downloadAndInstall(callback)` + `relaunch()` from `@tauri-apps/plugin-process`. Windows needs `installMode: "passive"` in tauri.conf.json to avoid UAC prompts for NSIS. |
| **Download progress indicator** | Users need feedback during multi-MB downloads. A stalled download with no progress feels broken. | LOW | Tauri's `downloadAndInstall()` emits three event types: `Started` (total content_length), `Progress` (chunk_length), `Finished`. Map to a progress bar in the update dialog. |
| **Signed update verification** | Security baseline. Unsigned updates are a malware distribution vector. | LOW | Tauri enforces this -- cannot be disabled. Generate key pair with `tauri signer generate -w ~/.tauri/taskflow.key`. Public key goes in tauri.conf.json `plugins.updater.pubkey`. Private key stored as GitHub Actions secret. **Losing the private key permanently prevents updates to existing installations.** |
| **Cross-platform CI builds (macOS/Windows/Linux)** | The app targets all three platforms. Manual builds are error-prone and unsustainable. | MEDIUM | `tauri-apps/tauri-action` v1 with GitHub Actions matrix: `macos-latest` (aarch64 + x86_64), `ubuntu-22.04` (x86_64), `windows-latest` (x86_64). Each matrix leg runs on native runner. No cross-compilation needed. |
| **Version derived from git tag** | Manual version bumps in tauri.conf.json and Cargo.toml drift and cause release errors. Single source of truth. | LOW | Push tag `v1.6.0` on private repo. CI workflow triggered on tag push. `tauri-action` has `tagName: app-v__VERSION__` which auto-replaces with app version. The tag itself drives the version. |
| **About dialog with version + build info** | Every desktop app has one. Users and support need to know the exact version running. | LOW | Custom shadcn/ui Dialog (not native -- Tauri 2 has no built-in About API). Display: version, build date, commit SHA (short), platform/arch, update status ("Up to date" / "Update available"). Wire to macOS menu bar "About Taskflow" item. |
| **Changelog in update prompt** | Users want to know what changed before deciding to update. Blind "update now" prompts erode trust. | LOW | Tauri updater object includes `body` field populated from GitHub Release notes. Render with existing `react-markdown` dependency. Keep release notes concise (bullet points, not essays). |
| **Configurable update check frequency** | Power users want control. Default 24h is standard. Some teams want faster rollout visibility. | LOW | New field in `useSettingsStore` with persist. Options: 1h, 6h, 12h, 24h, manual only. Drives the `setInterval` timer. New "Updates" section in Settings page. |

### Differentiators (Competitive Advantage)

Features that go beyond what most internal desktop tools provide. These signal product maturity.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Two-tier force-update policy** | Ensures critical security/compatibility fixes reach all users. Most internal tools have no enforcement at all. Two tiers (soft nag vs hard block) give appropriate urgency levels. | MEDIUM | Fetch `version-policy.json` from public repo (alongside `latest.json`). Two semver fields: `softMinimum` (persistent banner, dismissible once per session, returns on next launch) and `hardMinimum` (full-screen overlay, no dismiss, app unusable until updated). Compare with `semver` library or manual semver parse. Fail open: if policy file is unreachable, do not block. |
| **Version history in Settings** | Users can browse all past releases and their changelogs without leaving the app. Reduces "what changed?" support questions. Builds confidence in active development. | MEDIUM | Fetch releases from GitHub API: `GET /repos/{owner}/{repo}/releases` (public repo, no auth needed). Display as scrollable timeline with version tag, date, and markdown body. Cache with TanStack Query (staleTime: 1 hour). Paginate if many releases. |
| **Private-to-public repo release pipeline** | Source code stays private while binaries are publicly downloadable. Users never see proprietary code. Clean separation of development and distribution. | MEDIUM | GitHub Actions workflow in private repo uses a PAT (with `repo` scope on public repo) stored as secret. `softprops/action-gh-release` action accepts `repository` param to target the public repo. Uploads: platform binaries + `latest.json` + `version-policy.json`. |
| **macOS menu bar About integration** | macOS users expect "AppName > About AppName" in the system menu bar. Feels native. | LOW | Tauri 2 supports custom menus via `tauri::menu`. Add "About Taskflow" item to the app menu that triggers the About dialog. Windows/Linux access About from Settings or a Help menu item. |
| **"What's New" post-update dialog** | After updating, users see what changed in the version they just installed. Creates a moment of delight and awareness. | LOW | On app launch, compare stored `lastSeenVersion` (in Tauri Store) with current app version. If different, show a modal with the release notes for the current version. Mark as seen. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Silent auto-install without consent** | "Just keep it updated automatically" | Users lose work if app restarts unexpectedly mid-task. Violates user trust. Enterprise environments may have change-control policies. Portable app means user may have specific file placement expectations. | Download silently in background, but always ask before installing. Show "Restart to update" prompt. |
| **Delta/differential updates** | "Save bandwidth, faster updates" | Massively increases build complexity. Tauri does not support delta updates. Full binary is ~10MB -- trivial on any modern connection. The complexity-to-savings ratio is terrible. | Ship full binaries. 10MB downloads complete in seconds. |
| **Auto-update rollback UI** | "Let me go back to the previous version" | Creates support nightmare (which version has which bug?). Force-update policy becomes unenforceable if users can downgrade arbitrarily. Version-specific data migrations become reversibility hazards. | If a release is bad, push a new patch release quickly. Force-update policy handles migration to the fix. |
| **Multiple update channels (stable/beta/nightly)** | "Let power users test early builds" | Triples CI build minutes, doubles QA surface, fragments the tiny user base. Different channels need different signing keys or at least different endpoints. | Single stable channel. Test in private repo before publishing to public. Team can run dev builds locally for early testing. |
| **P2P update distribution** | "Reduce GitHub bandwidth usage" | NAT traversal complexity, security concerns, legal liability. GitHub Releases CDN is free, globally distributed, and handles any reasonable scale. | Use GitHub Releases CDN. It is free and sufficient. |
| **Custom update server** | "More control over update delivery" | Adds infrastructure to maintain (server, TLS, uptime monitoring). GitHub Releases serves the static `latest.json` perfectly. Tauri's updater supports it natively. | Use GitHub Releases as the static update endpoint. Zero infrastructure. |
| **In-app release notes editor** | "Write release notes from within Taskflow" | Massive scope creep. Release notes are a development workflow concern, not a product feature. They belong in the CI/release process. | Write release notes in GitHub Release description. Auto-populated from PR titles or conventional commits if desired. |

---

## Feature Dependencies

```
[Signing key generation]
    |-- enables --> [tauri.conf.json updater config]
    |                   |-- enables --> [Tauri updater plugin integration]
    |                                       |-- enables --> [Update check on launch]
    |                                       |                   |-- enables --> [Update notification banner]
    |                                       |                   |                   |-- enables --> [Changelog display]
    |                                       |                   |                   |-- enables --> [Download + install + restart]
    |                                       |                   |
    |                                       |                   |-- enables --> [Configurable check frequency]
    |                                       |
    |                                       |-- enables --> [Force-update policy check]
    |                                                           |-- requires --> [version-policy.json]
    |                                                           |-- enables --> [Soft nag banner]
    |                                                           |-- enables --> [Hard block overlay]

[GitHub Actions CI pipeline]
    |-- requires --> [Signing private key as secret]
    |-- requires --> [PAT for cross-repo publish as secret]
    |-- enables --> [Cross-platform matrix builds]
    |-- enables --> [latest.json auto-generation]
    |-- enables --> [Publish release to public repo]
    |-- enables --> [version-policy.json hosting]

[About dialog]
    |-- requires --> [Version + commit hash injected at build time]
    |-- enhances --> [Update status display ("Up to date" / "v1.7.0 available")]
    |-- enhances --> [macOS menu bar integration]

[Version history page]
    |-- requires --> [GitHub API fetch from public repo releases]
    |-- enhances --> [Settings page -- new "Updates" section]

[Settings "Updates" section]
    |-- requires --> [Configurable check frequency]
    |-- requires --> [About dialog content (version info)]
    |-- enhances --> [Version history] (displayed within this section)
```

### Dependency Notes

- **Signing key generation is the absolute first step.** Everything else in the updater chain depends on having a valid key pair. The public key is embedded in the app binary; the private key signs every release artifact. Losing the private key is unrecoverable for existing installations.
- **CI pipeline and updater config are independent.** The CI pipeline can be built and tested without the updater being wired in the app, and vice versa. They converge when the first real release is published.
- **Force-update policy depends on version-policy.json existing on the public repo.** The app must handle the file being missing gracefully (fail open -- never block the app if the policy file is unreachable).
- **Version history fetches from GitHub's public API (unauthenticated).** Rate limit is 60 requests/hour per IP. Must cache aggressively (TanStack Query with staleTime >= 1 hour).
- **About dialog needs build-time metadata.** Version comes from tauri.conf.json (readable at runtime). Commit SHA and build date need injection via Tauri's build script or environment variables set in CI.
- **macOS menu bar requires Rust-side menu configuration.** The About menu item triggers a Tauri command that the frontend listens for, then opens the About dialog.

---

## Integration with Existing Architecture

### Settings Page Extension

The existing Settings page has 6 sections (Connections, Appearance, Sidebar, Notifications, Workflow, Advanced). Add a 7th:

| Section | Icon | Contents |
|---------|------|----------|
| **Updates** | `Download` (lucide) | Update check frequency dropdown, "Check now" button, current version display, update status, version history list (P2) |

Implementation follows the established pattern:
1. New `UpdatesSection.tsx` component
2. Add `'updates'` to `SettingsSection` type union
3. Add entry to `SECTIONS` array in `Settings.tsx`
4. Render conditionally like other sections

### Store Integration

- **useSettingsStore** (persisted via Tauri Store): Add `updateCheckInterval` field. Type: `'1h' | '6h' | '12h' | '24h' | 'manual'`. Default: `'24h'`.
- **No new Zustand store needed.** Update state (checking, available version, download progress, installing) is transient UI state. Use `useState` in the update provider component or a lightweight non-persisted Zustand slice.
- **lastSeenVersion** in Tauri Store (for "What's New" detection): Simple string compared against `app.getVersion()`.

### Existing Dependencies Reused

| Dependency | Current Use | v1.6 Use |
|------------|-------------|----------|
| `react-markdown` | Jira descriptions, issue detail | Render GitHub Release notes in update prompt and version history |
| `Tauri Store plugin` | Settings, pinned tabs, sidebar config | Persist update preferences and lastSeenVersion |
| `shadcn/ui Dialog` | Issue detail sheet, create/edit dialogs | About dialog, update prompt, force-update overlay |
| `lucide-react` | All icons across app | `Download`, `Info`, `RefreshCw`, `AlertTriangle`, `Shield` icons |
| `TanStack Query` | All Jira/GitLab data fetching | Version history fetch from GitHub API (cache with long staleTime) |

### New Dependencies Required

| Package | Registry | Purpose | Notes |
|---------|----------|---------|-------|
| `@tauri-apps/plugin-updater` | npm | Frontend JS API: `check()`, `downloadAndInstall()` | Returns update object with version, body, date |
| `tauri-plugin-updater` | Cargo | Rust-side updater plugin | Add to `src-tauri/Cargo.toml` dependencies |
| `@tauri-apps/plugin-process` | npm | `relaunch()` after update install | May already be available via Tauri core; verify |
| `tauri-plugin-process` | Cargo | Rust-side process plugin for restart | Add to `src-tauri/Cargo.toml` dependencies |

### Capability/Permission Changes

Current `capabilities/default.json` needs additions:

```json
{
  "permissions": [
    // ... existing permissions ...
    "updater:default",
    "process:allow-restart"
  ]
}
```

### Tauri Config Changes

Current `tauri.conf.json` needs:

```json
{
  "bundle": {
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "pubkey": "GENERATED_PUBLIC_KEY_CONTENT",
      "endpoints": [
        "https://github.com/{owner}/{public-repo}/releases/latest/download/latest.json"
      ],
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

### Rust-side Changes

Current `src-tauri/Cargo.toml` needs two new dependencies:
```toml
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
```

Current `lib.rs` needs plugin registration:
```rust
.plugin(tauri_plugin_updater::Builder::new().build())
.plugin(tauri_plugin_process::init())
```

For macOS About menu: custom menu setup in Tauri's builder with a command handler that emits an event to the frontend.

For build-time metadata: Rust build script or Tauri's `beforeBuildCommand` to inject commit SHA and build date as environment variables accessible at runtime.

---

## MVP Definition

### Launch With (v1.6)

Everything needed for a working release pipeline + auto-update + version enforcement.

- [ ] **Signing key pair generation** -- foundation; everything depends on this
- [ ] **Tauri updater plugin setup** (Cargo + npm + capabilities + config) -- wiring
- [ ] **GitHub Actions CI workflow** -- cross-platform builds triggered on tag push
- [ ] **Private-to-public repo publishing** -- binaries to public repo, source stays private
- [ ] **Version from git tag** -- no manual version bumps
- [ ] **Build-time metadata injection** -- commit SHA, build date accessible at runtime
- [ ] **Update check on launch + configurable interval** -- core detection loop
- [ ] **Update prompt dialog** -- changelog (markdown), "Update Now" / "Later", download progress bar
- [ ] **Download + install + restart flow** -- end-to-end update installation
- [ ] **version-policy.json schema + hosting** -- policy file on public repo
- [ ] **Two-tier force-update** -- soft nag banner + hard block overlay
- [ ] **About dialog** -- version, build date, commit, platform, update status
- [ ] **macOS menu bar About item** -- platform convention
- [ ] **Settings "Updates" section** -- check frequency, manual check, version display

### Add After Validation (v1.6.x)

Features to add once core update system is proven with real releases.

- [ ] **Version history in Settings** -- needs multiple releases to be useful; fetch from GitHub API
- [ ] **"What's New" post-update dialog** -- compare lastSeenVersion on launch
- [ ] **Update available badge on Settings nav** -- subtle persistent dot indicator

### Future Consideration (v2+)

- [ ] **Staged rollouts** -- only matters with a larger user base
- [ ] **Update adoption telemetry** -- needs analytics infrastructure first
- [ ] **Admin-managed update policies** -- enterprise feature for multi-team deployment

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Signing key generation | HIGH (blocker) | LOW | **P1** |
| Tauri updater plugin wiring | HIGH (blocker) | LOW | **P1** |
| GitHub Actions CI pipeline | HIGH | MEDIUM | **P1** |
| Private-to-public repo publishing | HIGH | MEDIUM | **P1** |
| Version from git tag | HIGH | LOW | **P1** |
| Build-time metadata injection | MEDIUM | LOW | **P1** |
| Update check + notification banner | HIGH | LOW | **P1** |
| Update prompt with changelog | HIGH | LOW | **P1** |
| Download + install + restart | HIGH | MEDIUM | **P1** |
| version-policy.json | HIGH (security) | LOW | **P1** |
| Force-update: soft nag banner | HIGH | MEDIUM | **P1** |
| Force-update: hard block overlay | HIGH | LOW | **P1** |
| About dialog | MEDIUM | LOW | **P1** |
| macOS menu bar About | MEDIUM | LOW | **P1** |
| Settings "Updates" section | MEDIUM | LOW | **P1** |
| Configurable check frequency | MEDIUM | LOW | **P1** |
| Version history in Settings | MEDIUM | MEDIUM | **P2** |
| "What's New" post-update dialog | LOW | LOW | **P2** |
| Update badge on Settings nav | LOW | LOW | **P3** |

**Priority key:**
- P1: Must have for v1.6 launch -- all 16 features are part of the milestone
- P2: Should have, add in v1.6.x when there are enough releases to display
- P3: Nice to have, future polish

---

## Competitor/Reference Feature Analysis

| Feature | VS Code | Slack Desktop | Discord | Taskflow v1.6 Approach |
|---------|---------|---------------|---------|------------------------|
| Update check | Background on launch + periodic | Background, continuous | Background, continuous | On launch + configurable interval (1h/6h/12h/24h/manual) |
| Update notification | Status bar "Restart to Update" | Top banner | Modal dialog | Non-blocking toast/banner with "Update Now" / "Later" |
| Changelog in update | Link to full release notes web page | None visible to user | "What's New" modal post-update | Inline markdown changelog in update prompt dialog |
| Force update | None (open source, no enforcement) | Soft nag after extended period | Hard block for critical versions | Two-tier: `softMinimum` (persistent banner) + `hardMinimum` (full-screen blocker) |
| Install mechanism | Download background, apply on restart | Silent background install | Silent background install | Download with progress bar, user-initiated install, automatic restart |
| About dialog | Help > About (custom web panel) | Menu > About (native macOS) | Settings > About section | Custom shadcn Dialog; macOS menu bar + Settings access |
| Version history | Changelog on marketplace/website | None in-app | None in-app | In-app scrollable timeline in Settings (P2) |
| CI pipeline | Azure Pipelines (public) | Internal proprietary | Internal proprietary | GitHub Actions, private-to-public repo, tag-triggered |
| Distribution | Marketplace + website download | App stores + website | App stores + website | GitHub Releases on public repo (direct download) |

---

## Sources

- [Tauri Updater Plugin Official Docs](https://v2.tauri.app/plugin/updater/) -- HIGH confidence, authoritative
- [Tauri GitHub Actions Pipeline Docs](https://v2.tauri.app/distribute/pipelines/github/) -- HIGH confidence, authoritative
- [tauri-apps/tauri-action GitHub](https://github.com/tauri-apps/tauri-action) -- HIGH confidence, official action
- [softprops/action-gh-release](https://github.com/softprops/action-gh-release) -- HIGH confidence, widely used for cross-repo publishing
- [Cross-repo GitHub Actions Workflows](https://oneuptime.com/blog/post/2025-12-20-cross-repository-workflows-github-actions/view) -- MEDIUM confidence
- [Tauri v2 Auto-Update Guide](https://thatgurjot.com/til/tauri-auto-updater/) -- MEDIUM confidence, community walkthrough
- [Ship Tauri v2 with GitHub Actions](https://dev.to/tomtomdu73/ship-your-tauri-v2-app-like-a-pro-github-actions-and-release-automation-part-22-2ef7) -- MEDIUM confidence, community guide
- [Force Upgrade Mechanisms](https://appupgrade.dev/blog/why-force-upgrade-mechanism) -- MEDIUM confidence
- Taskflow codebase: `tauri.conf.json`, `Cargo.toml`, `capabilities/default.json`, `Settings.tsx` -- HIGH confidence, direct inspection

---
*Feature research for: Taskflow v1.6 Release Pipeline & Auto-Update*
*Researched: 2026-03-24*
