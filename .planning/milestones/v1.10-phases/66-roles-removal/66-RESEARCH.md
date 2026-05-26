# Phase 66: Roles Removal - Research

**Researched:** 2026-05-24
**Domain:** TypeScript/React codebase deletion — Zustand store migration, wizard step removal, dead-code cleanup
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**ROLES-01: Onboarding Wizard**
- D-01: Remove `RoleStep` from `STEP_COMPONENTS` and `STEP_LABELS` in `OnboardingWizard.tsx`. Wizard shrinks from 5→4 steps: `['Welcome', 'Jira', 'GitLab', 'Done']`.
- D-02: Remove the `role` field from `onboarding.store.ts` entirely (drop from type + initial state). No migration needed — onboarding store is in-memory only.
- D-03: `completedSteps` in `OnboardingWizard.tsx` tracks only `jiraValidated` (push step 1) + `gitlabValidated` (push step 2). Do not add tracking for Done (step 3).
- D-04: Delete `taskflow/src/routes/onboarding/RoleStep.tsx` after removing it from the wizard.

**ROLES-02 + ROLES-03: Settings UI**
- D-05: `RoleSection.tsx` is not imported or rendered anywhere in `Settings.tsx` — it is dead code. Delete the file.
- D-06: Remove `PresetButtons` from `SidebarSection.tsx` (line 21 import + usage) and from `AppearanceSection.tsx` (line 65 import + usage).
- D-07: Delete `taskflow/src/routes/settings/PresetButtons.tsx` after removing all usages.

**ROLES-04: Settings Store Migration**
- D-08: Bump `useSettingsStore` from version 21 → 22. Migration v22 drops the `role` field AND resets `sidebarItems` to all-visible (all 9 items, `visible: true`).
- D-09: Remove the `role` field from the store state type, initial state, `setRole` action, and any related TypeScript types in `settings.store.ts`.
- D-10: Remove `applyPreset` from the store state type and implementation. All callers (`RoleStep`, `RoleSection`) are being deleted — function has no remaining callers after this phase.

**ROLES-05: Role-Gated Rendering**
- D-11: Full codebase audit confirmed zero role-gated conditionals outside the files being deleted. ROLES-05 is pre-satisfied. The plan should verify with `grep -r "role" taskflow/src/components taskflow/src/routes` after deletion to confirm the success criterion.

**ROLES-06: Sidebar Defaults**
- D-12: `getDefaultSidebarItems` in `sidebar-items.ts` becomes a no-arg function returning all 9 items with `visible: true`. Drop the `preset: 'dev' | 'pm'` parameter, `devVisible`/`pmVisible` sets, and conditional logic.
- D-13: Remove `DEV_SIDEBAR_PRESET` and `PM_SIDEBAR_PRESET` exported constants. Update any tests that reference them to use the new all-visible default.
- D-14: New installs (no persisted state) also get all 9 items visible — the store's initial state `sidebarItems: getDefaultSidebarItems()` handles this automatically once the function is updated.

