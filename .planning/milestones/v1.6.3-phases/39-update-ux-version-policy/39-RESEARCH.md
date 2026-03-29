# Phase 39: Update UX + Version Policy - Research

**Researched:** 2026-03-24
**Domain:** Tauri updater UX, React dialog state machines, version policy enforcement
**Confidence:** HIGH

## Summary

Phase 39 builds on the complete Phase 38 foundation — `updaterService`, `useUpdateStore` (state machine), and `useUpdatePolling` — to deliver the full user-facing update experience. The work is almost entirely frontend React/TypeScript with no new Rust or Tauri plugin additions required.

All six requirements (UPD-02, UPD-03, UPD-04, POL-01, POL-02, POL-03) map to discrete, independently testable UI components that consume the existing store. The most complex integration point is the `useUpdatePolling` hook in `AppLayout` (main.tsx), which is the trigger for showing dialogs. The policy fetch (version-policy.json) piggybacks on the same TanStack Query polling entry point and uses `@tauri-apps/plugin-http` — already wired up for all Jira/GitLab calls.

Semver comparison is the one discretionary choice: the project does not currently include a semver library, but `compare-versions@6.1.1` is available from npm and is a tiny single-purpose package that avoids hand-rolling three-part version string comparison with pre-release handling. The simpler alternative is native `import.meta.env.APP_VERSION` string split, which works for exact `X.Y.Z` versions but is fragile for pre-release tags. Given that Phase 38 already injects `APP_VERSION` via `buildInfo.version`, the planner must choose one approach.

**Primary recommendation:** Build `UpdateDialog` as a single component driven by `useUpdateStore.status`, mount it at the `AppLayout` level alongside existing polling hooks, add `lastSeenVersion` to settings store with migration v11, add `softNagDismissed` as ephemeral React state (not stored), and implement the policy fetch as a dedicated `useVersionPolicyCheck` hook.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Update prompt dialog**
- D-01: Modal dialog (shadcn dialog.tsx) appears when an update is detected. Shows current version, available version, and rendered markdown changelog.
- D-02: Changelog rendered with react-markdown (already in deps for Jira wiki markup). Full markdown support — headings, lists, code blocks.
- D-03: Two action buttons: "Update Now" and "Later".
- D-04: When user clicks "Later", dialog dismisses but reappears on the next update check cycle (polling interval). Not once-per-session, not once-per-version — tied to polling interval.

**Download & install flow**
- D-05: Clicking "Update Now" transitions the same dialog to show download progress — progress bar with percentage, bytes downloaded / total bytes.
- D-06: Dialog is non-dismissable (blocking) during download. User cannot interact with the app until download completes or is cancelled.
- D-07: After download completes, dialog shows a 10-second auto-restart countdown. User can cancel the countdown to defer restart.
- D-08: On download error, dialog shows error message with "Retry" and "Cancel" buttons.

**What's New dialog**
- D-09: "What's New" dialog appears on first launch after an update. Triggered by comparing stored `lastSeenVersion` (persisted in settings store) with current app version.
- D-10: Same modal dialog style as update prompt. Shows version number heading + rendered markdown changelog. Single "Got it" dismiss button.
- D-11: Changelog content comes from the update metadata stored before restart (body field from Tauri updater response).

**Force-update policy**
- D-12: version-policy.json hosted on public GitHub repo (raw.githubusercontent.com URL). Contains `softMinimum`, `hardMinimum`, and optional `message` fields.
- D-13: Policy checked on the same interval as update checks (piggybacks on existing polling). No additional network requests — fetched alongside update check.
- D-14: Soft minimum: persistent top-of-app banner (similar to stale-data-banner.tsx pattern). Warning icon, message text, "Update Now" button, dismiss (X) button. Dismissible once per session — reappears on next launch.
- D-15: Hard minimum: full-screen centered overlay covering the entire app. No dismiss button, no close. Shows version info, why update is required, and "Update Now" button. Prevents all app interaction.
- D-16: Fail-open: if version-policy.json is unreachable (network error, 404, parse error), neither banner nor overlay appears. App continues normally.

