# Phase 40: Settings, About & Menu Integration - Research

**Researched:** 2026-03-25
**Domain:** Tauri 2 menu bar events, React dialog lifecycle, TanStack Query data fetching, GitHub Releases API, Settings section pattern
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Custom React modal using shadcn Dialog — not the native macOS About dialog.
**D-02:** Dialog shows: app icon, "TaskFlow" title, version, build date, commit SHA, platform/arch, and live update status from `update.store.ts`.
**D-03:** Update status display: "Up to date" (checkmark) when idle, "Update available (x.y.z)" when available. Reads from update store state.
**D-04:** Just the essentials — no links, no tech credits, no extras.
**D-05:** Single "Close" button to dismiss.
**D-06:** Replace the native `PredefinedMenuItem::about` in `lib.rs` with a custom `MenuItemBuilder` that emits a `menu-about` event to React.
**D-07:** On Windows/Linux, About is accessible via the Help menu ("About TaskFlow" item). The Help menu already exists in `lib.rs`.
**D-08:** On macOS, the "About TaskFlow" item stays in the app submenu but triggers the custom dialog instead of the native one.
**D-09:** New "Updates" section added to Settings sidebar, positioned after Workflow and before Advanced.
**D-10:** Section contains: current version display, check frequency dropdown (1h/6h/12h/24h/manual — reads/writes existing `updateCheckInterval`), "Check Now" button, and last checked timestamp.
**D-11:** "Check Now" button uses inline status text — "Checking..." (with spinner) → "Up to date" or "Update available (x.y.z)". Resets to "Check Now" after ~5 seconds. If update found, clicking opens the update dialog from Phase 39.
**D-12:** Last checked timestamp shown as relative time ("Last checked: 2 hours ago") below the frequency dropdown.
**D-13:** Version history data sourced from GitHub Releases API on the public repo. No auth needed.
**D-14:** Expandable list UI: scrollable list of version rows. Click to expand shows rendered markdown changelog inline. Current version gets "(current)" badge.
**D-15:** When GitHub API is unreachable, show "Unable to load version history" empty state with Retry. Consistent with existing ApiError + ErrorState patterns.
**D-16:** Version history placed below the update controls in the Updates settings section.

### Claude's Discretion

- Exact Settings sidebar icon choice for Updates section
- Version history fetch caching/staleTime strategy (TanStack Query)
- How to detect platform/arch at runtime (Tauri APIs vs navigator.platform)
- Loading skeleton for version history while fetching
- Number of releases to fetch (page size)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | About dialog displays version, build date, commit SHA, platform/arch, and update status | `buildInfo` constants cover version/SHA/date; `navigator.platform` covers platform; `useUpdateStore.status` + `availableVersion` covers update status |
| UI-02 | macOS menu bar has "About Taskflow" item that opens the About dialog | Replace `PredefinedMenuItem::about` with `MenuItemBuilder`, emit `menu-about`, catch with `listen()` in `AppLayout` — same pattern as all other menu events |
| UI-03 | Settings has an "Updates" section with check frequency, manual check button, and current version | `updateCheckInterval` + `setUpdateCheckInterval` already in settings.store; `updaterService.check()` available for manual trigger; `useUpdateStore` for status |
| UI-04 | Settings Updates section includes a version history list showing all past releases with changelogs | GitHub Releases API: `GET /repos/{owner}/{repo}/releases?per_page=20`; `react-markdown` + `remarkGfm` already installed; TanStack Query for fetch/cache |

</phase_requirements>

---

## Summary

Phase 40 builds the user-visible surfaces that complete the v1.6 release pipeline story: an About dialog, a Settings > Updates section, and the macOS/Windows menu bar item that opens About. The phase is entirely frontend, with a small Rust change in `lib.rs` to replace the native About menu item with a custom event emitter.

The technical ground is fully explored. All required libraries are already installed — `react-markdown`, `remarkGfm`, TanStack Query v5, shadcn Dialog/Select/Badge/Skeleton/EmptyState, Lucide icons. The settings store already has `updateCheckInterval` and its setter. Build metadata is already available via `buildInfo`. The menu event pattern (emit from Rust, `listen()` in React) is established with seven existing event types in `main.tsx`.

