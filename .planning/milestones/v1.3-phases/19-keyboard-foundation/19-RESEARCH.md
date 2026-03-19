# Phase 19: Keyboard Foundation - Research

**Researched:** 2026-03-15
**Domain:** Keyboard shortcut registry, react-hotkeys-hook, @base-ui/react Dialog, Zustand persist migration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Help panel presentation**
- Centered modal using `@base-ui/react/dialog` — same pattern as CreateEpicDialog and CreateEditIssueModal
- Fixed width (~500px), backdrop, scrollable if content overflows
- `?` key opens it from any screen (when not in a text input); Escape closes it (KEYS-01, KEYS-02)
- Key combos displayed as styled `<kbd>` badges (bordered, background-colored to look like real keys)

**Shortcut categories**
- Grouped by feature area: Navigation, Lists, Actions, General
- Categories are pre-defined in the constants but only categories with at least one entry are rendered
- Panel is incremental: Phase 19 only shows entries that are actually wired (`?` → Show shortcuts, `Esc` → Close panel in General). Later phases add their entries as they implement the shortcuts

**Registry design**
- Static constants file at `src/lib/shortcuts.ts` — exports a typed `SHORTCUTS` array
- Each entry shape: `{ id: string, defaultKey: string, description: string, category: 'Navigation' | 'Lists' | 'Actions' | 'General' }`
- `id` is a stable string slug (e.g., `'show-shortcuts'`) — used as the key for user overrides
- Designed for future customization: effective key = `overrides[id] ?? defaultKey`

**User override storage**
- Add `keyboardOverrides: Record<string, string>` to `useSettingsStore` (Zustand persist)
- Same pattern as `density` — no new store, bump store `version` + `migrate`
- Override UI (Settings > Keyboard section) is explicitly future scope — foundation only this phase

**Existing keydown listener migration**
- Migrate `SearchOverlay.tsx`'s raw `window.addEventListener('keydown')` Escape handler to `useHotkeys('escape', onClose, { enableOnFormTags: true })`
- Audit confirms this is the only raw keydown listener in the codebase
- All future shortcut wiring uses `react-hotkeys-hook` — no new raw listeners

**Input focus guard (KEYS-07)**
- `react-hotkeys-hook` does not fire on `<input>`, `<textarea>`, or `<select>` by default — satisfies KEYS-07 without extra logic
- `enableOnFormTags: true` only used where explicitly needed (Escape in SearchOverlay)

### Claude's Discretion

- Exact `<kbd>` styling (border radius, font size, padding, color tokens) — NOTE: UI-SPEC has already specified this precisely; use those values
- Modal width and max-height breakpoints — NOTE: UI-SPEC has specified `max-w-[500px] max-h-[80vh]`
- How to handle the case where `?` is pressed while the help panel itself is open (likely: do nothing or close)
- Whether to add a `useShortcuts()` convenience hook that returns `{ shortcuts, effectiveKey(id) }` for consumers

### Deferred Ideas (OUT OF SCOPE)

- Keyboard shortcut customization UI (Settings > Keyboard section) — foundation laid this phase (overrides field in settings store + stable IDs), but the editing UI is explicitly out of scope per REQUIREMENTS.md Out of Scope table
- Conflict detection when user tries to assign a key already in use — needed alongside customization UI
- Pre-populating the panel with Phase 20/21 shortcuts before they're wired — user chose incremental approach instead
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| KEYS-01 | User can open a keyboard shortcuts reference panel with the `?` key from anywhere in the app | `useHotkeys('?', openPanel)` with default options (no enableOnFormTags) satisfies this; hook placed at app root or layout |
| KEYS-02 | Shortcuts panel is dismissable with Escape | `@base-ui/react/dialog` handles Escape natively when `open={true}` — no explicit hotkey needed |
| KEYS-07 | Keyboard shortcuts do not fire when focus is inside any text input or contenteditable | `react-hotkeys-hook` default behavior (`enableOnFormTags: false`) satisfies this automatically; SearchOverlay migration uses `enableOnFormTags: true` intentionally |
</phase_requirements>

---

## Summary

