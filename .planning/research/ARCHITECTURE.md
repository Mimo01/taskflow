# Architecture Research

**Domain:** Release pipeline, auto-update, version management for Tauri 2 desktop app
**Researched:** 2026-03-24
**Confidence:** HIGH

## System Overview

```
                        GITHUB (CI/CD + Distribution)
 ┌──────────────────────────────────────────────────────────────────────┐
 │  PRIVATE REPO (source)                 PUBLIC REPO (releases)       │
 │  ┌──────────────────────┐              ┌──────────────────────────┐ │
 │  │ Push tag v1.6.0      │──────────────│ GitHub Release           │ │
 │  │ GitHub Actions        │  tauri-action│  ├── latest.json         │ │
 │  │  ├── Build macOS      │  owner/repo  │  ├── Taskflow.app.tar.gz│ │
 │  │  ├── Build Windows    │──────────────│  ├── Taskflow.msi.zip   │ │
 │  │  ├── Build Linux      │              │  ├── Taskflow.AppImage  │ │
 │  │  └── Sign artifacts   │              │  ├── *.sig (signatures) │ │
 │  └──────────────────────┘              │  └── version-policy.json │ │
 │                                         └──────────┬───────────────┘ │
 └────────────────────────────────────────────────────┼─────────────────┘
                                                       │
                              TAURI APP (desktop)      │ HTTPS fetch
 ┌─────────────────────────────────────────────────────┼─────────────────┐
 │                          RUST BACKEND               │                 │
 │  ┌──────────────────────────────────────────────────┼───────────────┐ │
 │  │  tauri-plugin-updater                            │               │ │
 │  │  ├── check() ←───── endpoints: [latest.json URL]─┘               │ │
 │  │  ├── download() ←── signature verification (pubkey)              │ │
 │  │  └── install() ───→ replace binary + relaunch                    │ │
 │  │                                                                  │ │
 │  │  tauri-plugin-process                                            │ │
 │  │  └── relaunch() ───→ restart app after install                   │ │
 │  └──────────────────────────────────────────────────────────────────┘ │
 │                          │ JS bridge                                  │
 │                          ▼                                            │
 │  ┌──────────────────────────────────────────────────────────────────┐ │
 │  │  REACT FRONTEND                                                  │ │
 │  │                                                                  │ │
 │  │  Services Layer                                                  │ │
 │  │  ├── update.ts ──── check/download/install via plugin-updater    │ │
 │  │  └── version-policy.ts ── fetch+parse version-policy.json        │ │
 │  │                                                                  │ │
 │  │  Zustand Store                                                   │ │
 │  │  └── update.store.ts ── update state, check timestamps, policy   │ │
 │  │                                                                  │ │
 │  │  TanStack Query Hooks                                            │ │
 │  │  ├── useUpdateCheck ── periodic update polling                   │ │
 │  │  └── useVersionPolicy ── fetch version-policy.json               │ │
 │  │                                                                  │ │
 │  │  Components                                                      │ │
 │  │  ├── UpdatePromptDialog ── changelog + download progress         │ │
 │  │  ├── ForceUpdateBanner ── soft nag (dismissible)                 │ │
 │  │  ├── ForceUpdateBlocker ── hard block (modal, no dismiss)        │ │
 │  │  ├── AboutDialog ── version, build info, update status           │ │
 │  │  ├── VersionHistorySection ── Settings section                   │ │
 │  │  └── UpdateSettingsSection ── check frequency in Settings        │ │
 │  └──────────────────────────────────────────────────────────────────┘ │
 └───────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Integration Point |
|-----------|----------------|-------------------|
| **GitHub Actions workflow** | Build cross-platform binaries, sign artifacts, publish to public repo | New file: `.github/workflows/release.yml` in private repo |
| **tauri-plugin-updater** (Rust) | Download verification, binary replacement, signature checking | Modify: `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs` |
| **tauri-plugin-process** (Rust) | App relaunch after update install | Modify: `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs` |
| **update.ts** (service) | JS bridge to plugin-updater: check, download, install, progress | New file: `src/services/update.ts` |
| **version-policy.ts** (service) | Fetch version-policy.json from public repo, parse soft/hard minimums | New file: `src/services/version-policy.ts` |
| **update.store.ts** (Zustand) | Last check timestamp, update state machine, dismissed versions | New file: `src/stores/update.store.ts` |
| **useUpdateCheck** (hook) | Periodic update check based on configurable interval | New file: `src/hooks/useUpdateCheck.ts` |
| **UpdatePromptDialog** | Show changelog, download progress bar, Update Now / Later buttons | New component |
| **ForceUpdateBanner** | Persistent dismissible banner for soft minimum violation | New component |
| **ForceUpdateBlocker** | Full-screen modal blocking app until update for hard minimum | New component |
| **AboutDialog** | App version, build date, update status, check-now button | New component |
| **VersionHistorySection** | Scrollable list of releases with changelogs fetched from GitHub | New Settings section |
| **UpdateSettingsSection** | Update check frequency slider/select | New Settings section |
| **Settings.tsx** | Add "Updates" section to sidebar nav | Modify existing |
| **lib.rs** | Register updater + process plugins, add About menu item | Modify existing |
| **tauri.conf.json** | Add updater config (pubkey, endpoints), createUpdaterArtifacts | Modify existing |
| **capabilities/default.json** | Add updater + process permissions | Modify existing |

## Recommended Project Structure

New and modified files only (existing structure preserved):

```
taskflow/
├── .github/
│   └── workflows/
│       └── release.yml              # CI: build + publish to public repo
├── src/
│   ├── services/
│   │   ├── update.ts                # NEW: updater plugin bridge
│   │   └── version-policy.ts        # NEW: version policy fetcher
│   ├── stores/
│   │   └── update.store.ts          # NEW: update state + last-check persist
│   ├── hooks/
│   │   └── useUpdateCheck.ts        # NEW: periodic update check hook
│   ├── components/
│   │   └── app/
│   │       ├── UpdatePromptDialog.tsx    # NEW: update available dialog
│   │       ├── ForceUpdateBanner.tsx     # NEW: soft nag banner
│   │       ├── ForceUpdateBlocker.tsx    # NEW: hard block overlay
│   │       └── AboutDialog.tsx           # NEW: about modal
│   └── routes/
│       └── settings/
│           ├── Settings.tsx              # MODIFY: add Updates section
│           ├── UpdateSettingsSection.tsx  # NEW: check frequency config
│           └── VersionHistorySection.tsx  # NEW: release history list
├── src-tauri/
│   ├── src/
│   │   └── lib.rs                   # MODIFY: register plugins, About menu
│   ├── Cargo.toml                   # MODIFY: add plugin deps
│   ├── tauri.conf.json              # MODIFY: updater config
│   └── capabilities/
│       └── default.json             # MODIFY: add permissions
├── version-policy.json              # NEW: template for public repo
└── vite.config.ts                   # MODIFY: inject build info env vars
```

### Structure Rationale

- **services/update.ts**: Follows existing pattern (stronghold.ts, tauri.ts) -- thin bridge to Tauri plugin, testable via vi.mock
- **services/version-policy.ts**: Separate from update.ts because it fetches from a different endpoint (raw GitHub file via plugin-http, not the updater plugin)
- **stores/update.store.ts**: Persisted via LazyStore (same pattern as settings.store.ts) for last-check timestamp and dismissed-versions list
- **hooks/useUpdateCheck.ts**: Combines TanStack Query polling with store state -- mirrors the existing notification poll pattern
- **components/app/**: Global components (UpdatePromptDialog, ForceUpdateBlocker) live alongside AppLayout since they render at the app shell level

## Architectural Patterns

### Pattern 1: Update State Machine

**What:** The update lifecycle has discrete states: idle -> checking -> available -> downloading -> installing -> restarting (or idle -> checking -> up-to-date). A Zustand store manages this state machine so multiple components can reflect the current state.
**When to use:** Whenever the UI needs to reflect update state across multiple components (banner, dialog, About dialog, Settings section).
**Trade-offs:** Slightly more code than ad-hoc state, but prevents impossible states (e.g., showing "downloading" when no update exists).

```typescript
type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string; notes: string | null; date: string | null }
  | { state: 'downloading'; version: string; progress: number; total: number | null }
  | { state: 'installing'; version: string }
  | { state: 'error'; message: string }
  | { state: 'up-to-date' };

