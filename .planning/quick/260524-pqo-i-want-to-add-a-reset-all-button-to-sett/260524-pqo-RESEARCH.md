# Quick Task 260524-pqo: Reset buttons in Settings — Research

**Researched:** 2026-05-24
**Domain:** Zustand v5 store reset + Tauri LazyStore persist + Stronghold secrets
**Confidence:** HIGH (all findings verified against codebase; Zustand API verified against installed v5.0.11)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Three distinct reset options** (not one button), placed inside `DebugModeSection.tsx`:
  1. **Reset onboarding wizard** — resets only `onboardingComplete` so the wizard re-runs
  2. **Reset preferences** — resets appearance, notifications, workflow, sidebar, integrations, updates; keeps Jira/GitLab credentials (URLs, tokens, custom field keys) intact
  3. **Reset all** — full wipe including credentials and all preferences
- **Button placement:** Advanced/Debug section, three separate action rows.
- **Confirmation UX:** Each option opens its own confirm dialog listing affected categories. Cancel / Reset buttons.

### Claude's Discretion
- Exact dialog wording and button labels
- Whether to show a success toast (note: see Pitfall 4 — no toast lib installed; use inline confirmation)
- Which Zustand fields map to each reset scope
- Whether to reuse existing dialog component patterns (recommendation: yes — reuse the `Dialog` pattern from the Clear-notification-cache flow)

### Deferred Ideas (OUT OF SCOPE)
- None recorded.
</user_constraints>

## Summary

Adding three scoped reset actions to `DebugModeSection.tsx`. The mechanism is straightforward in Zustand v5: `useSettingsStore.setState(partialOrFull, replace?)`. The persist middleware automatically writes to `settings.json` on every `set`/`setState` call, so **no explicit LazyStore flush is needed** for normal in-app resets (the app is not restarting). The confirm-dialog UX should reuse the exact `Dialog`/`DialogTrigger`/`DialogContent`/`DialogFooter` pattern already in this file (Clear-notification-cache, lines 197–227).

**One material correction to CONTEXT.md:** credentials are **not stored in `settings.store.ts`**. The decision text lists `jiraToken`/`gitlabToken` and base URLs as settings-store fields to exclude, but those fields do not exist there. Tokens live in **Stronghold** (encrypted, keys `jira-pat` / `gitlab-pat`) and base URLs live in **`auth.store.ts`** (`auth.json`). The custom field keys (`storyPointsFieldKey`, etc.) **are** in `settings.store.ts`. This changes the implementation surface — see Architecture below.

**Primary recommendation:** Add a `resetSettings(scope)` action to `settings.store.ts` that does in-store partial resets via `set(...)`, and handle cross-store wipes (auth.store + onboarding.store + Stronghold) explicitly from the component for the "Reset all" path. Reuse the existing `Dialog` confirm pattern.

## Where state actually lives (critical for scope mapping)

| Store / Sink | File / Sink | Persisted to | Holds | Relevant to scope |
|--------------|-------------|--------------|-------|-------------------|
| `useSettingsStore` | `src/stores/settings.store.ts` | `settings.json` (LazyStore) | theme, density, notif toggles, sidebar items/widths, AIO/Tempo enabled, update prefs, `onboardingComplete`, custom field keys, dev tools | preferences + onboarding + (field keys belong to "all" only) |
| `useAuthStore` | `src/stores/auth.store.ts` | `auth.json` (LazyStore) | `jiraBaseUrl`, `gitlabBaseUrl`, connection flags, active project, user identity | "Reset all" only (credentials) |
| Stronghold | `src/services/stronghold.ts` | encrypted vault | `jira-pat`, `gitlab-pat` tokens | "Reset all" only (credentials) |
| `useOnboardingStore` | `src/stores/onboarding.store.ts` | NOT persisted (transient, in-memory only) | wizard step buffers incl. transient `jiraToken`/`gitlabToken` form fields | optional clear; resets on reload anyway |

**Implication for the three scopes:**
- **Reset onboarding wizard:** `setOnboardingComplete(false)` (action already exists). The `AppLayout` gate in `main.tsx:501` reads `onboardingComplete` reactively, so the wizard re-runs immediately — no reload required.
- **Reset preferences:** reset settings-store fields *except* `onboardingComplete` and the custom field keys (keep those, since CONTEXT says keep credentials/field-key config intact). Do not touch `auth.store` or Stronghold.
- **Reset all:** full settings-store reset + `auth.store` reset + `removeSecret('jira-pat')` + `removeSecret('gitlab-pat')` + (optionally) onboarding-store reset.

## Architecture / Recommended Approach

### Reset mechanism — Zustand v5

`useSettingsStore.setState(partial, replace?)` is the canonical reset primitive (verified, zustand 5.0.11). Two patterns:

**A. Add a `resetSettings` action inside the store (RECOMMENDED).** Define the initial-state object once as a named const so it can be referenced both for the store factory and the reset action. This keeps the field→default mapping in one place and avoids drift.

