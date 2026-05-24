---
phase: quick-260524-pqo
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/stores/settings.store.ts
  - taskflow/src/stores/auth.store.ts
  - taskflow/src/stores/settings.store.test.ts
  - taskflow/src/routes/settings/DebugModeSection.tsx
autonomous: true
requirements: [PQO-RESET-01, PQO-RESET-02, PQO-RESET-03]
user_setup: []

must_haves:
  truths:
    - "User sees three reset action rows in Settings > Advanced (Reset onboarding wizard, Reset preferences, Reset all)"
    - "Each reset row opens its own confirm dialog listing affected categories with Cancel/Reset buttons"
    - "Reset onboarding wizard sets onboardingComplete=false so the wizard re-runs without app restart"
    - "Reset preferences restores appearance/notifications/workflow/sidebar/integrations/updates defaults while keeping onboardingComplete and the seven custom field keys intact"
    - "Reset all restores every settings-store data field to defaults, resets auth-store connection/identity fields, and removes jira-pat + gitlab-pat from Stronghold"
    - "Store action functions (setTheme, setDensity, etc.) remain callable after any reset (merge-mode, not replace)"
  artifacts:
    - path: "taskflow/src/stores/settings.store.ts"
      provides: "initialSettings const + resetSettings(scope) action"
      contains: "resetSettings"
    - path: "taskflow/src/stores/auth.store.ts"
      provides: "initialAuthState const + resetAuth() action"
      contains: "resetAuth"
    - path: "taskflow/src/stores/settings.store.test.ts"
      provides: "Unit tests for resetSettings preferences/all scopes"
      contains: "resetSettings"
    - path: "taskflow/src/routes/settings/DebugModeSection.tsx"
      provides: "Three reset action rows with confirm dialogs"
      contains: "Reset all"
  key_links:
    - from: "taskflow/src/routes/settings/DebugModeSection.tsx"
      to: "useSettingsStore.resetSettings"
      via: "store action call inside dialog confirm handler"
      pattern: "resetSettings\\('(preferences|all)'\\)"
    - from: "taskflow/src/routes/settings/DebugModeSection.tsx"
      to: "removeSecret"
      via: "Stronghold credential wipe in handleResetAll"
      pattern: "removeSecret\\('(jira|gitlab)-pat'\\)"
    - from: "taskflow/src/stores/settings.store.ts"
      to: "settings.json"
      via: "persist middleware auto-save on set()"
      pattern: "set\\("
---

<objective>
Add three scoped reset actions to Settings > Advanced (inside `DebugModeSection.tsx`): "Reset onboarding wizard", "Reset preferences", and "Reset all". Each opens its own confirm dialog listing the affected categories before firing.

Purpose: Give the user a self-service way to restore defaults or fully wipe local config without manually editing settings.json/auth.json or deleting the vault.

Output:
- `initialSettings` const + `resetSettings(scope)` action in settings.store
- `initialAuthState` const + `resetAuth()` action in auth.store
- Unit tests covering both reset scopes (preferences keeps field keys, all wipes everything; actions survive)
- Three confirm-dialog reset rows in DebugModeSection, reusing the existing Clear-notification-cache dialog pattern
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/mimo/Documents/Projects/taskflow/.planning/quick/260524-pqo-i-want-to-add-a-reset-all-button-to-sett/260524-pqo-CONTEXT.md
@/Users/mimo/Documents/Projects/taskflow/.planning/quick/260524-pqo-i-want-to-add-a-reset-all-button-to-sett/260524-pqo-RESEARCH.md

<interfaces>
<!-- Contracts extracted from the codebase. Use these directly — no exploration needed. -->