Phase 19 installs `react-hotkeys-hook@^5.2.4` as the project-wide standard for keyboard wiring, creates a static shortcut registry at `src/lib/shortcuts.ts`, builds a `KeyboardShortcutsPanel` modal using the existing `@base-ui/react/dialog` pattern, and migrates the one existing raw `window.addEventListener('keydown')` listener in `SearchOverlay.tsx`. All architecture decisions were locked in the CONTEXT.md discussion; the UI-SPEC document has been approved and provides exact class names and copywriting.

The KEYS-07 input-focus guard is satisfied for free: `react-hotkeys-hook` does not fire when focus is inside `<input>`, `<textarea>`, or `<select>` by default. No conditional logic is required. The only place `enableOnFormTags: true` appears is the SearchOverlay Escape migration, which explicitly needs to close even while the user is typing.

The `@base-ui/react/dialog` component handles Escape natively when the dialog is open. KEYS-02 therefore requires zero explicit hotkey wiring — the dialog's built-in behavior covers it. The planner should NOT add a `useHotkeys('escape')` for the panel itself.

**Primary recommendation:** Install react-hotkeys-hook, write the SHORTCUTS constant, build the panel from the UI-SPEC structure, migrate SearchOverlay, extend settings store with the keyboardOverrides field + version bump. Four focused tasks with clear ordering.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hotkeys-hook | ^5.2.4 | Keyboard shortcut binding via React hooks | Locked decision; project-standard for all shortcut wiring going forward |
| @base-ui/react | ^1.2.0 (already installed) | Dialog/modal primitive | Already in use for CreateEpicDialog and CreateEditIssueModal |
| zustand | ^5.0.11 (already installed) | Settings store with persist | Already in use; `keyboardOverrides` field added here |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/react | ^16.3.2 (already installed) | Component testing | All new component tests |
| vitest | ^4.0.18 (already installed) | Test runner | All tests |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-hotkeys-hook | tinykeys, hotkeys-js | react-hotkeys-hook is the locked choice; others not evaluated |
| @base-ui/react/dialog | Radix UI Dialog, shadcn Dialog | @base-ui/react is already used and locked |

**Installation:**
```bash
cd taskflow && npm install react-hotkeys-hook@^5.2.4
```

---

## Architecture Patterns

### Recommended Project Structure (new files this phase)

```
taskflow/src/
├── lib/
│   └── shortcuts.ts              # Static SHORTCUTS array + ShortcutEntry type
├── components/app/
│   └── KeyboardShortcutsPanel.tsx  # Dialog modal component
└── stores/
    └── settings.store.ts          # Add keyboardOverrides field + version bump
```

Files modified:
- `src/components/app/SearchOverlay.tsx` — migrate raw keydown listener
- `src/stores/settings.store.ts` — add field + bump persist version

### Pattern 1: Static Shortcut Registry

**What:** A typed const array exported from `src/lib/shortcuts.ts`. No context, no store — plain module-level constant.
**When to use:** Wherever the shortcuts list is needed — import directly.

```typescript
// Source: CONTEXT.md registry design decision
export type ShortcutCategory = 'Navigation' | 'Lists' | 'Actions' | 'General';

export interface ShortcutEntry {
  id: string;
  defaultKey: string;
  description: string;
  category: ShortcutCategory;
}

export const SHORTCUTS: ShortcutEntry[] = [
  { id: 'show-shortcuts', defaultKey: '?', description: 'Show keyboard shortcuts', category: 'General' },
  { id: 'dismiss',        defaultKey: 'Esc', description: 'Dismiss shortcuts panel', category: 'General' },
];
```

### Pattern 2: useHotkeys — Standard Wiring

**What:** All keyboard shortcuts use `useHotkeys` from `react-hotkeys-hook`. Never `window.addEventListener`.
**When to use:** Any component that needs to respond to a key press.

```typescript
// Source: https://react-hotkeys-hook.vercel.app/docs/api/use-hotkeys
import { useHotkeys } from 'react-hotkeys-hook';

// Open shortcuts panel — no enableOnFormTags (KEYS-07 satisfied by default)
useHotkeys('?', () => setOpen(true));

// Escape in SearchOverlay — enableOnFormTags: true so it fires while typing
useHotkeys('escape', onClose, { enableOnFormTags: true });
```

