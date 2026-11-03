# Quick Task 261103-cln: Redesign 'Not covered by tasks above' to match 'Deployment package mismatches' style, with fix action buttons - Context

**Gathered:** 2026-11-03
**Status:** Ready for planning

<domain>
## Task Boundary

Release detail page. Redesign the secondary section "Not covered by tasks above"
(`taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx` ~L1557, `secondary-section`)
so it visually matches the "Deployment package mismatches" section
(`taskflow/src/routes/dashboard/release-detail/DeploymentPackageSection.tsx` ~L330+).
Keep its current POSITION (directly under the unified task table, inside UnifiedTaskTable).
Add per-row action buttons that fix each state where a fix is possible.

</domain>

<decisions>
## Implementation Decisions

### Visual style (match Deployment package mismatches)
- Orange accent-bar callout container: `border-l-[3px] border-orange-400 bg-orange-50/60 px-6 py-4` (+ dark variants), `@container`.
- h3 header row: AlertTriangle icon + title "Not covered by tasks above" + rounded orange count pill + muted one-line hint (hidden at narrow container widths), same classes as the package section.
- Column header strip in the package section's HEADER_CLASS style; rows with orange hover + `divide-orange-200/60` dividers, `min-h-8` rows.
- State column = amber/orange state pill like `package-state` (collapses to icon at narrow widths). Per-reason counts may stay in the header only if they don't duplicate the count pill pointlessly — Claude's discretion (memory: no figure shown twice).
- Reuse the package section's VISIBLE_ROWS cap + "show more" expander if that section has one.
- Prefer extracting shared class constants/primitives rather than copy-pasting divergent strings.

### 'Not in version' fix
- Action "Apply" (outline xs button like package section) ADDS this release's fix version to the linked task(s), keeping their existing fixVersions. Multiple linked keys → apply to all of them (or dropdown per key — Claude's discretion).
- After success the MR should move into the primary table (invalidate/patch the release issue queries).

### 'No task' fix
- Action "Link task": pick a task from THIS RELEASE's issues (picker/popover with search), then prepend the key to the MR title on GitLab ("KEY-1 Original title") via GitLab MR PUT title. Linking is title-based (extractTicketKeys), so this makes the MR covered and it moves to the primary table. Optimistic/invalidate via the existing mrChannelKeys prefixes (useMrFixMutation patterns).

### 'Not evaluated' (merged/closed MRs)
- Keep the rows, muted state pill, empty action cell.

### Columns — Claude's Discretion
- Recommended: keep the MR-centric columns (State/reason, Key, Merge request, Author, Reviewers, MR state, BR, MS — BR/MS keep their existing Retarget / Assign-milestone fix affordances) restyled to the package look, plus a trailing Fix-action column (Apply / Link task) like the package section's COL_FIX_ACTION. One row = one line at every width; drop/sr-only columns at narrow container widths rather than wrapping (memory: one-row-one-line).

</decisions>

<specifics>
## Specific Ideas

- Pattern references: DeploymentPackageSection.tsx (layout, Apply button, pending/error state per row), useDeploymentPackageSync.ts (fixVersion write via computeFixVersionsForFix), useMrFixMutation.ts + mrChannelKeys.ts (GitLab MR writes + channel-cache patch/invalidate).
- Per-row pending + inline error display as in DeploymentPackageSection.
- Existing testids (`secondary-section`, `secondary-reason-pill`, `secondary-key-*`, `drift-row`, `drift-br/ms`) — update tests accordingly; keep testids where practical.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above. Project memories relevant: one row = one line; colour = status only; container queries don't apply to the container itself (use inner wrapper); jira.ts dual-file gotcha (edit legacy services/jira.ts); release-detail sticky header z-20.

</canonical_refs>