```typescript
// settings.store.ts — extract defaults to a const
const initialSettings = {
  theme: 'system' as Theme,
  onboardingComplete: false,
  density: 'default' as Density,
  // ... all data fields (NOT the set* action functions)
};

// inside create(persist((set) => ({ ...initialSettings, /* actions */,
  resetSettings: (scope: 'preferences' | 'all') =>
    set((s) => {
      if (scope === 'all') return { ...initialSettings };
      // 'preferences': keep onboardingComplete + custom field keys
      const { onboardingComplete, storyPointsFieldKey, epicLinkFieldKey,
        epicNameFieldKey, sprintFieldKey, epicColorFieldKey,
        flaggedFieldKey, accountFieldKey } = s;
      return { ...initialSettings, onboardingComplete, storyPointsFieldKey,
        epicLinkFieldKey, epicNameFieldKey, sprintFieldKey,
        epicColorFieldKey, flaggedFieldKey, accountFieldKey };
    }),
```

Use the default `set` (merge mode, `replace` omitted/false). **Do not pass `replace: true`** — that would drop the action functions (`setTheme`, etc.) from the store, breaking the app. Merge mode overwrites the data keys you provide and leaves the action functions intact. This matches how the existing test suite already calls `useSettingsStore.setState({...})` (merge) in `settings.store.test.ts`.

**B. Cross-store wipe for "Reset all"** — handle from the component (or a small helper), since it spans stores + Stronghold:

```typescript
async function handleResetAll() {
  useSettingsStore.getState().resetSettings('all');
  useAuthStore.setState({ jiraBaseUrl: null, gitlabBaseUrl: null,
    jiraConnected: false, gitlabConnected: false, activeJiraProject: null,
    activeGitlabProject: null, activeGitlabProjectPath: null,
    jiraUserDisplayName: null, jiraUsername: null, jiraUserKey: null,
    gitlabUserId: null, gitlabUsername: null });
  await removeSecret('jira-pat').catch(() => {});   // tolerate missing key
  await removeSecret('gitlab-pat').catch(() => {});
}
```

(Confirm the exact auth-reset field set against `auth.store.ts` at plan time; an `initialAuthState` const there would be cleaner, mirroring approach A.)

### Persist flush — answer to focus Q2

**No explicit flush needed for in-app resets.** The Tauri storage adapter (`src/lib/tauri-storage.ts`) wraps every `setItem` with `await store.save()`. Zustand's persist middleware fires `setItem` after each `set`/`setState`. So calling `resetSettings(...)` automatically schedules a write to `settings.json`.

The one documented exception is **write-before-restart**: persist is fire-and-forget (the middleware does not await `setItem`), so if you reset and *immediately kill the process* the save can lose the race — see the `persistChangelogBeforeRestart()` helper and its comment block in `tauri-storage.ts`. The reset feature does **not** restart the app, so this race does not apply. Do not add a manual flush.

### Dialog pattern — answer to focus Q3

There is **no `AlertDialog` component** in the codebase. The standard pattern is the Base UI `Dialog` family from `@/components/ui/dialog` — already imported and used in `DebugModeSection.tsx` for Clear-notification-cache. Reuse it verbatim:

- `<Dialog>` wraps `<DialogTrigger render={<Button .../>}>` + `<DialogContent showCloseButton={false}>`.
- `<DialogHeader>` → `<DialogTitle>` + `<DialogDescription>` (list the affected categories here).
- `<DialogFooter>` → `<DialogClose render={<Button variant="outline"/>}>Cancel</DialogClose>` + `<DialogClose render={<Button variant="destructive" onClick={handler}/>}>Reset</DialogClose>`.

Note the codebase quirk: the action runs via `onClick` on a `<Button>` *rendered inside* `<DialogClose>`, so the click both fires the handler and closes the dialog. Match this. Use `variant="destructive"` for the confirm button (matches Clear-all). Since each of the three rows needs its own dialog, either render three `<Dialog>` blocks or parameterize one with `useState` for the active scope — three inline blocks is simplest and matches the existing file's style.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Confirm dialog | Custom modal/overlay | Existing `@/components/ui/dialog` (Base UI) | Already styled, accessible, used 2 ft away in same file |
| Resetting store to defaults | Manually `set()` each of ~40 fields at the callsite | A single `initialSettings` const + `resetSettings` action | One source of truth; avoids drift when fields are added |
| Persisting the reset | Manual `LazyStore.save()` call | Nothing — persist adapter auto-saves | `setItem` already awaits `store.save()` |
| Token storage | Reading/writing token files | `removeSecret('jira-pat'\|'gitlab-pat')` from `stronghold.ts` | Tokens are in the encrypted vault, not any JSON store |

## Common Pitfalls

