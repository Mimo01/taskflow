# Phase 66: Roles Removal - Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 13 (9 modified, 3 deleted, 1 deleted test)
**Analogs found:** 13 / 13 (all are self-referential — modifications to existing files)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `taskflow/src/components/app/sidebar-items.ts` | utility | transform | self (simplification) | exact |
| `taskflow/src/stores/settings.store.ts` | store | CRUD | self (field removal + migration bump) | exact |
| `taskflow/src/components/app/OnboardingWizard.tsx` | component | event-driven | self (array shrink) | exact |
| `taskflow/src/stores/onboarding.store.ts` | store | CRUD | self (field removal) | exact |
| `taskflow/src/routes/settings/SidebarSection.tsx` | component | request-response | self (import removal) | exact |
| `taskflow/src/routes/settings/AppearanceSection.tsx` | component | request-response | self (import removal) | exact |
| `taskflow/src/routes/settings/Settings.test.tsx` | test | — | self (mock cleanup) | exact |
| `taskflow/src/routes/settings/ConnectionsSection.test.tsx` | test | — | self (mock cleanup) | exact |
| `taskflow/src/components/app/sidebar-items.test.ts` | test | — | self (test update) | exact |
| `taskflow/src/stores/onboarding.store.test.ts` | test | — | self (test update) | exact |
| `taskflow/src/lib/tauri-storage.test.ts` | test | — | self (fixture update) | exact |
| `taskflow/src/routes/settings/SidebarItemsList.test.tsx` | test | — | self (import + beforeEach update) | exact |
| ~~`taskflow/src/routes/onboarding/RoleStep.tsx`~~ | DELETE | — | — | — |
| ~~`taskflow/src/routes/settings/RoleSection.tsx`~~ | DELETE | — | — | — |
| ~~`taskflow/src/routes/settings/PresetButtons.tsx`~~ | DELETE | — | — | — |
| ~~`taskflow/src/routes/onboarding/RoleStep.test.tsx`~~ | DELETE | — | — | — |

---

## Pattern Assignments

### `taskflow/src/components/app/sidebar-items.ts` (utility, transform)

**Operation:** Simplify `getDefaultSidebarItems` to no-arg all-visible; remove `DEV_SIDEBAR_PRESET` and `PM_SIDEBAR_PRESET` exports.

**Current function signature** (lines 93–123):
```typescript
export function getDefaultSidebarItems(preset: 'dev' | 'pm'): SidebarItem[] {
  const devVisible = new Set([
    'dashboard', 'my-tasks', 'sprint-board', 'backlog', 'epics',
    'merge-requests', 'worklogs', 'aio-projects',
  ]);
  const pmVisible = new Set([
    'dashboard', 'my-tasks', 'sprint-board', 'backlog', 'epics',
    'merge-requests', 'sprint-progress', 'releases', 'worklogs', 'aio-projects',
  ]);
  const visibleSet = preset === 'pm' ? pmVisible : devVisible;
  return SIDEBAR_NAV_ITEMS.map((item) => ({
    id: item.id,
    visible: visibleSet.has(item.id),
  }));
}
```

**Target function** (D-12):
```typescript
export function getDefaultSidebarItems(): SidebarItem[] {
  return SIDEBAR_NAV_ITEMS.map((item) => ({
    id: item.id,
    visible: true,
  }));
}
```

**Lines to delete** (lines 125–127 — exported preset constants):
```typescript
/** Pre-computed preset constants for tests and comparisons. */
export const DEV_SIDEBAR_PRESET = getDefaultSidebarItems('dev');
export const PM_SIDEBAR_PRESET = getDefaultSidebarItems('pm');
```

---

### `taskflow/src/stores/settings.store.ts` (store, CRUD)

**Operations:**
1. Remove `role` from `SettingsState` interface (line 25) and initial state (line 182)
2. Remove `setRole` action from interface (line 146) and implementation (line 294)
3. Remove `applyPreset` action from interface (line 166) and implementation (lines 324–327)
4. Update initial `sidebarItems` call site (line 309): remove `'dev'` argument
5. Fix v9 migration block (line 378): replace `getDefaultSidebarItems(preset)` with `getDefaultSidebarItems()`
6. Add v22 migration block after existing v21 block (lines 420–423)
7. Bump version from 21 to 22 (line 332)

