# Quick Task 260827-eaj: Open links in a user-selectable browser — Research

**Researched:** 2026-08-27
**Domain:** Tauri v2 desktop (opener plugin), cross-platform browser launch + discovery, Zustand/Tauri-store settings
**Confidence:** HIGH (core mechanism verified against vendored crate source + live macOS test); MEDIUM (Windows/Linux path heuristics — not executable on this machine)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Scope of links affected**
- The selected-browser preference applies to ALL external links app-wide: dedicated "open in browser" buttons/menu items AND links clicked inside rendered descriptions/comments (wiki content, TipTap-rendered HTML, etc.).

**Browser list source**
- Claude's discretion — must work cross-platform (macOS, Windows, Linux, since this is a Tauri app). Research phase should determine the most feasible detection approach (auto-detect installed browsers vs. manual path entry) given Tauri's plugin ecosystem and OS APIs, and the planner should pick the simplest approach that reliably works on all three platforms. A "System Default" option should always be available regardless of approach.

**Fallback behavior**
- If the selected browser can't be launched, silently fall back to opening with the OS default browser. No toast/notification on fallback — fail quietly and just get the link open.

### Claude's Discretion
- Detection approach for the browser list (see above).
- UI placement/copy: "implement as a new setting under wherever app preferences/settings currently live (e.g. a 'Browser' or 'Links' section), following existing settings UI patterns in the app."

### Deferred Ideas (OUT OF SCOPE)
- None recorded.
</user_constraints>

## Summary

The app already depends on `@tauri-apps/plugin-opener` 2.5.3 / `tauri-plugin-opener` 2 (Cargo), and that plugin **already supports launching a URL with a specific application** via the second `openWith` argument of `openUrl(url, openWith?)`. No new npm package, no new Rust crate, and no `std::process::Command` shelling is required for the *launch* half of the task. [VERIFIED: node_modules/@tauri-apps/plugin-opener/dist-js/index.d.ts + ~/.cargo/registry/.../tauri-plugin-opener-2.5.3/src/open.rs]

There is exactly one blocking gotcha: the plugin's `default` permission set scopes `http://*` / `https://*` with `app = Application::Default`, and `Application::Default` matches **only when `with` is `None`**. Passing any `openWith` string today returns `Error::ForbiddenUrl`. The capability file must be widened. [VERIFIED: crate source `permissions/allow-default-urls.toml` + `src/scope.rs::Application::matches`]

For *discovery* of installed browsers there is no suitable crate on crates.io (`webbrowser` opens URLs but cannot enumerate, and its browser enum is a fixed short list). The least-code reliable approach is a small `#[tauri::command] list_browsers()` in `src-tauri/src/lib.rs` that checks a hardcoded table of well-known browsers against per-platform filesystem paths using only `std::path::Path::exists()` — zero subprocesses, zero new dependencies, works identically on all three OSes, and returns an absolute launch token that `openWith` accepts on every platform.

**Primary recommendation:** Add `externalBrowser: string | null` to the existing Zustand settings store, a `src/lib/openExternal.ts` wrapper that calls `openUrl(url, browser ?? undefined)` and retries `openUrl(url)` on rejection, replace all 12 `openUrl(...)` call sites with it, widen the opener capability scope, and add a tiny `list_browsers` Rust command doing pure `Path::exists()` checks. Estimated ~250 lines total.

## Standard Stack

### Already present — do NOT add anything