The main discretion areas are platform detection (use `navigator.platform` — already used in the codebase at `NotificationSettingsSection.tsx:185`) and GitHub Releases API caching strategy (use TanStack Query with 5-minute staleTime and manual refetch for Retry). The version history fetch should use the standard `fetch` (browser native or `@tauri-apps/plugin-http`) rather than `apiFetch`, since that wrapper is scoped to `'jira' | 'gitlab'` sources only.

**Primary recommendation:** Four new files + modifications to three existing files. Create `AboutDialog.tsx`, `UpdatesSection.tsx`, `VersionHistoryList.tsx` (sub-component) as new files; modify `Settings.tsx` (add Updates nav entry), `lib.rs` (replace About menu item, add Help menu item), and `main.tsx` (add `menu-about` listener + About dialog state).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @base-ui/react (Dialog) | ^1.2.0 | About dialog shell | Already in use via `dialog.tsx` wrapper |
| react-markdown | ^10.1.0 | Render changelog markdown in version history | Already used in UpdateDialog |
| remark-gfm | ^4.0.1 | GitHub-flavored markdown tables/checkboxes | Already paired with react-markdown |
| @tanstack/react-query | ^5.90.21 | Fetch + cache GitHub Releases | Already the project's data-fetching standard |
| zustand | ^5.0.11 | Read update store + settings store | Already used everywhere |
| lucide-react | ^0.577.0 | Icons (RefreshCw, CheckCircle, ArrowUpCircle, Loader2, ChevronDown, ChevronUp, WifiOff, PackageOpen) | Project icon library |
| @tauri-apps/api/event | ^2 | `listen()` for `menu-about` event | Already used for all other menu events |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tauri-apps/plugin-http | ^2.5.7 | Provides Tauri-safe `fetch` | GitHub Releases API call; use native `fetch` instead since CORS is not an issue inside Tauri webview |

**Installation:** No new packages required. All dependencies already in `taskflow/package.json`.

---

## Architecture Patterns

### Recommended File Structure

```
taskflow/src/
├── components/
│   └── about/
│       └── AboutDialog.tsx           # New — About modal (D-01 to D-05)
├── routes/settings/
│   ├── Settings.tsx                  # Modified — add 'updates' to SECTIONS
│   └── UpdatesSection.tsx            # New — Updates settings section (D-09 to D-16)
└── main.tsx                          # Modified — listen for menu-about, manage aboutOpen state

taskflow/src-tauri/src/
└── lib.rs                            # Modified — replace PredefinedMenuItem::about, add Help item
```

### Pattern 1: Menu Event (Rust → React)

The existing pattern in `lib.rs` and `main.tsx` is the canonical approach. No new infrastructure needed.

**Rust side — replace native About with custom event emitter:**
```rust
// In lib.rs setup(), replace PredefinedMenuItem::about(...) with:
let about_item = MenuItemBuilder::new("About TaskFlow")
    .id("menu-about")
    .build(handle)?;

// In app_menu Submenu::with_items, replace the PredefinedMenuItem::about line with:
&about_item,

// In help_menu Submenu::with_items (Windows/Linux):
let about_help_item = MenuItemBuilder::new("About TaskFlow")
    .id("menu-about")
    .build(handle)?;
// Add &about_help_item after &shortcuts_item

// In on_menu_event match arm, add:
"menu-about" => { let _ = app.emit("menu-about", ()); }
```

**React side — add listener in AppLayout's menu listener useEffect:**
```typescript
// In main.tsx, add to the listeners array inside the menu event useEffect:
listen('menu-about', () => setAboutOpen(true)),

// Add state at top of AppLayout:
const [aboutOpen, setAboutOpen] = useState(false);

// Render AboutDialog near other overlays (UpdateDialog, WhatsNewDialog):
<AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
```

**Source:** Verified against `taskflow/src-tauri/src/lib.rs` and `taskflow/src/main.tsx` — the `on_menu_event` handler and `listen()` useEffect pattern is in place for 7 events already.

### Pattern 2: Settings Section Component

Verified from `WorkflowSection.tsx` and `DebugModeSection.tsx`:

```typescript
// UpdatesSection.tsx structure:
export default function UpdatesSection() {
  return (
    <div data-testid="section-updates" className="flex flex-col gap-8">
      <h2 className="text-lg font-semibold">Updates</h2>
      {/* Current version row */}
      {/* Frequency dropdown (Select component) */}
      {/* Check Now button + inline status */}
      {/* Last checked relative timestamp */}
      {/* Release History subsection heading */}
      <VersionHistoryList />
    </div>
  );
}
```

