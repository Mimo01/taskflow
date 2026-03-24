# Phase 38: Updater Foundation + Service Layer - Research

**Researched:** 2026-03-24
**Domain:** Tauri v2 auto-updater plugin, Vite build-time version injection, Zustand state machines
**Confidence:** HIGH

## Summary

Phase 38 builds the invisible infrastructure that all future update UX phases (39, 40, 41) depend on. The work splits into three parallel tracks: (1) version injection — reading a git tag at build time and making it available to both the Tauri bundler and the frontend at runtime; (2) Tauri plugin wiring — registering `tauri-plugin-updater` in Rust, configuring it in `tauri.conf.json`, and creating a typed frontend update service; and (3) the update state machine — a non-persisted Zustand store that models the full Idle → Checking → Available → Downloading → Ready → Error lifecycle, plus a polling hook.

All three tracks have clean insertion points in the existing codebase. The plugin registration follows the same `.plugin(...)` pattern used by five existing plugins. The state machine is a non-persisted Zustand store identical in structure to `debug-log.store.ts`. The polling hook mirrors `useNotificationPolling.ts` exactly — a `useQuery` with `refetchInterval` driven by a settings store value.

The Ed25519 signing key is a pre-step concern: Phase 38 documents the keygen process and embeds the public key placeholder, but actual key generation happens before Phase 41. The CONTEXT.md decision D-11 locks this.

**Primary recommendation:** Implement in three independent tasks — version injection script, plugin/service wiring, and update store + hook — then integrate and test end-to-end.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Update checks run completely silently — no UI indication during routine checks. Only surface state when an update is actually found.
- **D-02:** On check failure (network error, endpoint down), fail silently to the user but log to Developer Tools request log for debugging.
- **D-03:** First update check runs after a ~5-10 second delay after launch, to avoid competing with initial Jira/GitLab data fetches.
- **D-04:** Git tag version injected via Vite `define` + `tauri.conf.json` version field. Build script reads git tag, writes to tauri.conf.json, and Vite injects as `import.meta.env` constants. Single source of truth for both Tauri updater and frontend.
- **D-05:** Build metadata limited to commit SHA + build date. No branch/dirty flag. Platform/arch detected at runtime via Tauri APIs.
- **D-06:** Update state machine lives in a Zustand store (non-persisted), consistent with auth.store, settings.store, notifications.store patterns.
- **D-07:** Update check frequency setting (1h/6h/12h/24h/manual) added to existing settings store alongside `notificationPollIntervalSecs`. Same LazyStore persistence pattern.
- **D-08:** Full lifecycle state machine built upfront: Idle → Checking → Available → Downloading → Ready → Error. No refactoring needed when Phase 39 adds the UX layer.
- **D-09:** Ed25519 private key stored as a GitHub Actions secret. Only CI has access. Public key embedded in `tauri.conf.json` for client-side verification.
- **D-10:** Key backup in two locations: password manager (1Password/Bitwarden) + GitHub Actions secret. Recovery process documented.
- **D-11:** Key generation is a manual pre-step with documentation. This phase embeds the public key in config and documents the keygen + backup process. Actual key generation happens before Phase 41 CI setup.

### Claude's Discretion

