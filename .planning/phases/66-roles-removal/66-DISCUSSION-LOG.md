# Phase 66: Roles Removal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 66-Roles Removal
**Areas discussed:** Sidebar migration for existing users, applyPreset lifecycle, Wizard step index handling, ROLES-05 scope check

---

## Sidebar migration for existing users

| Option | Description | Selected |
|--------|-------------|----------|
| Reset to all-visible | Migration sets sidebarItems to all 9 items visible. Clean post-role state. | ✓ |
| Preserve as-is | Just drop the `role` field; keep existing sidebarItems. | |

**User's choice:** Reset to all-visible

| Option | Description | Selected |
|--------|-------------|----------|
| All 9 items visible | All items on by default for new installs. | ✓ |
| Current dev preset as base | Hide sprint-progress + releases for new installs. | |

**User's choice:** All 9 items visible for new installs
**Notes:** Migration v22 resets both new and existing users to all-visible sidebar.

---

## applyPreset lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Remove entirely | Delete `applyPreset` from store + `getDefaultSidebarItems` becomes no-arg. | ✓ |
| Keep the function | Leave `applyPreset` as dead code for potential future use. | |

**User's choice:** Remove entirely

| Option | Description | Selected |
|--------|-------------|----------|
| Remove both preset exports | Delete DEV_SIDEBAR_PRESET + PM_SIDEBAR_PRESET; update tests. | ✓ |
| Keep as test fixtures | Preserve as static test fixtures. | |

**User's choice:** Remove both preset exports, update tests accordingly
**Notes:** `getDefaultSidebarItems` becomes no-arg, returns all 9 items visible.

---

## Wizard step index handling

| Option | Description | Selected |
|--------|-------------|----------|
| Remove role from onboarding store | Drop `role` field from onboarding.store.ts entirely. | ✓ |
| Keep as nullable dead field | Leave `role: null` in store with no callers. | |

**User's choice:** Remove from onboarding store

| Option | Description | Selected |
|--------|-------------|----------|
| Track only Jira (1) + GitLab (2) | completedSteps reflects validated credentials only. | ✓ |
| Also track Done (3) via onboardingComplete | Mark step 3 complete when onboardingComplete=true. | |

**User's choice:** Track only Jira + GitLab in completedSteps
**Notes:** Wizard becomes 4-step: Welcome → Jira → GitLab → Done.

---

## ROLES-05 scope check

| Option | Description | Selected |
|--------|-------------|----------|
| Mark as pre-satisfied | Zero role-gated conditionals found; verify after cleanup. | |
| Run full codebase audit | Search all src/ files for lingering role references. | ✓ |

**User's choice:** Run full codebase audit

**Audit result:** Full grep across all `src/` `.tsx`/`.ts` files confirmed zero role references outside the files being deleted. ROLES-05 is pre-satisfied. Plan should include a verification grep as final success check.

---

## Claude's Discretion

- Commit ordering within plans (e.g., remove UI callers before removing store actions)
- Whether deletions happen in standalone commits or bundled with broader plan commits
- Historic v9 migration block in settings.store.ts left intact (it references `s.role` as persisted history)

## Deferred Ideas

None — discussion stayed within phase scope.