**Settings.tsx modification:** Add `'updates'` to the `SettingsSection` union type and the `SECTIONS` array (after `workflow`, before `advanced`). Add `{activeSection === 'updates' && <UpdatesSection />}` to the content area. Icon: `RefreshCw` from lucide-react (confirmed in UI-SPEC).

### Pattern 3: TanStack Query for GitHub Releases API

```typescript
// In UpdatesSection.tsx or VersionHistoryList.tsx:
const { data, isLoading, isError, refetch } = useQuery({
  queryKey: ['github-releases'],
  queryFn: async () => {
    const res = await fetch(
      'https://api.github.com/repos/{OWNER}/{REPO}/releases?per_page=20'
    );
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    return res.json() as Promise<GitHubRelease[]>;
  },
  staleTime: 5 * 60 * 1000, // 5 minutes — same as project default
  retry: 1,
});
```

**Note:** Use `fetch` directly (native browser fetch), NOT `apiFetch`. The `apiFetch` utility requires a `source: 'jira' | 'gitlab'` parameter — it is not designed for third-party APIs. Inside Tauri's webview, native `fetch` works without CORS issues for public GitHub API calls. Confidence: HIGH (verified from `apiFetch.ts` signature at line 41).

**GitHub Releases API response shape (per release):**
```typescript
interface GitHubRelease {
  tag_name: string;         // e.g. "v1.6.0"
  name: string;             // e.g. "v1.6.0 — Initial Release"
  published_at: string;     // ISO 8601: "2026-03-24T12:00:00Z"
  body: string;             // Markdown changelog body
  prerelease: boolean;
  draft: boolean;
}
```
Source: GitHub REST API documentation (stable, well-known schema). Confidence: HIGH.

### Pattern 4: About Dialog Structure

```typescript
// AboutDialog.tsx — uses existing dialog.tsx primitives
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { buildInfo } from '@/lib/build-info';
import { useUpdateStore } from '@/stores/update.store';

export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { status, availableVersion } = useUpdateStore();
  // Platform detection: navigator.platform (already used at NotificationSettingsSection.tsx:185)
  const platform = navigator.platform;

  return (
    <Dialog open={open} onOpenChange={open ? undefined : onClose}>
      <DialogContent className="max-w-sm" showCloseButton={false}>
        {/* App icon — centered */}
        {/* "Taskflow" heading — text-lg font-semibold */}
        {/* Metadata rows: Version, Build Date, Commit SHA, Platform, Update Status */}
        <DialogFooter showCloseButton>
          {/* or explicit Close button */}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Platform detection approach:** `navigator.platform` — already used in the codebase (`NotificationSettingsSection.tsx:185`). Returns strings like `"MacIntel"`, `"Win32"`, `"Linux x86_64"`. For the About dialog, display it directly or do a simple prefix match for human-readable names. No external library needed. Confidence: HIGH.

**Architecture decision:** `platform/arch` is displayed from `navigator.platform` directly. This is a read-only runtime value, not a Tauri IPC call, which keeps the dialog synchronous and avoids async loading state.

### Pattern 5: Check Now Button Flow

```typescript
// Inside UpdatesSection.tsx — local state for inline status:
const [checkState, setCheckState] = useState<'idle' | 'checking' | 'done'>('idle');
const [checkResult, setCheckResult] = useState<'up-to-date' | 'available' | null>(null);

