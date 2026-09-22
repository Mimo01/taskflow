---
phase: 260922-cif
reviewed: 2026-09-22T07:57:00Z
depth: quick
files_reviewed: 7
files_reviewed_list:
  - src/components/ui/cached-avatar.tsx
  - src/routes/dashboard/QuickFilterChipRow.tsx
  - src/routes/dashboard/SprintBoardSkeleton.tsx
  - src/routes/dashboard/SprintBoardTab.tsx
  - src/routes/dashboard/SprintGoalBanner.tsx
  - src/routes/dashboard/StoryHeaderRow.tsx
  - src/routes/dashboard/TaskCard.tsx
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 260922-cif: Code Review Report

**Reviewed:** 2026-09-22T07:57:00Z
**Depth:** quick
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the diff adding `density-compact:`/`density-comfortable:` Tailwind variants across the sprint board, a new `16` avatar size, and a `useSettingsStore` density read in `StoryHeaderRow` and `TaskCard` to pick avatar size. No critical bugs or security issues found — this is a low-risk, additive styling change. No pattern-matching hits for hardcoded secrets, dangerous functions, empty catches, or debug artifacts. The `SprintBoardTab.tsx` header-height measurement change (hardcoded `37` → `stickyHeaderInnerRef.current?.offsetHeight ?? 37`) is a legitimate, unrelated-but-included fix that correctly keeps the sticky-header push-out math density-proof.

Two Warnings worth fixing: the status-pill compact overrides silently break the documented "do not add geometry classes to `statusPillClass()`" contract in `statusStyles.ts`, and the `avatarSize` density-lookup logic is duplicated verbatim in two components instead of being shared.

## Warnings

### WR-01: Compact status-pill overrides violate the documented `statusPillClass()` contract

**File:** `src/routes/dashboard/StoryHeaderRow.tsx:193-200`, `src/routes/dashboard/TaskCard.tsx:250-257`
**Issue:** `src/lib/statusStyles.ts:61-64` explicitly documents: "Callers must NOT add additional geometry classes such as `rounded*`, `px-*`, `py-*`, `text-xs`, `font-*`, `inline-flex`, `min-w-*`, or `text-center` — all of those are already included in `STATUS_PILL_LAYOUT_CLASS`." Both call sites now do exactly that, appending `density-compact:min-w-[4rem] density-compact:px-1 density-compact:py-0 density-compact:text-[0.625rem]` via `cn(statusPillClass(...), '...')`. It happens to work today because Tailwind's cascade layers order the variant-prefixed utilities after the base ones, but the pattern is fragile (any Tailwind/CSS layer reorder, or a third call site copying the same "just add classes" habit without the variant prefix, silently breaks pill geometry) and it's duplicated in two files instead of being centralized. The safer/documented pattern is to add density-aware sizing inside the shared helper (e.g., `statusPillClass(categoryKey, density)` or a second `STATUS_PILL_LAYOUT_CLASS_COMPACT` constant) so there is one source of truth, matching the "Card primitive" / "statusPillClass needs flex parent" precedent already established in this codebase.
**Fix:**
```ts
// src/lib/statusStyles.ts
export function statusPillClass(categoryKey: string | undefined, density?: Density): string {
  const layout = density === 'compact' ? STATUS_PILL_LAYOUT_CLASS_COMPACT : STATUS_PILL_LAYOUT_CLASS;
  return `${layout} ${statusCategoryBadgeClass(categoryKey)}`;
}
```
and update the doc comment, or update it to explicitly allow `density-compact:*`-prefixed overrides as an approved extension point.

### WR-02: `avatarSize` density lookup duplicated verbatim in two components

**File:** `src/routes/dashboard/StoryHeaderRow.tsx:102-103`, `src/routes/dashboard/TaskCard.tsx:148-149`
**Issue:** Both components independently read `useSettingsStore((s) => s.density)` and compute `density === 'compact' ? 16 : 20`. If a third density tier (e.g. `comfortable` → 24) is ever added, both call sites must be updated in lockstep, and it's easy to miss one (this codebase's memory notes already flag this exact drift pattern for shared fetchers/predicates elsewhere).
**Fix:** Extract a small shared hook, e.g. `useDensityAvatarSize()` in `src/stores/settings.store.ts` or a new `src/lib/density.ts`:
```ts
export function useDensityAvatarSize(): 16 | 20 {
  return useSettingsStore((s) => (s.density === 'compact' ? 16 : 20));
}
```

## Info

### IN-01: Repeated arbitrary `text-[0.625rem]` value with no shared token

**File:** `src/routes/dashboard/StoryHeaderRow.tsx` (lines 146, 167, 182, 196, 203, 208), `src/routes/dashboard/TaskCard.tsx` (lines ~176, 187, 190, 210, 255, 261, 269, 279)
**Issue:** The compact-density 10px text size is hardcoded as the arbitrary Tailwind value `density-compact:text-[0.625rem]` in roughly 14 places across two files. Any future adjustment to the compact font size requires a find-and-replace across both files instead of one definition.
**Fix:** Consider a project-level utility class or `@theme` token (e.g. `text-2xs`) defined once in `src/index.css`, then reused as `density-compact:text-2xs`.

### IN-02: Two-letter initials may overflow the new 16px avatar

**File:** `src/components/ui/cached-avatar.tsx:66-85`
**Issue:** The fallback initials container reuses the same `text-[10px]` font size for every avatar size (previously the smallest avatar was 20px/`size-5`; now `size=16`/`size-4` is used in compact density). Two-character initials (e.g. "MM") at 10px inside a 16px circle are noticeably tighter than at 20px and may visually clip/touch the circle edge on some fonts, though `overflow` isn't explicitly hidden so it likely just looks cramped rather than breaking layout.
**Fix:** Optionally scale the fallback font down for the 16px tier only, e.g. add a `size === 16 ? 'text-[8px]' : 'text-[10px]'` branch, or verify visually that it's acceptable and leave as-is.

### IN-03: `density === 'compact' ? 16 : 20` silently treats `'comfortable'` the same as `'default'`

**File:** `src/routes/dashboard/StoryHeaderRow.tsx:103`, `src/routes/dashboard/TaskCard.tsx:149`
**Issue:** `Density` is `'compact' | 'default' | 'comfortable'`, but the avatar-size ternary only branches on `'compact'` vs. everything else, so `'comfortable'` density gets the same 20px avatar as `'default'` even though every other element in this diff (padding, gaps, font sizes) does get a distinct `density-comfortable:` treatment elsewhere in the same files. This may be intentional (avatar only needed a compact-mode shrink), but it's inconsistent with the rest of the diff's density handling and worth a one-line confirmation it's not an oversight.
**Fix:** If comfortable should also get a larger avatar, use a 3-way map; otherwise add a short comment noting the omission is intentional.

---

_Reviewed: 2026-09-22T07:57:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
