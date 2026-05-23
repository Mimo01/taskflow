# Quick Task 8: add a new role with access to all features and pages - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Task Boundary

Add a new "Tech Lead" role to the app. This role shows all available pages from both the developer role (My Tasks, Sprint Board, MR Attention) and the PM role (Sprint Progress, Workload, Releases). The role must be selectable in onboarding and settings.

</domain>

<decisions>
## Implementation Decisions

### Role name
- Name: **Tech Lead** (display label: "Tech Lead")
- Code value: `'tech-lead'` (string literal in TypeScript types)

### Nav grouping
- Show two labeled sections: **Developer** (My Tasks, Sprint Board, MR Attention) and **PM** (Sprint Progress, Workload, Releases)
- Same structure as today but both sections visible simultaneously

### Dashboard widget mix
- **Claude's Discretion** — no change to dashboard required. Focus on sidebar and role selection UI only.

</decisions>

<specifics>
## Specific Ideas

- The type union in `settings.store.ts` must expand: `'developer' | 'pm' | 'tech-lead'`
- `RoleStep.tsx` (onboarding) needs a third radio option
- `RoleSection.tsx` (settings) needs a third radio option
- `Sidebar.tsx` needs a third branch showing both developer and PM nav links under separate labeled sections

</specifics>