async function handleCheckNow() {
  setCheckState('checking');
  const { setChecking, setAvailable, setError, resetToIdle } = useUpdateStore.getState();
  setChecking();
  try {
    const info = await updaterService.check();
    if (info) {
      setAvailable(info.version, info.body, info.date);
      setCheckResult('available');
    } else {
      resetToIdle();
      setCheckResult('up-to-date');
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err));
    setCheckResult('up-to-date'); // show neutral state on error
  }
  setCheckState('done');
  // Reset to idle after 5 seconds (D-11)
  setTimeout(() => { setCheckState('idle'); setCheckResult(null); }, 5000);
}
```

**Key insight:** The `useUpdateStore` is a global singleton. After calling `setAvailable(...)`, the `UpdateDialog` (already rendered in `main.tsx`) will automatically open because it reads `status === 'available'`. No prop threading needed.

### Anti-Patterns to Avoid

- **Using `apiFetch` for GitHub Releases:** `apiFetch` has `source: 'jira' | 'gitlab'` — it will produce TypeScript errors and incorrect instrumentation. Use native `fetch` for GitHub API calls.
- **Native `PredefinedMenuItem::about` left in place:** Leaving it alongside a custom item creates two About entries on macOS. Must replace, not add alongside.
- **Platform detection via Tauri OS plugin:** `@tauri-apps/plugin-os` is NOT installed. `navigator.platform` is the established codebase pattern and sufficient for display purposes.
- **Rendering `<AboutDialog>` inside Settings route:** The `menu-about` event fires from the native menu bar, which is accessible from any app screen. The dialog must be rendered at the `AppLayout` level (in `main.tsx`), not inside the Settings page.
- **Accordion with shared state inside TanStack Query:** Don't put the expanded-row index inside the query result. Keep it as a separate `useState<string | null>` (the expanded tag_name), independent of fetch state.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown changelog rendering | Custom markdown renderer | `react-markdown` + `remarkGfm` | Already installed; handles GFM tables, checkboxes, code blocks |
| Dialog with backdrop/animation | Custom modal | `dialog.tsx` (base-ui wrapper) | Already used in UpdateDialog with identical animation and backdrop |
| Relative timestamp | Custom `timeAgo()` utility | `relativeTime()` in `IssueDetailContent.tsx` | Already implements `Intl.RelativeTimeFormat` with second/minute/hour/day granularity |
| Chevron rotation animation | Custom CSS | Tailwind `transition-transform rotate-180` on `ChevronDown` | Standard Tailwind utility, no extra code |
| Fetch caching + retry for GitHub API | Custom cache | TanStack Query `useQuery` | Already the project standard; provides loading/error/refetch states automatically |

**Key insight:** `relativeTime()` is already exported from `IssueDetailContent.tsx`. Import it directly for the "Last checked: X ago" display. If you prefer to avoid cross-module coupling, copy the 8-line implementation into `UpdatesSection.tsx` or a `lib/` utility — but don't use a library.

---

## Common Pitfalls

### Pitfall 1: Duplicate About Item on macOS

**What goes wrong:** If `PredefinedMenuItem::about` is not removed and a new custom `MenuItemBuilder` is added, macOS will show two "About TaskFlow" entries in the app submenu — one native (opens the OS dialog) and one custom (emits event).

**Why it happens:** macOS app menus always include a native About entry from `PredefinedMenuItem::about`. Adding a custom item does not replace it.

**How to avoid:** Replace the `PredefinedMenuItem::about` call with `MenuItemBuilder` — do not add it alongside. Confirmed surgery point: `lib.rs` line 67.

**Warning signs:** Two "About TaskFlow" items visible in macOS app submenu during testing.

### Pitfall 2: `menu-about` Listener Outside React Component Mount

**What goes wrong:** If the `listen('menu-about', ...)` call is placed in a one-time effect that doesn't return a cleanup, the Tauri event listener leaks on unmount/remount (React 18 StrictMode runs effects twice in development).

**Why it happens:** Tauri `listen()` returns a promise resolving to an unlisten function. Without cleanup, multiple listeners accumulate.

**How to avoid:** Follow the exact pattern already used in `main.tsx` lines 213–228. The cleanup function calls `p.then((fn) => fn())` for each promise in the listeners array.

**Warning signs:** About dialog opens multiple times per menu click (double-fire), or opens for unrelated menu events.

### Pitfall 3: Settings.test.tsx Failing After Adding Updates Section

**What goes wrong:** `Settings.test.tsx` line 132 asserts `navButtons.length` equals 6. After adding "Updates" to SECTIONS, this test will fail with `expected 6 to be 7`.

**Why it happens:** The test has a hardcoded count assertion (line 132: `expect(navButtons.length).toBe(6)`). The test also has a label check at line 133 that must include `/Updates/i`.

**How to avoid:** Update the test in the same task that modifies `Settings.tsx`. Update the count assertion from 6 → 7 and add the `updates` button to the label regex. Also add `updateCheckInterval: 6` to `mockSettingsStore` in the test — `UpdatesSection` will read it.

**Warning signs:** `vitest run` shows `Settings.test.tsx` failure after Settings.tsx change.

### Pitfall 4: GitHub Releases API Rate Limiting in Tests

**What goes wrong:** Test environment makes real HTTP calls to GitHub API — tests are slow and flaky, and may hit unauthenticated rate limits (60 req/hour per IP).

**Why it happens:** Forgetting to mock `fetch` in the test file for `UpdatesSection`/`VersionHistoryList` tests.

**How to avoid:** Mock global `fetch` with `vi.fn().mockResolvedValue(...)` in test setup. Pattern is already used elsewhere (`vi.mock('@tauri-apps/plugin-http', ...)` pattern in existing test files). For VersionHistoryList tests, provide a mock response with 2–3 GitHub release objects.

**Warning signs:** Tests take >2 seconds per test, or fail with network errors in CI.

### Pitfall 5: `relativeTime()` Call with Null lastChecked

**What goes wrong:** "Last checked" timestamp display throws or shows "NaN" when the user has never triggered a check (lastChecked is null).

**Why it happens:** `relativeTime()` in `IssueDetailContent.tsx` calls `new Date(iso)` — passing `null` gives `Invalid Date`.

**How to avoid:** Guard the display: `{lastChecked && <p>Last checked: {relativeTime(lastChecked)}</p>}`. Only render when not null. Per UI-SPEC: "Hidden when never checked."

### Pitfall 6: Public Repo URL Placeholder

**What goes wrong:** The GitHub Releases API URL contains a placeholder owner/repo that doesn't exist yet — the query always fails.

**Why it happens:** Phase 41 creates the public release repo. Phase 40 uses it before it exists.

**How to avoid:** Use a constant `RELEASES_REPO_URL` (e.g., in `build-info.ts` or as a module constant) that is set to a placeholder like `https://api.github.com/repos/placeholder/placeholder/releases`. The version history will show the "Unable to load" error state — this is correct and expected behavior until Phase 41. Document this in the code comment.