interface UpdateStore {
  status: UpdateStatus;
  lastCheckAt: number | null;        // epoch ms, persisted
  dismissedVersions: string[];        // versions user clicked "Later" on
  setStatus: (status: UpdateStatus) => void;
  dismissVersion: (version: string) => void;
  setLastCheckAt: (ts: number) => void;
}
```

### Pattern 2: Version Policy as Remote Config

**What:** A `version-policy.json` file hosted on the public GitHub repo defines minimum versions. The app fetches this on launch and periodically. This decouples enforcement from app releases -- you can retroactively force-update old versions by updating the JSON without shipping a new app version.
**When to use:** When you need to block critically broken versions or enforce security patches.
**Trade-offs:** Requires network access; must handle fetch failures gracefully (fail-open: if policy cannot be fetched, do not block the user).

```json
{
  "softMinimum": "1.5.0",
  "hardMinimum": "1.3.0",
  "message": "Please update Taskflow for the latest fixes.",
  "hardMessage": "This version is no longer supported. Please update to continue."
}
```

```typescript
// version-policy.ts
interface VersionPolicy {
  softMinimum: string;
  hardMinimum: string;
  message?: string;
  hardMessage?: string;
}

async function fetchVersionPolicy(): Promise<VersionPolicy | null> {
  // Fetch from: https://raw.githubusercontent.com/{owner}/{public-repo}/main/version-policy.json
  // Uses tauri-plugin-http (CORS-free, same as Jira/GitLab calls)
  // Returns null on network error (fail-open)
}
```

### Pattern 3: Plugin Bridge Service (Existing Codebase Pattern)

**What:** All Tauri plugin calls go through a service module (like `tauri.ts`, `stronghold.ts`). The update service wraps `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process` so tests can mock at the module boundary.
**When to use:** Every new plugin integration.
**Trade-offs:** One extra layer of indirection, but essential for testability since plugins require the Tauri runtime.

```typescript
// services/update.ts
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export const updateService = {
  checkForUpdate: async (options?: { timeout?: number }) => {
    const update = await check(options);
    if (!update) return null;
    return {
      version: update.version,
      currentVersion: update.currentVersion,
      body: update.body ?? null,
      date: update.date ?? null,
      download: update.download.bind(update),
      install: update.install.bind(update),
      downloadAndInstall: update.downloadAndInstall.bind(update),
      close: update.close.bind(update),
    };
  },
  relaunch: () => relaunch(),
};
```

### Pattern 4: Dual-Repo Release Pipeline

**What:** Source code lives in a private repo. GitHub Actions builds artifacts and publishes releases to a separate public repo using tauri-action's `owner`/`repo` inputs. The public repo serves as the distribution channel -- latest.json, binaries, signatures, and version-policy.json all live there.
**When to use:** When source code is proprietary but distribution must be public (the updater cannot authenticate with private repo asset downloads).
**Trade-offs:** Requires a Personal Access Token with write access to the public repo, stored as a GitHub Actions secret. Release notes must be forwarded explicitly. The `version-policy.json` must be committed to the public repo separately.

### Pattern 5: Build-Time Version Injection

**What:** The app version comes from a single source of truth (git tag), injected at build time into tauri.conf.json by CI. The frontend accesses version and build info through environment variables defined in vite.config.ts.
**When to use:** Always. Manual version bumps across multiple files cause drift.
**Trade-offs:** Local dev builds show a placeholder version (0.1.0) unless you set env vars manually.

```typescript
// vite.config.ts additions
define: {
  '__APP_VERSION__': JSON.stringify(process.env.APP_VERSION || '0.1.0'),
  '__BUILD_DATE__': JSON.stringify(new Date().toISOString()),
  '__COMMIT_HASH__': JSON.stringify(process.env.COMMIT_HASH || 'dev'),
}
```

## Data Flow

### Update Check Flow

```
App Launch / Timer Tick (configurable interval)
    │
    ├── Is (now - lastCheckAt) > checkIntervalMs?
    │       NO --> skip
    │       YES ↓
    │
    ├── updateService.checkForUpdate()
    │       │
    │       ├── plugin-updater --> GET latest.json from public repo
    │       │       │
    │       │       ├── 204 No Content --> state: 'up-to-date'
    │       │       └── 200 + update JSON --> state: 'available'
    │       │
    │       └── Error --> state: 'error' (silent, retry next interval)
    │
    ├── Update available?
    │       │
    │       ├── Is version in dismissedVersions? --> show nothing (until next version)
    │       └── Not dismissed --> show UpdatePromptDialog
    │
    └── Store lastCheckAt = now