### Claude's Discretion
- Progress bar component implementation details (CSS/Tailwind)
- Exact countdown timer UI for auto-restart
- How to persist changelog across restart for What's New dialog (settings store vs temp file)
- version-policy.json fetch implementation (tauri-plugin-http vs Tauri fetch)
- Semver comparison library choice (or manual comparison)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UPD-02 | Update prompt dialog shows changelog (rendered markdown), new version, and "Update Now" / "Later" actions | `UpdateDialog` component driven by `useUpdateStore.status === 'available'`; `react-markdown@10.1.0` already in deps |
| UPD-03 | User can download, install, and restart the app in one click with a progress bar | Same `UpdateDialog` transitions to download/ready states via `updaterService.downloadAndInstall(onProgress)`; `update.store.setProgress()` feeds progress bar |
| UPD-04 | After updating, a "What's New" dialog shows the release notes for the version just installed | `WhatsNewDialog` triggered by `buildInfo.version !== settings.lastSeenVersion`; changelog from `lastSeenChangelog` persisted in settings store before restart |
| POL-01 | Public repo hosts version-policy.json defining softMinimum and hardMinimum | JSON file to create at `raw.githubusercontent.com` URL; schema: `{ softMinimum: string, hardMinimum: string, message?: string }` |
| POL-02 | App shows persistent nag banner (dismissible once per session) when below softMinimum | `SoftMinimumBanner` component mounted in AppLayout, session-dismissed with `useState`, shown based on policy check result |
| POL-03 | App shows full-screen blocking overlay (no dismiss) when below hardMinimum; fails open if policy unreachable | `HardMinimumOverlay` component, `z-index` above all app chrome; policy service wraps fetch in try/catch and returns `null` on any error |
</phase_requirements>

---

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-markdown` | `^10.1.0` | Render changelog markdown | Already in deps; used for Jira wiki markup |
| `remark-gfm` | `^4.0.1` | GitHub Flavored Markdown (tables, strikethrough) | Already in deps; enables GFM in changelogs |
| `@tauri-apps/plugin-http` | `^2.5.7` | Fetch version-policy.json | Already registered in Cargo.toml and capabilities/default.json |
| `@tauri-apps/plugin-updater` | `^2.10.0` | `downloadAndInstall`, update check | Phase 38 foundation |
| `zustand` | `^5.0.11` | Settings store for `lastSeenVersion`/`lastSeenChangelog` | Established pattern; persisted via `createTauriStorage` |
| `@tanstack/react-query` | `^5.90.21` | Policy fetch polling | Same pattern as update check polling |

### Discretionary: Semver Comparison
| Option | Version | Tradeoff |
|--------|---------|----------|
| `compare-versions` | `6.1.1` (verified) | Tiny (2KB), handles `X.Y.Z` and pre-release; no existing dep |
| Manual `split('.')` | N/A | Works for clean `X.Y.Z` only; breaks for `1.6.0-beta.1`; zero-dep |
| `semver` | `7.7.4` (verified) | Full RFC compliance, 15KB; overkill for `lt(current, minimum)` use case |

**Recommendation:** Use `compare-versions`. Add `npm install compare-versions`. It handles pre-release tags that dev/CI may produce (`0.0.0-dev`) correctly. Manual comparison would require custom pre-release stripping.

**Installation (only new dep needed):**
```bash
cd taskflow && npm install compare-versions
```

---

## Architecture Patterns

### Recommended Project Structure

New files for this phase:

```
taskflow/src/
├── components/update/
│   ├── UpdateDialog.tsx          # UPD-02, UPD-03 — available/downloading/ready/error states
│   ├── WhatsNewDialog.tsx        # UPD-04 — post-update changelog
│   ├── SoftMinimumBanner.tsx     # POL-02 — nag banner
│   ├── HardMinimumOverlay.tsx    # POL-03 — blocking overlay
│   ├── UpdateDialog.test.tsx
│   ├── WhatsNewDialog.test.tsx
│   ├── SoftMinimumBanner.test.tsx
│   └── HardMinimumOverlay.test.tsx
├── hooks/
│   └── useVersionPolicyCheck.ts  # POL-01/02/03 — policy fetch + semver compare
├── services/
│   └── versionPolicy.ts          # fetch + parse version-policy.json (fail-open)
└── stores/
    └── settings.store.ts         # add lastSeenVersion, lastSeenChangelog; bump to v11
