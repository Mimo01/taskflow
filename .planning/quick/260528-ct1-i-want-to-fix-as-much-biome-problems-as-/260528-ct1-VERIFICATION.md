---
phase: quick-260528-ct1
verified: 2026-05-28T09:32:00Z
status: gaps_found
score: 1/3 must-haves verified
re_verification: false
gaps:
  - truth: "Running `npm run check` from taskflow/ reports 0 warnings (down from 20)"
    status: failed
    reason: "npm run check reports 21 errors and 35 warnings. input-group.tsx has a parse-breaking JSX structure (biome-ignore comment placed between `return (` and `<div`, making the return statement syntactically invalid). CommandPalette.tsx still has 2 a11y warnings (useSemanticElements + noStaticElementInteractions) because role=button on a <div> still triggers useSemanticElements. SprintGoalBanner.tsx introduced a new a11y warning — <header aria-label> triggers useAriaPropsSupportedByRole (aria-label is not supported on landmark elements). ImageLightbox.tsx inner div with role=presentation + onKeyDown still triggers noStaticElementInteractions. Additionally 29 a11y warnings exist in files outside this phase's scope (those were apparently pre-existing and not part of the 20-warning target)."
    artifacts:
      - path: "taskflow/src/components/ui/input-group.tsx"
        issue: "Line 10: JSX comment `{/* biome-ignore ... */}` placed between `return (` and `<div` — invalid JSX, causes 5 parse errors. The suppression never reaches the `<div role=group>` node. Also introduces noUselessLoneBlockStatements and noUnusedFunctionParameters errors."
      - path: "taskflow/src/components/app/CommandPalette.tsx"
        issue: "Line 232: `role=button` on outer backdrop <div> still triggers lint/a11y/useSemanticElements. Line 242: inner <div role=presentation> with onKeyDown still triggers noStaticElementInteractions — role=presentation does not exempt an element from the no-static-interactions rule."
      - path: "taskflow/src/routes/dashboard/SprintGoalBanner.tsx"
        issue: "Line 18: `<header aria-label=...>` triggers lint/a11y/useAriaPropsSupportedByRole — aria-label is not a supported attribute on the header/banner landmark role according to Biome's rule."
      - path: "taskflow/src/routes/dashboard/ImageLightbox.tsx"
        issue: "Line 40: <div role=presentation onClick onKeyDown> still triggers noStaticElementInteractions — role=presentation does not satisfy this rule."
    missing:
      - "Fix input-group.tsx InputGroup function: move biome-ignore comment to be an inline comment on the <div> element or a single-line suppression comment on the line above the opening <div> tag (not inside the return parens as a standalone JSX expression)"
      - "Fix CommandPalette.tsx outer backdrop: either use a <button> or add a valid biome-ignore suppression for noStaticElementInteractions + useSemanticElements"
      - "Fix CommandPalette.tsx inner content div: role=presentation does not suppress noStaticElementInteractions — add biome-ignore suppression"
      - "Fix SprintGoalBanner.tsx: remove aria-label from <header> (it is redundant as header is already a landmark) or add biome-ignore suppression"
      - "Fix ImageLightbox.tsx inner div: role=presentation does not suppress noStaticElementInteractions — add biome-ignore suppression"

  - truth: "Test suite still passes after fixes"
    status: failed
    reason: "1 test file fails: src/components/app/CommandPalette.test.tsx. The test runner (vite/oxc) cannot parse the broken input-group.tsx (Expected `,` or `)` but found `Identifier`). 128 of 129 test files pass; 1 fails due to the parse error in input-group.tsx."
    artifacts:
      - path: "taskflow/src/components/ui/input-group.tsx"
        issue: "Parse error propagates to CommandPalette.test.tsx via the import chain, causing the test file to fail to transform"
    missing:
      - "Fix the input-group.tsx parse error (same fix as above) — this will unblock the test suite"
---

# Phase quick-260528-ct1: Biome A11y Warnings Fix Verification Report

**Phase Goal:** Fix all remaining Biome a11y warnings (target: 0 warnings)
**Verified:** 2026-05-28T09:32:00Z
**Status:** GAPS FOUND
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `npm run check` reports 0 warnings (down from 20) | FAILED | Actual: 21 errors, 35 warnings. 4 a11y warnings remain in phase-modified files; parse errors in input-group.tsx cause 5 additional errors. |
| 2 | No existing functional behavior changes — only attributes, handlers, and element name swaps | VERIFIED | All changes reviewed; only attributes, handlers, and element swaps were made in the 12 files. The semantic swap in SprintGoalBanner (div to header) and the aria-pressed swap in BacklogFilterBar are correct. No logic or state changes. |
| 3 | Test suite still passes after fixes | FAILED | 1 of 129 test files fail (CommandPalette.test.tsx) — caused by the parse error introduced into input-group.tsx. 1538 tests pass, 0 test regressions in logic — the single failure is a transform/parse failure. |