```

### Version Policy Flow

```
App Launch + Every 6 hours
    │
    ├── fetchVersionPolicy() --> GET version-policy.json from public repo
    │       │                    (via tauri-plugin-http, same as Jira/GitLab)
    │       │
    │       ├── Network error --> fail-open (no enforcement)
    │       └── Success --> compare current version using compare-versions lib
    │               │
    │               ├── current >= softMinimum --> no action
    │               ├── hardMinimum <= current < softMinimum --> ForceUpdateBanner
    │               └── current < hardMinimum --> ForceUpdateBlocker (blocks app)
    │
    └── Cache policy in update store (avoid re-fetch on every render)
```

### Download + Install Flow

```
User clicks "Update Now" in UpdatePromptDialog
    │
    ├── update.downloadAndInstall(onProgress)
    │       │
    │       ├── 'Started' event --> state: 'downloading', total = contentLength
    │       ├── 'Progress' event --> update progress bytes
    │       └── 'Finished' event --> state: 'installing'
    │
    ├── Install complete
    │       └── updateService.relaunch() --> app restarts with new version
    │
    └── Error at any step --> state: 'error', show retry option in dialog
```

### Version History Data Flow

```
Settings > Updates > Version History
    │
    ├── Fetch GitHub Releases API via tauri-plugin-http
    │   GET https://api.github.com/repos/{owner}/{public-repo}/releases
    │   (no auth required for public repo)
    │
    ├── TanStack Query cache (staleTime: 5 min)
    │
    └── Render list: version, date, body (markdown via react-markdown)
