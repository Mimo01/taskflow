---
phase: quick-260827-eaj
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src-tauri/src/lib.rs
  - taskflow/src-tauri/capabilities/default.json
  - taskflow/src/lib/openExternal.ts
  - taskflow/src/lib/openExternal.test.ts
  - taskflow/src/stores/settings.store.ts
  - taskflow/src/routes/dashboard/WikiRenderer.tsx
  - taskflow/src/routes/dashboard/DiscussionThreads.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
  - taskflow/src/routes/dashboard/SubtasksPanel.tsx
  - taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx
  - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx
  - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
  - taskflow/src/routes/notifications/NotificationPopover.tsx
  - taskflow/src/routes/settings/LinksSection.tsx
  - taskflow/src/routes/settings/LinksSection.test.tsx
  - taskflow/src/routes/settings/Settings.tsx
autonomous: true
requirements: [LINK-01, LINK-02, LINK-03]

must_haves:
  truths:
    - "User can open Settings → Links and see a browser dropdown listing System Default plus every browser detected on their machine"
    - "Selecting a browser persists across app restart"
    - "Clicking any 'open in browser' button opens the URL in the selected browser"
    - "Clicking a link inside a rendered description or comment opens it in the selected browser"
    - "If the selected browser cannot be launched, the URL still opens in the OS default browser with no error toast"
    - "Choosing System Default restores the pre-existing default-browser behavior"
  artifacts:
    - path: "taskflow/src/lib/openExternal.ts"
      provides: "Single choke point for all external URL opening with silent fallback"
      exports: ["openExternal"]
      min_lines: 15
    - path: "taskflow/src-tauri/src/lib.rs"
      provides: "list_browsers tauri command using Path::exists() detection"
      contains: "fn list_browsers"
    - path: "taskflow/src-tauri/capabilities/default.json"
      provides: "opener:allow-open-url scope permitting a non-default launch app"
      contains: "opener:allow-open-url"
    - path: "taskflow/src/routes/settings/LinksSection.tsx"
      provides: "Browser picker UI"
      min_lines: 40
    - path: "taskflow/src/stores/settings.store.ts"
      provides: "externalBrowser persisted setting at store version 29"
      contains: "externalBrowser"
  key_links:
    - from: "taskflow/src/lib/openExternal.ts"
      to: "useSettingsStore.externalBrowser"
      via: "getState() imperative read"
      pattern: "useSettingsStore\\.getState\\(\\)\\.externalBrowser"
    - from: "taskflow/src/lib/openExternal.ts"
      to: "@tauri-apps/plugin-opener openUrl"
      via: "openUrl(url, selected) with openUrl(url) fallback"
      pattern: "openUrl\\(url, *selected\\)"
    - from: "taskflow/src/routes/dashboard/WikiRenderer.tsx"
      to: "@/lib/openExternal"
      via: "import + anchor click handler"
      pattern: "openExternal\\("
    - from: "taskflow/src/routes/settings/LinksSection.tsx"
      to: "list_browsers"
      via: "tauriService.invoke"
      pattern: "invoke<[^>]*>\\('list_browsers'\\)"
---

<objective>
Add a settings option that routes every external link in the app through a user-selected browser, falling back silently to the OS default browser when that browser cannot be launched.

Purpose: The app opens many URLs (Jira issues, GitLab MRs, links embedded in descriptions and comments). Users who keep work in a separate browser profile currently have no way to control where those open.
Output: A `list_browsers` Rust command, a widened opener capability scope, an `externalBrowser` persisted setting, a single `openExternal()` choke point replacing all 12 `openUrl` call sites, and a Links section in Settings.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260827-eaj-add-a-settings-option-to-open-links-in-a/260827-eaj-CONTEXT.md
@.planning/quick/260827-eaj-add-a-settings-option-to-open-links-in-a/260827-eaj-RESEARCH.md

@taskflow/src-tauri/src/lib.rs
@taskflow/src-tauri/capabilities/default.json
@taskflow/src/stores/settings.store.ts
@taskflow/src/services/tauri.ts
@taskflow/src/routes/settings/Settings.tsx
@taskflow/src/routes/settings/AppearanceSection.tsx
</context>

<interfaces>
Contracts established by this plan and consumed downstream within it:

```ts
// taskflow/src/lib/openExternal.ts
export interface BrowserInfo { id: string; label: string; path: string }
export function openExternal(url: string): Promise<void>;
```

```rust
// taskflow/src-tauri/src/lib.rs — serialized to the BrowserInfo shape above
struct BrowserInfo { id: String, label: String, path: String }
#[tauri::command] fn list_browsers() -> Vec<BrowserInfo>;
```

Store contract: `useSettingsStore.getState().externalBrowser: string | null` — absolute launch path, `null` means System Default. Action: `setExternalBrowser(path: string | null): void`.
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Backend browser detection + opener capability scope</name>
  <files>taskflow/src-tauri/src/lib.rs, taskflow/src-tauri/capabilities/default.json</files>
  <action>
Add a `list_browsers` Tauri command to `src-tauri/src/lib.rs` and register it in the existing `tauri::generate_handler!` list at line 281 alongside `greet, toggle_debug_menu, save_attachment`.

Define a private `#[derive(serde::Serialize)] struct BrowserInfo` with fields `id: String`, `label: String`, `path: String`. `path` is the absolute launch token — RESEARCH verified that the `open` crate accepts an absolute path as the `with` argument on all three platforms (macOS `open -a <bundle>`, Windows `cmd /c start "" "<exe>"`, Unix `Command::new(<bin>)`), so no per-platform token translation is needed at call time.

Detection uses only `std::path::Path::exists()` — no subprocess, no new crate. `dirs = "5"` is already a Cargo dependency. Gate each block with `#[cfg(target_os = "...")]`:

- macOS: for each of (safari/Safari), (chrome/Google Chrome), (firefox/Firefox), (edge/Microsoft Edge), (brave/Brave Browser), (arc/Arc), (vivaldi/Vivaldi), (opera/Opera), (chromium/Chromium), (zen/Zen Browser) — check `/Applications/<Name>.app` then `<home>/Applications/<Name>.app` via `dirs::home_dir()`, push the first hit and break.
- Windows: join each of `%ProgramFiles%`, `%ProgramFiles(x86)%`, `%LOCALAPPDATA%` (read with `std::env::var`) against the relative exe paths `Google\Chrome\Application\chrome.exe`, `Mozilla Firefox\firefox.exe`, `Microsoft\Edge\Application\msedge.exe`, `BraveSoftware\Brave-Browser\Application\brave.exe`, `Vivaldi\Application\vivaldi.exe`, `Opera\opera.exe`; push the first existing absolute path per browser.
- Linux: split `std::env::var("PATH")` on `:` and test each dir for the binaries `firefox`, `google-chrome`, `google-chrome-stable`, `chromium`, `chromium-browser`, `brave-browser`, `microsoft-edge`, `vivaldi`, `opera`; push the first existing absolute path per browser.

Only browsers whose path resolves are returned. The command never errors — it returns an empty Vec if nothing is found. "System Default" is a UI-only entry and is NOT returned by this command.

CRITICAL (RESEARCH pitfall 1 — this is the whole feature): `capabilities/default.json` currently lists bare `"opener:default"`, whose `allow-default-urls` scope entries omit the `app` field, which resolves to `Application::Default` and matches only when `with` is `None`. Any `openWith` string today returns `Error::ForbiddenUrl` and the feature silently no-ops. Add an additive scoped permission object to the `permissions` array (keep `"opener:default"` — it is still needed for `reveal-item-in-dir` and the no-`with` path; scopes union across entries):

identifier `opener:allow-open-url`, `allow` = two entries, `{ "url": "http://*", "app": true }` and `{ "url": "https://*", "app": true }`.

