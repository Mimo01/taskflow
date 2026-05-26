# Phase 66: Roles Removal - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Delete the Developer/PM role concept end-to-end: remove the Role step from the onboarding wizard, delete the unused RoleSection and dead-code PresetButtons from settings, strip the `role` field from both `useSettingsStore` and `useOnboardingStore` (with v22 migration), remove `applyPreset` and preset exports from `sidebar-items.ts`, and make all sidebar items visible by default for both new installs and existing users post-migration.

No new UI surfaces. No behavior changes except deletion. Success = the codebase has no `role` field, no `applyPreset`, no preset UI, no wizard role step.

</domain>

<decisions>
## Implementation Decisions

### ROLES-01: Onboarding Wizard
- **D-01:** Remove `RoleStep` from `STEP_COMPONENTS` and `STEP_LABELS` in `OnboardingWizard.tsx`. Wizard shrinks from 5→4 steps: `['Welcome', 'Jira', 'GitLab', 'Done']`.
- **D-02:** Remove the `role` field from `onboarding.store.ts` entirely (drop from type + initial state). No migration needed — onboarding store is in-memory only.
- **D-03:** `completedSteps` in `OnboardingWizard.tsx` tracks only `jiraValidated` (push step 1) + `gitlabValidated` (push step 2). Do not add tracking for Done (step 3).
- **D-04:** Delete `taskflow/src/routes/onboarding/RoleStep.tsx` after removing it from the wizard.

### ROLES-02 + ROLES-03: Settings UI
- **D-05:** `RoleSection.tsx` is not imported or rendered anywhere in `Settings.tsx` — it is dead code. Delete the file.
- **D-06:** Remove `PresetButtons` from `SidebarSection.tsx` (line 21 import + usage) and from `AppearanceSection.tsx` (line 65 import + usage).
- **D-07:** Delete `taskflow/src/routes/settings/PresetButtons.tsx` after removing all usages.

### ROLES-04: Settings Store Migration
- **D-08:** Bump `useSettingsStore` from version 21 → 22. Migration v22 drops the `role` field AND resets `sidebarItems` to all-visible (all 9 items, `visible: true`).
- **D-09:** Remove the `role` field from the store state type, initial state, `setRole` action, and any related TypeScript types in `settings.store.ts`.
- **D-10:** Remove `applyPreset` from the store state type and implementation. All callers (`RoleStep`, `RoleSection`) are being deleted — function has no remaining callers after this phase.

### ROLES-05: Role-Gated Rendering
- **D-11:** Full codebase audit (all `.tsx`/`.ts` in `src/`) confirmed zero role-gated conditionals outside the files being deleted. ROLES-05 is pre-satisfied. The plan should verify with `grep -r "role" taskflow/src/components taskflow/src/routes` after deletion to confirm the success criterion.

### ROLES-06: Sidebar Defaults
- **D-12:** `getDefaultSidebarItems` in `sidebar-items.ts` becomes a no-arg function returning all 9 items with `visible: true`. Drop the `preset: 'dev' | 'pm'` parameter, `devVisible`/`pmVisible` sets, and conditional logic.
- **D-13:** Remove `DEV_SIDEBAR_PRESET` and `PM_SIDEBAR_PRESET` exported constants. Update any tests that reference them to use the new all-visible default.
- **D-14:** New installs (no persisted state) also get all 9 items visible — the store's initial state `sidebarItems: getDefaultSidebarItems()` handles this automatically once the function is updated.

### Claude's Discretion
- Order of deletion vs. migration within each plan: researcher/planner should determine the safest commit ordering (e.g., remove UI callers before removing store actions) to avoid TypeScript errors mid-plan.
- Whether `RoleSection.tsx` and `PresetButtons.tsx` are deleted as standalone commits or as part of larger plan commits — either is fine.
- The historic migration entry `v < 9` in `settings.store.ts` that references `s.role` should be left intact (it's persisted migration history — do NOT alter it).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Roles Removal (ROLES-01 through ROLES-06) — exact acceptance criteria and success criteria for each requirement

### Source files to modify
- `taskflow/src/components/app/OnboardingWizard.tsx` — ROLES-01: remove RoleStep from STEP_LABELS + STEP_COMPONENTS, remove `role` from completedSteps logic
- `taskflow/src/stores/onboarding.store.ts` — ROLES-01: remove `role` field from type and initial state
- `taskflow/src/routes/onboarding/RoleStep.tsx` — DELETE (ROLES-01)
- `taskflow/src/routes/settings/RoleSection.tsx` — DELETE (ROLES-02, dead code)
- `taskflow/src/routes/settings/PresetButtons.tsx` — DELETE (ROLES-03, after removing usages)
- `taskflow/src/routes/settings/SidebarSection.tsx` — ROLES-03: remove PresetButtons import + usage (line 8 import, line 21 usage)
- `taskflow/src/routes/settings/AppearanceSection.tsx` — ROLES-03: remove PresetButtons import + usage (line 14 import, line 65 usage)
- `taskflow/src/stores/settings.store.ts` — ROLES-04: bump to v22, drop `role` field + `setRole` action + `applyPreset` action, migration resets sidebarItems to all-visible
- `taskflow/src/components/app/sidebar-items.ts` — ROLES-06: `getDefaultSidebarItems` becomes no-arg all-visible, remove DEV_SIDEBAR_PRESET + PM_SIDEBAR_PRESET

### Prior state reference
- `.planning/STATE.md` — notes verify with `npm run build` (not just `tsc`)
- Phase 59 decision: `settings.store.ts` hard-imports `registry.ts` — deletion must be atomic

</canonical_refs>

<code_context>
## Existing Code Insights

### Files Being Deleted
- `RoleStep.tsx` — 5-step wizard step; deleting collapses wizard to 4 steps
- `RoleSection.tsx` — Settings role picker; NOT currently imported in Settings.tsx (dead code)
- `PresetButtons.tsx` — Dev/PM preset buttons; used in SidebarSection + AppearanceSection

### Established Patterns
- Settings store migrations: each version bump adds an `if (version < N)` block in the `migrate` function. The v22 block should: delete `s.role` and reset `s.sidebarItems` to the new all-visible default.
- Historic migration v9 references `s.role` — leave that block unchanged (persisted history).
- `getDefaultSidebarItems` is called in the store's initial state (`sidebarItems: getDefaultSidebarItems('dev')`); after removing the preset param, update the call site too.
- Build verification: `npm run build` required (catches CSS/import issues `tsc` misses — per Phase 59 state note).

### Integration Points
- `useOnboardingStore().role` is only read by `OnboardingWizard.tsx` for `completedSteps` — remove that reference when removing the field.
- `DEV_SIDEBAR_PRESET` / `PM_SIDEBAR_PRESET` may be referenced in test files — researcher should confirm before deletion.
- `applyPreset` migration call in v9: `s.sidebarItems = getDefaultSidebarItems(preset)` — this is inside the migrate function historical block; leave as-is (it runs for users upgrading from very old versions).

</code_context>

<specifics>
## Specific Ideas

- The v22 migration resets `sidebarItems` to all-visible even for existing users — this is intentional to provide a clean post-role-removal state. Existing sidebar customizations are reset.
- ROLES-05 is pre-satisfied: full audit of `src/components/` and `src/routes/` confirmed zero role-gated conditionals. The plan should include a verification grep as the final check.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 66-Roles Removal*
*Context gathered: 2026-05-24*