```

### About Dialog Data Flow

```
macOS: "About TaskFlow" menu item --> emit 'menu-about-taskflow' event
All platforms: Help > About menu item --> emit same event
    │
    └── AboutDialog opens (listens via Tauri event listener)
        ├── App name + icon
        ├── Version: __APP_VERSION__ (injected at build time)
        ├── Build: __COMMIT_HASH__ / __BUILD_DATE__
        ├── Update status: read from update.store.ts
        │   "Up to date" / "Update available (v1.7.0)" / "Checking..."
        └── "Check for Updates" button --> triggers updateService.checkForUpdate()
```

## Integration Points with Existing Architecture

### Modifications to Existing Files

| File | Change | Risk |
|------|--------|------|
| `src-tauri/Cargo.toml` | Add `tauri-plugin-updater = "2"` and `tauri-plugin-process = "2"` | Low -- additive only |
| `src-tauri/src/lib.rs` | Register two plugins in `.setup()` block; replace `PredefinedMenuItem::about` with custom menu item that emits `menu-about-taskflow` event to frontend | Medium -- menu bar restructuring |
| `src-tauri/tauri.conf.json` | Add `plugins.updater` block (pubkey, endpoints), set `bundle.createUpdaterArtifacts: true` | Medium -- build config change |
| `src-tauri/capabilities/default.json` | Add `"updater:default"` and `"process:allow-relaunch"` to permissions array | Low -- additive |
| `src/routes/settings/Settings.tsx` | Add `'updates'` to `SettingsSection` union type, add entry to `SECTIONS` array with Download icon, render `UpdateSettingsSection` and `VersionHistorySection` | Low -- follows existing 6-section pattern exactly |
| `src/stores/settings.store.ts` | Add `updateCheckIntervalHours: number` (default: 24) with setter, bump store version to 10, add migration block | Low -- well-established migration pattern |
| `src/App.tsx` or AppLayout | Mount `ForceUpdateBanner`, `ForceUpdateBlocker`, `UpdatePromptDialog` at app shell level; add Tauri event listener for About menu | Medium -- touches global shell |
| `vite.config.ts` | Add `define` block for `__APP_VERSION__`, `__BUILD_DATE__`, `__COMMIT_HASH__` | Low -- additive |

### New External Dependencies

| Dependency | Side | Purpose | Version | Size |
|------------|------|---------|---------|------|
| `tauri-plugin-updater` | Rust | Binary update download/install/verify | `2` | N/A (Rust crate) |
| `tauri-plugin-process` | Rust | App relaunch after install | `2` | N/A (Rust crate) |
| `@tauri-apps/plugin-updater` | JS | Frontend API for check/download/install | `^2.0.0` | ~5KB |
| `@tauri-apps/plugin-process` | JS | Frontend relaunch() call | `^2.0.0` | ~2KB |
| `compare-versions` | JS | Semver comparison for version policy | `^6.0.0` | ~1.5KB gzip |

**Why compare-versions over semver:** Zero dependencies, 1.5KB gzipped, ESM-native, supports the exact operations needed (gt, lt, gte, compare). The full `semver` package is 30KB+ and designed for Node.js ranges -- overkill for simple version comparison.

### Existing Patterns Reused

| Pattern | Where It Already Exists | How It Is Reused |
|---------|-------------------------|------------------|
| Plugin bridge service | `stronghold.ts`, `tauri.ts` | `update.ts` wraps plugin-updater identically |
| LazyStore persistence | `settings.store.ts`, `pinned-tabs.store.ts` | `update.store.ts` persists lastCheckAt, dismissedVersions |
| TanStack Query polling | Notification poll (30-60s intervals) | `useUpdateCheck` uses refetchInterval from settings |
| Settings sidebar section | 6 existing sections in Settings.tsx | Add "Updates" as 7th section with identical pattern |
| Menu event --> frontend action | `menu-nav-sprint`, `menu-command-palette` pattern | `menu-about-taskflow` event triggers AboutDialog |
| Dialog component (shadcn) | Various dialogs throughout app | UpdatePromptDialog, AboutDialog use same Dialog primitive |
| CORS-free fetch via plugin-http | All Jira/GitLab API calls via apiFetch() | Version history + version policy fetch GitHub API the same way |
| Zustand persist with migration | 9 migrations in settings store | update.store follows identical versioned migration pattern |

## Tauri Plugin Configuration Details

### tauri.conf.json Changes

```json
{
  "bundle": {
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "pubkey": "<CONTENTS_OF_PUBLIC_KEY>",
      "endpoints": [
        "https://github.com/<owner>/<public-repo>/releases/latest/download/latest.json"
      ]
    }
  }
}
```

### lib.rs Plugin Registration

```rust
// Add to the .setup(|app| { ... }) block, alongside existing plugin registrations
#[cfg(desktop)]
app.handle().plugin(tauri_plugin_updater::Builder::new().build());
app.handle().plugin(tauri_plugin_process::init());
```

### Capabilities Additions

```json
{
  "permissions": [
    "updater:default",
    "process:allow-relaunch"
  ]
}
```

The `updater:default` permission grants `allow-check`, `allow-download`, `allow-install`, and `allow-download-and-install`. The `process:allow-relaunch` grants only the relaunch capability.

### Signing Key Setup

Generate once, store in GitHub Secrets:

```bash
npx tauri signer generate -w ~/.tauri/taskflow.key
```

This produces:
- `~/.tauri/taskflow.key` (private key -- NEVER commit)
- `~/.tauri/taskflow.key.pub` (public key -- goes in tauri.conf.json pubkey field)

CI environment variables needed:
- `TAURI_SIGNING_PRIVATE_KEY` = contents of private key file
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` = password (can be empty string)