- Exact state machine type definitions and transition functions
- Tauri updater plugin configuration details
- Build script implementation (shell script vs Node script vs Vite plugin)
- Update service abstraction for testability

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CI-03 | App version is derived from git tag at build time (no manual version bumps in config files) | D-04: Vite `define` + pre-build script that reads `git describe --tags` and writes to `tauri.conf.json`. Both the Tauri binary and `import.meta.env.APP_VERSION` are authoritative from the same tag. |
| CI-04 | Build-time metadata (commit SHA, build date) is injected and accessible at runtime | D-05: Vite `define` injects `APP_COMMIT_SHA` and `APP_BUILD_DATE` as `import.meta.env` constants from environment variables set by the build script. |
| UPD-01 | App checks for updates on launch and at a configurable interval (1h/6h/12h/24h/manual) | D-03/D-06/D-07/D-08: `tauri-plugin-updater` registered, `updateCheckInterval` added to settings store, `useUpdatePolling` hook with `useQuery(refetchInterval)` drives checks. First check after ~7s delay. |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tauri-plugin-updater | 2.10.0 | Rust backend for update checking, downloading, installing | Official Tauri v2 plugin; same version family as existing plugins |
| @tauri-apps/plugin-updater | 2.10.0 | TypeScript frontend bindings for update check/download/install | Pair to Rust plugin; already pattern-matched by 5 existing plugin pairs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand (already installed) | 5.0.11 | Non-persisted update state machine store | Matches existing stores; no new dependency |
| @tanstack/react-query (already installed) | 5.90.21 | Update polling hook with configurable `refetchInterval` | Matches `useNotificationPolling` pattern exactly |
| Node.js (built-in) | 25.8.1 (on machine) | Build script: read git tag, write tauri.conf.json, set env vars | Already used in project; no new tooling needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Node.js build script | Shell script / Vite plugin | Node is consistent with existing `package.json` scripts; Vite plugin adds complexity for a one-time pre-build task |
| TanStack Query polling | `setInterval` in a React effect | Query provides de-duplication, background refetch, and matches the existing notification pattern |

**Installation (new dependencies only):**
```bash
cd taskflow
cargo add tauri-plugin-updater --target 'cfg(any(target_os = "macos", windows, target_os = "linux"))'
npm install @tauri-apps/plugin-updater
```

**Version verified:** `@tauri-apps/plugin-updater@2.10.0` (published ~1 month ago; `tauri-plugin-updater = "2.10.0"` in Cargo registry as of 2026-03-24).

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
taskflow/
├── scripts/
│   └── inject-version.js          # Pre-build: reads git tag → writes tauri.conf.json + exports env vars
├── src/
│   ├── services/
│   │   └── updater.ts             # Update service (wraps @tauri-apps/plugin-updater check())
│   ├── stores/
│   │   └── update.store.ts        # Non-persisted Zustand state machine
│   └── hooks/
│       └── useUpdatePolling.ts    # TanStack Query polling hook (mirrors useNotificationPolling)
├── src-tauri/
│   ├── src/lib.rs                 # Add updater plugin registration
│   └── Cargo.toml                 # Add tauri-plugin-updater dependency
├── tauri.conf.json                # Add updater config block + bundle.createUpdaterArtifacts
└── vite.config.ts                 # Add define: { APP_VERSION, APP_COMMIT_SHA, APP_BUILD_DATE }
```

---

### Pattern 1: Tauri Plugin Registration (Rust)

The updater plugin uses a desktop-only conditional registration via `#[cfg(desktop)]`. This is the standard pattern for Tauri v2 desktop-only plugins.

**In `Cargo.toml`:**
```toml
# desktop-only target conditional
tauri-plugin-updater = { version = "2", optional = false }
```

Or using the target-specific form (the recommended form per official docs):
```toml
[target.'cfg(any(target_os = "macos", windows, target_os = "linux"))'.dependencies]
tauri-plugin-updater = "2"
```

**In `src-tauri/src/lib.rs` (inside the `.setup()` closure, alongside stronghold registration):**
```rust
// Source: https://v2.tauri.app/plugin/updater/
#[cfg(desktop)]
app.handle()
    .plugin(tauri_plugin_updater::Builder::new().build())
    .expect("failed to register updater plugin");
```

---

### Pattern 2: tauri.conf.json Updater Config Block

```json
{
  "bundle": {
    "active": true,
    "targets": "all",
    "createUpdaterArtifacts": true,
    "icon": ["...existing icons..."]
  },
  "plugins": {
    "updater": {
      "pubkey": "PLACEHOLDER_REPLACE_BEFORE_PHASE_41",
      "endpoints": [
        "https://github.com/OWNER/RELEASES_REPO/releases/latest/download/latest.json"
      ]
    }
  }
}
```