```

New files outside `src/`:
```
version-policy.json               # repo root; hosted on public GitHub repo
```

### Pattern 1: UpdateDialog — Single Component, Multiple Views

The dialog drives all download states from `useUpdateStore.status`. It uses the existing `Dialog` from `@base-ui/react/dialog` (via `dialog.tsx`). The `open` prop is controlled: `status === 'available' || status === 'downloading' || status === 'ready' || status === 'error'`.

```typescript
// Source: taskflow/src/components/ui/dialog.tsx pattern
// Non-dismissable during download: DialogContent showCloseButton={false} + no onOpenChange

function UpdateDialog() {
  const { status, availableVersion, changelog, downloadProgress, errorMessage } = useUpdateStore();
  const open = status === 'available' || status === 'downloading' || status === 'ready' || status === 'error';

  // Dialog.Root open prop — no onOpenChange during downloading
  return (
    <Dialog open={open} onOpenChange={status === 'available' || status === 'error' ? handleOpenChange : undefined}>
      <DialogContent showCloseButton={false}>
        {status === 'available' && <AvailableView />}
        {status === 'downloading' && <DownloadingView progress={downloadProgress} />}
        {status === 'ready' && <ReadyView />}
        {status === 'error' && <ErrorView message={errorMessage} />}
      </DialogContent>
    </Dialog>
  );
}
```

**Key: "Later" clears to idle without resetting `availableVersion`** — `resetToIdle()` in `update.store` already preserves `availableVersion`. The polling hook will call `setAvailable()` again on next poll, re-opening the dialog (D-04).

### Pattern 2: Download + Restart Flow

```typescript
// Source: taskflow/src/services/updater.ts
async function handleUpdateNow() {
  setDownloading(); // transitions store
  try {
    await updaterService.downloadAndInstall((event) => {
      if (event.event === 'Progress') {
        const { chunkLength, contentLength } = event.data as { chunkLength: number; contentLength: number };
        // accumulate and compute pct
        setProgress(pct);
      }
    });
    setReady(); // triggers countdown view
    // Auto-restart after 10s countdown — use setInterval in ReadyView
    // relaunch() from '@tauri-apps/api/process'
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err));
  }
}
```

**Note on `relaunch()`:** The Tauri v2 API for process relaunch is `import { relaunch } from '@tauri-apps/plugin-process'` — this plugin is NOT currently in Cargo.toml or package.json. The alternative is `import { relaunch } from '@tauri-apps/api/process'` — available via the core `@tauri-apps/api` package already installed. Research indicates core API `relaunch` was deprecated in favor of `@tauri-apps/plugin-process` in Tauri v2, but the core API still works. **The planner must verify which is available** — see Open Questions.

### Pattern 3: What's New — Persist Changelog Before Restart

The challenge: after `relaunch()`, memory state is gone. Changelog must be persisted to survive restart. The settings store (persisted via `createTauriStorage('settings.json')`) is the natural home.

```typescript
// Before calling relaunch():
// 1. Store changelog in settings store
setLastSeenChangelog(changelog); // new field in settings.store

// On app start, in AppLayout:
// buildInfo.version from import.meta.env.APP_VERSION (injected by Vite define)
const { lastSeenVersion, lastSeenChangelog, setLastSeenVersion } = useSettingsStore();
const showWhatsNew = lastSeenVersion !== buildInfo.version && lastSeenChangelog !== null;

// After user dismisses WhatsNewDialog:
setLastSeenVersion(buildInfo.version);
```

Settings store migration bump: version 10 → 11, adding `lastSeenVersion: string | null` (default: null) and `lastSeenChangelog: string | null` (default: null).

### Pattern 4: Version Policy Service (Fail-Open)

```typescript
// Source: @tauri-apps/plugin-http pattern from taskflow/src/lib/apiFetch.ts
import { fetch } from '@tauri-apps/plugin-http';

export interface VersionPolicy {
  softMinimum: string;
  hardMinimum: string;
  message?: string;
}