**Interface lines to remove** (lines 25, 146, 166):
```typescript
// line 25 — DELETE entire line:
role: 'developer' | 'pm' | 'tech-lead' | null;

// line 146 — DELETE entire line:
setRole: (role: 'developer' | 'pm' | 'tech-lead') => void;

// line 166 — DELETE entire line:
applyPreset: (preset: 'dev' | 'pm') => void;
```

**Initial state lines to remove** (lines 182, 294, 309, 324–327):
```typescript
// line 182 — DELETE:
role: null,

// line 294 — DELETE:
setRole: (role) => set({ role }),

// line 309 — UPDATE (remove 'dev' arg):
// BEFORE:
sidebarItems: getDefaultSidebarItems('dev'),
// AFTER:
sidebarItems: getDefaultSidebarItems(),

// lines 324–327 — DELETE entire applyPreset action:
applyPreset: (preset) =>
  set({
    sidebarItems: getDefaultSidebarItems(preset),
  }),
```

**Version bump** (line 332):
```typescript
// BEFORE:
version: 21,
// AFTER:
version: 22,
```

**v9 migration fix** (lines 375–379) — replace `getDefaultSidebarItems(preset)` to fix TypeScript after signature change:
```typescript
// BEFORE:
if (version < 9) {
  const role = s.role as string | null;
  const preset = role === 'pm' ? 'pm' : 'dev';
  s.sidebarItems = getDefaultSidebarItems(preset);
}

// AFTER (D-09 says leave intact; fix only the compile error — v22 resets anyway):
if (version < 9) {
  s.sidebarItems = getDefaultSidebarItems();
}
```

**v22 migration block** — add after lines 420–423 (the existing v21 block):
```typescript
if (version < 21) {
  if (Array.isArray(s.sidebarItems)) {
    s.sidebarItems = appendWorklogsItemIfMissing(s.sidebarItems as SidebarItem[]);
  }
}
// ADD THIS v22 BLOCK IMMEDIATELY AFTER:
if (version < 22) {
  delete (s as Record<string, unknown>).role;
  s.sidebarItems = getDefaultSidebarItems();
}
```

**Existing migration pattern for reference** (lines 399–406 — v15/v16 pattern):
```typescript
if (version < 15) {
  if (s.aioEnabled === undefined) s.aioEnabled = false;
}
if (version < 16) {
  if (Array.isArray(s.sidebarItems)) {
    s.sidebarItems = appendAioItemIfMissing(s.sidebarItems as SidebarItem[]);
  }
}
```

---

### `taskflow/src/components/app/OnboardingWizard.tsx` (component, event-driven)

**Operation:** Remove RoleStep import, shrink STEP_LABELS/STEP_COMPONENTS from 5→4, remove `role` from store destructure and completedSteps.

**Current state** (lines 15–33):
```typescript
import DoneStep from '@/routes/onboarding/DoneStep';
import GitLabStep from '@/routes/onboarding/GitLabStep';
import JiraStep from '@/routes/onboarding/JiraStep';
import RoleStep from '@/routes/onboarding/RoleStep';       // DELETE this line
import WelcomeStep from '@/routes/onboarding/WelcomeStep';
import { useOnboardingStore } from '@/stores/onboarding.store';
import StepIndicator from './StepIndicator';

const STEP_LABELS = ['Welcome', 'Jira', 'GitLab', 'Role', 'Done'];   // remove 'Role'
const STEP_COMPONENTS = [WelcomeStep, JiraStep, GitLabStep, RoleStep, DoneStep]; // remove RoleStep

export default function OnboardingWizard() {
  const { step, jiraValidated, gitlabValidated, role } = useOnboardingStore();  // remove role

  const completedSteps: number[] = [];
  if (jiraValidated) completedSteps.push(1);
  if (gitlabValidated) completedSteps.push(2);
  if (role) completedSteps.push(3);  // DELETE this line
```