Key notes:
- `bundle.createUpdaterArtifacts: true` tells Tauri CLI to produce `.tar.gz` + `.sig` artifacts alongside normal bundles.
- `plugins.updater.pubkey` must be the literal public key content (not a path). Use a placeholder string now; CI writes the real key before Phase 41.
- The endpoint URL uses GitHub Releases' static download pattern. The `latest.json` file is the update metadata file CI will publish.
- Tauri supports template variables in endpoint URLs: `{{target}}`, `{{arch}}`, `{{current_version}}`. These are optional — a single static `latest.json` endpoint is sufficient for this project.

---

### Pattern 3: Version Injection Build Script

**Decision D-04 locked approach:** A Node.js pre-build script reads the git tag, updates `tauri.conf.json`, and exports environment variables that Vite's `define` reads.

```javascript
// Source: scripts/inject-version.js
// Run as: node scripts/inject-version.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const tag = execSync('git describe --tags --match "v[0-9]*" --abbrev=0', { encoding: 'utf8' }).trim();
const version = tag.replace(/^v/, '');       // "v1.5" → "1.5.0" (SemVer)
const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
const buildDate = new Date().toISOString().substring(0, 10); // "2026-03-24"

// 1. Write version into tauri.conf.json
const confPath = path.join(__dirname, '../src-tauri/tauri.conf.json');
const conf = JSON.parse(fs.readFileSync(confPath, 'utf8'));
conf.version = version;
fs.writeFileSync(confPath, JSON.stringify(conf, null, 2) + '\n');

// 2. Export for Vite define (vite reads process.env at config evaluation time)
process.stdout.write(
  `APP_VERSION=${version}\nAPP_COMMIT_SHA=${sha}\nAPP_BUILD_DATE=${buildDate}\n`
);
```

**Important: SemVer requirement.** Tauri updater requires the version field to be valid SemVer (`MAJOR.MINOR.PATCH`). Git tags like `v1.5` must be normalized to `1.5.0`. The script must handle single-component tags (`v1` → `1.0.0`) and two-component tags (`v1.5` → `1.5.0`).

**`package.json` script integration:**
```json
{
  "scripts": {
    "inject-version": "node scripts/inject-version.js",
    "tauri:build": "npm run inject-version && npm run tauri -- build"
  }
}
```

**`vite.config.ts` define block:**
```typescript
// Source: https://vitejs.dev/config/shared-options.html#define
define: {
  'import.meta.env.APP_VERSION': JSON.stringify(process.env.APP_VERSION ?? '0.0.0-dev'),
  'import.meta.env.APP_COMMIT_SHA': JSON.stringify(process.env.APP_COMMIT_SHA ?? 'dev'),
  'import.meta.env.APP_BUILD_DATE': JSON.stringify(process.env.APP_BUILD_DATE ?? 'unknown'),
},
```

**TypeScript augmentation (in `src/vite-env.d.ts` or similar):**
```typescript
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly APP_VERSION: string;
  readonly APP_COMMIT_SHA: string;
  readonly APP_BUILD_DATE: string;
}
```

---

### Pattern 4: Update Service (`src/services/updater.ts`)

Follows the `tauriService` abstraction pattern — wraps the plugin so tests can mock it.

