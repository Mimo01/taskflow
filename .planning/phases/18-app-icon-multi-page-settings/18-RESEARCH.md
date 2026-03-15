# Phase 18: App Icon + Multi-Page Settings - Research

**Researched:** 2026-03-15
**Domain:** Tauri icon pipeline, React useState-based multi-section navigation, Zustand persist migration, CSS data-attribute density variants
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Settings sidebar has **5 items**: Connections, Appearance, Notifications, Workflow, Role
- Role gets its own sidebar item (not folded into Connections or Appearance)
- Settings opens to **Connections** by default — no last-visited persistence
- Navigation is internal `useState` — no URL sub-routing, no new React Router routes
- Jira and GitLab displayed as **two separate cards** each with fields, status badge, test button
- Credential fields are **read-only with masked token** (••••••) — clicking Edit reveals an inline form
- Test connection button shows **inline status**: spinner while testing, then green checkmark or red × with error message inline — no toast, no modal
- RoleSection moves into its own **Role** sidebar section
- Three density tiers: **Compact / Default / Comfortable**
- Density affects list rows (tasks, MRs, backlog items), sidebar navigation, sprint board cards — and all other list/card surfaces
- Implementation: `data-density="compact|default|comfortable"` on `<html>` — same pattern as `data-theme`
- Theme toggle stays in Appearance (existing ThemeSection)
- Notifications section: existing NotificationSettingsSection content moved — no changes to content
- Workflow section: StaleMrThresholdSection + DebugModeSection + sprint board prefs (new: collapse parent stories by default toggle, show subtasks in My Tasks toggle)
- Icon visual direction: **node graph / network** — connected nodes
- Icon color palette: **dark background + blue/indigo accent**
- Creation method: Claude generates a **programmatic SVG**, exports to PNG at 1024×1024
- Icon is **full-bleed square** — no baked-in rounded corners
- After PNG is ready, run `tauri icon` CLI to generate all platform sizes into `src-tauri/icons/`

### Claude's Discretion
- Exact node-graph composition (number of nodes, edge angles, stroke weights)
- Exact blue/indigo hex values and background shade
- SVG-to-PNG export toolchain (node canvas, sharp, Rust svg2png, or similar)
- Sprint board column order preference UI (if added, based on existing board column data)
- Exact spacing values for each density tier
- DebugModeSection placement within Workflow (could be at bottom, behind an "Advanced" label)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BRAND-01 | App has a new abstract/geometric icon on all platforms (macOS Dock, Windows taskbar, Linux) | `tauri icon` CLI accepts 1024×1024 PNG and auto-generates all platform sizes into `src-tauri/icons/`; existing icon slots confirmed; `tauri.conf.json` icon array already correct |
| SETTINGS-01 | Settings has sidebar navigation with Connections, Appearance, Notifications, and Workflow sections | `useState` pattern confirmed correct for internal nav; existing Settings.tsx is a flat single-column layout that will be restructured into a two-column sidebar+content layout |
| SETTINGS-02 | Connections section displays Jira and GitLab credentials with test connection buttons | Existing TokenSection has all the data-fetching logic; needs redesign into two cards with inline test feedback; `validateJira`/`validateGitLab` already called for connection testing |
| SETTINGS-03 | Appearance section includes theme toggle and display density options | ThemeSection exists and works; density needs new `data-density` attribute on `<html>`, new store fields, and CSS variant rules in `index.css` |
| SETTINGS-04 | Notifications section includes poll interval and per-event desktop notification toggles | NotificationSettingsSection exists as-is; just moves into sidebar nav structure |
| SETTINGS-05 | Workflow section includes stale MR threshold and sprint board preferences | StaleMrThresholdSection + DebugModeSection exist; two new sprint board pref fields need to be added to settings store with a version bump |
</phase_requirements>

---

## Summary

Phase 18 has two independent workstreams: (1) generating and installing a new app icon, and (2) restructuring the Settings page from a flat vertical scroll into a two-column sidebar-nav layout. Both workstreams are self-contained with well-understood implementation paths.