**Target state** (D-01, D-03):
```typescript
import DoneStep from '@/routes/onboarding/DoneStep';
import GitLabStep from '@/routes/onboarding/GitLabStep';
import JiraStep from '@/routes/onboarding/JiraStep';
import WelcomeStep from '@/routes/onboarding/WelcomeStep';
import { useOnboardingStore } from '@/stores/onboarding.store';
import StepIndicator from './StepIndicator';

const STEP_LABELS = ['Welcome', 'Jira', 'GitLab', 'Done'];
const STEP_COMPONENTS = [WelcomeStep, JiraStep, GitLabStep, DoneStep];

export default function OnboardingWizard() {
  const { step, jiraValidated, gitlabValidated } = useOnboardingStore();

  const completedSteps: number[] = [];
  if (jiraValidated) completedSteps.push(1);
  if (gitlabValidated) completedSteps.push(2);
  // no role completedSteps push (D-03)
```

---

### `taskflow/src/stores/onboarding.store.ts` (store, CRUD)

**Operation:** Remove `role` field from `OnboardingState` interface and initial state. No migration needed (in-memory only per D-02).

**Interface change** (line 22 — DELETE):
```typescript
// DELETE this line from OnboardingState interface:
role: 'developer' | 'pm' | 'tech-lead' | null;
```

**Initial state change** (line 40 — DELETE):
```typescript
// DELETE this line from the create() initial state:
role: null,
```

**Omit type** (line 25 — no change needed; `role` is not in the omit list):
```typescript
// This line stays as-is (role is not excluded from set()):
set: (partial: Partial<Omit<OnboardingState, 'set' | 'goNext' | 'goBack'>>) => void;
```

---

### `taskflow/src/routes/settings/SidebarSection.tsx` (component, request-response)

**Operation:** Remove `PresetButtons` import (line 8) and usage (line 21). Keep `SidebarItemsList`.

**Current** (lines 1–24):
```typescript
import PresetButtons from './PresetButtons';   // DELETE
import SidebarItemsList from './SidebarItemsList';

export default function SidebarSection() {
  return (
    <div data-testid="section-sidebar" className="flex flex-col gap-6">
      ...
      <SidebarItemsList />
      <PresetButtons />    {/* DELETE */}
    </div>
  );
}
```

**Target:**
```typescript
import SidebarItemsList from './SidebarItemsList';

export default function SidebarSection() {
  return (
    <div data-testid="section-sidebar" className="flex flex-col gap-6">
      ...
      <SidebarItemsList />
    </div>
  );
}
```

---

### `taskflow/src/routes/settings/AppearanceSection.tsx` (component, request-response)

**Operation:** Remove `PresetButtons` import (line 14) and `<PresetButtons />` usage (line 65). Keep all other content unchanged.

**Lines to remove:**
```typescript
// line 14 — DELETE:
import PresetButtons from './PresetButtons';

// line 65 — DELETE (inside the "Sidebar Items section" div):
<PresetButtons />
```

**Surrounding context stays intact** (lines 61–66):
```typescript
{/* Sidebar Items section */}
<div className="flex flex-col gap-3">
  <label className="text-sm font-medium">Sidebar Items</label>
  <SidebarItemsList />
  {/* <PresetButtons /> — REMOVED */}
</div>
```

---

### `taskflow/src/components/app/sidebar-items.test.ts` (test)

**Operation:** Replace two preset-arg test cases (lines 29–39) with one all-visible test. Preserve the workload absence guard tests (lines 19–51 structure).

**Lines to replace** (lines 29–39 — two preset tests):
```typescript
// DELETE these two 'it' blocks:
it('pmVisible preset (getDefaultSidebarItems("pm")) contains no workload entry', () => {
  const pmItems = getDefaultSidebarItems('pm');
  const hit = pmItems.find((item) => item.id === 'workload');
  expect(hit).toBeUndefined();
});

it('devVisible preset (getDefaultSidebarItems("dev")) contains no workload entry', () => {
  const devItems = getDefaultSidebarItems('dev');
  const hit = devItems.find((item) => item.id === 'workload');
  expect(hit).toBeUndefined();
});
```

**Replacement test** (D-12, Pitfall 1):
```typescript
it('getDefaultSidebarItems returns all SIDEBAR_NAV_ITEMS with visible: true', () => {
  const items = getDefaultSidebarItems();
  expect(items).toHaveLength(SIDEBAR_NAV_ITEMS.length);
  expect(items.every((item) => item.visible)).toBe(true);
  expect(items.map((i) => i.id)).toEqual(SIDEBAR_NAV_ITEMS.map((i) => i.id));
});
```

**Note:** The describe block label references "Phase 59" workload absence guard — that outer describe and the remaining 4 tests (lines 19–28, 41–51) are unchanged.

