---
phase: quick-260524-pqo
verified: 2026-05-24T18:50:00Z
status: human_needed
score: 6/6
overrides_applied: 0
human_verification:
  - test: "Open Settings > Advanced and scroll to the Reset section"
    expected: "Three rows visible: 'Reset onboarding wizard', 'Reset preferences', 'Reset all' — each with a Reset button on the right"
    why_human: "JSX structure is present but visual rendering requires a running app"
  - test: "Click 'Reset onboarding wizard', confirm in dialog"
    expected: "The setup wizard re-runs immediately (without app restart). Row shows Check + 'Done' for ~3 seconds."
    why_human: "Reactive behaviour depends on onboarding gate in main.tsx reading the store — cannot verify without running app"
  - test: "Click 'Reset preferences', confirm in dialog"
    expected: "Appearance/sidebar/notification settings revert to defaults; Jira/GitLab URLs and custom field keys are unchanged"
    why_human: "Scope-preservation correctness needs runtime inspection to confirm persisted state"
  - test: "Click 'Reset all', confirm in dialog"
    expected: "All settings and auth fields reset to defaults, Jira/GitLab disconnected in UI, stored PATs removed from Stronghold vault"
    why_human: "Stronghold removal can only be confirmed at runtime with actual vault state"
---

# Quick Task: Reset All Button — Verification Report

**Task Goal:** Add a 'reset all' button to settings
**Verified:** 2026-05-24T18:50:00Z
**Status:** human_needed (all automated checks passed; 4 UI/runtime items need manual smoke)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User sees three reset action rows in Settings > Advanced (Reset onboarding wizard, Reset preferences, Reset all) | ? HUMAN | JSX renders three rows at lines 264–389 of DebugModeSection.tsx; visual presence needs running app |
| 2 | Each reset row opens its own confirm dialog listing affected categories with Cancel/Reset buttons | VERIFIED | Each row wraps a `<Dialog>` with `<DialogHeader>`, `<DialogDescription>` listing categories, and `<DialogFooter>` with Cancel + destructive Reset buttons (lines 280–302, 321–347, 365–388) |
| 3 | Reset onboarding wizard sets onboardingComplete=false so the wizard re-runs without app restart | VERIFIED | `handleResetWizard()` calls `setOnboardingComplete(false)` (line 65); onboarding gate in main.tsx reads store reactively — no navigate/restart needed |
| 4 | Reset preferences restores appearance/notifications/workflow/sidebar/integrations/updates defaults while keeping onboardingComplete and the seven custom field keys intact | VERIFIED | `resetSettings('preferences')` in store (lines 323–334): spreads `initialSettings`, then overrides `onboardingComplete` + all 7 field keys from current state `s`; 16 unit tests confirm scope behaviour (all 59 pass) |
| 5 | Reset all restores every settings-store data field to defaults, resets auth-store connection/identity fields, and removes jira-pat + gitlab-pat from Stronghold | VERIFIED | `handleResetAll()` (lines 76–83): calls `resetSettings('all')`, `resetAuth()`, `removeSecret('jira-pat').catch(()=>{})`, `removeSecret('gitlab-pat').catch(()=>{})`; `initialSettings` covers all 52 data fields; `initialAuthState` covers all 12 auth fields |
| 6 | Store action functions (setTheme, setDensity, etc.) remain callable after any reset (merge-mode, not replace) | VERIFIED | `resetSettings` uses `set((s) => ...)` with no `replace: true` anywhere in settings.store.ts or auth.store.ts; `resetAuth` uses `set({ ...initialAuthState })` (merge); unit tests assert `typeof setTheme === 'function'` after both scopes and `typeof setJiraConnected === 'function'` after `resetAuth()` |