export async function fetchVersionPolicy(url: string): Promise<VersionPolicy | null> {
  try {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) return null;
    const data = await response.json() as unknown;
    // validate shape
    if (typeof data !== 'object' || data === null) return null;
    const d = data as Record<string, unknown>;
    if (typeof d.softMinimum !== 'string' || typeof d.hardMinimum !== 'string') return null;
    return { softMinimum: d.softMinimum, hardMinimum: d.hardMinimum, message: d.message as string | undefined };
  } catch {
    return null; // D-16: fail-open
  }
}
```

**D-13: Piggyback on update polling interval.** The cleanest implementation is a `useVersionPolicyCheck` hook that mirrors `useUpdatePolling` — same TanStack Query pattern with the same `refetchInterval`. Do NOT add a separate network call; combine or co-locate with the update polling interval.

### Pattern 5: HardMinimumOverlay — z-index Stacking

The overlay must cover all app chrome including Sidebar, TopBar, dialogs. Mount at the root of `AppLayout`'s return JSX, after all other elements, with `fixed inset-0 z-[200]` (above dialog z-50 and any other overlays). No backdrop dismiss.

```typescript
// Mounted in AppLayout, after all other content:
{hardMinimumActive && <HardMinimumOverlay currentVersion={buildInfo.version} policy={policy} />}
```

### Pattern 6: SoftMinimumBanner — Session-Only Dismissal

Session dismissal is NOT persisted (D-14: "reappears on next launch"). Use a React `useState` in `AppLayout` — not the settings store. This matches the "ephemeral state" principle already established for `update.store`.

```typescript
// In AppLayout:
const [softNagDismissed, setSoftNagDismissed] = useState(false);
// show when: softMinimumActive && !softNagDismissed
```

### Anti-Patterns to Avoid

- **Separate dialog components per state:** Don't create `AvailableDialog`, `DownloadingDialog`, `ReadyDialog` as separate mounted/unmounted components. The Dialog `open` prop handles animation; one component with conditional inner content avoids animation jank from mount/unmount cycles.
- **Persisting soft nag dismissal:** D-14 says once-per-session. Storing in settings store would make it persist across launches, which contradicts the decision.
- **Calling `updaterService.check()` twice in download:** `updaterService.downloadAndInstall()` already calls `check()` internally. The update info is already in `useUpdateStore` (set by `setAvailable()`). The service re-checks internally, which is fine but unavoidable with current service design.
- **Using `@tauri-apps/plugin-updater`'s internal download progress type assumptions:** The progress event shape must be inspected at runtime; assume `event.event` is a string discriminant.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown rendering | Custom HTML parser | `react-markdown` + `remark-gfm` | Edge cases in GFM, already in deps |
| Semver comparison | `split('.').map(Number)` comparison | `compare-versions` | Fails on pre-release tags like `0.0.0-dev`; one-line with library |
| HTTP fetch | `window.fetch()` | `@tauri-apps/plugin-http` `fetch` | Tauri v2 uses native HTTP transport; browser fetch may be blocked by CSP or CORS in WebView |
| Countdown timer | Custom `setTimeout` chain | `setInterval` with React `useEffect` + `useState` | Standard React pattern; `useEffect` cleanup prevents memory leaks |
| Dialog animation | CSS keyframes | `@base-ui/react/dialog` (already in `dialog.tsx`) | Enter/exit animations included via `data-open`/`data-closed` attributes |

**Key insight:** The entire UX layer assembles from already-installed components. The only new package to install is `compare-versions` (if the planner chooses it over manual comparison).

---

## Common Pitfalls

### Pitfall 1: `relaunch()` import path
**What goes wrong:** `@tauri-apps/plugin-process` not in Cargo.toml/package.json; import fails at runtime.
**Why it happens:** Tauri v2 moved `relaunch` from `@tauri-apps/api/process` to `@tauri-apps/plugin-process`. Core API deprecation may or may not be enforced.
**How to avoid:** Use `import { relaunch } from '@tauri-apps/api/process'` first — verify it resolves. If not, add `tauri-plugin-process` to Cargo.toml and `npm install @tauri-apps/plugin-process`.
**Warning signs:** `Module not found` error at build time; `TypeError: relaunch is not a function` at runtime.

### Pitfall 2: Dialog blocking during download
**What goes wrong:** User can close the dialog (ESC key or backdrop click) while download is in progress, leaving the update in an undefined state.
**Why it happens:** Base UI Dialog uses `onOpenChange` for ESC/backdrop — if not suppressed, it fires.
**How to avoid:** Pass `modal={true}` and do NOT provide `onOpenChange` during `downloading` status. The `DialogPrimitive.Root` `open` prop is controlled; removing `onOpenChange` in download state prevents escape.
**Warning signs:** Dialog closes mid-download; store stays in `downloading` state with no UI.

### Pitfall 3: Settings store version bump
**What goes wrong:** Existing installs have `settings.json` at version 10 without `lastSeenVersion` / `lastSeenChangelog` fields. Zustand persist `migrate` is not called, fields are `undefined`, `What's New` dialog shows incorrectly.
**Why it happens:** Zustand persist requires explicit migration for new fields.
**How to avoid:** Bump `version` from 10 to 11. Add `if (version < 11)` migration block: `s.lastSeenVersion = null; s.lastSeenChangelog = null;`
**Warning signs:** `What's New` dialog shows on every launch even after dismissal.