---

### `taskflow/src/stores/onboarding.store.test.ts` (test)

**Operation:** Remove `role: null` from `beforeEach` setState (line 18) and remove the `role: 'developer'` assertion in the `set updates partial state` test (lines 57–63).

**beforeEach change** (line 18 — DELETE one line):
```typescript
// In beforeEach setState call, DELETE:
role: null,
```

**Test body change** (lines 56–64):
```typescript
// BEFORE:
it('set updates partial state', () => {
  act(() => {
    useOnboardingStore.getState().set({
      jiraUrl: 'https://jira.example.com',
      role: 'developer',       // DELETE this line
    });
  });
  const state = useOnboardingStore.getState();
  expect(state.jiraUrl).toBe('https://jira.example.com');
  expect(state.role).toBe('developer');   // DELETE this line
});

// AFTER:
it('set updates partial state', () => {
  act(() => {
    useOnboardingStore.getState().set({
      jiraUrl: 'https://jira.example.com',
    });
  });
  const state = useOnboardingStore.getState();
  expect(state.jiraUrl).toBe('https://jira.example.com');
});
```

---

### `taskflow/src/lib/tauri-storage.test.ts` (test)

**Operation:** Replace `role: 'developer'` fixture field and its assertion with `theme: 'system'` (Pitfall 4). The test's intent — verifying unrelated fields survive a patch — remains valid.

**Test change** (lines 36–56 — first test only):
```typescript
// BEFORE (lines 37, 52):
const existing = {
  state: { role: 'developer', theme: 'system', lastSeenChangelog: null, lastSeenVersion: null },
  version: 21,
};
// ...
expect(parsed.state.role).toBe('developer');  // line 52

// AFTER:
const existing = {
  state: { theme: 'system', lastSeenChangelog: null, lastSeenVersion: null },
  version: 21,
};
// ...
// Remove the role assertion line entirely (theme assertion already present on line 53 stays)
```

**Lines 53–55 stay unchanged:**
```typescript
expect(parsed.state.theme).toBe('system');
// Schema version must be preserved, not reset to a hardcoded value.
expect(parsed.version).toBe(21);
```

---

### `taskflow/src/routes/settings/SidebarItemsList.test.tsx` (test)

**Operation:** Replace `DEV_SIDEBAR_PRESET` import with `getDefaultSidebarItems`, update `beforeEach` fixture. Keep all test assertions intact (Pitfall 3).

**Import change** (line 26):
```typescript
// BEFORE:
import { DEV_SIDEBAR_PRESET, SIDEBAR_NAV_ITEMS } from '@/components/app/sidebar-items';

// AFTER:
import { SIDEBAR_NAV_ITEMS, getDefaultSidebarItems } from '@/components/app/sidebar-items';
```

**beforeEach fixture change** (lines 38–44):
```typescript
// BEFORE:
act(() => {
  useSettingsStore.setState({
    sidebarItems: DEV_SIDEBAR_PRESET.map((item) => ({ ...item })),
    setSidebarItemVisible,
    reorderSidebarItem,
  } as any);
});

// AFTER:
act(() => {
  useSettingsStore.setState({
    sidebarItems: getDefaultSidebarItems().map((item) => ({ ...item })),
    setSidebarItemVisible,
    reorderSidebarItem,
  } as any);
});
```

**Note:** The `dashboard` checkbox test comment on line 62 ("The first item in DEV_SIDEBAR_PRESET is 'dashboard' and is visible") should be updated to reference `getDefaultSidebarItems()`. The assertion itself is still correct since dashboard is visible in both old and new defaults.

---

### `taskflow/src/routes/settings/Settings.test.tsx` (test)

**Operation:** Remove `role`, `setRole`, and `applyPreset` from `mockSettingsStore` object (Pitfall 5).

**Lines to delete from `mockSettingsStore`** (lines 92, 113, 136):
```typescript
// line 92 — DELETE:
role: 'developer' as 'developer' | 'pm' | 'tech-lead' | null,

// line 113 — DELETE:
setRole: vi.fn(),

// line 136 — DELETE:
applyPreset: vi.fn(),
```

---

### `taskflow/src/routes/settings/ConnectionsSection.test.tsx` (test)

**Operation:** Remove `role` and `setRole` from `mockSettingsStore` object (Pitfall 5).