| Dependency | Version | Role in this task |
|-----------|---------|-------------------|
| `@tauri-apps/plugin-opener` | 2.5.3 (installed) | `openUrl(url, openWith?)` — the whole launch mechanism [VERIFIED: package.json + node_modules] |
| `tauri-plugin-opener` (Rust) | `"2"` → 2.5.3 resolved | Backend command + scope enforcement [VERIFIED: Cargo.toml, cargo registry] |
| `@tauri-apps/plugin-store` + `zustand/persist` | in use | Existing settings persistence (`settings.json`, key `settings-store`) [VERIFIED: src/lib/tauri-storage.ts] |
| `src/services/tauri.ts` `tauriService.invoke()` | in use | The only sanctioned invoke boundary (mockable in vitest) [VERIFIED: src/services/tauri.ts] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|-----------|-----------|----------|
| `openUrl(url, with)` | `std::process::Command` in a custom Rust command | Reimplements what the opener plugin already does (incl. detached spawn + per-OS arg shape). More code, no benefit. Reject. |
| Path-scan detection | `webbrowser` crate 1.2.4 | [ASSUMED] Opens only; fixed `Browser` enum (Default/Firefox/Chrome/Safari/Opera/…); cannot enumerate installed browsers. Adds a dep for nothing. Reject. |
| Path-scan detection | macOS `mdfind "kMDItemCFBundleIdentifier == '…'"`, Windows `HKLM\SOFTWARE\Clients\StartMenuInternet`, Linux `.desktop` scan | Most complete, but 3 divergent implementations + a `winreg` dep + Spotlight dependency. Overkill for a quick task. |
| Auto-detect | Manual "browser path" text field | Least code but poor UX and no cross-platform hint. Keep as no-op; detection is cheap enough. |

**Installation:** none. **Zero new packages.**

## Package Legitimacy Audit

**No external packages are added by this task.** All required capability exists in dependencies already present in `taskflow/package.json` and `taskflow/src-tauri/Cargo.toml`. slopcheck not required — audit table intentionally empty.

## How `openWith` actually behaves (verified)

`tauri-plugin-opener` forwards `with` verbatim to the `open` crate 5.3.3 `with_detached(path, app)`:

| Platform | Command constructed | Implication for the stored value |
|----------|--------------------|----------------------------------|
| macOS | `/usr/bin/open <url> -a <app>` | `<app>` = app name (`"Firefox"`) **or** bundle path (`"/Applications/Firefox.app"`) [VERIFIED: open-5.3.3/src/macos.rs] |
| Windows | `cmd /c start "" "<app>" "<url>"` (CREATE_NO_WINDOW) | `<app>` = exe name resolvable via App Paths **or** absolute `.exe` path [VERIFIED: open-5.3.3/src/windows.rs] |
| Linux/Unix | `Command::new(<app>).arg(<url>)` | `<app>` = binary name on `PATH` **or** absolute binary path [VERIFIED: open-5.3.3/src/unix.rs] |

**Key consequence:** an **absolute path** is a valid `with` value on *all three* platforms. So the detection command and the persisted setting can use one uniform representation — the absolute path discovered during detection — avoiding any per-platform token translation at call time.