**Score:** 1/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/components/app/AppIcon.tsx` | aria-hidden on decorative SVG | VERIFIED | `aria-hidden="true"` present on root svg |
| `taskflow/src/components/app/KeyboardShortcutsPanel.tsx` | aria-hidden on decorative search icon SVG | VERIFIED | `aria-hidden="true"` added to inline svg |
| `taskflow/src/components/ui/empty-state.test.tsx` | type=button on test button | VERIFIED | `type="button"` added |
| `taskflow/src/components/ui/label.tsx` | biome-ignore noLabelWithoutControl | VERIFIED | Suppression comment present |
| `taskflow/src/components/ui/input-group.tsx` | biome-ignore on role=group + onKeyDown on InputGroupAddon | STUB/BROKEN | JSX comment placed as standalone expression between `return (` and `<div` — invalid JSX, causes 5 parse errors. InputGroupAddon onKeyDown is correctly added (lines 60-63). The InputGroup suppression comment (line 10) is malformed and triggers suppressions/unused + parse errors. |
| `taskflow/src/routes/dashboard/SprintGoalBanner.tsx` | `<header>` element replacing `<div role=banner>` | PARTIAL | `<header>` swap done, but `aria-label` on `<header>` triggers a NEW a11y warning (useAriaPropsSupportedByRole). The fix traded one warning for another. |
| `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` | biome-ignore on `<tr role=button>` | VERIFIED | Suppression comment present and effective |
| `taskflow/src/routes/dashboard/BacklogFilterBar.tsx` | aria-pressed on button, no aria-selected on li | VERIFIED | aria-selected removed from li, aria-pressed added to inner button |
| `taskflow/src/components/app/CommandPalette.tsx` | Keyboard handlers + role/tabIndex on clickable divs | PARTIAL | onKeyDown and tabIndex added. However role=button on outer div still triggers useSemanticElements; role=presentation on inner div does not suppress noStaticElementInteractions — 2 a11y warnings remain. |
| `taskflow/src/routes/dashboard/AuthImage.tsx` | Guarded role/tabIndex/onKeyDown on clickable img | VERIFIED | Guarded attributes pattern applied correctly |
| `taskflow/src/routes/dashboard/ImageLightbox.tsx` | onKeyDown on overlay + presentation role on inner | PARTIAL | onKeyDown added on overlay div (verified). Inner div has role=presentation + onKeyDown, but role=presentation does not suppress noStaticElementInteractions — 1 warning remains. |
| `taskflow/src/routes/dashboard/MentionPopover.tsx` | onKeyDown(Enter) on div role=option | VERIFIED | onKeyDown Enter handler calling onSelect(user) present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| All modified files | Biome a11y rule engine | npm run check | FAILED | 21 errors and 35 warnings. 4 a11y warnings in phase-modified files (CommandPalette ×2, SprintGoalBanner ×1, ImageLightbox ×1). Parse errors in input-group.tsx. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `taskflow/src/components/ui/input-group.tsx` | 10 | JSX comment as standalone expression in return() — `{/* biome-ignore ... */}` before `<div` | BLOCKER | Parse error prevents file from compiling; breaks input-group test file; `...props` spread mistakenly parsed as a block statement; suppression is ineffective |
| `taskflow/src/components/app/CommandPalette.tsx` | 232 | role=button on backdrop div triggers useSemanticElements | BLOCKER | a11y warning remains — goal not met |
| `taskflow/src/routes/dashboard/SprintGoalBanner.tsx` | 18 | `<header aria-label="Sprint goal">` triggers useAriaPropsSupportedByRole | BLOCKER | New a11y warning introduced by the fix itself |
| `taskflow/src/routes/dashboard/ImageLightbox.tsx` | 40 | role=presentation on interactive div does not suppress noStaticElementInteractions | BLOCKER | a11y warning remains |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| npm run check reports 0 warnings | `cd taskflow && npm run check` | Found 21 errors, 35 warnings | FAIL |
| Test suite passes | `cd taskflow && npm test -- --run` | 1 test file failed (CommandPalette.test.tsx — parse error in input-group.tsx) | FAIL |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| BIOME-A11Y-01 | 0 Biome a11y warnings after fix | BLOCKED | 35 warnings remain; 4 are in phase-modified files; parse errors also present |

### Human Verification Required

None — all findings are programmatically confirmed.

### Gaps Summary

**Two blockers prevent goal achievement:**

**Blocker 1 — input-group.tsx parse error (root cause of test failure):**
The `InputGroup` function's biome-ignore JSX comment was placed as a standalone JSX expression (`{/* ... */}`) between `return (` and the `<div` element. This is invalid JSX — a `return` can only return one expression. Biome parses the comment as a JSX expression, then hits the `<div` as a second expression and fails. The `...props` spread on line 18 is interpreted as a block statement (noUselessLoneBlockStatements warning). The fix: move the comment to be an inline line comment (`// biome-ignore ...`) on the line immediately before the `<div role="group">` opening tag.

**Blocker 2 — Three files still have a11y warnings:**
- `CommandPalette.tsx`: `role=button` on a `<div>` triggers `useSemanticElements` (line 232). The inner `role=presentation` div with `onKeyDown` triggers `noStaticElementInteractions` (line 242) — `role=presentation` does not exempt an element from this rule.
- `SprintGoalBanner.tsx`: The `div→header` swap is correct, but `aria-label` on `<header>` triggers `useAriaPropsSupportedByRole`. The fix is to remove `aria-label` from the header (it is redundant as the header landmark is already identifiable) or add a biome-ignore suppression.
- `ImageLightbox.tsx`: Inner `<div role=presentation>` with `onKeyDown` still triggers `noStaticElementInteractions` — same issue as CommandPalette inner div.

**Scope note:** The 29 a11y warnings in files outside this phase's scope (CreateEditIssueModal, AioTestRunsSection, AttachmentLightbox, DurationInput, etc.) appear to be pre-existing warnings that were never part of the 20-warning target. These are not attributable to this phase and are not counted as gaps here.

**What passed:** 8 of the 12 files are correctly fixed and verified (AppIcon, KeyboardShortcutsPanel, empty-state.test, label, AioCycleDetailPage, BacklogFilterBar, AuthImage, MentionPopover). The changes in those files are correct and clean.

---

_Verified: 2026-05-28T09:32:00Z_
_Verifier: Claude (gsd-verifier)_