### Pitfall 4: Progress event data shape from Tauri updater
**What goes wrong:** `event.data` shape for download progress is assumed to be `{ chunkLength, contentLength }` but may vary by Tauri plugin version.
**Why it happens:** `@tauri-apps/plugin-updater@2.10.0` progress event shape is documented but may differ from typed definitions.
**How to avoid:** Inspect the actual event shape in the `onProgress` callback with a console.log before computing percentage. Guard with `typeof event.data === 'object'`.
**Warning signs:** Progress bar stays at 0% or throws TypeError during download.

### Pitfall 5: `0.0.0-dev` version in dev builds
**What goes wrong:** In development, `buildInfo.version === '0.0.0-dev'`. A version policy with `hardMinimum: '1.0.0'` would block ALL dev app usage.
**Why it happens:** `import.meta.env.APP_VERSION` falls back to `'0.0.0-dev'` when not built with the inject script.
**How to avoid:** In `useVersionPolicyCheck`, skip policy enforcement when version contains `-dev` suffix, OR compare only when version matches `X.Y.Z` pattern. Dev builds should never hit the hard block.
**Warning signs:** Hard minimum overlay appears in local dev environment immediately.

### Pitfall 6: `@base-ui/react` Dialog `open` with no `onOpenChange`
**What goes wrong:** Base UI Dialog in controlled mode requires `onOpenChange` to be provided; without it, the dialog may not be closable even when intended.
**Why it happens:** React strict mode may warn; Base UI may emit console errors.
**How to avoid:** Provide `onOpenChange` for all states where dismissal IS allowed (`available`, `error`). Explicitly pass no-op or undefined for `downloading` and `ready` (with active countdown).
**Warning signs:** ESLint/TypeScript prop warnings; dialog refuses to close on "Later" click.

---

## Code Examples

### Progress bar (Tailwind — no new component needed)
```tsx
// Inline Tailwind — no separate component required
<div className="w-full bg-muted rounded-full h-2">
  <div
    className="bg-primary h-2 rounded-full transition-all duration-200"
    style={{ width: `${downloadProgress ?? 0}%` }}
  />
</div>
<p className="text-xs text-muted-foreground text-right">{downloadProgress ?? 0}%</p>
```

### Countdown auto-restart (useEffect pattern)
```typescript
// Source: standard React pattern
function ReadyView({ onCancel }: { onCancel: () => void }) {
  const [seconds, setSeconds] = useState(10);

  useEffect(() => {
    if (seconds <= 0) {
      relaunch().catch(() => {}); // fire and forget
      return;
    }
    const t = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [seconds]);

  return (
    <>
      <p>Restarting in {seconds}s…</p>
      <Button variant="outline" onClick={onCancel}>Cancel</Button>
    </>
  );
}
```

### Version policy fetch + compare
```typescript
// compare-versions usage
import { compareVersions } from 'compare-versions';

function isBelow(current: string, minimum: string): boolean {
  // Skip enforcement for dev builds
  if (current.includes('-dev') || current === '0.0.0-dev') return false;
  try {
    return compareVersions(current, minimum) < 0;
  } catch {
    return false; // fail-open on parse error
  }
}
```

### Mounting order in AppLayout (main.tsx)
```typescript
// In AppLayout return JSX — order matters for z-index stacking
return (
  <div className="flex h-screen overflow-hidden">
    {/* ... existing app chrome ... */}
    {softMinimumActive && !softNagDismissed && (
      <SoftMinimumBanner onDismiss={() => setSoftNagDismissed(true)} onUpdate={handleUpdateNow} />
    )}
    {/* Update/WhatsNew dialogs — mounted at root, z-50 */}
    <UpdateDialog />
    <WhatsNewDialog />
    {/* Hard minimum — must be LAST, z-[200] covers everything */}
    {hardMinimumActive && <HardMinimumOverlay />}
  </div>
);
```