The icon workstream is a one-shot asset pipeline: generate an SVG programmatically, export to 1024×1024 PNG, then run `npx tauri icon <path>` from the `taskflow/` directory. The Tauri CLI reads that single source PNG and produces every required platform size automatically, overwriting the existing files in `src-tauri/icons/`. No `tauri.conf.json` changes are needed — the icon array is already correctly configured with five targets (32x32.png, 128x128.png, 128x128@2x.png, icon.icns, icon.ico).

The Settings restructure is a layout refactor — all section components exist and work correctly. The core work is: (a) creating the new two-column `Settings.tsx` shell with a `useState`-driven sidebar, (b) redesigning `TokenSection` into two separate connection cards with inline test-connection feedback, (c) adding `data-density` CSS attribute support parallel to the existing `data-theme` pattern, and (d) adding three new fields (`density`, `sprintCollapseByDefault`, `showSubtasksInMyTasks`) to `settings.store.ts` with a `version` bump and `migrate` function.

**Primary recommendation:** Implement the icon pipeline first (it's a clear dependency — can verify visually immediately), then do the Settings restructure as the larger sequential workstream. Both can proceed in the same set of waves.

---

## Standard Stack

### Core (already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.1.0 | Settings UI components | Already used throughout |
| Zustand | ^5.0.11 | Settings state + persistence | Already used for all stores |
| Tailwind CSS | ^4.2.1 | Styling including density CSS variants | Already used, with `@variant` support |
| lucide-react | ^0.577.0 | Sidebar nav icons | Already used in Sidebar.tsx |
| @tauri-apps/cli | ^2 | `tauri icon` command for icon generation | Already installed as devDependency |

### Supporting (discretion area — SVG to PNG export)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sharp | ^0.34.x | SVG-to-PNG rasterization in Node.js | Reliable, well-maintained, produces exact pixel dimensions; available via `npm install --save-dev sharp` if needed |
| canvas (node-canvas) | ^2.x | Alternative rasterization | Use if sharp unavailable; heavier native dependency |
| Inline Node.js Buffer approach | — | Write SVG as string, use `sharp()` to convert | Preferred — no intermediate temp files |

**Note on SVG-to-PNG:** The `tauri icon` CLI accepts either a PNG or SVG file directly as input. If the SVG has a transparent background and is vector-clean, the CLI can rasterize it itself. However, for a filled background (required by the design — near-black fill), exporting to PNG first ensures correct background rendering. Verify by testing `npx tauri icon app-icon.svg` first; if output looks correct skip the PNG step.

**Installation (only if sharp is needed):**
```bash
cd taskflow && npm install --save-dev sharp
```

---

## Architecture Patterns

### Recommended Project Structure Changes

```
taskflow/src/routes/settings/
├── Settings.tsx              # REWRITE: two-column sidebar + content shell
├── ConnectionsSection.tsx    # NEW: replaces TokenSection (two cards)
├── AppearanceSection.tsx     # NEW: ThemeSection + DensityControl together
├── NotificationsSection.tsx  # NEW (thin wrapper): mounts NotificationSettingsSection
├── WorkflowSection.tsx       # NEW: StaleMrThreshold + DebugMode + sprint prefs
├── RoleSection.tsx           # UNCHANGED: moved to its own sidebar slot
├── TokenSection.tsx          # KEEP but do not use in new Settings (replaced)
├── ThemeSection.tsx          # KEEP (used by AppearanceSection)
├── NotificationSettingsSection.tsx  # UNCHANGED
├── StaleMrThresholdSection.tsx      # UNCHANGED
├── DebugModeSection.tsx             # UNCHANGED
├── Settings.test.tsx         # UPDATE: tests for new sidebar nav
└── index.tsx                 # UNCHANGED (re-exports Settings)

taskflow/src/
├── index.css                 # ADD: [data-density] CSS rules
└── services/theme.ts         # ADD: applyDensity() parallel to applyTheme()

taskflow/src-tauri/icons/     # OVERWRITTEN by `tauri icon` command
taskflow/app-icon.png         # NEW: source 1024×1024 PNG (generated, not committed)
taskflow/app-icon-source.svg  # NEW: source SVG (committed for reproducibility)
```

### Pattern 1: useState Internal Settings Navigation

**What:** A `settingsSection` state value controls which section's content is rendered. No React Router sub-routes.

**When to use:** Settings page only — confirmed by locked decisions.

**Example:**
```typescript
// Source: project convention (Sidebar.tsx / AppLayout patterns)
type SettingsSection = 'connections' | 'appearance' | 'notifications' | 'workflow' | 'role';

export default function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('connections');

  return (
    <div className="flex h-full">
      {/* Sidebar nav */}
      <nav className="w-48 shrink-0 border-r border-border flex flex-col gap-1 px-2 py-4">
        {SECTIONS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveSection(id)}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium',
              activeSection === id
                ? 'bg-accent text-accent-foreground font-semibold'
                : 'hover:bg-accent'
            )}
            aria-current={activeSection === id ? 'page' : undefined}
          >
            {icon}
            {label}
          </button>
        ))}
      </nav>
      {/* Content area */}
      <div className="flex-1 overflow-auto py-8 px-6 max-w-2xl">
        {activeSection === 'connections' && <ConnectionsSection />}
        {activeSection === 'appearance' && <AppearanceSection />}
        {activeSection === 'notifications' && <NotificationsSection />}
        {activeSection === 'workflow' && <WorkflowSection />}
        {activeSection === 'role' && <RoleSection />}
      </div>
    </div>
  );
}
```

### Pattern 2: data-density Attribute (mirrors data-theme pattern)

**What:** Apply `data-density="compact|default|comfortable"` to `document.documentElement` and target it in CSS with Tailwind v4 `@variant`.

**When to use:** Any time density changes — on store hydration and on user selection.

**Example:**
```typescript
// Source: project pattern — services/theme.ts applyTheme()
export type Density = 'compact' | 'default' | 'comfortable';

export function applyDensity(density: Density): void {
  document.documentElement.setAttribute('data-density', density);
}
```

```css
/* Source: index.css — parallel to @variant dark */
@variant density-compact (&:is([data-density="compact"] *));
@variant density-comfortable (&:is([data-density="comfortable"] *));
```

Then Tailwind utility usage:
```html
<!-- Task row: shrink on compact, expand on comfortable -->
<div class="py-3 density-compact:py-1.5 density-comfortable:py-4">...</div>
```

**Critical detail:** `applyDensity()` must be called at app startup (in `main.tsx` alongside `loadTheme()`) to prevent density flash on load.

### Pattern 3: Zustand Persist version + migrate for New Fields

**What:** When adding new fields to an existing persisted store, bump `version` and provide a `migrate` function. Otherwise old persisted state (missing the new keys) will be hydrated with `undefined` for the new fields, bypassing defaults.

**When to use:** Any store where new fields are added and users may have existing persisted state.

**Example:**
```typescript
// Source: Zustand v5 persist middleware API — verified from node_modules type definitions
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // ... existing fields ...
      density: 'default' as Density,
      sprintCollapseByDefault: false,
      showSubtasksInMyTasks: true,
      // ... existing setters ...
      setDensity: (d: Density) => set({ density: d }),
      setSprintCollapseByDefault: (v: boolean) => set({ sprintCollapseByDefault: v }),
      setShowSubtasksInMyTasks: (v: boolean) => set({ showSubtasksInMyTasks: v }),
    }),
    {
      name: 'settings-store',
      storage: tauriStorage,
      version: 1,  // was implicitly 0 (not set) — bump to 1
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>;
        if (version < 1) {
          // Add new fields with defaults when upgrading from version 0
          state.density = 'default';
          state.sprintCollapseByDefault = false;
          state.showSubtasksInMyTasks = true;
        }
        return state as SettingsState;
      },
    },
  ),
);
```

### Pattern 4: Inline Connection Card with Test Button

**What:** Each service (Jira, GitLab) gets one card. Card shows URL field, active project selector, masked token display, Edit inline form. Test button calls the same validate function already used in TokenSection. Status renders inline below the button.

**When to use:** ConnectionsSection only.

**Example:**
```typescript
// Source: project pattern — TokenSection.tsx useMutation pattern + services/jira.ts validateJira
type TestStatus = 'idle' | 'pending' | 'success' | 'error';

function ConnectionCard({ ... }) {
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const handleTest = async () => {
    setTestStatus('pending');
    setTestError(null);
    try {
      const pat = await readSecret(secretKey);
      await validateFn(baseUrl, pat);
      setTestStatus('success');
    } catch (err) {
      setTestStatus('error');
      setTestError((err as Error).message ?? 'Connection failed');
    }
  };

  // Reset status when user edits the URL or token
  const handleEdit = () => {
    setTestStatus('idle');
    setTestError(null);
    setEditing(true);
  };

  return (
    <div className="border border-border rounded-lg p-4 flex flex-col gap-4">
      {/* URL, project selector, token display ... */}
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleTest}
          disabled={testStatus === 'pending'}>
          {testStatus === 'pending' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Test Connection'}
        </Button>
        {testStatus === 'success' && (
          <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" /> Connected
          </span>
        )}
        {testStatus === 'error' && (
          <span className="flex items-center gap-1 text-sm text-destructive">
            <XCircle className="h-4 w-4" /> {testError}
          </span>
        )}
      </div>
    </div>
  );
}
```

### Pattern 5: tauri icon CLI Pipeline

**What:** Single command that takes a source PNG (or SVG) and generates all required icon sizes.

**When to use:** After the source PNG is ready.

**Example:**
```bash
# From the taskflow/ directory
npx tauri icon ./app-icon.png
# Outputs to src-tauri/icons/ automatically — matches the tauri.conf.json icon array
```

The CLI generates: `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns` (macOS), `icon.ico` (Windows), and all Windows Square* sizes. The existing `src-tauri/icons/` directory has all expected slots — they will be overwritten.

**Source PNG requirements:**
- Exactly 1024×1024 pixels
- Square aspect ratio
- Full-bleed (no padding baked in — macOS applies squircle mask itself)
- PNG format with RGB or RGBA channels

### Anti-Patterns to Avoid

- **Adding new React Router routes for Settings sub-pages:** Locked decision — `useState` only. No `<Route path="/settings/connections">`.
- **Using toast notifications for test-connection results:** Inline status only — no `sonner`, no toast. Results appear below the test button.
- **Storing density in a separate localStorage key:** Must go into `useSettingsStore` via the Tauri Store persist adapter — consistent with all other settings.
- **Not bumping store version when adding fields:** Existing users would get `undefined` for `density`, `sprintCollapseByDefault`, `showSubtasksInMyTasks` — bypassing defaults.
- **Applying density only in CSS without calling `applyDensity()` at startup:** Causes a visible density flash on cold launch (same problem `loadTheme()` solves for theme).
- **Rounding corners in the SVG icon:** macOS applies the squircle mask itself. Baked-in rounded corners produce double-masking artifacts.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Platform icon sizes | Manual resizing to 32/64/128/256/512/1024 etc. | `npx tauri icon <source>` | Tauri CLI knows every required size and format per platform; handles .icns multi-resolution container and .ico multi-size correctly |
| Masked token display | Custom obfuscation logic | `type="password"` with `readOnly` + value `"••••••••"` | Already implemented in TokenSection; `type="password"` is browser-native, screen-reader accessible |
| Animated spinner | CSS animation from scratch | `lucide-react` `Loader2` with `animate-spin` class | Already available in project — consistent with existing patterns |
| Settings section switcher | Tabs component from shadcn | Plain `<button>` with `useState` | Tabs component adds routing semantics (`role="tabpanel"`) that are semantically incorrect here; buttons + `aria-current="page"` is the right pattern for navigation |

---

## Common Pitfalls

### Pitfall 1: Zustand Persist without version bump
**What goes wrong:** New fields (`density`, `sprintCollapseByDefault`, `showSubtasksInMyTasks`) come back as `undefined` for users who have existing `settings.json`. The store's default initializer runs only for fresh stores — not on rehydration from persisted state.
**Why it happens:** Zustand persist middleware merges persisted state over the initial state. New keys absent from persisted state are overwritten as `undefined`, not filled with defaults.
**How to avoid:** Add `version: 1` and a `migrate` function to the persist config. Migrate runs when the stored version < current version, allowing defaults to be injected.
**Warning signs:** `density` is `undefined` at runtime; density toggle has no visual effect; store type errors on `setDensity(undefined)`.

### Pitfall 2: density flash on cold launch
**What goes wrong:** App renders momentarily at `default` density before the Tauri Store async hydration completes, then jumps to the persisted value — visually jarring.
**Why it happens:** `applyDensity()` is not called before first render (same root cause as the theme flash problem `loadTheme()` solves).
**How to avoid:** In `main.tsx`, call `applyDensity()` with the persisted density value before `ReactDOM.createRoot()`. Since the persisted value requires async Tauri Store read, the simplest approach is to read it directly from the Tauri Store JSON file, or set a safe default (`'default'`) synchronously and let hydration correct it (no visible jump if the default is 'default').
**Warning signs:** Brief layout shift on app launch where rows expand/contract after ~200ms.

### Pitfall 3: `tauri icon` run from wrong directory
**What goes wrong:** Command fails or outputs icons to wrong path.
**Why it happens:** `tauri icon` looks for `tauri.conf.json` in the current directory or its parents. The conf is in `taskflow/src-tauri/tauri.conf.json`.
**How to avoid:** Always run from `taskflow/` directory: `cd taskflow && npx tauri icon ./app-icon.png`. The `-o` flag can override output path if needed.
**Warning signs:** "Could not find tauri.conf.json" error; icons appear in wrong location.

### Pitfall 4: SVG icon with transparent background
**What goes wrong:** `tauri icon` processes the SVG and the resulting PNG shows transparent (black) background in the Dock instead of the intended dark background.
**Why it happens:** The Tauri CLI treats transparency literally. macOS fills transparent icon areas with black by default.
**How to avoid:** The SVG must have an explicit background rectangle fill, not rely on CSS background-color. Set `<rect width="100%" height="100%" fill="#0d0d0d"/>` (or chosen near-black) as the first element in the SVG.
**Warning signs:** Icon appears with black or hollow areas in macOS Dock.

### Pitfall 5: test-connection status not cleared on edit
**What goes wrong:** User tests successfully (green checkmark), changes the token field, tests again — old "Connected" badge persists during the new test.
**Why it happens:** Status state (`testStatus`) is not reset when the token input value changes.
**How to avoid:** Add an `onChange` handler on the token input field that calls `setTestStatus('idle')` and `setTestError(null)`.
**Warning signs:** Stale green checkmark visible while spinner also shows.

### Pitfall 6: Inline form inside a read-only card — focus trap
**What goes wrong:** Edit inline form appears inside the card but focus does not move to the first input field, requiring users to click again.
**Why it happens:** State toggles from `editing: false` to `editing: true` but no `autoFocus` or `useEffect` moves focus.
**How to avoid:** Add `autoFocus` to the first input in the inline edit form, or use `useEffect(() => { inputRef.current?.focus(); }, [editing])`.
**Warning signs:** Edit form appears but cursor is not in the input field.

---

## Code Examples

### Density CSS Variant Rules (index.css)

```css
/* Source: project pattern — index.css @variant dark */
@variant density-compact (&:is([data-density="compact"] *));
@variant density-comfortable (&:is([data-density="comfortable"] *));

/* Base density sizes are 'default' — no variant needed */
/* Compact: reduce vertical padding on list/card surfaces */
/* Comfortable: increase vertical padding on list/card surfaces */
```

Usage in components:
```html
<!-- TaskRow, MR row, backlog item, sprint board card, sidebar nav item -->
<div class="py-3 density-compact:py-1.5 density-comfortable:py-5">...</div>
```

### applyDensity Service Function

```typescript
// Source: project pattern — services/theme.ts applyTheme()
export type Density = 'compact' | 'default' | 'comfortable';

export function applyDensity(density: Density): void {
  if (density === 'default') {
    document.documentElement.removeAttribute('data-density');
  } else {
    document.documentElement.setAttribute('data-density', density);
  }
}
```

Note: Removing the attribute for `'default'` is cleaner than `data-density="default"` because it means the CSS rules only need `compact` and `comfortable` variants — the absence of the attribute is default behavior.

### Settings Store Addition

```typescript
// New fields to add to SettingsState interface:
density: Density;
sprintCollapseByDefault: boolean;
showSubtasksInMyTasks: boolean;
setDensity: (d: Density) => void;
setSprintCollapseByDefault: (v: boolean) => void;
setShowSubtasksInMyTasks: (v: boolean) => void;

// New defaults in the create() call:
density: 'default',
sprintCollapseByDefault: false,
showSubtasksInMyTasks: true,

// New setters:
setDensity: (d) => set({ density: d }),
setSprintCollapseByDefault: (v) => set({ sprintCollapseByDefault: v }),
setShowSubtasksInMyTasks: (v) => set({ showSubtasksInMyTasks: v }),

// persist options: add version + migrate
version: 1,
migrate: (persisted, version) => {
  const s = persisted as Record<string, unknown>;
  if (version < 1) {
    if (s.density === undefined) s.density = 'default';
    if (s.sprintCollapseByDefault === undefined) s.sprintCollapseByDefault = false;
    if (s.showSubtasksInMyTasks === undefined) s.showSubtasksInMyTasks = true;
  }
  return s as SettingsState;
},
```

### Node-graph SVG Structure (conceptual)

```xml
<!-- Source: design decision from CONTEXT.md -->
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <!-- Dark background — required, not transparent -->
  <rect width="1024" height="1024" fill="#0d1117"/>
  <!-- 5 nodes: center + 4 satellite, connected by lines -->
  <!-- Lines first (behind nodes) -->
  <line x1="512" y1="512" x2="250" y2="280" stroke="#4f7cff" stroke-width="8" stroke-linecap="round" opacity="0.6"/>
  <!-- ... more edges ... -->
  <!-- Nodes: filled circles with accent color -->
  <circle cx="512" cy="512" r="52" fill="#4f7cff"/>
  <!-- Satellite nodes slightly smaller -->
  <circle cx="250" cy="280" r="36" fill="#6c8fff"/>
  <!-- ... more nodes ... -->
</svg>
```

Key design constraints for readability at 32×32:
- Minimum node circle radius: 36px (in 1024 canvas) — scales to ~1.1px at 32px, borderline; use filled circles not rings
- Minimum stroke width: 8px — scales to ~0.25px at 32px; increase to 12px if edges need to be visible at small sizes
- Max 5–6 nodes — more than 6 becomes unreadable at 32px
- High contrast between background and nodes: WCAG AA contrast ratio at minimum

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single scrollable Settings page | Sidebar-nav multi-section Settings | Phase 18 | Settings grows to 5 sections; scroll becomes unwieldy |
| Tauri default icon | Custom node-graph icon | Phase 18 | App identity in Dock/taskbar |
| No density control | 3-tier density (compact/default/comfortable) | Phase 18 | Adapts to developer preference and screen size |
| `data-theme` only attribute on `<html>` | `data-theme` + `data-density` dual attributes | Phase 18 | Both apply simultaneously; CSS variants compose correctly |

---

## Open Questions

1. **SVG-to-PNG: does `tauri icon` accept SVG with filled background directly?**
   - What we know: `tauri icon` help text says it accepts "squared PNG or SVG file with transparency"
   - What's unclear: "with transparency" wording suggests it expects transparent background SVG; filled-background SVG may need testing
   - Recommendation: Generate the SVG, test `npx tauri icon app-icon.svg` first. If the output macOS icon has the correct dark background, no separate PNG export step needed. If not, add a `sharp` rasterization step.

2. **Density at app launch — flash prevention**
   - What we know: `loadTheme()` is called before `ReactDOM.createRoot()` to prevent theme flash; density needs the same treatment
   - What's unclear: Reading from Tauri Store is async; there's no synchronous way to get the density before first render
   - Recommendation: Default density is `'default'` (no attribute on `<html>`). Since `'default'` is also the store default and the CSS baseline, no flash occurs for the majority case. Only users who set `'compact'` or `'comfortable'` would see a brief flash. Accept this for v1.3 — full fix would require a synchronous storage read which Tauri Store does not support.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run src/routes/settings/` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BRAND-01 | New icon files exist in src-tauri/icons/ | smoke | `ls taskflow/src-tauri/icons/32x32.png taskflow/src-tauri/icons/icon.icns` | ❌ Wave 0 (file check, not unit test) |
| SETTINGS-01 | Settings renders 5 sidebar nav buttons | unit | `cd taskflow && npx vitest run src/routes/settings/Settings.test.tsx` | ✅ exists (needs new tests added) |
| SETTINGS-01 | Clicking sidebar item shows that section | unit | same | ✅ |
| SETTINGS-02 | Connections section renders Jira and GitLab cards | unit | same | ✅ |
| SETTINGS-02 | Test connection button shows inline spinner, then result | unit | same | ✅ |
| SETTINGS-03 | Appearance section renders theme toggle and density control | unit | same | ✅ |
| SETTINGS-03 | Selecting density calls setDensity and applies data-density | unit | same | ✅ |
| SETTINGS-04 | Notifications section renders poll interval and toggles | unit | same | ✅ |
| SETTINGS-05 | Workflow section renders stale MR threshold and sprint prefs | unit | same | ✅ |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run src/routes/settings/`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `taskflow/src/routes/settings/Settings.test.tsx` — existing file needs tests updated for new sidebar structure (SETTINGS-01 through SETTINGS-05); old tests for flat layout will break
- [ ] `taskflow/src/routes/settings/ConnectionsSection.test.tsx` — new file for inline test-connection feedback (SETTINGS-02)
- [ ] Mock for `applyDensity` in settings test setup — add to existing vi.mock patterns

*(All other test infrastructure exists — no framework install needed)*

---

## Sources

### Primary (HIGH confidence)
- `taskflow/src/routes/settings/Settings.tsx` — confirmed single-column flat layout to be replaced
- `taskflow/src/routes/settings/TokenSection.tsx` — full source read; connection logic to be extracted into ConnectionsSection
- `taskflow/src/stores/settings.store.ts` — confirmed no `version`/`migrate`; identified exactly which fields to add
- `taskflow/src/services/theme.ts` — confirmed `applyTheme` pattern; `applyDensity` follows exact same shape
- `taskflow/src/index.css` — confirmed Tailwind v4 `@variant` syntax; confirmed `@variant dark` pattern to follow
- `taskflow/src-tauri/tauri.conf.json` — confirmed icon array; no changes needed
- `taskflow/src-tauri/icons/` — confirmed all platform icon slots exist
- `taskflow/node_modules/zustand/middleware/persist.d.ts` — confirmed `version: number` and `migrate: (state, version) => T` API
- `npx tauri icon --help` output — confirmed CLI accepts PNG or SVG, outputs to icons/ directory

### Secondary (MEDIUM confidence)
- Tailwind v4 `@variant` custom variant syntax — confirmed from `index.css` use of `@variant dark`; data-attribute variant follows same pattern
- `tauri icon` SVG input behavior — CLI help says "PNG or SVG with transparency"; filled-background SVG behavior unverified (flagged as open question)

### Tertiary (LOW confidence)
- Icon readability at 32×32 minimum size guidelines — based on general icon design principles; not verified against Tauri-specific guidance

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed present; no new installs required for core work
- Architecture: HIGH — all existing code read; patterns directly derived from existing codebase conventions
- Store migration: HIGH — Zustand v5 persist types confirmed from node_modules
- Tauri icon CLI: HIGH — help output verified directly
- Pitfalls: HIGH — identified from direct code inspection (no version bump in current store, transparent SVG behavior)
- SVG rasterization path: MEDIUM — `tauri icon` SVG direct input needs verification

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable stack — Tauri 2, Zustand 5, Tailwind 4 all recent stable releases)
