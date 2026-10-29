---
phase: 93-releases-list-and-detail-redesign-fix-version-driven-list-fi
plan: 06
status: uat-issues-reported
---

# Phase 93 Plan 06: Phase gate (PARTIAL - Task 1 done, Task 2 live UAT pending)

## Task 1 results (done)

- `npm test`: 247 files passed / 1 skipped, 3911 tests passed.
- `npm run check`: only the known baseline files flagged (chart.tsx, internalLinks.test.ts, BacklogRow.tsx, MyTaskRow.tsx, MyTasksPage.test.tsx); no phase file flagged.
- Grep gates all hold: no "gitlab" in ReleasesTab.tsx; no dangerouslySetInnerHTML in release components / releases-list / ReleaseHeader; no ReleaseTitleHeading; no issueCounts in UnifiedTaskTable.tsx.
- 93-VALIDATION.md: map marked green, Wave 0 ticked, `nyquist_compliant: true`, `wave_0_complete: true`; versionCountsParity contract noted as moved to `jira.versionsBreakdown.test.ts` (commit 9bbf467f).
- Visual pre-check (throwaway vite page in scratchpad, placeholder data): one line per row, Package/Date hidden at 640px, pill + graph are the only coloured elements, long name truncates. One defect found and fixed: list graph skeleton spanned the full cell and shifted when data arrived; now reserves the figure slot (commit 57e236c2).

## Commits

- 57e236c2 fix(93-06): reserve figure slot in list graph skeleton to avoid shift
- 9bbf467f docs(93-06): validation map

## Screenshots (scratchpad, not committed)

- /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/1e619056-aac0-4ffc-8987-198eca585705/scratchpad/releases-1100.png (post-fix, list top only)
- /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/1e619056-aac0-4ffc-8987-198eca585705/scratchpad/releases-640.png (pre-fix skeleton; list + detail header pinned/unpinned)

## Deviations

- [Rule 1 - Bug] graph loading skeleton layout shift, fixed in ReleaseIssueGraph.tsx.

## Task 2 (pending)

Live UAT by the user. Record "approved" or verbatim issues here.

### UAT result (2026-10-29)

Functional checks pass. Issue reported verbatim:

> "it works but it is too plain. I was imagining something more interesting"

Not approved. Next step chosen by user: sketch 2-3 throwaway HTML mockups of alternative list designs (e.g. next-release hero, timeline, richer rows) before planning gap closure.