**Full hook signature:**
```typescript
function useHotkeys<T extends Element>(
  keys: string | string[],
  callback: (event: KeyboardEvent, handler: HotkeysEvent) => void,
  options?: Options,
  deps?: any[]
): React.MutableRef<T | null>
```

**Key options with defaults:**
- `enableOnFormTags: false` — KEYS-07 guard; leave as default for all non-search shortcuts
- `enableOnContentEditable: false` — same; leave as default
- `enabled: true` — can be a boolean or `(event, handler) => boolean` for conditional enabling
- `preventDefault: false` — set to `true` if the key would trigger browser behavior
- `scopes: '*'` — all hotkeys are global scope in Phase 19

### Pattern 3: @base-ui/react Dialog Modal

**What:** Centered modal with backdrop. Escape is handled by the dialog natively.
**When to use:** KeyboardShortcutsPanel and all future centered modals.

```tsx
// Source: src/routes/dashboard/CreateEpicDialog.tsx (canonical reference)
<Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
  <Dialog.Portal>
    <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
    <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2
                             w-full max-w-[500px] max-h-[80vh] overflow-y-auto
                             bg-background rounded-lg shadow-lg p-6">
      <Dialog.Title className="text-lg font-semibold mb-4">
        Keyboard Shortcuts
      </Dialog.Title>
      {/* shortcut list */}
      <Dialog.Close render={<button type="button" aria-label="Close keyboard shortcuts" />} />
    </Dialog.Popup>
  </Dialog.Portal>
</Dialog.Root>
```

**Critical:** `@base-ui/react/dialog` closes on Escape automatically when `open={true}`. Do NOT add a `useHotkeys('escape')` for the panel — it would double-fire.

### Pattern 4: Zustand Persist Version Bump

**What:** Any new persisted field in `useSettingsStore` requires bumping `version` and adding a migration case.
**When to use:** Adding `keyboardOverrides` field this phase.

```typescript
// Source: src/stores/settings.store.ts (existing pattern)
// Current version: 1

// Step 1: Add field to interface
keyboardOverrides: Record<string, string>;

// Step 2: Add default in create()
keyboardOverrides: {},

// Step 3: Bump version + add migrate case
{
  name: 'settings-store',
  storage: tauriStorage,
  version: 2,                          // was 1, now 2
  migrate: (persisted, version) => {
    const s = persisted as Record<string, unknown>;
    if (version < 1) {
      if (s.density === undefined) s.density = 'default';
      if (s.sprintCollapseByDefault === undefined) s.sprintCollapseByDefault = false;
      if (s.showSubtasksInMyTasks === undefined) s.showSubtasksInMyTasks = true;
    }
    if (version < 2) {
      if (s.keyboardOverrides === undefined) s.keyboardOverrides = {};
    }
    return s as unknown as SettingsState;
  },
}
```

### Pattern 5: kbd Badge Styling (from UI-SPEC)

```tsx
// Source: 19-UI-SPEC.md — approved design contract
<kbd className="inline-flex items-center px-2 py-1 text-xs font-normal
               bg-muted text-foreground border border-border rounded-sm font-mono">
  {key}
</kbd>
```

Category heading:
```tsx
<h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide
               pt-4 pb-1 first:pt-0">
  {category}
</h3>
```

Shortcut row:
```tsx
<div className="flex items-center justify-between py-2 gap-4">
  <span className="text-sm text-foreground">{description}</span>
  <kbd>...</kbd>
</div>
```

### Anti-Patterns to Avoid

- **Raw window.addEventListener for keyboard events:** All keyboard logic uses `useHotkeys`. The SearchOverlay migration removes the only remaining raw listener.
- **useHotkeys('escape') for the panel close:** @base-ui/react handles this natively. Adding an explicit hook would cause double-fire.
- **createContext/useContext:** The project uses no context providers. `KeyboardShortcutsPanel` imports `SHORTCUTS` directly from the constants module.
- **New store for shortcuts:** No new store. `keyboardOverrides` goes into `useSettingsStore` per the locked decision.
- **Pre-populating future shortcuts:** Only Phase 19's 2 wired shortcuts appear in the panel. Do not add KEYS-03 through KEYS-06 placeholders — they get added in their respective phases.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Keyboard event handling | Custom `useEffect` + `window.addEventListener` | `react-hotkeys-hook@^5.2.4` | Input focus guard, cleanup, React lifecycle, SSR safety |
| Modal with focus trap + Escape | Custom modal | `@base-ui/react/dialog` | Focus trap, Escape, accessibility, portal management all handled |
| Grouped list rendering | Custom groupBy | `SHORTCUTS.filter(s => s.category === cat)` per category | Simple — no lodash needed for 2 entries |