```typescript
// Source: mirrors src/services/tauri.ts abstraction pattern
import { check } from '@tauri-apps/plugin-updater';

export interface UpdateInfo {
  version: string;
  body: string | null;  // changelog/notes
  date: string | null;  // RFC 3339
}

export const updaterService = {
  /**
   * Check for an available update.
   * Returns UpdateInfo if update available, null if already up to date.
   * Throws on network/endpoint errors.
   */
  check: async (): Promise<UpdateInfo | null> => {
    const update = await check();
    if (!update) return null;
    return {
      version: update.version,
      body: update.body ?? null,
      date: update.date ?? null,
    };
  },

  /**
   * Download and install update. Calls onProgress with download events.
   * Caller must call relaunch() after this resolves.
   */
  downloadAndInstall: async (
    onProgress?: (event: { event: string; data?: unknown }) => void
  ): Promise<void> => {
    const update = await check();
    if (!update) throw new Error('No update available');
    await update.downloadAndInstall(onProgress);
  },
};
```

**Why wrap rather than import directly:** `check()` imports from `@tauri-apps/plugin-updater` which requires the Tauri runtime. The abstraction layer lets tests mock `updaterService` at the module boundary, matching how `tauriService.invoke()` works.

---

### Pattern 5: Update State Machine Store (`src/stores/update.store.ts`)

Non-persisted Zustand store — identical structure to `debug-log.store.ts` (no `persist` middleware).

```typescript
// State machine: Idle → Checking → Available → Downloading → Ready → Error
export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'     // downloaded, awaiting user action to install+relaunch
  | 'error';

export interface UpdateState {
  status: UpdateStatus;
  availableVersion: string | null;
  changelog: string | null;
  releaseDate: string | null;
  downloadProgress: number | null;   // 0-100, null when not downloading
  errorMessage: string | null;

  // Transitions — each enforces valid predecessor states
  setChecking: () => void;
  setAvailable: (version: string, changelog: string | null, date: string | null) => void;
  setDownloading: () => void;
  setProgress: (pct: number) => void;
  setReady: () => void;
  setError: (msg: string) => void;
  resetToIdle: () => void;
}

export const useUpdateStore = create<UpdateState>((set) => ({
  status: 'idle',
  availableVersion: null,
  changelog: null,
  releaseDate: null,
  downloadProgress: null,
  errorMessage: null,

  setChecking: () => set({ status: 'checking', errorMessage: null }),
  setAvailable: (version, changelog, date) =>
    set({ status: 'available', availableVersion: version, changelog, releaseDate: date }),
  setDownloading: () => set({ status: 'downloading', downloadProgress: 0 }),
  setProgress: (pct) => set({ downloadProgress: pct }),
  setReady: () => set({ status: 'ready', downloadProgress: null }),
  setError: (msg) => set({ status: 'error', errorMessage: msg, downloadProgress: null }),
  resetToIdle: () => set({
    status: 'idle',
    errorMessage: null,
    downloadProgress: null,
  }),
}));
```

---

### Pattern 6: Update Polling Hook (`src/hooks/useUpdatePolling.ts`)

Mirrors `useNotificationPolling.ts` exactly — a `useQuery` with `refetchInterval` plus a launch delay.

```typescript
// D-03: 7s launch delay (mid-range of the 5-10s window)
// D-01: Silent on no update; only transitions store to 'available' when update found
// D-02: Errors logged to debug store, not surfaced to user
const LAUNCH_DELAY_MS = 7_000;

export function useUpdatePolling() {
  const updateStore = useUpdateStore();
  const { updateCheckInterval } = useSettingsStore(); // 'manual' | 1h | 6h | 12h | 24h
  const [ready, setReady] = useState(false);

  // D-03: Delay first check to avoid competing with Jira/GitLab fetches on launch
  useEffect(() => {
    const t = setTimeout(() => setReady(true), LAUNCH_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  const intervalMs = updateCheckInterval === 'manual'
    ? false  // false disables polling in TanStack Query
    : updateCheckInterval * 60 * 60 * 1000;

  useQuery({
    queryKey: ['update-check'],
    queryFn: async () => {
      updateStore.setChecking();
      try {
        const info = await updaterService.check();
        if (info) {
          updateStore.setAvailable(info.version, info.body, info.date);
        } else {
          updateStore.resetToIdle();
        }
        return info;
      } catch (err) {
        // D-02: Log to developer tools, do NOT surface to user
        debugLog({ source: 'update', error: String(err) });
        updateStore.setError(String(err));
        return null;
      }
    },
    refetchInterval: intervalMs,
    refetchIntervalInBackground: false,  // don't check while app is hidden
    staleTime: typeof intervalMs === 'number' ? intervalMs - 5_000 : Infinity,
    enabled: ready && updateCheckInterval !== 'manual',
    retry: false,  // don't retry on failure — next scheduled check will try
  });
}
```