Note: `SoftMinimumBanner` should be placed inside the `flex-col` content wrapper (between TopBar and main), not outside the outer flex container, to mimic `ReAuthBanner` placement.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@tauri-apps/api/process` `relaunch` | `@tauri-apps/plugin-process` `relaunch` | Tauri v2 | May need new Cargo dep |
| shadcn/ui Radix Dialog | Base UI Dialog (`@base-ui/react/dialog`) | Phase 30+ migration | Controlled via `open` + `onOpenChange`, not `defaultOpen` |
| `window.fetch` | `@tauri-apps/plugin-http` `fetch` | Tauri v2 | Required for HTTP from Tauri WebView |

---

## Open Questions

1. **`relaunch()` import source**
   - What we know: `@tauri-apps/api` is installed; `relaunch` exists in `@tauri-apps/api/process` for Tauri v2 core API. `@tauri-apps/plugin-process` is NOT in Cargo.toml or package.json.
   - What's unclear: Whether `@tauri-apps/api/process` `relaunch` works in Tauri v2.10 without the plugin, or if it silently no-ops.
   - Recommendation: Implementation wave should try `import { relaunch } from '@tauri-apps/api/process'` first. If it fails, add `tauri-plugin-process` to Cargo.toml + permissions. The PLAN should include this as a contingency task.

2. **`updaterService.downloadAndInstall` progress event shape**
   - What we know: `@tauri-apps/plugin-updater@2.10.0` provides an `onProgress` callback; `event.event` is a string discriminant.
   - What's unclear: Whether the event shape is `{ event: 'Started' | 'Progress' | 'Finished'; data: ... }` or a different enum.
   - Recommendation: Add a defensive console.log in first implementation pass to capture actual event shape before computing progress percentage.

3. **version-policy.json URL (D-12)**
   - What we know: URL is `raw.githubusercontent.com/OWNER/RELEASES_REPO/main/version-policy.json` (OWNER/RELEASES_REPO is TBD pending Phase 41 public repo creation).
   - What's unclear: Whether the public repo exists yet.
   - Recommendation: Hardcode a placeholder URL in the hook. Fail-open means the policy silently does nothing until the URL resolves. This is safe for development.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 39 is purely frontend TypeScript/React code. No new external services, CLI tools, or runtimes beyond what Phase 38 already established. `@tauri-apps/plugin-http` is already registered and permitted.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + React Testing Library 16.3.2 |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npm test` |
