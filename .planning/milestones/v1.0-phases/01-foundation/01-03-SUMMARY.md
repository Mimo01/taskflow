---
phase: 01-foundation
plan: 03
subsystem: ui
tags: [react, shadcn, zustand, tanstack-query, stronghold, tauri-store, tailwind, vitest, tdd, settings, onboarding]

# Dependency graph
requires:
  - 01-01 (Tauri scaffold, stronghold service, settings store, theme service, createHashRouter routing)
  - 01-02 (jira.ts, gitlab.ts, OnboardingWizard shell, WelcomeStep, JiraStep, GitLabStep, shadcn init)
provides:
  - RoleStep — RadioGroup role picker (Developer/PM); writes to onboarding + settings stores
  - DoneStep — confirmation screen; marks onboardingComplete in settings store; navigates to /dashboard
  - Settings page shell — three sections: Credentials (TokenSection), Role (RoleSection), Appearance (ThemeSection)
  - TokenSection — masked token display, eye-toggle reveal via Stronghold readSecret, Update Token mutation with same error strings as onboarding
  - RoleSection — settings-bound RadioGroup; immediate role switch without save button
  - ThemeSection — three-way Light/Dark/System segmented control calling applyTheme + saveTheme
  - ThemeToggle — compact sidebar icon cycling through themes on click
  - Sidebar — vertical layout with Dashboard nav, role label, ThemeToggle, and gear icon linking to /settings
  - AppLayout — wraps post-onboarding routes with Sidebar + ReAuthBanner; no sidebar during onboarding
  - settings.store.ts — onboardingComplete boolean + setOnboardingComplete action added
  - Complete 5-step onboarding wizard: Welcome → Jira → GitLab → Role → Done
  - Phase 1 feature-complete
affects:
  - Phase 2+ (dashboard routes use AppLayout/Sidebar; role-based nav added in Phase 2)

# Tech tracking
tech-stack:
  added:
    - shadcn/ui radio-group component
    - shadcn/ui tabs component
  patterns:
    - Token masking: always render type="password" value="••••••••" on initial render; readSecret() only on explicit eye-toggle click — token never in Zustand
    - Update Token mutation: validateJira/validateGitLab → storeSecret on success (same pattern as onboarding)
    - Theme toggle: applyTheme() first (instant DOM update) then saveTheme() (async persistence) — both on every click
    - AppLayout pattern: Outlet-based layout component; sidebar rendered only after onboardingComplete
    - loadTheme() called before createRoot().render() — prevents flash of wrong theme

key-files:
  created:
    - taskflow/src/routes/onboarding/RoleStep.tsx
    - taskflow/src/routes/onboarding/DoneStep.tsx
    - taskflow/src/routes/settings/Settings.tsx
    - taskflow/src/routes/settings/TokenSection.tsx
    - taskflow/src/routes/settings/RoleSection.tsx
    - taskflow/src/routes/settings/ThemeSection.tsx
    - taskflow/src/components/app/Sidebar.tsx
    - taskflow/src/components/app/ThemeToggle.tsx
    - taskflow/src/components/ui/radio-group.tsx
    - taskflow/src/components/ui/tabs.tsx
    - taskflow/src/routes/onboarding/RoleStep.test.tsx (filled in from stubs)
    - taskflow/src/routes/settings/Settings.test.tsx (filled in from stubs)
  modified:
    - taskflow/src/routes/settings/index.tsx (render Settings component instead of placeholder)
    - taskflow/src/stores/settings.store.ts (added onboardingComplete + setOnboardingComplete)
    - taskflow/src/components/app/OnboardingWizard.tsx (replaced placeholder steps with real RoleStep and DoneStep)
    - taskflow/src/main.tsx (added AppLayout with Sidebar, imports cleanup)

key-decisions:
  - "Settings page uses sections layout (not tabs) — three dividers for Credentials/Role/Appearance; simpler and sufficient for 3 sections"
  - "Sidebar is vertical (not top bar) — vertical layout scales better for Phase 2 role-based nav expansion"
  - "ThemeToggle placed in sidebar bottom — always accessible, collocated with Settings gear icon"
  - "Token reveal uses local component state (never Zustand) — security boundary; if component unmounts, token evaporates"
  - "Tauri Store key names: settings.json (theme, role, onboardingComplete via Zustand persist middleware)"
  - "AppLayout uses onboardingComplete from settings store as proxy for post-onboarding layout; sidebar hidden during wizard"