---

### Pattern 7: Settings Store Extension

Add `updateCheckInterval` to `settings.store.ts` following the existing incremental pattern:

```typescript
// Add to SettingsState interface
/** Update check interval. 'manual' disables automatic checking. Default: '6h'. */
updateCheckInterval: 1 | 6 | 12 | 24 | 'manual';
setUpdateCheckInterval: (v: 1 | 6 | 12 | 24 | 'manual') => void;

// Add to default state
updateCheckInterval: 6 as const,

// Add setter
setUpdateCheckInterval: (v) => set({ updateCheckInterval: v }),

// Increment settings store version to 10 and add migration:
if (version < 10) {
  if (s.updateCheckInterval === undefined) s.updateCheckInterval = 6;
}
```

---

### Anti-Patterns to Avoid

- **Calling `check()` directly in components:** All calls go through `updaterService.check()` so tests can mock at the service boundary, matching the `tauriService.invoke()` pattern.
- **Not normalizing git tags to SemVer:** Tauri updater version comparison is SemVer-strict. Tags like `v1.5` must become `1.5.0`. Skipping this causes Tauri to reject version comparison and the updater won't work.
- **Embedding private key in repo:** `TAURI_SIGNING_PRIVATE_KEY` is a CI secret only. The public key goes in `tauri.conf.json`. Never commit the private key.
- **Storing update state in a persisted store:** The update status is ephemeral session state. Persisting it would cause stale "update available" prompts on next launch before the first check completes.
- **Calling `relaunch()` without user consent:** The user must trigger install+relaunch explicitly. The Phase 38 hook only detects and downloads; install trigger belongs in Phase 39's UI.
- **Ignoring the SemVer patch component in the endpoint URL:** GitHub Releases `latest.json` must contain the full SemVer version. The version in `tauri.conf.json` and the version in `latest.json` must both be full `X.Y.Z` for the updater's comparison to work.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Binary signing | Custom signing script | `TAURI_SIGNING_PRIVATE_KEY` env var + Tauri CLI | Tauri handles Ed25519 signing during `tauri build` automatically |
| Update metadata JSON | Custom server | Static `latest.json` on GitHub Releases | Tauri's JSON format is well-defined; GitHub CDN is free and sufficient |
| SemVer comparison | Custom version logic | Let Tauri updater compare | Edge cases in pre-release identifiers; Tauri handles this correctly |
| Progress tracking | WebSocket/SSE | `update.downloadAndInstall(progressCallback)` | Plugin provides progress events natively |

**Key insight:** The Tauri updater plugin handles all the hard parts — TLS, signature verification, platform-specific installation procedures, and Windows restart behavior. The app code only needs to call `check()`, read the result, and call `downloadAndInstall()` when the user consents.

---

## Common Pitfalls

### Pitfall 1: Version String Not SemVer
**What goes wrong:** `tauri.conf.json` has `"version": "1.5"` (two components). The Tauri bundler accepts it but the updater's version comparison fails silently or errors at runtime.
**Why it happens:** Git tags are conventionally `v1.5` not `v1.5.0`. The inject script must normalize.
**How to avoid:** Pad to three components: `tag.replace(/^v/, '').split('.').concat(['0','0']).slice(0,3).join('.')`.
**Warning signs:** `check()` returns `null` even when a newer version exists in `latest.json`.