**Score:** 6/6 truths verified (Truth 1 requires visual human confirmation)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/stores/settings.store.ts` | `initialSettings` const + `resetSettings(scope)` action | VERIFIED | `initialSettings` const at lines 20–68 (52 data fields, no actions, no sidebarItems); `resetSettings` action at lines 319–335; `SettingsState` interface declares `resetSettings: (scope: 'preferences' \| 'all') => void` at line 216 |
| `taskflow/src/stores/auth.store.ts` | `initialAuthState` const + `resetAuth()` action | VERIFIED | `initialAuthState` const at lines 16–29 (12 fields, excludes `_hasHydrated`); `resetAuth: () => void` in interface at line 69; implementation: `set({ ...initialAuthState })` at line 94 |
| `taskflow/src/stores/settings.store.test.ts` | Unit tests for resetSettings preferences/all scopes | VERIFIED | Two new describe blocks at lines 295–479: `settings.store — reset actions (quick 260524-pqo)` (16 tests) and `auth.store — resetAuth() (quick 260524-pqo)` (8 tests); all 59 tests pass |
| `taskflow/src/routes/settings/DebugModeSection.tsx` | Three reset action rows with confirm dialogs | VERIFIED | Reset subsection at lines 258–390 with three rows, three `<Dialog>` instances, `removeSecret` imported (line 31), `useAuthStore` imported (line 29) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `DebugModeSection.tsx` | `useSettingsStore.resetSettings` | store action call inside dialog confirm handler | VERIFIED | `resetSettings` selected at line 53; called as `resetSettings('preferences')` in `handleResetPreferences` (line 71) and `useSettingsStore.getState().resetSettings('all')` in `handleResetAll` (line 77); handlers bound to `onClick` on destructive `<DialogClose>` buttons (lines 339, 382) |
| `DebugModeSection.tsx` | `removeSecret` | Stronghold credential wipe in `handleResetAll` | VERIFIED | `removeSecret` imported from `'../../services/stronghold'` (line 31); called as `await removeSecret('jira-pat').catch(() => {})` (line 79) and `await removeSecret('gitlab-pat').catch(() => {})` (line 80) |
| `settings.store.ts` | `settings.json` | persist middleware auto-save on `set()` | VERIFIED | Store wrapped in `persist(...)` with `storage: createTauriStorage('settings.json')` (lines 337–339); every action including `resetSettings` calls the Zustand `set()` function which triggers persist auto-save |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| — | None found | — | No TBD/FIXME/XXX markers; no replace:true; no toast imports; no stub returns; no placeholder text; no hardcoded empty props at call sites |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit tests pass (reset actions, auth reset, action survival) | `cd taskflow && npm run test -- settings.store` | 59/59 passed | PASS |
| TypeScript compilation clean | `cd taskflow && npx tsc --noEmit` | No output (zero errors) | PASS |

### Probe Execution

Step 7c: SKIPPED — no probe scripts declared in PLAN; this is a UI-only quick task with no `scripts/*/tests/probe-*.sh` convention applicable.

### Human Verification Required

#### 1. Three Reset Rows Visible in Settings > Advanced

**Test:** Open the running app, navigate to Settings > Advanced, scroll to bottom.
**Expected:** Three rows appear: "Reset onboarding wizard", "Reset preferences", "Reset all" — each with a Reset button on the right side.
**Why human:** JSX structure verified in source but visual rendering (CSS, layout, devToolsEnabled gate if any) requires a live app.

#### 2. Reset Onboarding Wizard Re-Runs Wizard Reactively

**Test:** Confirm "Reset onboarding wizard" dialog. Without closing/restarting the app, observe the screen.
**Expected:** The setup wizard appears immediately (onboarding gate in main.tsx at line 501 reads `onboardingComplete` reactively from the store).
**Why human:** React reactive re-render from store state change cannot be asserted via grep.

#### 3. Reset Preferences Scope Is Correct at Runtime

**Test:** Change theme/density, set a custom Jira field key, then confirm "Reset preferences". Inspect Settings values after.
**Expected:** Theme/density revert to defaults; the custom field key is unchanged; Jira/GitLab connection state unchanged.
**Why human:** Runtime state and persisted-file contents confirm scope behaviour beyond unit test coverage.

#### 4. Reset All Removes PATs from Stronghold Vault

**Test:** Connect Jira/GitLab (so PATs are stored), then confirm "Reset all". Re-open Settings > Integrations.
**Expected:** Both integrations show as disconnected; attempting to use Jira/GitLab API calls fails (tokens gone from vault).
**Why human:** Stronghold vault operations are Tauri-native and can only be confirmed with a running app and an actual vault.

## Gaps Summary

No automated gaps found. All 6 truths are VERIFIED by code evidence. The `human_needed` status reflects four runtime/visual checks that require a live Tauri app — they are not blockers to deployment confidence but are expected smoke tests after any settings-UI change.

---

_Verified: 2026-05-24T18:50:00Z_
_Verifier: Claude (gsd-verifier)_