---

## Code Examples

Verified patterns from the codebase:

### Existing menu event listener (main.tsx lines 213–228)
```typescript
// Source: taskflow/src/main.tsx
useEffect(() => {
  const listeners = [
    listen('menu-keyboard-shortcuts', () => setShortcutsOpen(true)),
    listen('menu-command-palette', () => setPaletteOpen(true)),
    // ... 5 more
  ];
  return () => {
    listeners.forEach((p) => {
      p.then((fn) => fn());
    });
  };
}, [navigate]);
```

### Existing relativeTime utility (IssueDetailContent.tsx lines 43–51)
```typescript
// Source: taskflow/src/routes/dashboard/IssueDetailContent.tsx
export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (diffSecs < 60) return rtf.format(-diffSecs, 'second');
  if (diffSecs < 3600) return rtf.format(-Math.floor(diffSecs / 60), 'minute');
  if (diffSecs < 86400) return rtf.format(-Math.floor(diffSecs / 3600), 'hour');
  return rtf.format(-Math.floor(diffSecs / 86400), 'day');
}
```

### Existing platform detection (NotificationSettingsSection.tsx line 185)
```typescript
// Source: taskflow/src/routes/settings/NotificationSettingsSection.tsx
navigator.platform.startsWith('Mac') && ...
```

### Existing Settings section pattern (WorkflowSection.tsx)
```typescript
// Source: taskflow/src/routes/settings/WorkflowSection.tsx
export default function WorkflowSection() {
  return (
    <div data-testid="section-workflow" className="flex flex-col gap-8">
      <h2 className="text-lg font-semibold">Workflow</h2>
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Sprint Board
        </h3>
        {/* controls */}
      </div>
    </div>
  );
}
```

### Existing useUpdateStore pattern in a component
```typescript
// Source: taskflow/src/components/update/UpdateDialog.tsx
const { status, availableVersion } = useUpdateStore();
// Derive display from status
const open = status === 'available' || status === 'downloading' || ...
```

### Select component usage (DebugModeSection.tsx)
```typescript
// Source: taskflow/src/routes/settings/DebugModeSection.tsx
<Select value={retentionLimit.toString()} onValueChange={(val) => setRetentionLimit(Number(val))}>
  <SelectTrigger><SelectValue /></SelectTrigger>
  <SelectContent>
    {RETENTION_OPTIONS.map((opt) => (
      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

### EmptyState usage pattern
```typescript
// Source: taskflow/src/components/ui/empty-state.tsx
<EmptyState
  icon={WifiOff}
  title="Unable to load release history"
  subtitle="Check your internet connection and try again."
  action={<Button variant="outline" size="sm" onClick={refetch}>Retry</Button>}