**Key insight:** The input focus guard (KEYS-07) is a solved problem in `react-hotkeys-hook`. Its default behavior (`enableOnFormTags: false`) is exactly what the requirements need. Do not build any conditional logic around `document.activeElement` or `e.target` checks.

---

## Common Pitfalls

### Pitfall 1: Double Escape Handling

**What goes wrong:** Adding `useHotkeys('escape', onClose)` inside `KeyboardShortcutsPanel` alongside the `@base-ui/react/dialog`'s native Escape handling. The panel closes twice — the second close attempt may call `onClose` on an already-unmounted component.
**Why it happens:** Developers add explicit Escape wiring "to be safe" without knowing the dialog handles it.
**How to avoid:** Do not add `useHotkeys('escape')` for the shortcuts panel. Trust `Dialog.Root`'s `onOpenChange` callback.
**Warning signs:** Test that verifies `onClose` is called exactly once on Escape press; if it fires twice the test fails.

### Pitfall 2: SearchOverlay Test Breaks After Migration

**What goes wrong:** The existing `SearchOverlay.test.tsx` tests the Escape behavior via `fireEvent.keyDown(window, { key: 'Escape' })`. After migrating to `useHotkeys`, this test pattern may break because `react-hotkeys-hook` uses its own event listener registration.
**Why it happens:** `useHotkeys` attaches to `document` by default, not `window`. `fireEvent.keyDown(window, ...)` targets the window object.
**How to avoid:** After migration, fire the event on `document` instead: `fireEvent.keyDown(document, { key: 'Escape' })`. Check whether existing test passes before changing it — if `fireEvent.keyDown(window, ...)` still works in jsdom, leave it.
**Warning signs:** The existing Escape test in `SearchOverlay.test.tsx` line 181-186 fails after migration.

### Pitfall 3: `?` Key Not Matching

**What goes wrong:** `useHotkeys('?', ...)` doesn't fire because the browser interprets `?` as `shift+/` and the key string matching fails.
**Why it happens:** `react-hotkeys-hook` v5 handles shifted characters. The string `'?'` is the correct way to register the `?` key — it maps to the key value, not the code.
**How to avoid:** Use `'?'` as the key string. Do NOT use `'shift+/'`. Verify with a quick manual test on the dev build.
**Warning signs:** Panel never opens on pressing `?`.

### Pitfall 4: Store Version Not Bumped

**What goes wrong:** Adding `keyboardOverrides` to the Zustand persist state without bumping `version`. Existing users' persisted stores silently miss the new field — `keyboardOverrides` comes back as `undefined` instead of `{}`.
**Why it happens:** Developer skips the version/migrate boilerplate.
**How to avoid:** Always bump `version` from 1 to 2 AND add the migration case `if (version < 2)` in the same commit that adds the field.
**Warning signs:** `useSettingsStore().keyboardOverrides` is `undefined` after cold launch in a build that previously persisted v1 data.

### Pitfall 5: Dialog Not Closing on Escape in Test Environment

**What goes wrong:** Testing `KeyboardShortcutsPanel` with `fireEvent.keyDown(document, { key: 'Escape' })` doesn't close the dialog in jsdom because `@base-ui/react/dialog` uses browser-native behavior that jsdom may not fully simulate.
**Why it happens:** jsdom's focus and keyboard event simulation is incomplete for some dialog implementations.
**How to avoid:** Test the `open` prop state change instead: mock the `onOpenChange` callback and verify it's called with `false` when Escape is fired. Alternatively, test via the close button click.
**Warning signs:** Dialog remains mounted in test DOM after Escape keydown.

---

## Code Examples

Verified patterns from official sources and codebase:

### Full KeyboardShortcutsPanel structure

```tsx
// Source: 19-UI-SPEC.md + CreateEpicDialog.tsx canonical pattern
import { Dialog } from '@base-ui/react/dialog';
import { SHORTCUTS, type ShortcutCategory } from '@/lib/shortcuts';

const CATEGORIES: ShortcutCategory[] = ['Navigation', 'Lists', 'Actions', 'General'];

interface KeyboardShortcutsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsPanel({ open, onClose }: KeyboardShortcutsPanelProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2
                     w-full max-w-[500px] max-h-[80vh] overflow-y-auto
                     bg-background rounded-lg shadow-lg p-6"
          aria-describedby="kbd-panel-desc"
        >
          <Dialog.Title className="text-lg font-semibold mb-4">
            Keyboard Shortcuts
          </Dialog.Title>
          <p id="kbd-panel-desc" className="sr-only">
            A list of all available keyboard shortcuts grouped by category.
          </p>
          {CATEGORIES.map((cat) => {
            const entries = SHORTCUTS.filter((s) => s.category === cat);
            if (entries.length === 0) return null;
            return (
              <div key={cat}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase
                               tracking-wide pt-4 pb-1 first:pt-0">
                  {cat}
                </h3>
                {entries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between py-2 gap-4">
                    <span className="text-sm text-foreground">{entry.description}</span>
                    <kbd className="inline-flex items-center px-2 py-1 text-xs font-normal
                                   bg-muted text-foreground border border-border rounded-sm font-mono">
                      {entry.defaultKey}
                    </kbd>
                  </div>
                ))}
              </div>
            );
          })}
          <Dialog.Close
            render={
              <button
                type="button"
                className="sr-only"
                aria-label="Close keyboard shortcuts"
              />
            }
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

### Wiring the `?` shortcut (at root/layout level)

```tsx
// Source: react-hotkeys-hook official docs + 19-CONTEXT.md decisions
import { useHotkeys } from 'react-hotkeys-hook';
import { useState } from 'react';
import { KeyboardShortcutsPanel } from '@/components/app/KeyboardShortcutsPanel';

// In App.tsx or a layout component:
const [shortcutsOpen, setShortcutsOpen] = useState(false);

useHotkeys('?', () => setShortcutsOpen(true));

// In JSX:
<KeyboardShortcutsPanel open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
```

### SearchOverlay migration (raw → useHotkeys)

```tsx
// REMOVE this (SearchOverlay.tsx lines 91-97):
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [onClose]);

// REPLACE with:
import { useHotkeys } from 'react-hotkeys-hook';