**macOS arg-order check (this looked wrong, it isn't):** the crate builds `open <url> -a <app>` (URL *before* the flag). Live-tested on this machine:
```
$ /usr/bin/open "https://example.com" -a "NoSuchApp1234"
Unable to find application named 'NoSuchApp1234'   # exit 1
```
The error is about the *app*, not the URL — confirming `open` parses `-a` positioned after the URL. [VERIFIED: local execution, macOS 25.6.0]

## The blocking gotcha: capability scope

`src-tauri/capabilities/default.json` currently lists `"opener:default"`. That set includes `allow-default-urls`, whose scope entries are:

```toml
[[permission.scope.allow]]
url = "http://*"      # app field omitted → Application::Default
[[permission.scope.allow]]
url = "https://*"
```

and `scope.rs`:
```rust
impl Application {
    fn matches(&self, a: Option<&str>) -> bool {
        match self {
            Self::Default => a.is_none(),           // <-- rejects any `with`
            Self::Enable(enable) => *enable,        // `app: true` → allow any program
            Self::App(program) => Some(program.as_str()) == a,
        }
    }
}
```
`open_url` returns `Err(Error::ForbiddenUrl { url, with })` when no allow entry matches. [VERIFIED: crate source]

**Fix (minimal):** in `capabilities/default.json`, replace bare `"opener:default"` usage for URLs by adding an explicit scoped entry:

```json
{
  "identifier": "opener:allow-open-url",
  "allow": [
    { "url": "http://*",  "app": true },
    { "url": "https://*", "app": true }
  ]
}
```
Keep `"opener:default"` as-is (needed for `reveal-item-in-dir` and the default-app path); scopes are unioned across entries, so adding the above is additive and non-breaking.

Security note: `"app": true` permits launching *any* program name the frontend supplies. Since the frontend only ever supplies a value that came from the backend's own `list_browsers()` allowlist, exposure is limited — but a stricter alternative is to enumerate each detected browser path as `{"url": "https://*", "app": "/Applications/Firefox.app"}`. That cannot be expressed statically (paths differ per machine), so `"app": true` is the pragmatic choice. Recommend the Rust side additionally validate that `with` is one of the paths `list_browsers()` would return, if hardening is wanted later — not required for this task.

## Architecture: least-code path

```
Settings UI (BrowserSection)
   │  useEffect → tauriService.invoke<Browser[]>('list_browsers')
   ▼
Rust  list_browsers()  ── pure std::fs Path::exists() over a const table
   │                      returns [{ id, label, path }]
   ▼
settings.store.ts   externalBrowser: string | null   (absolute path, null = System Default)
   │
   ▼
src/lib/openExternal.ts  ← SINGLE choke point
   │  openUrl(url, browser ?? undefined)
   │     .catch(() => openUrl(url))        ← silent fallback (locked decision)
   ▼
12 existing call sites (buttons + WikiRenderer/DiscussionThreads rendered links)
```

### Component responsibilities

| File | Change |
|------|--------|
| `taskflow/src-tauri/src/lib.rs` | Add `#[tauri::command] fn list_browsers() -> Vec<BrowserInfo>`; register in `invoke_handler![greet, toggle_debug_menu, save_attachment, list_browsers]` (line 283) |
| `taskflow/src-tauri/capabilities/default.json` | Add scoped `opener:allow-open-url` entry with `"app": true` |
| `taskflow/src/lib/openExternal.ts` | **NEW** — wrapper + silent fallback |
| `taskflow/src/stores/settings.store.ts` | `externalBrowser: null` in `initialSettings` (line ~21), interface field, `setExternalBrowser` action, bump `version: 28 → 29` (line 362) + `if (version < 29) { if (s.externalBrowser === undefined) s.externalBrowser = null; }` |
| `taskflow/src/routes/settings/Settings.tsx` | Optional new section, or fold into an existing one |
| 9 files with `openUrl` imports | Swap `import { openUrl } from '@tauri-apps/plugin-opener'` → `import { openExternal } from '@/lib/openExternal'` |

### The 12 call sites to migrate (non-test)

| File | Line(s) | Kind |
|------|---------|------|
| `src/routes/dashboard/WikiRenderer.tsx` | 1366 | **rendered description/comment links** (the big one) |
| `src/routes/dashboard/DiscussionThreads.tsx` | 101 | rendered MR-discussion links |
| `src/routes/dashboard/IssueDetailContent.tsx` | 510 | "open in browser" button |
| `src/routes/dashboard/ReleaseDetailPage.tsx` | 206 | button |
| `src/routes/dashboard/SubtasksPanel.tsx` | 17 (+ `window.open` fallback at 19) | button |
| `src/routes/dashboard/MergeRequestDetailPage.tsx` | 222 | button |
| `src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx` | 324, 338, 474 | buttons |
| `src/routes/dashboard/release-detail/UnifiedTaskTable.tsx` | 445, 745 | row/button |
| `src/routes/notifications/NotificationPopover.tsx` | 324 | notification click |

`src/lib/internalLinks.ts` needs **no change** — it only decides in-app vs. external; the external branch is what routes into `openExternal`.

`SubtasksPanel.tsx` uniquely has a `window.open(url, '_blank', 'noopener,noreferrer')` fallback inside a try/catch (its test at `SubtasksPanel.test.tsx:53` mocks a rejecting `openUrl` to exercise it). Preserve that as the *final* fallback rung: selected browser → default browser → `window.open`.

## Recommended detection table

Pure `std::path::Path::exists()`, no subprocess, no new crate. Entry is included in the dropdown only if a path resolves.

**macOS** — check `/Applications/<X>.app` then `~/Applications/<X>.app`. Verified present on the dev machine: `Safari.app`, `Firefox.app`, `Google Chrome.app`, `Microsoft Edge.app` [VERIFIED: `ls /Applications`]. Candidate list: Safari, Google Chrome, Firefox, Microsoft Edge, Brave Browser, Arc, Vivaldi, Opera, Chromium, Zen Browser. Return the `.app` bundle path as the launch token.

*(Optional robustness fallback if a bundle is installed outside `/Applications`: `mdfind "kMDItemCFBundleIdentifier == 'org.mozilla.firefox'"` — live-verified working on this machine, returns `/Applications/Firefox.app`. Adds a subprocess; treat as a nice-to-have, not required.)*

**Windows** [ASSUMED — not executable here] — check under `%ProgramFiles%`, `%ProgramFiles(x86)%`, `%LOCALAPPDATA%`:
`Google\Chrome\Application\chrome.exe`, `Mozilla Firefox\firefox.exe`, `Microsoft\Edge\Application\msedge.exe`, `BraveSoftware\Brave-Browser\Application\brave.exe`, `Vivaldi\Application\vivaldi.exe`, `Opera\opera.exe`. Return the absolute `.exe`. (The registry route `HKLM\SOFTWARE\Clients\StartMenuInternet` is more complete but needs a `winreg` dependency — not worth it here.)

**Linux** [ASSUMED — not executable here] — split `$PATH` on `:` and test each dir for: `firefox`, `google-chrome`, `google-chrome-stable`, `chromium`, `chromium-browser`, `brave-browser`, `microsoft-edge`, `vivaldi`, `opera`. Return the absolute binary path. (Flatpak-only installs will be missed — acceptable; silent fallback covers it.)

Gate each block with `#[cfg(target_os = "…")]`.

**"System Default"** is a UI-only entry mapping to `externalBrowser = null` → `openUrl(url)` with no second arg → existing behavior, still permitted by `opener:default`.

## Common Pitfalls

### 1. Forgetting the capability scope
**Symptom:** every selected-browser click silently falls back to the default browser and the feature looks like a no-op.
**Cause:** `Application::Default` in `allow-default-urls` rejects any `with`.
**Detect early:** the rejection is `Error::ForbiddenUrl`; log it (dev only) during implementation, then remove the log. Because the locked decision says *fail silently*, a missing scope produces zero user-visible signal — verify explicitly.

### 2. Silent fallback swallowing everything
`openUrl(...).catch(() => openUrl(url))` will also swallow a genuinely malformed URL. Keep the fallback narrow and let the second `openUrl` reject unhandled (or `.catch(() => {})`, matching the existing style at `IssueDetailContent.tsx:510` and `WikiRenderer.tsx:1366`).

### 3. Stale persisted browser path
A browser the user selected can be uninstalled or moved. Do **not** validate at startup; just let the launch fail and fall back (locked decision). Optionally re-run `list_browsers()` on entering the settings section and show the persisted value as "(not found)" if absent — cosmetic, not required.

### 4. Zustand persist version bump
`settings.store.ts` uses `version: 28` with a cumulative `migrate` chain. Adding a field without bumping to 29 + a `version < 29` branch means existing installs (with `version: 28` in `settings.json`) skip initialization; the field will be `undefined` rather than `null`. Follow the exact pattern already used at `if (version < 25) { if (s.rankFieldKey === undefined) s.rankFieldKey = null; }`.

### 5. Test mocks
Nine test files currently `vi.mock('@tauri-apps/plugin-opener', …)` and assert on `openUrl`. Introducing `openExternal` means these assertions must either target the new module or the mock must stay at the plugin boundary (preferred — `openExternal` calls the real `openUrl`, so existing `expect(openUrl).toHaveBeenCalledWith(url)` assertions keep passing when `externalBrowser` is `null`). Choosing the plugin-level mock minimizes test churn. Note `RecentItemsPopover.test.tsx`, `CommandPalette.test.tsx`, and `SprintBoardTab.test.tsx` mock the plugin but their components no longer call it — those mocks are inert.

### 6. Pre-commit hook runs the full vitest suite
Known project constraint — combine RED/GREEN into a single commit per TDD task.

## Code Examples

### `src/lib/openExternal.ts` (new)
```ts
import { openUrl } from '@tauri-apps/plugin-opener';
import { useSettingsStore } from '@/stores/settings.store';

/**
 * Open an external URL in the user-selected browser, silently falling back to
 * the OS default when the selected browser cannot be launched.
 * Reads the store imperatively (getState) so non-React call sites work too.
 */
export async function openExternal(url: string): Promise<void> {
  const selected = useSettingsStore.getState().externalBrowser;
  if (selected) {
    try {
      await openUrl(url, selected);
      return;
    } catch {
      // fall through — silent fallback per product decision
    }
  }
  await openUrl(url);
}
```

### `list_browsers` command sketch (`src-tauri/src/lib.rs`)
```rust
#[derive(serde::Serialize)]
struct BrowserInfo { id: String, label: String, path: String }

#[tauri::command]
fn list_browsers() -> Vec<BrowserInfo> {
    let mut out = Vec::new();
    #[cfg(target_os = "macos")]
    {
        const APPS: &[(&str, &str)] = &[
            ("safari", "Safari"), ("chrome", "Google Chrome"), ("firefox", "Firefox"),
            ("edge", "Microsoft Edge"), ("brave", "Brave Browser"), ("arc", "Arc"),
            ("vivaldi", "Vivaldi"), ("opera", "Opera"), ("chromium", "Chromium"),
        ];
        let home = dirs::home_dir();
        for (id, name) in APPS {
            for base in [PathBuf::from("/Applications")]
                .into_iter()
                .chain(home.iter().map(|h| h.join("Applications")))
            {
                let p = base.join(format!("{name}.app"));
                if p.exists() {
                    out.push(BrowserInfo { id: id.to_string(), label: name.to_string(),
                                           path: p.to_string_lossy().into_owned() });
                    break;
                }
            }
        }
    }
    // #[cfg(target_os = "windows")] … %ProgramFiles% / %LOCALAPPDATA% exe paths
    // #[cfg(target_os = "linux")]   … split $PATH, test known binary names
    out
}
```
`dirs = "5"` is already a Cargo dependency [VERIFIED: Cargo.toml].

### Frontend invoke (follow existing boundary)
```ts
import { tauriService } from '@/services/tauri';
const browsers = await tauriService.invoke<BrowserInfo[]>('list_browsers');
```
`tauriService` is documented as "the ONLY place that imports from `@tauri-apps/api/core`" — do not import `invoke` directly. [VERIFIED: src/services/tauri.ts]

## Settings UI placement

`Settings.tsx` renders a fixed `SECTIONS` array with nine sections (Connections, Appearance, Sidebar, Notifications, Workflow, Subtask Templates, Integrations, Updates, Advanced) and swaps content by `activeSection` state. Two viable options:

- **Lowest-code:** add the browser picker to the existing **Workflow** or **Appearance** section (no `SettingsSection` union change, no nav entry).
- **Most discoverable:** add a new `'links'` section (`Link2` icon is imported but currently used by Connections; `ExternalLink` from lucide-react is a better fit).

Follow the `AppearanceSection.tsx` pattern: a `const OPTIONS` array + labelled group of buttons, or a shadcn `Select` for a variable-length list (browser count is dynamic — a `Select` is the better fit here).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Windows browser install paths under `%ProgramFiles%` / `%LOCALAPPDATA%` as listed | Detection table | Dropdown is empty on Windows; user gets System Default only. Low severity (silent fallback), but feature is dead on Windows. |
| A2 | Linux browser binary names as listed are on `PATH` | Detection table | Same as A1 for Linux. |
| A3 | `webbrowser` crate cannot enumerate installed browsers | Alternatives | Only affects the "don't add a dep" argument; recommendation stands regardless. |
| A4 | `cmd /c start "" "<app>"` resolves bare exe names via App Paths on Windows | Verified behavior table | Mitigated: recommendation stores **absolute** exe paths, which do not rely on App Paths. |

## Open Questions

1. **Should the dropdown show browsers detected as absent?**
   - Known: detection returns only present browsers; "System Default" is always present.
   - Unclear: what to render if the persisted path no longer exists.
   - Recommendation: render the persisted value as a disabled/greyed item labelled with its basename; do not auto-clear (avoids surprising the user). Cosmetic — planner may drop it.

2. **Harden `with` validation server-side?**
   - Known: `"app": true` in the capability permits any program string from the frontend.
   - Recommendation: out of scope for this quick task; note it as a follow-up if the app ever renders untrusted-driven settings.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|-----------|------------|-----------|---------|----------|
| `@tauri-apps/plugin-opener` | launch-with-browser | ✓ | 2.5.3 | — |
| `tauri-plugin-opener` (Rust) | scope + command | ✓ | 2.5.3 | — |
| `dirs` crate | `~/Applications` lookup | ✓ | 5 | `std::env::var("HOME")` |
| `@tauri-apps/plugin-store` | settings persistence | ✓ | in use | — |
| macOS `/usr/bin/open` | macOS launch | ✓ | system | — |

**Missing dependencies:** none.

## Sources

### Primary (HIGH confidence)
- `~/.cargo/registry/src/index.crates.io-*/tauri-plugin-opener-2.5.3/src/{open.rs,commands.rs,scope.rs,scope_entry.rs}` and `permissions/{default.toml,allow-default-urls.toml}` — scope semantics, `with` plumbing
- `~/.cargo/registry/src/index.crates.io-*/open-5.3.3/src/{macos.rs,windows.rs,unix.rs}` — per-platform command shapes
- `taskflow/node_modules/@tauri-apps/plugin-opener/dist-js/index.d.ts` — `openUrl(url, openWith?)` signature
- Local execution: `/usr/bin/open <url> -a <app>` arg-order test; `mdfind kMDItemCFBundleIdentifier` detection test; `ls /Applications`
- Codebase: `settings.store.ts`, `tauri-storage.ts`, `services/tauri.ts`, `capabilities/default.json`, `src-tauri/src/lib.rs`, `Settings.tsx`, `AppearanceSection.tsx`, all `openUrl` call sites

### Secondary (MEDIUM confidence)
- `cargo search browser` — no crate provides cross-platform installed-browser enumeration

## Metadata

**Confidence breakdown:**
- Launch mechanism + scope gotcha: **HIGH** — read directly from vendored crate source and confirmed by live macOS test
- macOS detection: **HIGH** — two independent methods tested on the target machine
- Windows/Linux detection paths: **MEDIUM/LOW** — training-knowledge path lists, unverifiable from macOS; silent-fallback decision limits blast radius
- Settings/store integration: **HIGH** — patterns read from the codebase

**Research date:** 2026-08-27
**Valid until:** 2026-09-26 (stable APIs; opener plugin is on a settled v2 line)