/>
```

### DialogContent with showCloseButton=false + explicit Close
```typescript
// Source: taskflow/src/components/ui/dialog.tsx — DialogFooter supports showCloseButton prop
<DialogContent showCloseButton={false} className="max-w-sm">
  {/* content */}
  <DialogFooter showCloseButton>
    {/* DialogFooter renders a DialogClose/Button when showCloseButton=true */}
  </DialogFooter>
</DialogContent>
// Alternatively, use explicit DialogClose render prop (pattern in DebugModeSection.tsx)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `PredefinedMenuItem::about` (Tauri native) | `MenuItemBuilder` with custom event emission | This phase | Custom React dialog opens instead of OS About sheet |
| No Updates section in Settings | New Updates section between Workflow and Advanced | This phase | Users can control update frequency and browse history |

---

## Open Questions

1. **What is the actual public repo owner/path for GitHub Releases?**
   - What we know: The GitHub Releases API URL needs a real owner/repo. Phase 41 creates the repo.
   - What's unclear: Whether a placeholder URL or an env variable is preferred.
   - Recommendation: Declare `const RELEASES_REPO_API = 'https://api.github.com/repos/PLACEHOLDER/PLACEHOLDER/releases?per_page=20'` as a constant in `UpdatesSection.tsx` (or `build-info.ts`). The version history will correctly show the "Unable to load" error state until Phase 41 wires it up. Leave a `// TODO(Phase-41): set real repo path` comment.

2. **Should `lastChecked` timestamp be persisted or ephemeral?**
   - What we know: `settings.store.ts` currently has no `lastChecked` field. `update.store.ts` is transient (no persist).
   - What's unclear: Whether "Last checked: 2 hours ago" should survive app restarts.
   - Recommendation: Add `lastChecked: string | null` to `settings.store.ts` (persisted, ISO string). Set it inside `handleCheckNow()` and also inside `useUpdatePolling`'s queryFn after each check. This is a new field requiring a `version: 12` migration in `settings.store.ts`.

3. **App icon for About dialog (D-02)**
   - What we know: The UI-SPEC says the app icon is centered at the top of the About dialog. The `defaultWindowIcon()` from `@tauri-apps/api/app` returns the app icon as an `Image` object — rendering it in React requires converting to a data URL or using a bundled PNG.
   - What's unclear: Whether a bundled `/icons/icon.png` asset path works in Tauri's webview.
   - Recommendation: Use a static import from `src-tauri/icons/` or reference `/icon.png` via Vite's `public/` folder. Check if a suitable icon exists at `taskflow/public/` or `taskflow/src-tauri/icons/`. If unavailable, omit the icon and substitute with a Lucide `AppWindow` or `Layers` icon as a fallback — the UI-SPEC says the app icon anchors the eye, but a Lucide icon of the same size serves the same visual function.

---

## Environment Availability