### Claude's Discretion
- Order of deletion vs. migration within each plan: researcher/planner should determine the safest commit ordering (e.g., remove UI callers before removing store actions) to avoid TypeScript errors mid-plan.
- Whether `RoleSection.tsx` and `PresetButtons.tsx` are deleted as standalone commits or as part of larger plan commits — either is fine.
- The historic migration entry `v < 9` in `settings.store.ts` that references `s.role` should be left intact (it's persisted migration history — do NOT alter it).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROLES-01 | Remove role selection step from startup wizard | OnboardingWizard.tsx line-precise changes identified; RoleStep.tsx confirmed for deletion; onboarding.store.ts role field fully mapped |
| ROLES-02 | Remove role toggle from Settings | RoleSection.tsx confirmed dead code (not imported in Settings.tsx); safe to delete file directly |
| ROLES-03 | Remove Dev/PM preset buttons from Sidebar settings | PresetButtons.tsx usages mapped: SidebarSection.tsx line 8+21, AppearanceSection.tsx line 14+65 |
| ROLES-04 | Remove `role` field from `useSettingsStore` with version bump migration | Full migration chain mapped v1→v22; v22 block pattern confirmed; `role` in initial state line 182 and type line 25 identified |
| ROLES-05 | Strip role-gated rendering across all components | Audit complete — zero role-gated conditionals outside files being deleted; verification grep plan confirmed |
| ROLES-06 | Make every sidebar nav item + dashboard surface accessible to all users by default | `getDefaultSidebarItems` signature change fully specified; DEV_SIDEBAR_PRESET + PM_SIDEBAR_PRESET removal mapped; test update required |
</phase_requirements>

---

## Summary

Phase 66 is a pure deletion phase — no new UI surfaces, no new behavior, no new libraries. Every change is a removal: delete files, strip fields from stores, collapse a wizard step, and update a migration version. The codebase is in clean passing state (119 test files pass, 1359 tests pass) before this phase begins.

The technical work splits cleanly into three groups: (1) sidebar-items.ts simplification and its downstream effect on the settings store initial state, (2) wizard step removal and onboarding store cleanup, and (3) settings UI dead-code deletion. These three groups have a dependency order: sidebar-items.ts must be changed before settings.store.ts can safely call `getDefaultSidebarItems()` without arguments; settings.store.ts role/applyPreset removal must happen before or simultaneously with RoleStep and PresetButtons deletion (since both components call these store methods).

The most important risk is test breakage. Four test files reference role-related symbols: `sidebar-items.test.ts` (calls `getDefaultSidebarItems('pm'/'dev')`), `SidebarItemsList.test.tsx` (imports `DEV_SIDEBAR_PRESET`), `onboarding.store.test.ts` (sets `role: null` in beforeEach and reads it in a test), and `tauri-storage.test.ts` (uses `role: 'developer'` as fixture data and asserts it survives a patch). All four require updates as part of this phase.

**Primary recommendation:** Implement in a single plan with two waves. Wave 1 updates `sidebar-items.ts` + `settings.store.ts` (structural foundation). Wave 2 removes UI files and fixes tests. Build verification with `npm run build` is required (per Phase 59 precedent — CSS/import issues that `tsc` misses).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sidebar item defaults | Store layer (settings.store.ts) | sidebar-items.ts (data source) | Store initial state calls getDefaultSidebarItems(); data definition lives in sidebar-items.ts |
| Wizard step orchestration | Frontend component (OnboardingWizard.tsx) | onboarding.store.ts (step tracking) | Wizard shell owns step array; store owns step counter and validation flags |
| Role persistence | Store layer (settings.store.ts) | — | Zustand persist middleware; role field dropped with v22 migration |
| Migration v22 | Store layer (settings.store.ts) | — | Zustand persist `migrate` function; existing migration chain pattern |
| Sidebar visibility defaults (new users) | sidebar-items.ts | settings.store.ts initial state | getDefaultSidebarItems() defines the all-visible array; store calls it at init |
| Sidebar visibility reset (existing users) | settings.store.ts v22 migration | — | Migration resets sidebarItems to all-visible for all existing users |

---

## Standard Stack

No new libraries are introduced in this phase. All changes are within the existing codebase.

### Existing Libraries Affected

| Library | Version (as used) | Role in This Phase |
|---------|------------------|--------------------|
| zustand | existing | Persist store v21→v22 migration, drop `role` field and `applyPreset` action |
| vitest | existing | Test updates for removed symbols (DEV_SIDEBAR_PRESET, role fixture) |
| TypeScript | existing | Type narrowing — remove `role` from `SettingsState` interface and `OnboardingState` interface |

**No installation commands needed for this phase.**

---

## Package Legitimacy Audit

Not applicable — this phase installs no external packages.

---

## Architecture Patterns

### Zustand Persist Migration Pattern (project-established)

**What:** Each version bump adds an `if (version < N)` block in the `migrate` function. The block mutates the persisted state object `s` then returns `persisted as SettingsState`. [VERIFIED: settings.store.ts source]

**Example (existing v16 block for reference):**
```typescript
// Source: taskflow/src/stores/settings.store.ts
if (version < 16) {
  if (Array.isArray(s.sidebarItems)) {
    s.sidebarItems = appendAioItemIfMissing(s.sidebarItems as SidebarItem[]);
  }
}
```

**v22 block (to implement):**
```typescript
if (version < 22) {
  delete (s as Record<string, unknown>).role;
  s.sidebarItems = getDefaultSidebarItems();
}
```

**Critical constraint:** The `if (version < 9)` block that reads `s.role` must NOT be altered — it is persisted migration history and still runs for users upgrading from very old versions. [VERIFIED: settings.store.ts lines 375-379, CONTEXT.md D-09 note]

**Version bump:** Change `version: 21` to `version: 22` on line 333 of settings.store.ts. [VERIFIED: settings.store.ts source]

### getDefaultSidebarItems Simplification Pattern

**Before:**
```typescript
// Source: taskflow/src/components/app/sidebar-items.ts
export function getDefaultSidebarItems(preset: 'dev' | 'pm'): SidebarItem[] {
  const devVisible = new Set([...]);
  const pmVisible = new Set([...]);
  const visibleSet = preset === 'pm' ? pmVisible : devVisible;
  return SIDEBAR_NAV_ITEMS.map((item) => ({
    id: item.id,
    visible: visibleSet.has(item.id),
  }));
}
```

**After (D-12):**
```typescript
export function getDefaultSidebarItems(): SidebarItem[] {
  return SIDEBAR_NAV_ITEMS.map((item) => ({
    id: item.id,
    visible: true,
  }));
}
```

**Also remove:** `DEV_SIDEBAR_PRESET` and `PM_SIDEBAR_PRESET` constants at lines 126-127.

**Update call site** in settings.store.ts line 309: `sidebarItems: getDefaultSidebarItems()` (remove the `'dev'` argument).

### Wizard Step Array Removal Pattern

**Before (OnboardingWizard.tsx):**
```typescript
// Source: taskflow/src/components/app/OnboardingWizard.tsx
import RoleStep from '@/routes/onboarding/RoleStep';
const STEP_LABELS = ['Welcome', 'Jira', 'GitLab', 'Role', 'Done'];
const STEP_COMPONENTS = [WelcomeStep, JiraStep, GitLabStep, RoleStep, DoneStep];
const { step, jiraValidated, gitlabValidated, role } = useOnboardingStore();
if (role) completedSteps.push(3);
```

**After (D-01, D-03):**
```typescript
const STEP_LABELS = ['Welcome', 'Jira', 'GitLab', 'Done'];
const STEP_COMPONENTS = [WelcomeStep, JiraStep, GitLabStep, DoneStep];
const { step, jiraValidated, gitlabValidated } = useOnboardingStore();
// no role completedSteps push
```

### SidebarSection Cleanup Pattern

**SidebarSection.tsx before:**
```typescript
import PresetButtons from './PresetButtons';
import SidebarItemsList from './SidebarItemsList';
// ...
<SidebarItemsList />
<PresetButtons />
```

**After (D-06):**
```typescript
import SidebarItemsList from './SidebarItemsList';
// ...
<SidebarItemsList />
```

**AppearanceSection.tsx:** Remove `import PresetButtons from './PresetButtons'` (line 14) and `<PresetButtons />` usage (line 65). No other layout changes. [VERIFIED: AppearanceSection.tsx source]

### Anti-Patterns to Avoid

- **Altering the v9 migration block:** The `if (version < 9)` block calls `getDefaultSidebarItems(preset)` with the old signature. After sidebar-items.ts changes, this call will break TypeScript. The planner must handle this: since D-09 says "leave intact", the solution is to inline the old preset logic as a local variable inside the v9 block OR update the call to match the new no-arg signature plus accept the all-visible result for those very-old users. See Pitfall 2 below.
- **Deleting PresetButtons.tsx before removing imports:** TypeScript will fail to compile. Remove imports from SidebarSection + AppearanceSection in the same commit as or before the file deletion.
- **Removing `setRole` from the store interface before removing all callers:** `RoleStep.tsx` calls `setRole` and `applyPreset`. Both files must be cleaned up in coordinated commits.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Store field removal on upgrade | Custom migration logic | Zustand persist `migrate` function — existing pattern, just add v22 block |
| TypeScript interface cleanup | Manual find-replace | Edit the `SettingsState` interface directly; TypeScript compiler will catch all remaining references |
| Test fixture updates | New test infrastructure | Update existing mocks in-place; no new test utilities needed |

---

## Runtime State Inventory

This phase involves a store migration (version bump). The following inventory applies:

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `settings.json` (Tauri plugin-store) — persists `role` and `sidebarItems` fields | v22 migration deletes `role`, resets `sidebarItems` to all-visible on next app start |
| Live service config | None — no external services store role data | None |
| OS-registered state | None — no OS-level registrations reference role | None |
| Secrets/env vars | None — `role` is a UI preference, not a secret | None |
| Build artifacts | `taskflow/src-tauri/Cargo.lock` — unrelated to role removal | None (ignore) |

**Existing users post-migration:** All sidebar customizations are reset to all-visible on first startup after upgrade. This is intentional per D-08 and documented in UI-SPEC.

---

## Common Pitfalls

### Pitfall 1: sidebar-items.test.ts calls old function signature
**What goes wrong:** After `getDefaultSidebarItems` becomes no-arg, `sidebar-items.test.ts` lines 29 and 34 call `getDefaultSidebarItems('pm')` and `getDefaultSidebarItems('dev')` — TypeScript error, test fails.
**Why it happens:** The test file explicitly tests the old preset behavior and calls the function with arguments.
**How to avoid:** Update `sidebar-items.test.ts` to remove the old preset-specific tests. Replace with a test verifying all 9 items are visible with no arguments. The "workload absence guard" tests (lines 19-51) are unrelated to presets and should be preserved as-is.
**Warning signs:** TypeScript error "Expected 0 arguments, but got 1."

### Pitfall 2: v9 migration block calls getDefaultSidebarItems(preset) with old signature
**What goes wrong:** After removing the `preset` parameter, `settings.store.ts` line 378 (`s.sidebarItems = getDefaultSidebarItems(preset)`) calls the function with an argument — TypeScript error.
**Why it happens:** The v9 migration block is "persisted history" (CONTEXT.md: do NOT alter). But it still compiles and runs.
**How to avoid:** Replace the call in the v9 block with an inline all-visible implementation. Since the v22 migration resets sidebarItems anyway, users upgrading from v9 will have their items reset by v22 regardless. The simplest fix: replace `getDefaultSidebarItems(preset)` in the v9 block with `getDefaultSidebarItems()` (no arg). This diverges slightly from the v9 original behavior (they'd get all-visible instead of role-preset) but they're about to get all-visible from v22 anyway.
**Warning signs:** TypeScript error "Expected 0 arguments, but got 1" on settings.store.ts migrate function.

### Pitfall 3: SidebarItemsList.test.tsx imports DEV_SIDEBAR_PRESET
**What goes wrong:** `SidebarItemsList.test.tsx` line 26 imports `DEV_SIDEBAR_PRESET` from `sidebar-items.ts`. After removing that export, the import fails and the test file errors.
**Why it happens:** The test uses `DEV_SIDEBAR_PRESET` as the initial store state in `beforeEach`.
**How to avoid:** Replace `DEV_SIDEBAR_PRESET` in the test with `getDefaultSidebarItems()` — the imported function that now returns all-visible items. Update the `beforeEach` to call `getDefaultSidebarItems()` directly.
**Warning signs:** TypeScript/Vitest import error on `SidebarItemsList.test.tsx`.

### Pitfall 4: tauri-storage.test.ts fixture asserts role field survives patch
**What goes wrong:** `tauri-storage.test.ts` line 37 uses `state: { role: 'developer', ... }` as fixture data and line 52 asserts `expect(parsed.state.role).toBe('developer')`. After removing `role` from the store type, the TypeScript assertion cast makes this still compile — but the test is now testing a field that no longer exists in production state. It won't fail, but it's misleading.
**Why it happens:** The test was written to verify that `persistChangelogBeforeRestart` preserves all unrelated fields. The `role` field was a convenient example.
**How to avoid:** Replace `role: 'developer'` in the fixture with another unrelated field (e.g., `theme: 'system'`) and update the corresponding assertion. The test's _intent_ (preserving unrelated fields) remains valid; only the example field needs updating.
**Warning signs:** Test passes but asserts a field (`role`) that no longer exists in the actual store state shape.

### Pitfall 5: Settings.test.tsx and ConnectionsSection.test.tsx mock store with role/setRole/applyPreset
**What goes wrong:** Both test files mock `useSettingsStore` with `role: 'developer'`, `setRole: vi.fn()`, and `applyPreset: vi.fn()` in their mock objects. After removing these from the store interface, TypeScript will flag these as excess properties in the mock object.
**Why it happens:** The mock objects use `as typeof mockSettingsStore` or similar casts — TypeScript may not catch excess props in mocks. But the fields are semantically stale.
**How to avoid:** Remove `role`, `setRole`, and `applyPreset` from both mock objects. The tests themselves don't exercise these fields directly (the role is set but never asserted in the tests).
**Warning signs:** Stale mock fields; potential TypeScript strict-mode errors on excess properties.

### Pitfall 6: RoleStep.test.tsx is todos-only but imports from the deleted file
**What goes wrong:** `RoleStep.test.tsx` has only `it.todo(...)` tests — no actual imports of `RoleStep.tsx` itself. However, the describe block label `'RoleStep'` and the file path create a test file that references a soon-to-be-deleted component. The test file should be deleted along with `RoleStep.tsx`.
**Why it happens:** The test file was scaffolded but never implemented.
**How to avoid:** Delete `RoleStep.test.tsx` along with `RoleStep.tsx`. Verify no other test imports RoleStep.
**Warning signs:** Orphaned test file after component deletion.

---

## Code Examples

### v22 Migration Block (verified against existing migration chain pattern)

```typescript
// Source: taskflow/src/stores/settings.store.ts — migrate function
// Add after the existing `if (version < 21)` block (lines 420-423)
if (version < 22) {
  delete (s as Record<string, unknown>).role;
  s.sidebarItems = getDefaultSidebarItems();
}
```

Change line 333: `version: 21` → `version: 22`

### Fix for v9 Migration Block (to avoid TypeScript error after getDefaultSidebarItems signature change)

```typescript
// Source: taskflow/src/stores/settings.store.ts lines 375-379 (existing)
// BEFORE (leave semantics, fix signature):
if (version < 9) {
  // getDefaultSidebarItems no longer takes a preset param; v22 will reset anyway
  s.sidebarItems = getDefaultSidebarItems();
}
```

### Updated sidebar-items.test.ts (replacing preset tests)

```typescript
// Replace the two preset-specific tests with a single all-visible test:
it('getDefaultSidebarItems returns all SIDEBAR_NAV_ITEMS with visible: true', () => {
  const items = getDefaultSidebarItems();
  expect(items).toHaveLength(SIDEBAR_NAV_ITEMS.length);
  expect(items.every((item) => item.visible)).toBe(true);
  expect(items.map((i) => i.id)).toEqual(SIDEBAR_NAV_ITEMS.map((i) => i.id));
});
```

### Updated SidebarItemsList.test.tsx beforeEach

```typescript
// Replace: import { DEV_SIDEBAR_PRESET, SIDEBAR_NAV_ITEMS } from '@/components/app/sidebar-items';
// With:
import { SIDEBAR_NAV_ITEMS, getDefaultSidebarItems } from '@/components/app/sidebar-items';

// In beforeEach, replace DEV_SIDEBAR_PRESET.map(...) with:
useSettingsStore.setState({
  sidebarItems: getDefaultSidebarItems().map((item) => ({ ...item })),
  setSidebarItemVisible,
  reorderSidebarItem,
} as any);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Role-based preset sidebar | All items visible by default | Phase 66 (this phase) | All 9 nav items shown to everyone; no role concept |
| 5-step onboarding wizard | 4-step onboarding wizard | Phase 66 (this phase) | Role selection step removed; wizard flows Welcome → Jira → GitLab → Done |
| `getDefaultSidebarItems('dev' \| 'pm')` | `getDefaultSidebarItems()` | Phase 66 (this phase) | No preset parameter; always returns all items visible |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The v9 migration block `if (version < 9)` can have its `getDefaultSidebarItems(preset)` call replaced with `getDefaultSidebarItems()` without any correctness concern, since v22 will reset sidebarItems anyway | Common Pitfalls / Pitfall 2 | Negligible — users upgrading from v<9 get all-visible directly instead of dev-preset first then all-visible from v22 |
| A2 | `ConnectionsSection.test.tsx` mock object has `role: 'developer'` and `setRole: vi.fn()` that should be cleaned up | Common Pitfalls / Pitfall 5 | Low — test still passes without removing these (TypeScript casts hide excess props in mocks), but stale mock fields |

---

## Open Questions

1. **SidebarItemsList.test.tsx drag-reorder tests**
   - What we know: The test verifies drag handles render for `SIDEBAR_NAV_ITEMS.length` items
   - What's unclear: After switching from `DEV_SIDEBAR_PRESET` (8/9 items visible in dev preset) to all-visible default, the test still checks `getAllByLabelText('Drag to reorder')` expecting `SIDEBAR_NAV_ITEMS.length` handles — this count was already correct since `DEV_SIDEBAR_PRESET` had all 9 items in the array (just with different `visible` values). No behavior change needed.
   - Recommendation: Only change the import and `beforeEach` fixture; the assertion on handle count is already correct.

---

## Environment Availability

Step 2.6 check: This phase is code/config-only changes within the existing project. All tools required (`npm`, TypeScript compiler, Vitest) are confirmed available from the passing test run.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Build + test | confirmed | existing | — |
| Vitest | Test suite | confirmed | existing (124 test files run) | — |
| TypeScript | Compile check | confirmed | existing | — |
| npm run build | Final verification (Phase 59 precedent) | confirmed | existing | — |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (existing) |
| Config file | `taskflow/vite.config.ts` |
| Quick run command | `cd taskflow && npx vitest run src/components/app/sidebar-items.test.ts src/routes/onboarding/RoleStep.test.tsx src/stores/onboarding.store.test.ts src/routes/settings/SidebarItemsList.test.tsx src/lib/tauri-storage.test.ts` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROLES-01 | Wizard has 4 steps, no RoleStep | unit | `npx vitest run src/routes/onboarding/RoleStep.test.tsx` (delete test file) | ✅ delete |
| ROLES-01 | OnboardingStore has no `role` field | unit | `npx vitest run src/stores/onboarding.store.test.ts` | ✅ update |
| ROLES-03 | SidebarSection renders no PresetButtons | unit | `npx vitest run src/routes/settings/SidebarItemsList.test.tsx` | ✅ update |
| ROLES-04 | Settings store at v22; role field absent | unit | `npx vitest run src/lib/tauri-storage.test.ts` | ✅ update |
| ROLES-06 | getDefaultSidebarItems() returns all 9 visible | unit | `npx vitest run src/components/app/sidebar-items.test.ts` | ✅ update |
| ROLES-05 | No role conditionals in components/routes | grep | `grep -r "\.role" taskflow/src/components taskflow/src/routes` → no results | manual verification |

### Sampling Rate
- **Per task commit:** Run relevant affected test file
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green + `npm run build` succeeds before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers all phase requirements. All test files exist; some require updates (not creation). No new test files need to be created.

---

## Security Domain

This phase has no security implications. No authentication, cryptography, session management, input validation, or access control changes. The `role` field being removed was a UI preference only — it did not gate any API calls, data access, or privileged operations.

ASVS categories: Not applicable (deletion-only phase, no new code surfaces).

---

## Sources

### Primary (HIGH confidence)
- `taskflow/src/stores/settings.store.ts` — Full migration chain (v1-v21), role field location, applyPreset implementation, version number
- `taskflow/src/components/app/sidebar-items.ts` — getDefaultSidebarItems signature, DEV_SIDEBAR_PRESET/PM_SIDEBAR_PRESET exports, SIDEBAR_NAV_ITEMS (9 items confirmed)
- `taskflow/src/components/app/OnboardingWizard.tsx` — STEP_LABELS, STEP_COMPONENTS, role usage in completedSteps
- `taskflow/src/stores/onboarding.store.ts` — role field in OnboardingState interface and initial state
- `taskflow/src/routes/onboarding/RoleStep.tsx` — calls setRole + applyPreset; confirmed deletion target
- `taskflow/src/routes/settings/RoleSection.tsx` — dead code confirmed (not imported in Settings.tsx)
- `taskflow/src/routes/settings/PresetButtons.tsx` — confirmed callers: SidebarSection + AppearanceSection
- `taskflow/src/routes/settings/Settings.tsx` — confirmed: RoleSection not imported; sections list verified
- `taskflow/src/components/app/sidebar-items.test.ts` — preset-arg calls identified for update
- `taskflow/src/routes/settings/SidebarItemsList.test.tsx` — DEV_SIDEBAR_PRESET import identified for update
- `taskflow/src/stores/onboarding.store.test.ts` — role field in beforeEach setState identified for update
- `taskflow/src/lib/tauri-storage.test.ts` — role fixture + assertion identified for update
- `taskflow/src/routes/onboarding/RoleStep.test.tsx` — todos-only; safe to delete with RoleStep.tsx
- `.planning/phases/66-roles-removal/66-CONTEXT.md` — all decisions (D-01 through D-14) locked
- `.planning/phases/66-roles-removal/66-UI-SPEC.md` — visual contract for post-deletion UI state

### Secondary (MEDIUM confidence)
- Vitest run output: 119 test files passing, 1359 tests passing — confirms clean pre-phase baseline

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all existing patterns verified from source
- Architecture: HIGH — all affected files read and exact line numbers confirmed
- Pitfalls: HIGH — discovered from direct source inspection, not inferred

**Research date:** 2026-05-24
**Valid until:** 2026-06-24 (stable codebase; no fast-moving dependencies)