useHotkeys('escape', onClose, { enableOnFormTags: true });
// enableOnFormTags: true is intentional — allows Escape to work while typing in the search input
```

---

## Existing Code Insights

### SearchOverlay.test.tsx Escape test (must stay green)

Line 181-186 in the existing test:
```tsx
it('calls onClose when Escape key is pressed', () => {
  const onClose = vi.fn();
  renderOverlay(onClose);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledOnce();
});
```

After migration to `useHotkeys`, verify this test still passes. If it fails because `useHotkeys` listens on `document` rather than `window`, change to `fireEvent.keyDown(document, { key: 'Escape' })`.

### Settings store current state

- Current `version: 1`
- Current fields: `density`, `sprintCollapseByDefault`, `showSubtasksInMyTasks` were added in version < 1 migrations
- Phase 19 must: bump to `version: 2`, add `keyboardOverrides: Record<string, string>` with default `{}`, add `if (version < 2)` migration case

### Test mock pattern for @tauri-apps/plugin-store

All test files mock the Tauri store the same way. New test files for Phase 19 must include:
```tsx
vi.mock('@tauri-apps/plugin-store', () => {
  class LazyStore {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue(undefined);
    save = vi.fn().mockResolvedValue(undefined);
    delete = vi.fn().mockResolvedValue(undefined);
  }
  return { LazyStore };
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `window.addEventListener('keydown')` | `useHotkeys()` from react-hotkeys-hook | Phase 19 migration | Input focus guard automatic, cleanup handled by React |
| Raw keydown with manual input guard | Default `enableOnFormTags: false` | Immediately | KEYS-07 satisfied without conditional code |

**Deprecated/outdated:**
- Raw `window.addEventListener('keydown')` in SearchOverlay: removed this phase, replaced with `useHotkeys`

---

## Open Questions

1. **Does `useHotkeys('?', ...)` fire when the panel is already open?**
   - What we know: The hook is mounted at the root level; closing the panel doesn't unmount the hook
   - What's unclear: Whether pressing `?` while the dialog has focus would trigger the hook (dialog may capture keyboard events)
   - Recommendation: `@base-ui/react/dialog` traps focus inside the popup, so keyboard events inside the dialog stay in the dialog and do not bubble to the window-level listener. The `?` hook likely does not fire when the panel is open. Verify in manual testing and add a comment explaining why idempotence is handled by focus trap rather than conditional `enabled`.

2. **`useShortcuts()` convenience hook — add or skip?**
   - What we know: CONTEXT.md lists this as Claude's Discretion; the planner can decide
   - What's unclear: Whether Phase 20/21 would actually benefit from it vs. importing SHORTCUTS directly
   - Recommendation: Skip for Phase 19. Keep it simple — `KeyboardShortcutsPanel` imports `SHORTCUTS` directly. A convenience hook can be added later if a pattern of repeated `effectiveKey()` calls emerges.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run --reporter=verbose src/components/app/KeyboardShortcutsPanel.test.tsx src/components/app/SearchOverlay.test.tsx src/stores/settings.store.test.ts` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KEYS-01 | `?` key opens the shortcuts panel | unit | `cd taskflow && npx vitest run src/components/app/KeyboardShortcutsPanel.test.tsx -t "opens"` | ❌ Wave 0 |
| KEYS-02 | Escape closes the panel | unit | `cd taskflow && npx vitest run src/components/app/KeyboardShortcutsPanel.test.tsx -t "Escape"` | ❌ Wave 0 |
| KEYS-07 | `?` does not fire inside text input | unit | `cd taskflow && npx vitest run src/components/app/KeyboardShortcutsPanel.test.tsx -t "input"` | ❌ Wave 0 |
| SearchOverlay migration | Escape still closes overlay after raw→useHotkeys migration | unit | `cd taskflow && npx vitest run src/components/app/SearchOverlay.test.tsx` | ✅ exists |
| Settings store | `keyboardOverrides` field present with default `{}` | unit | `cd taskflow && npx vitest run src/stores/settings.store.test.ts` | ✅ exists — may need new test case |

### Sampling Rate

- **Per task commit:** `cd taskflow && npx vitest run src/components/app/SearchOverlay.test.tsx src/components/app/KeyboardShortcutsPanel.test.tsx`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `taskflow/src/components/app/KeyboardShortcutsPanel.test.tsx` — covers KEYS-01, KEYS-02, KEYS-07
- [ ] New test case in `settings.store.test.ts` for `keyboardOverrides` field and migration from v1→v2 (file exists; add case)

---

## Sources

### Primary (HIGH confidence)

- `taskflow/src/components/app/SearchOverlay.tsx` — exact raw listener to migrate (lines 91-97)
- `taskflow/src/routes/dashboard/CreateEpicDialog.tsx` — Dialog pattern canonical reference
- `taskflow/src/stores/settings.store.ts` — current version (1), migrate pattern, field structure
- `taskflow/package.json` — confirms react-hotkeys-hook NOT yet installed; all other dependencies present
- `.planning/phases/19-keyboard-foundation/19-CONTEXT.md` — all locked decisions
- `.planning/phases/19-keyboard-foundation/19-UI-SPEC.md` — approved visual and interaction contract
- https://react-hotkeys-hook.vercel.app/docs/api/use-hotkeys — full Options type, defaults, enableOnFormTags behavior

### Secondary (MEDIUM confidence)

- npm registry `react-hotkeys-hook` latest — confirmed version 5.2.4

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — exact versions confirmed from npm registry and package.json
- Architecture: HIGH — all patterns are locked decisions with existing codebase examples
- Pitfalls: HIGH — derived from reading actual source code + library docs
- Test map: HIGH — vitest config and test files verified by direct file inspection

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (react-hotkeys-hook is stable; @base-ui/react API is stable)