### GitHub Actions Workflow Structure

```yaml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  build:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-latest
            args: '--target aarch64-apple-darwin'
          - platform: macos-latest
            args: '--target x86_64-apple-darwin'
          - platform: ubuntu-22.04
            args: ''
          - platform: windows-latest
            args: ''
    runs-on: ${{ matrix.platform }}
    steps:
      # checkout, setup node, setup rust, install deps...
      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.PUBLIC_REPO_PAT }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          owner: '<public-repo-owner>'
          repo: '<public-repo-name>'
          tagName: 'v__VERSION__'
          releaseName: 'Taskflow v__VERSION__'
          releaseBody: 'See release notes below.'
          releaseDraft: false
          prerelease: false
          args: ${{ matrix.args }}
```

Key points:
- `owner` and `repo` target the public repo (not the private source repo)
- `GITHUB_TOKEN` must be a PAT with `contents:write` on the public repo
- `__VERSION__` is automatically replaced with the version from tauri.conf.json
- `tauri-action` generates `latest.json` with platform-specific download URLs and signatures

## Build Order (Suggested Phase Sequence)

### Phase 1: Foundation (Rust Plugins + Config + Signing)
Install plugins, configure updater, generate signing keys, set up version injection.

**Delivers:**
- `tauri-plugin-updater` + `tauri-plugin-process` added to Cargo.toml
- Plugins registered in lib.rs
- `tauri.conf.json` configured with updater settings (pubkey, endpoints)
- Permissions added to capabilities/default.json
- `vite.config.ts` define block for build info env vars
- JS packages installed: `@tauri-apps/plugin-updater`, `@tauri-apps/plugin-process`, `compare-versions`