patterns-established:
  - "Pattern: Token masking — render masked placeholder on mount; readSecret() only on explicit eye click; revealed value in local state only"
  - "Pattern: Theme apply-then-save — applyTheme() synchronous DOM update first for instant feedback; saveTheme() async persistence second"
  - "Pattern: AppLayout outlet wrapping — post-onboarding layout (sidebar, banner) provided via React Router Outlet; no props threading"

requirements-completed:
  - ROLE-01
  - ROLE-02
  - AUTH-05
  - UI-01

# Metrics
duration: 15min
completed: 2026-03-11
---

# Phase 1 Plan 03: Role Picker, Settings Page, and App Shell Summary

**Complete 5-step onboarding wizard (Role + Done steps), full Settings page with masked token management, three-way theme toggle, and vertical sidebar with persistent gear-icon Settings access**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-11T09:33:00Z
- **Completed:** 2026-03-11T09:38:00Z
- **Tasks:** 2 (Task 1: TDD RoleStep + Settings; Task 2: ThemeSection + Sidebar + app shell)
- **Files modified:** 12 created, 4 modified

## Accomplishments

- Complete 5-step onboarding wizard: Welcome → Jira → GitLab → Role → Done (all steps real, no placeholders)
- Full Settings page with three sections — Credentials (masked tokens + Update Token flow), Role (immediate radio switch), Appearance (Light/Dark/System)
- Token masking enforced: tokens never rendered as plaintext by default; eye-toggle reads from Stronghold on demand
- Sidebar with ThemeToggle and persistent gear icon to /settings, hidden during onboarding
- All 42 Phase 1 tests green; suite grew from 29 (Plan 02) to 42 tests

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing RoleStep and Settings tests** — `1454fa6` (test)
2. **Task 1 GREEN: RoleStep, DoneStep, Settings page with token masking and role section** — `e0affcc` (feat)
3. **Task 2: ThemeSection, Sidebar with gear icon, and app shell layout wiring** — `6a98a2f` (feat)

## shadcn/ui Components Added

```bash
npx shadcn@latest add radio-group tabs --yes
```

- `radio-group` — used by RoleStep and RoleSection
- `tabs` — installed for future use (Settings uses sections layout instead)

## Settings Page Layout Decision

Used **sections layout** (not tabs). Three dividers separate: Credentials / Role / Appearance. Tabs were available via the installed component but unnecessary for 3 sections — a simple scrollable page with visual dividers is clearer and requires fewer clicks.

## Sidebar Layout Decision

**Vertical sidebar** on the left edge. Rationale: scales naturally for Phase 2 role-based nav expansion (more items stack vertically). The sidebar is responsive: shows full labels on `md:` and icon-only on mobile. App name at top, Dashboard nav in middle, ThemeToggle + Settings gear at bottom.

## ThemeToggle Placement

**In the sidebar bottom section**, collocated with the Settings gear icon. Both theme control and settings access are always one click away from anywhere in the app.

## Tauri Store Key Names

- `settings.json` — Zustand persist adapter; stores `role`, `theme`, `onboardingComplete` under key `settings-store`
- `stronghold-meta.json` — vault password (from Plan 01)
- Stronghold keys: `jira-pat`, `gitlab-pat`

## Vitest Run Output

```
Test Files  7 passed (7)
     Tests  42 passed (42)
  Start at  09:37:33
  Duration  5.18s
```

All 42 active tests pass (zero todos remaining in Phase 1 test files).

## Phase 1 Requirements Verification

| Req ID | Description | Implemented |
|--------|-------------|-------------|
| AUTH-01 | Jira PAT stored in Stronghold, never Zustand | Plan 01 + 02 |
| AUTH-02 | GitLab PAT stored in Stronghold, never Zustand | Plan 01 + 02 |
| AUTH-03 | Stronghold vault with argon2 salt | Plan 01 |
| AUTH-04 | Inline project/group selection after validation | Plan 02 |
| AUTH-05 | Token masking with eye-toggle reveal + Update Token | **Plan 03** |
| AUTH-06 | Exact error messages for 401/403/network | Plan 02 |
| ROLE-01 | Role picker in onboarding wizard | **Plan 03** |
| ROLE-02 | Role switch in Settings without re-running onboarding | **Plan 03** |
| UI-01 | Tauri 2 desktop app with Tailwind + shadcn + createHashRouter | Plan 01 |

All 9 Phase 1 requirements (AUTH-01..06, ROLE-01, ROLE-02, UI-01) are verifiably implemented.

## Files Created/Modified