Step 2.6: SKIPPED — This phase involves only React/TypeScript/Rust source code changes and one external API call (GitHub public API). No new runtimes, databases, services, or CLI tools are required beyond what the existing build already uses.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.ts) |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npm test` |
| Full suite command | `cd taskflow && npm test` (runs all test files via `vitest run`) |
| Environment | jsdom with `@testing-library/jest-dom` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | AboutDialog renders version, buildDate, commitSha, platform, update status | unit | `cd taskflow && npm test -- AboutDialog` | ❌ Wave 0 |
| UI-01 | AboutDialog shows "Up to date" when status is idle | unit | `cd taskflow && npm test -- AboutDialog` | ❌ Wave 0 |
| UI-01 | AboutDialog shows "Update available (x.y.z)" when status is available | unit | `cd taskflow && npm test -- AboutDialog` | ❌ Wave 0 |
| UI-02 | Settings.tsx renders 7 nav buttons (including "Updates") | unit | `cd taskflow && npm test -- Settings` | ✅ (needs update) |
| UI-02 | Settings renders UpdatesSection when "Updates" nav item clicked | unit | `cd taskflow && npm test -- Settings` | ✅ (needs update) |
| UI-03 | UpdatesSection renders version display, frequency dropdown, Check Now button | unit | `cd taskflow && npm test -- UpdatesSection` | ❌ Wave 0 |
| UI-03 | Changing frequency dropdown calls setUpdateCheckInterval | unit | `cd taskflow && npm test -- UpdatesSection` | ❌ Wave 0 |
| UI-03 | Check Now button shows spinner during check, then result text | unit | `cd taskflow && npm test -- UpdatesSection` | ❌ Wave 0 |
| UI-04 | VersionHistoryList shows skeleton while loading | unit | `cd taskflow && npm test -- UpdatesSection` | ❌ Wave 0 |
| UI-04 | VersionHistoryList shows release rows when loaded | unit | `cd taskflow && npm test -- UpdatesSection` | ❌ Wave 0 |
| UI-04 | VersionHistoryList shows EmptyState on fetch error with Retry button | unit | `cd taskflow && npm test -- UpdatesSection` | ❌ Wave 0 |
| UI-04 | VersionHistoryList shows "(current)" badge for matching version | unit | `cd taskflow && npm test -- UpdatesSection` | ❌ Wave 0 |
| UI-04 | Clicking release row expands and renders markdown changelog | unit | `cd taskflow && npm test -- UpdatesSection` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd taskflow && npm test`
- **Per wave merge:** `cd taskflow && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `taskflow/src/components/about/AboutDialog.test.tsx` — covers UI-01
- [ ] `taskflow/src/routes/settings/UpdatesSection.test.tsx` — covers UI-03, UI-04
- [ ] Update `taskflow/src/routes/settings/Settings.test.tsx` — add "Updates" to nav count (6 → 7) and label assertions (UI-02)

Mock requirements for new test files:
- `vi.mock('@tauri-apps/plugin-updater', ...)` — already shown in UpdateDialog.test.tsx
- `vi.mock('@/services/updater', ...)` — already shown in UpdateDialog.test.tsx
- `vi.mock('@/lib/build-info', ...)` — mock with fixed version/sha/date values
- `vi.mock('@/stores/update.store', ...)` or use `useUpdateStore.setState()` directly (both patterns exist)
- Mock `fetch` globally for VersionHistoryList: `vi.stubGlobal('fetch', vi.fn().mockResolvedValue(...))`

---

## Sources

### Primary (HIGH confidence)
- `taskflow/src-tauri/src/lib.rs` — full menu setup code, `on_menu_event` handler, `MenuItemBuilder` pattern
- `taskflow/src/main.tsx` — `listen()` pattern, `AppLayout` structure, all existing menu event integrations
- `taskflow/src/stores/settings.store.ts` — `updateCheckInterval` field, setter, persist migration pattern
- `taskflow/src/stores/update.store.ts` — `UpdateStatus` type, state shape
- `taskflow/src/hooks/useUpdatePolling.ts` — manual check trigger approach
- `taskflow/src/services/updater.ts` — `updaterService.check()` return type
- `taskflow/src/components/update/UpdateDialog.tsx` — react-markdown usage, Dialog usage pattern
- `taskflow/src/components/ui/dialog.tsx` — `DialogContent`, `DialogFooter`, `showCloseButton` props
- `taskflow/src/components/ui/empty-state.tsx` — `EmptyState` interface
- `taskflow/src/routes/settings/Settings.tsx` — SECTIONS structure, nav rendering pattern
- `taskflow/src/routes/settings/WorkflowSection.tsx` — settings section layout pattern
- `taskflow/src/routes/settings/DebugModeSection.tsx` — Select usage pattern, Dialog-inside-section pattern
- `taskflow/src/routes/settings/Settings.test.tsx` — test structure to update
- `taskflow/src/routes/dashboard/IssueDetailContent.tsx` — `relativeTime()` utility (lines 43–51)
- `taskflow/src/routes/settings/NotificationSettingsSection.tsx` — `navigator.platform` usage (line 185)
- `taskflow/src/lib/apiFetch.ts` — confirms NOT usable for GitHub API (source type constraint)
- `taskflow/vitest.config.ts` — test framework config
- `taskflow/src/test/setup.ts` — global test mocks
- `.planning/phases/40-settings-about-menu-integration/40-UI-SPEC.md` — visual contract, copywriting contract, component inventory

### Secondary (MEDIUM confidence)
- GitHub REST API documentation — `/repos/{owner}/{repo}/releases` endpoint shape (well-known, stable schema)
- `taskflow/package.json` — verified all required packages present at correct versions

### Tertiary (LOW confidence)
- App icon availability at `public/` or `src-tauri/icons/` — not verified (open question 3)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from package.json; no new installs needed
- Architecture: HIGH — all integration points verified from reading actual source files
- Pitfalls: HIGH — all pitfalls derived from reading existing test files and code, not speculation
- GitHub API shape: HIGH — well-known stable API

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable libraries, no fast-moving dependencies)