settings.store.ts — current structure (src/stores/settings.store.ts):
- `export const useSettingsStore = create<SettingsState>()(persist((set) => ({ <data fields>, <action functions> }), { name:'settings-store', storage: createTauriStorage('settings.json'), version: 22, migrate }))`
- Defaults are INLINED in the factory today (no const). The DATA fields (with their default values) are:
  theme:'system', onboardingComplete:false, staleMrThresholdDays:3, notificationPollIntervalSecs:60,
  osNotifJiraEnabled:true, osNotifGitlabEnabled:true, storyPointsFieldKey:'customfield_10016',
  epicLinkFieldKey:'customfield_10014', epicNameFieldKey:'customfield_10015', sprintFieldKey:'customfield_10020',
  epicColorFieldKey:'customfield_10013', flaggedFieldKey:'customfield_10021', accountFieldKey:null,
  devToolsEnabled:false, requestLogging:false, responseBodyCapture:false, operationProfiling:false,
  performanceWaterfall:false, retentionLimit:200, jiraConcurrencyLimit:6, density:'default', sprintCollapseByDefault:false,
  showSubtasksInMyTasks:true, keyboardOverrides:{}, commentSortOrder:'newest', updateCheckInterval:6,
  lastSeenVersion:null, lastSeenChangelog:null, lastChecked:null, sidebarCollapsed:false, sidebarWidth:224,
  issueDetailPanelWidth:null, mrDetailPanelWidth:288, releaseDetailPanelWidth:288, aioEnabled:false, tempoEnabled:false,
  selectedAioProjectKey:null, quickFilters:[], (all 9 notif* booleans):true,
  sidebarItems: getDefaultSidebarItems()
- The SEVEN custom field keys to PRESERVE under 'preferences': storyPointsFieldKey, epicLinkFieldKey,
  epicNameFieldKey, sprintFieldKey, epicColorFieldKey, flaggedFieldKey, accountFieldKey
- Action functions (DO NOT include in initialSettings; they are defined inline and must survive a reset):
  setTheme, setOnboardingComplete, setDensity, ... ~50 set* functions.
- NOTE: `setJiraConcurrencyLimit` also calls `setConcurrencyRuntime(v)` as a side effect. A pure set() reset of
  jiraConcurrencyLimit will NOT re-sync the runtime limiter. This is acceptable (limiter re-reads on next call);
  do NOT add side-effect calls inside resetSettings.

auth.store.ts — current structure (src/stores/auth.store.ts):
- DATA fields (defaults): jiraConnected:false, gitlabConnected:false, jiraBaseUrl:null, gitlabBaseUrl:null,
  activeJiraProject:null, activeGitlabProject:null, activeGitlabProjectPath:null, jiraUserDisplayName:null,
  jiraUsername:null, jiraUserKey:null, gitlabUserId:null, gitlabUsername:null
- TRANSIENT field: `_hasHydrated:boolean` — NOT persisted (partialize strips it), and MUST NOT be reset to false
  (resetting it could re-trigger loading states). Exclude `_hasHydrated` from initialAuthState.
- Action functions to preserve: setJiraConnected, setGitlabConnected, setActiveJiraProject,
  setActiveGitlabProject, setJiraUser, setGitlabUserId, setGitlabUsername

stronghold.ts (src/services/stronghold.ts):
- `export async function removeSecret(key: string): Promise<void>` — keys are 'jira-pat' and 'gitlab-pat'.

dialog.tsx (src/components/ui/dialog.tsx) — exported family:
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
- Confirm-button quirk: the action runs via onClick on a <Button> rendered INSIDE <DialogClose>, so the click
  both fires the handler and closes the dialog. Match this exactly.

DebugModeSection.tsx (src/routes/settings/DebugModeSection.tsx):
- Already imports the full Dialog family + Button + useSettingsStore + lucide icons (Check, Trash2).
- Existing Clear-notification-cache dialog at lines 197–227 is the exact pattern to copy.
- Existing inline-success pattern: `const [cleared, setCleared] = useState(false)`; handler sets true then
  `setTimeout(() => setCleared(false), 3000)`. Reuse this style for reset success feedback (no toast lib exists).

onboarding gate (src/main.tsx:501): `if (!onboardingComplete) { <render wizard> }` reads reactively from
  useSettingsStore. Setting onboardingComplete=false re-runs the wizard with no navigate()/restart needed.

Test conventions (src/stores/settings.store.test.ts):
- Top of file mocks '@tauri-apps/plugin-store' LazyStore so no IPC. Keep that mock.
- Tests use `useSettingsStore.setState({...} as any)` to arrange and `useSettingsStore.getState()` to assert,
  wrapped in `act(...)` from @testing-library/react. Follow this exact style.