### Pitfall 2: `tauri.conf.json` Modified in Git Working Tree
**What goes wrong:** After `inject-version.js` writes the version, `git diff` shows a modified `tauri.conf.json`. CI may fail dirty-tree checks or the modified file may be committed accidentally.
**Why it happens:** The build script mutates a tracked file.
**How to avoid:** Two options: (a) add `tauri.conf.json` to `.gitignore` and generate it from `tauri.conf.json.template` — but this breaks Tauri CLI tooling. (b) Reset the version to `"0.0.0-dev"` (a placeholder) as a post-build step, and document that the script-written version is transient. Option (b) is simpler.
**Warning signs:** CI commits differ from local builds; `git status` shows unexpected changes after `tauri build`.

### Pitfall 3: Updater Plugin Not Registered for Desktop Only
**What goes wrong:** Compilation fails on mobile targets or the plugin throws at runtime if not guarded with `#[cfg(desktop)]`.
**Why it happens:** `tauri-plugin-updater` is desktop-only.
**How to avoid:** Use `#[cfg(desktop)]` on the registration block, and use the `[target.'cfg(...)'.dependencies]` Cargo syntax.

### Pitfall 4: `check()` Called Before App is Ready
**What goes wrong:** The updater makes a network request during app startup before the Tauri runtime is fully initialized, causing a panic or a silent no-op.
**Why it happens:** The polling hook mounts immediately in the React tree.
**How to avoid:** The `ready` state and `setTimeout(LAUNCH_DELAY_MS)` in `useUpdatePolling` ensures the first check is delayed ~7 seconds, fully after the app has rendered and initialized.

### Pitfall 5: Vite `define` Values Not JSON-Stringified
**What goes wrong:** `define: { 'import.meta.env.APP_VERSION': process.env.APP_VERSION }` injects the raw identifier, not a string. At runtime, the value is `undefined` or a syntax error.
**Why it happens:** Vite's `define` does textual replacement — the value must be a valid JS expression, which for strings means it must include the quotes.
**How to avoid:** Always wrap with `JSON.stringify()`: `JSON.stringify(process.env.APP_VERSION ?? '0.0.0-dev')`.

