# Phase 19: Keyboard Foundation - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Centralized shortcut registry, global keyboard hook, and `?` help panel that lists all registered shortcuts. This phase wires only the `?` and `Esc` shortcuts and migrates SearchOverlay's existing raw keydown listener. Navigation shortcuts (G+S, G+B, G+N), J/K list navigation, and Cmd+K all belong to later phases — they will add entries to the registry when implemented.

</domain>

<decisions>
## Implementation Decisions

### Help panel presentation
- Centered modal using `@base-ui/react/dialog` — same pattern as CreateEpicDialog and CreateEditIssueModal
- Fixed width (~500px), backdrop, scrollable if content overflows
- `?` key opens it from any screen (when not in a text input); Escape closes it (KEYS-01, KEYS-02)
- Key combos displayed as styled `<kbd>` badges (bordered, background-colored to look like real keys)

### Shortcut categories
- Grouped by feature area: **Navigation**, **Lists**, **Actions**, **General**
- Categories are pre-defined in the constants but only categories with at least one entry are rendered
- Panel is incremental: Phase 19 only shows entries that are actually wired (`?` → Show shortcuts, `Esc` → Close panel in General). Later phases add their entries as they implement the shortcuts

### Registry design
- Static constants file at `src/lib/shortcuts.ts` — exports a typed `SHORTCUTS` array
- Each entry shape: `{ id: string, defaultKey: string, description: string, category: 'Navigation' | 'Lists' | 'Actions' | 'General' }`
- `id` is a stable string slug (e.g., `'show-shortcuts'`) — used as the key for user overrides
- Designed for future customization: effective key = `overrides[id] ?? defaultKey`

### User override storage
- Add `keyboardOverrides: Record<string, string>` to `useSettingsStore` (Zustand persist)
- Same pattern as `density` — no new store, bump store `version` + `migrate`
- Override UI (Settings > Keyboard section) is explicitly future scope — foundation only this phase

### Existing keydown listener migration
- Migrate `SearchOverlay.tsx`'s raw `window.addEventListener('keydown')` Escape handler to `useHotkeys('escape', onClose, { enableOnFormTags: true })`
- Audit confirms this is the only raw keydown listener in the codebase (STATE.md noted this as required)
- All future shortcut wiring uses `react-hotkeys-hook` — no new raw listeners

### Input focus guard (KEYS-07)
- `react-hotkeys-hook` does not fire on `<input>`, `<textarea>`, or `<select>` by default — satisfies KEYS-07 without extra logic
- For `?` specifically: default behavior is correct (typing `?` in an input field must not open the panel)
- `enableOnFormTags: true` only used where explicitly needed (e.g., Escape in SearchOverlay to allow closing even while typing in the search input)

### Claude's Discretion
- Exact `<kbd>` styling (border radius, font size, padding, color tokens)
- Modal width and max-height breakpoints
- How to handle the case where `?` is pressed while the help panel itself is open (likely: do nothing or close)
- Whether to add a `useShortcuts()` convenience hook that returns `{ shortcuts, effectiveKey(id) }` for consumers

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Keyboard Shortcuts — KEYS-01, KEYS-02, KEYS-07 are the only requirements in scope for this phase

### Existing patterns to follow
- `src/routes/dashboard/CreateEpicDialog.tsx` — reference implementation for `@base-ui/react/dialog` modal pattern
- `src/components/app/SearchOverlay.tsx` — the raw keydown listener to migrate; also reference for how keyboard overlays are tested

No external ADRs or design specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@base-ui/react/dialog` — already used in CreateEpicDialog and CreateEditIssueModal; no new install needed for the help panel
- `src/components/ui/sheet.tsx` — considered and rejected for this panel (centered modal is the right pattern)
- `useSettingsStore` (`src/stores/settings.store.ts`) — add `keyboardOverrides` field here with version bump

### Established Patterns
- `@base-ui/react/dialog` modal: `Dialog.Root > Dialog.Portal > Dialog.Backdrop + Dialog.Popup + Dialog.Title + Dialog.Close`
- Zustand persist with version + migrate: any new persisted field in `useSettingsStore` requires bumping `version` and adding a migrate function
- No `createContext`/`useContext` anywhere — if `KeyboardShortcutsPanel` needs the shortcuts list, pass it as a prop or import the constants directly

### Integration Points
- `src/components/app/SearchOverlay.tsx` — migrate the Escape listener (raw → useHotkeys)
- `src/stores/settings.store.ts` — add `keyboardOverrides: Record<string, string>` with default `{}`; bump store version
- New files to create: `src/lib/shortcuts.ts` (registry constants), `src/components/app/KeyboardShortcutsPanel.tsx` (the `?` modal)
- `react-hotkeys-hook@^5.2.4` — new dependency, must be installed

</code_context>

<specifics>
## Specific Ideas

- Registry shape example: `{ id: 'show-shortcuts', defaultKey: '?', description: 'Show keyboard shortcuts', category: 'General' }`
- Panel in Phase 19 will have exactly 2 entries: `?` (Show shortcuts) and `Esc` (Dismiss) — both in General
- Future phases extend by: (1) adding entries to `SHORTCUTS` in `lib/shortcuts.ts`, (2) calling `useHotkeys()` in the relevant component, (3) no changes needed to the panel itself — it reads from the constants

</specifics>

<deferred>
## Deferred Ideas

- Keyboard shortcut customization UI (Settings > Keyboard section) — foundation laid this phase (overrides field in settings store + stable IDs), but the editing UI is explicitly out of scope per REQUIREMENTS.md Out of Scope table
- Conflict detection when user tries to assign a key already in use — needed alongside customization UI
- Pre-populating the panel with Phase 20/21 shortcuts before they're wired — user chose incremental approach instead

</deferred>

---

*Phase: 19-keyboard-foundation*
*Context gathered: 2026-03-15*