### Pitfall 1: Assuming credentials live in settings.store
**What goes wrong:** Following CONTEXT.md literally and trying to exclude `jiraToken`/`gitlabToken`/`jiraBaseUrl` from a settings-store reset — those fields don't exist there, so the exclusion is a no-op and "Reset all" silently fails to wipe credentials.
**Avoid:** Credentials = `auth.store.ts` (URLs/connection) + Stronghold (`jira-pat`, `gitlab-pat`). "Reset preferences" already keeps them intact simply by only touching `settings.store`. "Reset all" must explicitly reset `auth.store` AND call `removeSecret` twice.

### Pitfall 2: `replace: true` nukes the action functions
**What goes wrong:** `setState(initialSettings, true)` replaces the *entire* store object, deleting `setTheme`, `setDensity`, etc. Subsequent UI interactions throw "x is not a function".
**Avoid:** Use merge mode (omit the second arg). `initialSettings` contains only data fields; merging overwrites those and preserves actions.

### Pitfall 3: Migration loop fear (focus Q4) — not a real risk
**What goes wrong:** Worry that resetting state re-triggers the `migrate` function.
**Reality:** `migrate` only runs on **rehydration from disk** when the persisted `version` (22) differs from the store's declared `version`. An in-memory `set()` does not invoke `migrate`. The persisted blob keeps `version: 22`. Do **not** reset/null the `version` field — there is no `version` field in app state anyway (it lives in the persist wrapper metadata, not in `SettingsState`). Resetting data fields is safe and causes no migration loop.

### Pitfall 4: No toast library installed
**What goes wrong:** Adding a "success toast" import fails — there is no `sonner`/`react-hot-toast`/`react-toastify` in `package.json`. ConnectionsSection explicitly notes "No toast/sonner — all feedback is inline."
**Avoid:** For success feedback, mirror the existing inline `cleared` pattern in this same file (a `useState` flag + a green check that auto-clears after 3s), or simply rely on the visible state change (wizard re-running / fields blanking). Don't introduce a toast dependency.

### Pitfall 5: Onboarding re-run needs nothing but the flag
**What goes wrong:** Over-engineering a navigation/redirect after resetting onboarding.
**Reality:** `AppLayout` (`main.tsx:501`) and `onboarding/index.tsx:7` both read `onboardingComplete` reactively via `useSettingsStore`. Setting it `false` re-renders into the wizard automatically. No manual `navigate()` needed (though a `navigate('/onboarding')` is harmless if desired).

## Environment Availability

SKIPPED — purely in-repo TypeScript/React changes; no new external dependencies. All required APIs (`zustand`, `@tauri-apps/plugin-store`, Base UI Dialog, `stronghold.ts`) already present.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing `*.test.ts`/`*.test.tsx` suites) |
| Quick run command | `npm run test -- settings.store` |
| Full suite command | `npm run test` |
| Build guard | `npm run build` (per Phase 59 decision: `tsc` alone misses CSS import failures) |

### Requirements → Test Map
| Behavior | Test Type | Command |
|----------|-----------|---------|
| `resetSettings('preferences')` keeps `onboardingComplete` + field keys, resets the rest | unit | `npm run test -- settings.store` |
| `resetSettings('all')` returns all data fields to defaults; action functions still present | unit | `npm run test -- settings.store` |
| Reset onboarding sets `onboardingComplete=false` | unit | `npm run test -- settings.store` |

### Wave 0 Gaps
- [ ] Add reset assertions to existing `src/stores/settings.store.test.ts` (preferred — file already exists and uses `setState` patterns). No new framework setup needed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Reset preferences" should keep custom field keys (treated as part of integration config, per CONTEXT "keeps … custom field keys intact") | scope mapping | If user wants field keys reset under "preferences", adjust the keep-list. Low risk — easy one-line change. |
| A2 | Onboarding-store transient fields need not be explicitly cleared on "Reset all" (they're in-memory and reset on reload) | cross-store wipe | Cosmetic only; clearing is harmless if desired. |

## Sources

### Primary (HIGH)
- Codebase: `settings.store.ts`, `auth.store.ts`, `onboarding.store.ts`, `tauri-storage.ts`, `stronghold.ts`, `DebugModeSection.tsx`, `dialog.tsx`, `main.tsx`, `onboarding/index.tsx` — read directly this session.
- `package.json` — zustand `^5.0.11` confirmed; no toast library present.
- Zustand v5 `setState(partial, replace?)` merge-vs-replace semantics — consistent with existing test usage in `settings.store.test.ts`.

## Metadata
**Confidence breakdown:**
- State location / scope mapping: HIGH — verified across all four sinks in the codebase.
- Reset mechanism (Zustand setState merge): HIGH — matches installed v5.0.11 and existing tests.
- Persist flush behavior: HIGH — read the actual storage adapter.
- Dialog pattern: HIGH — reusing exact in-file pattern.

**Research date:** 2026-05-24
**Valid until:** stable (no fast-moving external deps); revisit only if stores are refactored.