Do not remove or reorder any existing permission entry.
  </action>
  <verify>
    <automated>cd taskflow/src-tauri && cargo check 2>&1 | tail -5 && grep -q "opener:allow-open-url" capabilities/default.json && grep -q '"app": true' capabilities/default.json && grep -q "list_browsers" src/lib.rs && grep -c "list_browsers" src/lib.rs</automated>
  </verify>
  <done>`cargo check` passes with no new warnings; `list_browsers` appears in both its definition and the `generate_handler!` list (grep count >= 2); `capabilities/default.json` contains an `opener:allow-open-url` entry with `"app": true` for both http and https, and still contains `"opener:default"`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: openExternal choke point, settings store field, and all 12 call-site migrations</name>
  <files>taskflow/src/lib/openExternal.ts, taskflow/src/lib/openExternal.test.ts, taskflow/src/stores/settings.store.ts, taskflow/src/routes/dashboard/WikiRenderer.tsx, taskflow/src/routes/dashboard/DiscussionThreads.tsx, taskflow/src/routes/dashboard/IssueDetailContent.tsx, taskflow/src/routes/dashboard/ReleaseDetailPage.tsx, taskflow/src/routes/dashboard/SubtasksPanel.tsx, taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx, taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx, taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx, taskflow/src/routes/notifications/NotificationPopover.tsx</files>
  <behavior>
`openExternal(url)` in `src/lib/openExternal.test.ts`, mocking `@tauri-apps/plugin-opener` and seeding `useSettingsStore` state:
- Test 1: `externalBrowser` is `null` → calls `openUrl(url)` exactly once, with a single argument (no second arg).
- Test 2: `externalBrowser` is `'/Applications/Firefox.app'` → calls `openUrl(url, '/Applications/Firefox.app')`.
- Test 3: `externalBrowser` is set and the first `openUrl` rejects → a second call `openUrl(url)` is made with no second argument, and `openExternal` resolves without throwing (silent fallback per locked decision).
- Test 4: `externalBrowser` is `null` and `openUrl` rejects → the rejection is not retried (exactly one call) and does not throw out of `openExternal`.
  </behavior>
  <action>
Create `src/lib/openExternal.ts` exporting `openExternal(url: string): Promise<void>` and the `BrowserInfo` interface (`{ id: string; label: string; path: string }`). Read the preference imperatively via `useSettingsStore.getState().externalBrowser` so non-React call sites work. If a browser is selected, `await openUrl(url, selected)` inside a try and return on success; on rejection fall through. Always end with a `openUrl(url)` attempt whose rejection is swallowed (`.catch(() => {})`) — this matches the existing swallow style at `IssueDetailContent.tsx:510` and `WikiRenderer.tsx:1366` and satisfies the locked "fail quietly" decision. Keep the fallback narrow: only the *selected-browser* attempt triggers a retry; a `null` preference means exactly one `openUrl` call. Document in the file header that this is the single sanctioned external-URL boundary.

Settings store (`src/stores/settings.store.ts`), following the exact `rankFieldKey` pattern already in the file:
- Add `externalBrowser: null as string | null` to `initialSettings` (near `rankFieldKey` at line ~61).
- Add `externalBrowser: string | null;` and `setExternalBrowser: (path: string | null) => void;` to the `SettingsState` interface, with a doc comment stating that the value is an absolute launch path and `null` means System Default.
- Add `setExternalBrowser: (path) => set({ externalBrowser: path }),` beside `setRankFieldKey` (line ~332).
- Bump `version: 28` → `version: 29` (line 362) and append a migrate branch after the `version < 28` block: `if (version < 29) { if (s.externalBrowser === undefined) s.externalBrowser = null; }`. Skipping the bump leaves the field `undefined` on existing installs (RESEARCH pitfall 4).
- Do NOT add `externalBrowser` to the `resetSettings('preferences')` carry-over list — it is a preference and should reset to `null` with the rest.

Migrate all 12 non-test `openUrl(` call sites to `openExternal(`, swapping `import { openUrl } from '@tauri-apps/plugin-opener'` for `import { openExternal } from '@/lib/openExternal'` in each of the 9 files: WikiRenderer.tsx:1366 (rendered description/comment links — the primary user-facing case), DiscussionThreads.tsx:101, IssueDetailContent.tsx:510, ReleaseDetailPage.tsx:206, SubtasksPanel.tsx:17, MergeRequestDetailPage.tsx:222, ReleaseDetailSidebar.tsx:324/338/474, UnifiedTaskTable.tsx:445/745, NotificationPopover.tsx:324. Preserve each site's existing `.catch(() => {})` / `await` shape — `openExternal` has the same signature and never rejects.