- Run: `npm run test -- settings.store`
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add reset actions to settings.store + auth.store with unit tests</name>
  <files>taskflow/src/stores/settings.store.ts, taskflow/src/stores/auth.store.ts, taskflow/src/stores/settings.store.test.ts</files>
  <behavior>
    - resetSettings('all') returns every settings DATA field to its default (theme='system', density='default', onboardingComplete=false, devToolsEnabled=false, retentionLimit=200, jiraConcurrencyLimit=6, quickFilters=[], all notif* = true, custom field keys back to their customfield_* defaults, etc.)
    - resetSettings('all') leaves action functions intact: typeof getState().setTheme === 'function' after reset
    - resetSettings('preferences') resets the same data fields BUT preserves the current value of onboardingComplete AND all seven custom field keys (storyPointsFieldKey, epicLinkFieldKey, epicNameFieldKey, sprintFieldKey, epicColorFieldKey, flaggedFieldKey, accountFieldKey)
    - resetAuth() returns all auth DATA fields to defaults (all null/false) and preserves _hasHydrated (does not set it to false) and preserves action functions
  </behavior>
  <action>In settings.store.ts, extract the inlined data-field defaults into a named const `initialSettings` declared ABOVE the create() call. Include ONLY data fields (the values listed in the interfaces block) — NOT any set* action functions, and NOT `sidebarItems` as a shared reference (use a fresh `getDefaultSidebarItems()` call so resets get a new array; in the const use `get sidebarItems()` is overkill — instead omit sidebarItems from the const and merge it explicitly in resetSettings via getDefaultSidebarItems()). Spread `...initialSettings` plus `sidebarItems: getDefaultSidebarItems()` into the factory's returned object to preserve current default behavior exactly. Add a `resetSettings: (scope: 'preferences' | 'all') => void` field to the SettingsState interface and implement it with the default `set` (merge mode — NEVER pass replace:true, per RESEARCH Pitfall 2): for scope 'all' set `{ ...initialSettings, sidebarItems: getDefaultSidebarItems() }`; for scope 'preferences' read current state `s` and return `{ ...initialSettings, sidebarItems: getDefaultSidebarItems(), onboardingComplete: s.onboardingComplete, storyPointsFieldKey: s.storyPointsFieldKey, epicLinkFieldKey: s.epicLinkFieldKey, epicNameFieldKey: s.epicNameFieldKey, sprintFieldKey: s.sprintFieldKey, epicColorFieldKey: s.epicColorFieldKey, flaggedFieldKey: s.flaggedFieldKey, accountFieldKey: s.accountFieldKey }`. Do NOT touch the `version` field or migrate (RESEARCH Pitfall 3 — in-memory set does not trigger migration). Do NOT add setConcurrencyRuntime side effects inside resetSettings. In auth.store.ts, mirror the approach: extract `initialAuthState` const containing only the twelve data fields (exclude `_hasHydrated` and all actions), spread it into the factory, and add a `resetAuth: () => void` to the AuthState interface implemented as `set({ ...initialAuthState })` (merge mode — _hasHydrated and actions are preserved by merge). In settings.store.test.ts, add a new describe block `settings.store — reset actions (quick 260524-pqo)` following the existing setState/getState/act conventions and the existing LazyStore mock. Cover the four behaviors above: arrange non-default values via setState, call the reset action via getState().resetSettings(scope)/resetAuth() inside act(), then assert defaults restored, preserved fields kept (preferences scope), and `typeof getState().setTheme === 'function'`. For auth assertions, import useAuthStore in the test (add the import; the plugin-store mock already covers auth.store's LazyStore).</action>
  <verify>
    <automated>cd taskflow && npm run test -- settings.store && npx tsc --noEmit</automated>
  </verify>
  <done>resetSettings('preferences') and resetSettings('all') exist on the settings store with correct scope behavior; resetAuth() exists on the auth store; new unit tests pass; tsc reports no type errors; action functions confirmed present after reset.</done>
</task>