### Pitfall 6: Public Key Placeholder Breaking Tauri Build
**What goes wrong:** Tauri CLI validates the `pubkey` format during `tauri build`. A non-base64 placeholder string causes a build error.
**Why it happens:** The actual Ed25519 public key is not generated until before Phase 41.
**How to avoid:** Either (a) leave the `pubkey` field absent from the config until Phase 41 (the updater plugin still registers, it just can't verify signatures — acceptable for dev), or (b) generate a throwaway keypair now for testing and replace before Phase 41 CI setup.

---

## Code Examples

### Updater Check in Tauri v2 Frontend

```typescript
// Source: https://v2.tauri.app/plugin/updater/
import { check } from '@tauri-apps/plugin-updater';

const update = await check();
if (update) {
  console.log(`Update available: ${update.version}`);
  console.log(`Notes: ${update.body}`);
  console.log(`Date: ${update.date}`);
}
```

### Update Metadata JSON Format (latest.json on GitHub Releases)

```json
{
  "version": "1.6.0",
  "notes": "## What's New\n- Auto-updates now work\n- Various fixes",
  "pub_date": "2026-05-01T12:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "CONTENT_OF_.sig_FILE",
      "url": "https://github.com/OWNER/REPO/releases/download/v1.6.0/Taskflow_1.6.0_aarch64.app.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "CONTENT_OF_.sig_FILE",
      "url": "https://github.com/OWNER/REPO/releases/download/v1.6.0/Taskflow_1.6.0_x86_64.app.tar.gz"
    },
    "windows-x86_64": {
      "signature": "CONTENT_OF_.sig_FILE",
      "url": "https://github.com/OWNER/REPO/releases/download/v1.6.0/Taskflow_1.6.0_x64-setup.exe"
    },
    "linux-x86_64": {
      "signature": "CONTENT_OF_.sig_FILE",
      "url": "https://github.com/OWNER/REPO/releases/download/v1.6.0/taskflow_1.6.0_amd64.AppImage.tar.gz"
    }
  }
}
```

**Critical:** The `signature` field must contain the literal content of the `.sig` file Tauri CLI produces, not a URL.

### Key Generation Command

```bash
# Run once before Phase 41. NOT in this phase.
cd taskflow
npx tauri signer generate -w ~/.tauri/taskflow.key
# Output: private key path + public key string (embed public key in tauri.conf.json)
```

### Zustand Store Test Pattern (from existing codebase)

```typescript
// Source: src/stores/debug-log.store.test.ts pattern
import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useUpdateStore } from './update.store';

describe('update.store', () => {
  beforeEach(() => {
    act(() => {
      useUpdateStore.setState({
        status: 'idle',
        availableVersion: null,
        changelog: null,
        releaseDate: null,
        downloadProgress: null,
        errorMessage: null,
      });
    });
  });

  it('transitions from idle to checking', () => {
    act(() => useUpdateStore.getState().setChecking());
    expect(useUpdateStore.getState().status).toBe('checking');
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri v1 updater (separate crate, `tauri-update-server`) | `tauri-plugin-updater` v2 (plugin system) | Tauri v2.0 (2024) | Plugin registration pattern is now `.plugin(tauri_plugin_updater::Builder::new().build())`, not build feature flags |
| Tauri v1 `allowlist.updater` in tauri.conf.json | `plugins.updater` block in tauri.conf.json | Tauri v2.0 (2024) | Config structure changed; v1 docs are not applicable |

**Deprecated/outdated:**
- Tauri v1 updater config (`tauri.conf.json > tauri > updater` nested block): Replaced by `plugins.updater` top-level block in v2.
- `tauri-update-server`: Was a separate community server; GitHub Releases static JSON is now the standard approach.

---

## Open Questions

1. **Public key placeholder strategy**
   - What we know: Tauri CLI validates `pubkey` format during `tauri build`. A garbage string causes a build error.
   - What's unclear: Whether an absent `pubkey` field is tolerated by the Tauri CLI during local dev builds (no CI signing).
   - Recommendation: Verify locally with `npm run tauri -- build` after adding the config block with `pubkey` absent. If it fails, generate a throwaway keypair for dev-only use and replace before Phase 41.

2. **`tauri.conf.json` version field in dev mode**
   - What we know: `tauri dev` reads `tauri.conf.json` directly. If the inject-version script sets it to a real version, dev mode also reports that version.
   - What's unclear: Whether there's a need to distinguish dev-mode version from release builds.
   - Recommendation: Use `"0.0.0-dev"` as the committed default. The build script only overwrites it during `npm run tauri:build`, not during `npm run tauri dev`. This keeps git clean.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| cargo / rustc | tauri-plugin-updater Rust build | ✓ | cargo 1.94.0 | — |
| Node.js | inject-version.js script | ✓ | v25.8.1 | — |
| git | Read tag in inject-version.js | ✓ | 2.50.1 | — |
| @tauri-apps/plugin-updater | Frontend update API | ✗ (not yet installed) | — | Install via npm |
| tauri-plugin-updater | Rust backend | ✗ (not yet in Cargo.toml) | — | Install via cargo add |
| git tags (v1.x format) | inject-version.js version read | ✓ | v1.5 is latest | — |

**Missing dependencies with no fallback:**
- `@tauri-apps/plugin-updater` and `tauri-plugin-updater` must be installed as part of this phase.

**Missing dependencies with fallback:**
- None.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npm test -- --reporter=dot` |
| Full suite command | `cd taskflow && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CI-03 | `APP_VERSION` inject sets version to git tag (no `v` prefix, SemVer) | unit | `npm test -- src/stores/update.store.test.ts` | ❌ Wave 0 |
| CI-04 | `APP_COMMIT_SHA` and `APP_BUILD_DATE` are accessible as `import.meta.env` strings | unit | `npm test -- src/lib/build-info.test.ts` | ❌ Wave 0 |
| UPD-01 (state machine) | Store transitions: idle→checking, checking→available, checking→error, available→downloading, downloading→ready | unit | `npm test -- src/stores/update.store.test.ts` | ❌ Wave 0 |
| UPD-01 (settings) | `updateCheckInterval` persists in settings store; migration from v9 sets default `6` | unit | `npm test -- src/stores/settings.store.test.ts` | ✅ (extend existing) |
| UPD-01 (service) | `updaterService.check()` calls the plugin and maps the result to `UpdateInfo` | unit | `npm test -- src/services/updater.test.ts` | ❌ Wave 0 |
| UPD-01 (hook) | `useUpdatePolling` does not fire before `LAUNCH_DELAY_MS`; fires on interval when `updateCheckInterval !== 'manual'` | integration | manual-only (requires fake timers + Tauri mock) | ❌ Wave 0 (manual-only) |

**Manual-only justifications:**
- `useUpdatePolling` integration test requires both fake timers and a mocked Tauri plugin runtime. The state machine and service tests cover all the individual units; the hook integration is verified by smoke-testing the running app.

### Sampling Rate
- **Per task commit:** `cd taskflow && npm test -- --reporter=dot`
- **Per wave merge:** `cd taskflow && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/stores/update.store.test.ts` — covers CI-03 state machine transitions
- [ ] `src/services/updater.test.ts` — covers UPD-01 service wrapper (mock `@tauri-apps/plugin-updater`)
- [ ] `src/lib/build-info.test.ts` — covers CI-04 `import.meta.env` constant presence and non-empty string values

*(Extending `src/stores/settings.store.test.ts` for `updateCheckInterval` migration — existing file, not a Wave 0 gap)*

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md does not exist in the working directory. No project-specific overrides apply. Standard project patterns observed from codebase inspection:

- **Linter/formatter:** Biome (`npm run check` / `npm run fix`) — all new code must pass.
- **TypeScript:** Strict mode (`tsc --noEmit` in `npm run check`) — all new files must be fully typed.
- **Test framework:** Vitest with jsdom, `@testing-library/react`. Tests live alongside source files as `*.test.ts`.
- **Tauri IPC abstraction:** All Tauri plugin imports are wrapped in a service module (`src/services/*.ts`). Never import `@tauri-apps/` directly in components or stores.
- **Zustand patterns:** Persisted stores use `createTauriStorage`; non-persisted stores use plain `create<T>()`. No cross-store imports except via `getState()` in non-reactive contexts.
- **No `console.log`:** Debug output goes to the debug log store via `useDebugLogStore().append()`.

---

## Sources

### Primary (HIGH confidence)
- `https://v2.tauri.app/plugin/updater/` — Fetched directly; plugin installation, config schema, JS API, key generation commands
- `npm view @tauri-apps/plugin-updater` — Version 2.10.0 confirmed current (published ~1 month ago)
- `cargo search tauri-plugin-updater` — Rust crate version 2.10.0 confirmed
- Project codebase (`taskflow/`) — All patterns (stores, services, hooks, tests) extracted directly

### Secondary (MEDIUM confidence)
- Tauri v2 config schema `https://schema.tauri.app/config/2` — Inferred from existing `tauri.conf.json` `$schema` reference

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified from npm registry and Cargo registry
- Architecture: HIGH — all patterns derived directly from existing codebase files
- Pitfalls: HIGH for SemVer/key issues (verified from Tauri docs); MEDIUM for `define` JSON.stringify (common Vite gotcha, not explicitly in docs)

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (Tauri plugin versions; check before Phase 39 planning)