- `taskflow/src/routes/onboarding/RoleStep.tsx` — RadioGroup Developer/PM; writes to onboarding + settings stores
- `taskflow/src/routes/onboarding/DoneStep.tsx` — confirmation screen; setOnboardingComplete(true); navigate /dashboard
- `taskflow/src/routes/settings/Settings.tsx` — sections layout shell rendering TokenSection, RoleSection, ThemeSection
- `taskflow/src/routes/settings/TokenSection.tsx` — masked token, eye-toggle Stronghold reveal, Update Token mutation
- `taskflow/src/routes/settings/RoleSection.tsx` — settings RadioGroup; immediate write to useSettingsStore().setRole
- `taskflow/src/routes/settings/ThemeSection.tsx` — three-way toggle; applyTheme + saveTheme on click
- `taskflow/src/components/app/Sidebar.tsx` — vertical sidebar; Dashboard nav + ThemeToggle + Settings gear
- `taskflow/src/components/app/ThemeToggle.tsx` — compact Sun/Moon/Monitor cycling icon button
- `taskflow/src/components/ui/radio-group.tsx` — shadcn RadioGroup component
- `taskflow/src/components/ui/tabs.tsx` — shadcn Tabs component
- `taskflow/src/routes/onboarding/RoleStep.test.tsx` — 7 tests (role selection, Continue disabled/enabled, store writes)
- `taskflow/src/routes/settings/Settings.test.tsx` — 6 tests (token masking, eye-toggle, Update Token, role switch)
- `taskflow/src/routes/settings/index.tsx` — updated to render Settings component
- `taskflow/src/stores/settings.store.ts` — added onboardingComplete + setOnboardingComplete
- `taskflow/src/components/app/OnboardingWizard.tsx` — replaced placeholder steps with real RoleStep + DoneStep
- `taskflow/src/main.tsx` — AppLayout with Sidebar + ReAuthBanner; Outlet-based post-onboarding layout

## Decisions Made

- **Sections over tabs for Settings:** 3 sections don't warrant tab navigation; simpler scrollable layout is clearer
- **Vertical sidebar:** Scales better for Phase 2 role-based nav expansion
- **ThemeToggle in sidebar:** Collocated with Settings for one-click access from anywhere
- **Token in local state only:** Revealed token from Stronghold stored in component-local state — evaporates on unmount, never touches Zustand
- **onboardingComplete as layout proxy:** AppLayout reads settings store's onboardingComplete to decide whether to show sidebar

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `await` inside non-async function in Settings.test.tsx**
- **Found during:** Task 1 RED phase (test compilation)
- **Issue:** `const { readSecret } = vi.mocked(await import(...))` inside a non-async `it()` callback caused esbuild to reject the file
- **Fix:** Made the test callback `async` and used `vi.mocked()` wrapper correctly
- **Files modified:** `src/routes/settings/Settings.test.tsx`
- **Verification:** Tests compiled and ran; 6/6 Settings tests pass

**2. [Rule 1 - Bug] Fixed Update Token test — button disabled when input empty**
- **Found during:** Task 1 GREEN phase (test run)
- **Issue:** Test clicked "Update Token" without filling the new token input; button is correctly disabled when input is empty so storeSecret was never called
- **Fix:** Added `fireEvent.change(newTokenInputs[0], { target: { value: 'new-jira-token-value' } })` before clicking Update Token
- **Files modified:** `src/routes/settings/Settings.test.tsx`
- **Verification:** All 6 Settings tests pass

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs in test file)
**Impact on plan:** Both fixes were test-side corrections, not implementation changes. No scope creep.

## Issues Encountered

None — implementation proceeded as planned. Tests needed minor fixes in the test file itself (not the components).

## User Setup Required

None — no external service configuration required for this plan.

## Next Phase Readiness

- Phase 1 is feature-complete: 5-step wizard, Stronghold PAT storage, Settings page, sidebar with gear icon, theme toggle
- All 42 Phase 1 tests pass
- Phase 2 (dashboard + polling) can import `useSettingsStore().role` for role-based conditional rendering
- `Sidebar.tsx` has a role label placeholder; Phase 2 should add role-conditional nav items there
- `AppLayout` wraps all post-onboarding routes — Phase 2 dashboard routes get sidebar automatically
- Known blocker carried forward: Jira Bearer vs Basic auth format needs live instance validation before Phase 2 writes the polling interceptor

## Self-Check: PASSED

All 16 key files confirmed present. All 3 task commits verified (1454fa6, e0affcc, 6a98a2f).

---
*Phase: 01-foundation*
*Completed: 2026-03-11*