<task type="auto">
  <name>Task 2: Wire three reset rows with confirm dialogs into DebugModeSection</name>
  <files>taskflow/src/routes/settings/DebugModeSection.tsx</files>
  <action>Add a new "Reset" subsection (a `<div className="flex flex-col gap-4">` with an `<h3>` heading "Reset" matching the existing uppercase muted-foreground heading style) below the existing "Data" / Clear-notification-cache block. Inside it, render three action rows, each structured exactly like the existing Clear-notification-cache row (label + description on the left, a `<Dialog>` with `<DialogTrigger render={<Button variant="outline" size="sm" className="shrink-0"/>}>` on the right, and `<DialogContent showCloseButton={false}>` with `<DialogHeader><DialogTitle/><DialogDescription/></DialogHeader>` + `<DialogFooter>` containing a `<DialogClose render={<Button variant="outline"/>}>Cancel</DialogClose>` and a `<DialogClose render={<Button variant="destructive" onClick={handler}/>}>Reset</DialogClose>`). Row 1 "Reset onboarding wizard": dialog lists that the setup wizard will re-run; confirm handler calls `setOnboardingComplete(false)` (pull `setOnboardingComplete` from the store). Row 2 "Reset preferences": dialog description lists affected categories — Appearance, Sidebar, Notifications, Workflow, Integrations, Updates — and states Jira/GitLab connection settings and custom field keys are kept; confirm handler calls `resetSettings('preferences')`. Row 3 "Reset all": dialog warns it wipes ALL preferences AND removes Jira/GitLab connection details and stored access tokens; confirm handler is an async `handleResetAll` that calls `useSettingsStore.getState().resetSettings('all')`, `useAuthStore.getState().resetAuth()`, then `await removeSecret('jira-pat').catch(() => {})` and `await removeSecret('gitlab-pat').catch(() => {})`. Add imports: `useAuthStore` from '../../stores/auth.store' and `removeSecret` from '../../services/stronghold'. Pull `resetSettings` and `setOnboardingComplete` via `useSettingsStore((s) => s.resetSettings)` / `useSettingsStore((s) => s.setOnboardingComplete)` selectors (matching the file's existing selector style). For success feedback, reuse the inline pattern: add a `const [resetDone, setResetDone] = useState<null | 'wizard' | 'preferences' | 'all'>(null)` and after each handler set it then `setTimeout(() => setResetDone(null), 3000)`; show a small emerald Check + "Done" inline on the affected row when matched (mirror the existing `cleared` rendering). Do NOT add a toast library. Do NOT call any LazyStore.save() manually (persist auto-saves).</action>
  <verify>
    <automated>cd taskflow && npx tsc --noEmit && npm run lint 2>&1 | tail -5 && npm run build 2>&1 | tail -5</automated>
  </verify>
  <done>Settings > Advanced shows three reset rows each with its own confirm dialog; tsc + lint clean; `npm run build` succeeds (build guard per Phase 59 decision — tsc alone misses CSS import failures).</done>
</task>

</tasks>

<verification>
- `cd taskflow && npm run test -- settings.store` — reset unit tests pass (both scopes + auth + actions-survive)
- `cd taskflow && npm run build` — full build succeeds (catches CSS/import failures tsc misses)
- Manual smoke (human, optional): Settings > Advanced shows three reset rows; "Reset onboarding wizard" re-runs the wizard immediately without restart; "Reset preferences" keeps connection/field-key config; "Reset all" disconnects integrations and clears tokens.
</verification>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user → local stores/vault | User triggers destructive resets of locally-persisted config and the encrypted Stronghold vault |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-pqo-01 | Tampering | resetSettings/resetAuth via setState replace mode | mitigate | Use merge-mode set() only (never replace:true) so action functions survive — enforced by Task 1 test asserting typeof setTheme === 'function' |
| T-pqo-02 | Denial of Service | accidental "Reset all" wiping credentials | mitigate | Each reset gated behind its own confirm dialog listing affected categories with explicit Cancel; destructive variant button per existing pattern |
| T-pqo-03 | Information Disclosure | Stronghold token removal failure leaving stale PAT | accept | removeSecret wrapped in .catch(() => {}) tolerates a missing key; a leftover token is low risk (vault is encrypted, app is local dev tooling) and is overwritten on next connect |
| T-pqo-SC | Tampering | npm/pip/cargo installs | mitigate | No new packages installed — all APIs (zustand, Base UI Dialog, stronghold.ts) already present; no supply-chain surface added |
</threat_model>

<success_criteria>
- Three reset actions (onboarding wizard, preferences, all) appear in Settings > Advanced, each behind its own confirm dialog (CONTEXT locked decision)
- resetSettings('preferences') keeps onboardingComplete + the seven custom field keys; resetSettings('all') restores all defaults (RESEARCH scope mapping)
- "Reset all" additionally resets auth.store connection/identity fields and removes jira-pat + gitlab-pat from Stronghold (RESEARCH Pitfall 1 correction — credentials are NOT in settings.store)
- All reset actions use Zustand merge-mode set() so action functions survive (RESEARCH Pitfall 2)
- No toast dependency introduced; inline success feedback only (RESEARCH Pitfall 4)
- No manual LazyStore flush (RESEARCH persist auto-save)
- `npm run test -- settings.store` and `npm run build` both pass
</success_criteria>

<output>
Create `.planning/quick/260524-pqo-i-want-to-add-a-reset-all-button-to-sett/260524-pqo-SUMMARY.md` when done
</output>