**Lines to delete from `mockSettingsStore`** (lines 43, 58):
```typescript
// line 43 — DELETE:
role: 'developer' as 'developer' | 'pm' | 'tech-lead' | null,

// line 58 — DELETE:
setRole: vi.fn(),
```

---

## Files to Delete

| File | Reason |
|------|--------|
| `taskflow/src/routes/onboarding/RoleStep.tsx` | D-04: wizard step removed; no remaining callers after OnboardingWizard.tsx update |
| `taskflow/src/routes/settings/RoleSection.tsx` | D-05: confirmed dead code; not imported in Settings.tsx |
| `taskflow/src/routes/settings/PresetButtons.tsx` | D-07: delete after removing imports from SidebarSection + AppearanceSection |
| `taskflow/src/routes/onboarding/RoleStep.test.tsx` | Pitfall 6: todos-only test; orphaned after RoleStep.tsx deletion |

**Deletion order constraint:** Remove imports from `SidebarSection.tsx` and `AppearanceSection.tsx` before or in the same commit as deleting `PresetButtons.tsx`. Same applies to removing RoleStep from `OnboardingWizard.tsx` before deleting `RoleStep.tsx`.

---

## Shared Patterns

### Zustand Persist Migration Version Bump
**Source:** `taskflow/src/stores/settings.store.ts` lines 329–425
**Apply to:** `settings.store.ts` only
**Pattern:** Add new `if (version < N)` block at the end of the `migrate` function, before the `return persisted as SettingsState` line. Update `version: N` in the persist options object. Existing blocks are never modified (persisted history).

```typescript
// Standard migration block shape (from line 399–406 as reference):
if (version < N) {
  // mutate s (the persisted Record<string, unknown>) directly
  // e.g. delete (s as Record<string, unknown>).fieldName;
  // e.g. s.newField = defaultValue;
}
// v22 specific — delete role, reset sidebarItems:
if (version < 22) {
  delete (s as Record<string, unknown>).role;
  s.sidebarItems = getDefaultSidebarItems();
}
```

### Zustand In-Memory Store Field Removal
**Source:** `taskflow/src/stores/onboarding.store.ts` lines 12–46
**Apply to:** `onboarding.store.ts` only
**Pattern:** No migration needed for in-memory (non-persisted) stores. Remove from: (1) the interface, (2) the initial state object, (3) any store action that references the field, (4) all callers in components.

### Test Mock Object Cleanup
**Source:** `taskflow/src/routes/settings/Settings.test.tsx` lines 90–137
**Apply to:** `Settings.test.tsx`, `ConnectionsSection.test.tsx`
**Pattern:** The `mockSettingsStore` object shape must match the `SettingsState` interface. After removing fields from the interface, remove corresponding entries from the mock object. TypeScript casts (`as any`, interface casts) may not surface excess property errors — remove stale fields proactively.

---

## Commit Ordering (Claude's Discretion)

The safest two-wave ordering to avoid TypeScript errors mid-plan:

**Wave 1 — Foundation (no orphaned callers):**
1. `sidebar-items.ts` — simplify function, remove preset constants
2. `settings.store.ts` — remove role/setRole/applyPreset, update call site, fix v9 block, add v22 block, bump version

**Wave 2 — UI removal and test cleanup:**
3. `SidebarSection.tsx` + `AppearanceSection.tsx` — remove PresetButtons imports/usage
4. Delete `PresetButtons.tsx`
5. `OnboardingWizard.tsx` — remove RoleStep import/usage
6. Delete `RoleStep.tsx` + `RoleStep.test.tsx`
7. Delete `RoleSection.tsx` (dead code — no callers to clean up first)
8. `onboarding.store.ts` — remove role field
9. All test file updates (sidebar-items.test.ts, onboarding.store.test.ts, tauri-storage.test.ts, SidebarItemsList.test.tsx, Settings.test.tsx, ConnectionsSection.test.tsx)

---

## No Analog Found

All files in this phase are modifications or deletions of existing files. No new files are being created, so no "no analog" cases apply.

---

## Metadata

**Analog search scope:** `taskflow/src/stores/`, `taskflow/src/components/app/`, `taskflow/src/routes/settings/`, `taskflow/src/routes/onboarding/`, `taskflow/src/lib/`
**Files scanned:** 13 source files read directly
**Pattern extraction date:** 2026-05-24
