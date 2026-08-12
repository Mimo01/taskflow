# Quick Task 260812-rx9: Enhance compactness settings coverage - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning

<domain>
## Task Boundary

The app already has a density/compactness setting in Settings → Appearance that works
well across most of the app. Some surfaces were forgotten or do not compact as much as
they should. Named examples from the user:

- Task descriptions (wiki-rendered content)
- Task lists in standup notes
- Epics page
- AIO pages
- "and more" — other surfaces yet to be identified

Goal: close the density coverage gaps so the compactness setting behaves consistently
everywhere.

</domain>

<decisions>
## Implementation Decisions

### Mechanism — per-component classes (LOCKED)
- Keep the existing opt-in pattern: add `density-compact:` / `density-comfortable:`
  Tailwind variant utilities to the components that are missing them.
- Do NOT introduce a global CSS-variable / token-driven spacing system driven by
  `[data-density]`. That was explicitly rejected — it risks regressing surfaces that
  are already tuned correctly.
- The existing `@variant density-compact` / `density-comfortable` definitions in
  `taskflow/src/index.css` remain the single mechanism.

### Wiki prose (task descriptions, comments) — spacing only (LOCKED)
- In compact mode, tighten: paragraph / list / heading margins, line-height,
  table cell padding, code block padding.
- Do NOT change prose font size based on density. Font size is owned exclusively by the
  existing Text Size setting; compounding the two can push text below legibility.
- No image max-height or table-density changes in this task.

### Scope — full audit sweep (LOCKED)
- Audit every route/component for missing or insufficient density variants, not just the
  four named surfaces.
- Fix all identified gaps in this task. Do not defer a "remaining gaps" list to a
  follow-up — the sweep is the deliverable.
- Named surfaces are guaranteed-in-scope anchors: wiki-rendered content, standup notes
  task lists, epics page, AIO pages.

### Variant parity — both variants (LOCKED)
- Every surface touched gets both `density-compact:` (tighter) and
  `density-comfortable:` (looser) treatment so all three density settings behave
  consistently, matching how already-covered surfaces work.

### Claude's Discretion
- Exact spacing step values per surface — follow the magnitudes already used by
  covered components rather than inventing new scales.
- Whether a given surface genuinely needs a variant (some surfaces are legitimately
  density-neutral, e.g. modals with fixed geometry). Skipping such a surface is fine if
  noted in the summary.
- Ordering and grouping of the work into commits.

</decisions>

<specifics>
## Specific Ideas

- Density is implemented as Tailwind custom variants in `taskflow/src/index.css`:
  `@variant density-compact (&:is([data-density="compact"] *));` (plus a
  `density-comfortable` counterpart). Default density sets no attribute (CSS baseline).
- `taskflow/src/services/theme.ts` applies the `data-density` attribute; the setting
  lives in `taskflow/src/stores/settings.store.ts` and is exposed via
  `taskflow/src/routes/settings/AppearanceSection.tsx`.
- Components already covered (use these as the reference for spacing magnitudes):
  `dashboard/TaskRow.tsx`, `dashboard/BacklogRow.tsx`, `dashboard/TaskCard.tsx`,
  `dashboard/StoryHeaderRow.tsx`, `dashboard/MrRow.tsx`, `my-tasks/MyTaskRow.tsx`,
  `notifications/NotificationRow.tsx`, `release-detail/UnifiedTaskTable.tsx`,
  `issue-detail/AioTestRunsSection.tsx` (PARTIAL — has `density-compact:py-1` but a
  fixed `min-h-11` floors it, so the setting is visually inert there).
- Wiki rendering attaches at a single point: the `<article className="prose prose-sm …">`
  in `WikiRenderer.tsx`. Prose spacing rules go there so descriptions and comments both
  benefit.

### Corrections to earlier assumptions (from research, 2026-08-12)
- There is NO TipTap in this repo. Wiki rendering is react-markdown +
  `@tailwindcss/typography`. Any earlier note about a "shared TipTap WikiEditor" is stale.
- `issue-detail/ChangelogEntry.tsx` was listed above as already covered — it is not.
  It has no density classes and is a gap.
- Root cause of "doesn't compact enough" is usually a fixed `min-h-*` flooring the row,
  not a missing `py-*`. Adding density padding variants without a matching
  `density-compact:min-h-*` is a silent no-op.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in the decisions above. Existing
in-repo precedent (the already-covered components listed under Specific Ideas) is the
authority on spacing magnitudes.

</canonical_refs>