Preserve `SubtasksPanel.tsx`'s `window.open(url, '_blank', 'noopener,noreferrer')` try/catch fallback as the final rung: selected browser → default browser → `window.open`. Its test at `SubtasksPanel.test.tsx:53` mocks a rejecting `openUrl` to exercise that path; since `openExternal` swallows rejections, make the panel's catch trigger on a `window.open` need — verify that test still passes and adjust the panel (not the test) if the rejection no longer propagates.

Do NOT change `src/routes/dashboard/issue-detail/AttachmentsSection.tsx` — it imports `openPath`, not `openUrl`, and is out of scope. Do NOT change `src/lib/internalLinks.ts` — it only decides in-app vs. external; its external branch is what now routes into `openExternal`.

Leave all nine existing `vi.mock('@tauri-apps/plugin-opener', ...)` test files untouched: keeping the mock at the plugin boundary means `expect(openUrl).toHaveBeenCalledWith(url)` assertions keep passing when `externalBrowser` is `null` (RESEARCH pitfall 5). If any test seeds a non-null `externalBrowser`, that is the only case needing an assertion update.

Project constraint: the pre-commit hook runs the full vitest suite, so combine the RED and GREEN steps into a single commit for this task.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/lib/openExternal.test.ts && npx vitest run src/routes/dashboard src/routes/notifications src/stores 2>&1 | tail -20 && test -z "$(grep -rl '@tauri-apps/plugin-opener' src | grep -v '\.test\.' | grep -v 'lib/openExternal.ts' | grep -v 'AttachmentsSection')"</automated>
  </verify>
  <done>All four `openExternal` behavior tests pass; the dashboard/notifications/stores suites pass with no assertion changes to the nine existing plugin-mocking test files; the grep gate returns empty, proving `openExternal.ts` and `AttachmentsSection.tsx` are the only non-test modules importing `@tauri-apps/plugin-opener`; settings store reads `version: 29` with a `version < 29` migrate branch.</done>
</task>

<task type="auto">
  <name>Task 3: Links settings section with browser picker</name>
  <files>taskflow/src/routes/settings/LinksSection.tsx, taskflow/src/routes/settings/LinksSection.test.tsx, taskflow/src/routes/settings/Settings.tsx</files>
  <action>
Create `src/routes/settings/LinksSection.tsx`, a default-exported component following the `AppearanceSection.tsx` structure: root `<div data-testid="section-links" className="flex flex-col gap-8">` with an `<h2 className="text-lg font-semibold">Links</h2>` heading, then a labelled control group with a short description line explaining that external links (issue/MR buttons and links inside descriptions and comments) open in the chosen browser.

Because the browser list is dynamic, use the existing shadcn `Select` from `@/components/ui/select` rather than the button-group pattern. Load the list with `tauriService.invoke<BrowserInfo[]>('list_browsers')` from `@/services/tauri` — that service is the only sanctioned `@tauri-apps/api/core` boundary, so do not import `invoke` directly. Fetch in a `useEffect` on mount, defaulting to an empty array and swallowing invoke failure (the picker degrades to System Default only).

Options: a fixed first entry "System Default" mapping to `null`, then one entry per detected browser using `label` for display and `path` as the value. Bind to `externalBrowser` / `setExternalBrowser` from `useSettingsStore`. Represent `null` in the Select with a non-empty sentinel value such as `'__default__'` (Radix Select rejects an empty-string item value) and translate at the boundary in both directions.

If the persisted `externalBrowser` is a path not present in the fetched list (browser moved or uninstalled), render an extra option labelled with the path's basename plus " (not found)" so the Select still shows the user's choice. Do not auto-clear the setting — per the locked decision the launch simply fails and falls back silently.

Wire the section into `src/routes/settings/Settings.tsx`: add `'links'` to the `SettingsSection` union (line 37), add a `{ id: 'links', label: 'Links', icon: <ExternalLink className="h-4 w-4" /> }` entry to the `SECTIONS` array (line 48) positioned after `'appearance'`, importing `ExternalLink` from `lucide-react` (do not reuse `Link2` — it already serves Connections), and add `{activeSection === 'links' && <LinksSection />}` to the render switch (near line 97).