**Why first:** Everything else depends on the plugins being available and configured.

### Phase 2: Update Service + Store
Create the service bridge and state management.

**Delivers:**
- `src/services/update.ts` -- plugin bridge with typed wrapper
- `src/services/version-policy.ts` -- policy fetcher via plugin-http
- `src/stores/update.store.ts` -- state machine + persistence
- `updateCheckIntervalHours` added to settings store (migration v10)
- Tests for all above

**Why second:** UI components need the service and store to function.

### Phase 3: Update Check + Prompt Dialog
Wire up periodic checking and the user-facing update prompt.

**Delivers:**
- `src/hooks/useUpdateCheck.ts` -- periodic check with TanStack Query
- `src/components/app/UpdatePromptDialog.tsx` -- changelog display, progress bar, Update Now / Later
- Mount useUpdateCheck in AppLayout
- Tests

**Why third:** Core update UX -- the minimum viable update experience.

### Phase 4: Version Policy Enforcement
Add force-update behavior for soft and hard minimum versions.

**Delivers:**
- `src/components/app/ForceUpdateBanner.tsx` -- soft nag (dismissible per session)
- `src/components/app/ForceUpdateBlocker.tsx` -- hard block (full-screen modal, no dismiss)
- Mount in AppLayout with version comparison logic
- `version-policy.json` template for public repo
- Tests

**Why fourth:** Depends on update service (Phase 2) and update dialog (Phase 3) being functional.

### Phase 5: Settings Integration + Version History
Add user-configurable update settings and release history view.

**Delivers:**
- `src/routes/settings/UpdateSettingsSection.tsx` -- check frequency dropdown, current version display, Check Now button
- `src/routes/settings/VersionHistorySection.tsx` -- fetch GitHub releases API, render markdown changelogs
- Modify Settings.tsx to add "Updates" section (7th sidebar item)
- Tests

**Why fifth:** Nice-to-have UI that depends on all prior infrastructure being in place.

### Phase 6: About Dialog + Menu Integration
Custom About dialog replacing macOS default, accessible cross-platform.

**Delivers:**
- `src/components/app/AboutDialog.tsx` -- version, build info, update status
- Modify lib.rs: replace `PredefinedMenuItem::about` with custom menu item emitting event
- Add Help > About menu item for cross-platform access
- Frontend event listener to open dialog
- Register keyboard shortcut if desired
- Tests

**Why sixth:** Self-contained feature with dependency on update store for status display.

### Phase 7: CI Pipeline
GitHub Actions workflow for automated cross-platform builds and release publishing.

