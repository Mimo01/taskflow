# Quick Task 261028-lal: Highlight the peeked task on the main page - Context

**Gathered:** 2026-10-28
**Status:** Ready for planning

<domain>
## Task Boundary

When a task is opened in the sidebar (PeekPanel, mounted in `taskflow/src/main.tsx` via `peekIssueKey` state),
the corresponding task row/card on the main page should be visibly highlighted.

</domain>

<decisions>
## Implementation Decisions

### Scope
- Highlight on ALL surfaces that open the peek: My Tasks rows (MyTaskRow), Sprint Board cards (TaskCard),
  Backlog rows (BacklogRow), Release detail issue rows. One shared mechanism (not per-page plumbing).

### Style
- Subtle primary-tinted background + 2px accent bar on the leading edge. No layout shift
  (use inset box-shadow / pseudo-element, not border/padding changes).

### Claude's Discretion
- How peekIssueKey is shared (small zustand store or context vs prop drilling). Prefer a store/hook
  `useIsPeeked(key)` so rows re-render only when their own state flips.
- Shared class helper so the style is defined once.
- Must follow project gotchas: Tailwind v4 space-y/negative margins, one row = one line, no layout shift,
  React Compiler (no hidden module-level reads), Biome lint (don't `--write` all of src).

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>
