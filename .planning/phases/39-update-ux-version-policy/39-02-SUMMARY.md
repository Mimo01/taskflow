---
phase: 39-update-ux-version-policy
plan: 02
subsystem: ui
tags: [react, tauri, version-policy, compare-versions, tanstack-query, zustand]

# Dependency graph
requires:
  - phase: 39-01
    provides: UpdateDialog, WhatsNewDialog, update.store, useUpdatePolling, AppLayout wiring
  - phase: 38-updater-foundation-service-layer
    provides: updaterService, update.store state machine, useUpdatePolling
provides:
  - versionPolicy service with fetchVersionPolicy (fail-open) and isBelow (semver comparison)
  - useVersionPolicyCheck hook computing softMinimumActive/hardMinimumActive
  - SoftMinimumBanner dismissible nag banner with session-only dismissal
  - HardMinimumOverlay full-screen blocking overlay (z-[200])
  - version-policy.json at repo root with safe defaults
  - AppLayout wiring: soft banner after ReAuthBanners, hard overlay as last element
affects: [40-settings-update-interval, 41-public-releases-repo]

# Tech tracking
tech-stack:
  added: [compare-versions@6.1.1]
  patterns:
    - fail-open semantics: fetchVersionPolicy returns null on any error; policy null means no enforcement
    - dev build bypass: isBelow returns false when version contains '-dev'
    - session-only dismissal: softNagDismissed as React useState in AppLayout (not persisted)
    - z-layering: HardMinimumOverlay z-[200] covers UpdateDialog z-[150] and all other overlays

key-files:
  created:
    - taskflow/src/services/versionPolicy.ts
    - taskflow/src/services/versionPolicy.test.ts
    - taskflow/src/hooks/useVersionPolicyCheck.ts
    - taskflow/src/components/update/SoftMinimumBanner.tsx
    - taskflow/src/components/update/SoftMinimumBanner.test.tsx
    - taskflow/src/components/update/HardMinimumOverlay.tsx
    - taskflow/src/components/update/HardMinimumOverlay.test.tsx
    - version-policy.json
  modified:
    - taskflow/src/main.tsx
    - taskflow/package.json

key-decisions:
  - "compare-versions library (not hand-rolled) for reliable pre-release tag handling"
  - "version-policy.json defaults to 0.0.0/0.0.0 — no enforcement until intentionally bumped"
  - "VERSION_POLICY_URL placeholder uses OWNER/RELEASES_REPO — Phase 41 will replace with real URL"
  - "softMinimumActive excludes hardMinimum overlap: soft only fires when below soft but not below hard"
  - "handleBannerUpdate uses useUpdateStore.getState() (not hook) to avoid rules-of-hooks violation in async function"

patterns-established:
  - "Fail-open policy: version enforcement components return null/false on any fetch/parse error"
  - "Session-only dismissal via React useState (not persisted) per D-14"
  - "Two-tier version enforcement: SoftMinimumBanner (banner) + HardMinimumOverlay (blocking)"

requirements-completed: [POL-01, POL-02, POL-03]

# Metrics
duration: 5min
completed: 2026-03-25
---

# Phase 39 Plan 02: Version Policy Enforcement Summary

**Two-tier version policy enforcement with fail-open semantics: soft minimum nag banner (dismissible per session) and hard minimum blocking overlay (z-[200]), backed by a semver comparison service with dev build bypass and version-policy.json safe defaults.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-25T00:05:54Z
- **Completed:** 2026-03-25T00:10:54Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Version policy service with `fetchVersionPolicy` (fail-open) and `isBelow` (semver via compare-versions) — 11 tests covering all error paths
- `useVersionPolicyCheck` hook piggybacking on settings store `updateCheckInterval`, computing `softMinimumActive` and `hardMinimumActive`
- `SoftMinimumBanner`: TriangleAlert icon, version message, "Update Now" + dismiss X, sr-only label — 5 tests
- `HardMinimumOverlay`: fixed full-screen z-[200] blocking overlay with Lock icon, "Update Required" heading, inline error for failed check — 6 tests
- AppLayout wired: soft banner after ReAuthBanners, hard overlay as last JSX element, session-only `softNagDismissed` state
- `version-policy.json` at repo root with `"softMinimum": "0.0.0", "hardMinimum": "0.0.0"` safe defaults

## Task Commits

1. **Task 1: Version policy service + compare-versions + policy JSON** - `f6dcd07` (feat)
2. **Task 2: SoftMinimumBanner + HardMinimumOverlay + AppLayout wiring** - `68079d1` (feat)

## Files Created/Modified
- `taskflow/src/services/versionPolicy.ts` — fetchVersionPolicy + isBelow + VersionPolicy interface
- `taskflow/src/services/versionPolicy.test.ts` — 11 tests (fetch errors, semver cases, dev bypass)
- `taskflow/src/hooks/useVersionPolicyCheck.ts` — TanStack Query hook, returns softMinimumActive/hardMinimumActive/policy
- `taskflow/src/components/update/SoftMinimumBanner.tsx` — dismissible nag banner
- `taskflow/src/components/update/SoftMinimumBanner.test.tsx` — 5 tests
- `taskflow/src/components/update/HardMinimumOverlay.tsx` — blocking z-[200] overlay
- `taskflow/src/components/update/HardMinimumOverlay.test.tsx` — 6 tests
- `taskflow/src/main.tsx` — version policy imports + state + JSX wiring
- `taskflow/package.json` — compare-versions dependency added
- `version-policy.json` — repo root safe defaults

## Decisions Made
- `compare-versions` library chosen over hand-rolled to correctly handle pre-release version tags
- `softMinimumActive` excludes the hard minimum range (soft fires only when below soft but NOT below hard) — prevents double-enforcement overlap
- `VERSION_POLICY_URL` uses placeholder `OWNER/RELEASES_REPO` — Phase 41 will update with real public repo URL
- `handleBannerUpdate` uses `useUpdateStore.getState()` (Zustand static getState) instead of a hook call to avoid rules-of-hooks violation inside the async handler

## Deviations from Plan

None — plan executed exactly as written. Pre-existing ReleasesTab test failures (useNavigate outside Router) were confirmed pre-existing and out of scope.

## Issues Encountered
- Wave 1 commits were on `main` branch but the worktree branch was behind; merged `main` into worktree via fast-forward before starting execution. No conflicts.

## Next Phase Readiness
- Version policy enforcement fully implemented and tested
- `VERSION_POLICY_URL` placeholder ready for Phase 41 replacement with real GitHub raw URL
- `version-policy.json` at repo root — Phase 41 will copy to public releases repo
- Phase 39 complete: both plans (Update Dialog lifecycle + Version Policy enforcement) shipped

---
*Phase: 39-update-ux-version-policy*
*Completed: 2026-03-25*