Write `LinksSection.test.tsx` mocking `@/services/tauri` to return two fake browsers: assert the Select renders System Default plus both labels, and that choosing a browser calls `setExternalBrowser` with that browser's absolute path.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/routes/settings/LinksSection.test.tsx && npx tsc --noEmit 2>&1 | tail -5 && npx biome check ./src/routes/settings ./src/lib/openExternal.ts 2>&1 | tail -5</automated>
    <human-check>
Run `npm run tauri dev`. (1) Open Settings → Links; confirm the dropdown lists System Default plus the browsers actually installed on this machine. (2) Select a non-default browser, then click an "open in browser" button on an issue detail page — the URL must open in the selected browser, NOT the OS default. This is the single most important check: RESEARCH pitfall 1 says a missing capability scope makes the feature silently no-op with zero user-visible signal, so a URL landing in the default browser here means Task 1's capability entry is wrong. (3) Click a hyperlink inside an issue description or comment — same selected browser. (4) Quit and relaunch the app; confirm the selection persisted. (5) Switch back to System Default and confirm links open in the OS default browser again.
    </human-check>
  </verify>
  <done>Links section appears in Settings nav and renders the detected browser list with a System Default entry; selecting a browser persists to the store; `tsc --noEmit` clean; biome reports no new diagnostics in the touched files; human check confirms a selected browser actually receives both button-originated and description/comment-originated URLs.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| frontend → `opener` plugin `with` arg | The renderer supplies an arbitrary program string that the OS will execute |
| filesystem → `list_browsers` | Read-only `Path::exists()` probing of well-known locations; no user input crosses in |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-eaj-01 | Elevation of Privilege | `opener:allow-open-url` with `"app": true` | accept | The scope permits launching any program the frontend names. The frontend only ever supplies a value originating from the backend's own `list_browsers()` allowlist, and the persisted value is written solely by the Links Select. Per-machine paths cannot be enumerated statically in the capability file, so `"app": true` is the only workable static scope. Server-side validation that `with` ∈ `list_browsers()` is recorded as an optional future hardening, not required here. |
| T-eaj-02 | Tampering | persisted `externalBrowser` in `settings.json` | accept | An attacker who can write `settings.json` already has local filesystem access to the user's app data and could achieve execution more directly. No new exposure. |
| T-eaj-03 | Information Disclosure | `list_browsers` return value | accept | Leaks only which browsers are installed, to the app's own renderer. No PII, no network egress. |
| T-eaj-04 | Denial of Service | `openExternal` fallback chain | mitigate | Bounded to at most two `openUrl` attempts plus (SubtasksPanel only) one `window.open`; no retry loop, no unbounded recursion. |
| T-eaj-SC | Tampering | npm/cargo installs | mitigate | No packages are added by this task — RESEARCH's Package Legitimacy Audit is intentionally empty. If any executor finds itself running `npm install` or `cargo add`, stop and re-plan. |
</threat_model>

<verification>
- `cd taskflow/src-tauri && cargo check` passes.
- `cd taskflow && npx vitest run` — full suite green (the pre-commit hook enforces this anyway).
- `cd taskflow && npx tsc --noEmit` clean.
- `cd taskflow && npx biome check ./src` reports no NEW files flagged beyond the documented pre-existing baseline (BacklogPage.tsx, BacklogRow.tsx, chart.tsx, MyTasksPage.tsx, MyTasksPage.test.tsx). Never gate on an absolute diagnostic count.
- Grep gate: only `src/lib/openExternal.ts` and `src/routes/dashboard/issue-detail/AttachmentsSection.tsx` import `@tauri-apps/plugin-opener` in non-test code.
- Human check in Task 3 confirms the capability scope actually took effect — automated tests cannot detect the silent `ForbiddenUrl` no-op.
</verification>

<success_criteria>
- A Links section exists in Settings with a browser dropdown containing System Default plus every detected browser.
- The selection persists across restart (store version 29, migrate branch present).
- All 12 external-link call sites — including WikiRenderer rendered links and DiscussionThreads links — route through `openExternal`.
- A selected browser that cannot launch falls back to the OS default with no toast, no error, no visible failure.
- Zero new npm or cargo dependencies.
</success_criteria>

<output>
Create `.planning/quick/260827-eaj-add-a-settings-option-to-open-links-in-a/260827-eaj-SUMMARY.md` when done
</output>