| Full suite command | `cd taskflow && npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UPD-02 | UpdateDialog renders version + changelog when status='available' | unit | `cd taskflow && npm test -- UpdateDialog` | ❌ Wave 0 |
| UPD-02 | "Later" button calls `resetToIdle()` | unit | `cd taskflow && npm test -- UpdateDialog` | ❌ Wave 0 |
| UPD-03 | "Update Now" transitions to downloading view with progress bar | unit | `cd taskflow && npm test -- UpdateDialog` | ❌ Wave 0 |
| UPD-03 | Progress bar reflects `downloadProgress` percentage | unit | `cd taskflow && npm test -- UpdateDialog` | ❌ Wave 0 |
| UPD-03 | Error view shows Retry + Cancel; retry re-invokes download | unit | `cd taskflow && npm test -- UpdateDialog` | ❌ Wave 0 |
| UPD-04 | WhatsNewDialog shows when `lastSeenVersion !== buildInfo.version` | unit | `cd taskflow && npm test -- WhatsNewDialog` | ❌ Wave 0 |
| UPD-04 | "Got it" updates `lastSeenVersion` to current version | unit | `cd taskflow && npm test -- WhatsNewDialog` | ❌ Wave 0 |
| POL-01 | `fetchVersionPolicy` parses valid JSON correctly | unit | `cd taskflow && npm test -- versionPolicy` | ❌ Wave 0 |
| POL-01 | `fetchVersionPolicy` returns null on fetch error (fail-open) | unit | `cd taskflow && npm test -- versionPolicy` | ❌ Wave 0 |
| POL-01 | `fetchVersionPolicy` returns null on malformed JSON | unit | `cd taskflow && npm test -- versionPolicy` | ❌ Wave 0 |
| POL-02 | SoftMinimumBanner renders when below softMinimum | unit | `cd taskflow && npm test -- SoftMinimumBanner` | ❌ Wave 0 |
| POL-02 | SoftMinimumBanner dismiss calls onDismiss | unit | `cd taskflow && npm test -- SoftMinimumBanner` | ❌ Wave 0 |
| POL-03 | HardMinimumOverlay renders when below hardMinimum | unit | `cd taskflow && npm test -- HardMinimumOverlay` | ❌ Wave 0 |
| POL-03 | HardMinimumOverlay has no dismiss button | unit | `cd taskflow && npm test -- HardMinimumOverlay` | ❌ Wave 0 |
| POL-03 | `isBelow('0.0.0-dev', '1.0.0')` returns false (dev build skip) | unit | `cd taskflow && npm test -- versionPolicy` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd taskflow && npm test`
- **Per wave merge:** `cd taskflow && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `taskflow/src/components/update/UpdateDialog.test.tsx` — covers UPD-02, UPD-03
- [ ] `taskflow/src/components/update/WhatsNewDialog.test.tsx` — covers UPD-04
- [ ] `taskflow/src/services/versionPolicy.test.ts` — covers POL-01, POL-03 fail-open
- [ ] `taskflow/src/components/update/SoftMinimumBanner.test.tsx` — covers POL-02
- [ ] `taskflow/src/components/update/HardMinimumOverlay.test.tsx` — covers POL-03
- [ ] Mock `@tauri-apps/plugin-http` already available in test patterns (see jira.test.ts) — reuse pattern
- [ ] Mock `@tauri-apps/plugin-updater` needed for UpdateDialog tests — add to test/setup.ts or per-file vi.mock

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md does not exist in this project root. No project-level coding conventions were found beyond what is discoverable from the codebase itself. The following conventions are observed from the existing codebase:

- **HTTP in Tauri:** Always use `@tauri-apps/plugin-http` `fetch`, never `window.fetch`
- **Stores:** Non-persisted Zustand for ephemeral state; persisted Zustand with `createTauriStorage` for user preferences
- **Component location:** App-level components in `src/components/app/`; UI primitives in `src/components/ui/`; feature components in domain-specific dirs (new: `src/components/update/`)
- **Testing:** Vitest + RTL; mock Tauri plugins in `src/test/setup.ts` or per-file `vi.mock`
- **TypeScript:** Strict; no `any` without justification
- **Imports:** Absolute paths via `@/` alias (configured in vitest.config.ts and vite.config.ts)
- **Settings store migrations:** Always bump `version` integer and add `if (version < N)` block

---

## Sources

### Primary (HIGH confidence)
- `taskflow/src/services/updater.ts` — Phase 38 service API, `downloadAndInstall` signature
- `taskflow/src/stores/update.store.ts` — Full state machine, all transitions
- `taskflow/src/hooks/useUpdatePolling.ts` — Polling pattern, AppLayout integration point
- `taskflow/src/stores/settings.store.ts` — Migration versioning, persist pattern
- `taskflow/src/components/ui/dialog.tsx` — Base UI dialog structure, `showCloseButton` prop
- `taskflow/src/components/ui/stale-data-banner.tsx` — Banner pattern for soft nag
- `taskflow/src/main.tsx` — AppLayout structure, mounting point for dialogs
- `taskflow/src-tauri/capabilities/default.json` — `http:allow-fetch` confirmed present
- `taskflow/src-tauri/Cargo.toml` — `tauri-plugin-http` confirmed present; `tauri-plugin-process` NOT present
- `taskflow/src/lib/build-info.ts` — `buildInfo.version` access pattern
- `taskflow/src/test/setup.ts` — Mock pattern for Tauri plugins in tests

### Secondary (MEDIUM confidence)
- `npm view compare-versions version` → `6.1.1` (verified live)
- `npm view semver version` → `7.7.4` (verified live)
- Existing test files (`jira.test.ts`, `update.store.test.ts`) — test patterns confirmed

### Tertiary (LOW confidence)
- Tauri v2 `relaunch()` import path — `@tauri-apps/api/process` vs `@tauri-apps/plugin-process` — training data + inference from Cargo.toml analysis; not verified against official Tauri v2 docs. Flagged as Open Question.
- `@tauri-apps/plugin-updater@2.10.0` progress event shape — inferred from updater.ts signature; exact discriminant strings not verified.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries directly verified from package.json, Cargo.toml, and capabilities
- Architecture: HIGH — patterns derived directly from existing codebase code reading
- Pitfalls: MEDIUM-HIGH — relaunch import path is LOW confidence; others derived from code analysis
- Test map: HIGH — file existence verified; commands verified against vitest.config.ts

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable stack; risk is Tauri plugin API changes, LOW probability)