**Delivers:**
- `.github/workflows/release.yml` -- full matrix build workflow
- Signing key generation + secrets configuration guide
- Tag-based version derivation (git tag -> app version)
- Documentation for the release process
- End-to-end pipeline test

**Why last:** Needs all app-side code complete to test the full flow. This is also the only phase requiring manual GitHub repository setup (creating the public repo, configuring secrets).

## Anti-Patterns

### Anti-Pattern 1: Blocking UI During Update Check

**What people do:** Show a loading spinner or block the entire app while checking for updates.
**Why it is wrong:** Update checks are background operations. Blocking degrades the core Jira/GitLab experience for a secondary concern.
**Do this instead:** Check silently in the background. Only show UI when an update is actually available. Never block app startup for an update check (unless hard minimum violation).

### Anti-Pattern 2: Auto-Installing Without Consent

**What people do:** Download and install updates automatically without user confirmation.
**Why it is wrong:** Users lose work context if the app restarts unexpectedly. Erodes trust, especially for a productivity tool.
**Do this instead:** Always prompt with UpdatePromptDialog. Show what is changing (changelog). Offer "Later" option. Only auto-block for hard minimum violations, and even then show what is happening.

### Anti-Pattern 3: Hardcoding Version in Multiple Places

**What people do:** Manually update version in tauri.conf.json, Cargo.toml, package.json, and TypeScript constants.
**Why it is wrong:** Versions drift. Builds ship with wrong version strings. CI builds become fragile.
**Do this instead:** Single source of truth: git tag. CI reads the tag and injects into tauri.conf.json at build time. The frontend reads version from `__APP_VERSION__` env var or Tauri's `app.getVersion()` API at runtime.

### Anti-Pattern 4: Failing Closed on Policy Fetch Error

**What people do:** Block the app if version-policy.json cannot be fetched (network down, GitHub outage).
**Why it is wrong:** Users cannot use the app offline or during GitHub outages. A distribution concern should never brick the core product.
**Do this instead:** Fail-open. If policy cannot be fetched, assume current version is acceptable. Cache the last successful policy response with a TTL (e.g., 24 hours).

### Anti-Pattern 5: Using fetch() Instead of plugin-http for GitHub API

**What people do:** Call GitHub's API with browser fetch() in the webview.
**Why it is wrong:** In Tauri 2, webview fetch() can trigger CORS issues. The existing codebase already solved this with tauri-plugin-http.
**Do this instead:** Use the same plugin-http apiFetch() wrapper for GitHub API calls (version history, version policy) as is used for all Jira/GitLab calls. Consistency matters.

### Anti-Pattern 6: Storing Signing Keys in the Repository

**What people do:** Commit the Tauri signing private key to the repository.
**Why it is wrong:** Anyone with repo access can sign malicious updates that the app will accept as legitimate.
**Do this instead:** Store the private key ONLY in GitHub Actions secrets. The public key (which goes in tauri.conf.json) is safe to commit -- it can only verify, not sign.

## Sources

- [Tauri Updater Plugin Official Docs](https://v2.tauri.app/plugin/updater/) -- HIGH confidence
- [Tauri GitHub Actions Pipeline](https://v2.tauri.app/distribute/pipelines/github/) -- HIGH confidence
- [Tauri Updater JS API Reference](https://v2.tauri.app/reference/javascript/updater/) -- HIGH confidence
- [Tauri Process Plugin](https://v2.tauri.app/plugin/process/) -- HIGH confidence
- [tauri-apps/tauri-action GitHub](https://github.com/tauri-apps/tauri-action) -- HIGH confidence
- [compare-versions npm](https://www.npmjs.com/package/compare-versions) -- HIGH confidence
- [Private repo to public repo release strategy](https://github.com/tauri-apps/tauri/discussions/7553) -- MEDIUM confidence (community discussion, verified against tauri-action docs)
- [Tauri v2 Auto-Update Blog Post](https://thatgurjot.com/til/tauri-auto-updater/) -- MEDIUM confidence (blog, cross-verified with official docs)

---
*Architecture research for: Taskflow v1.6 Release Pipeline & Auto-Update*
*Researched: 2026-03-24*
