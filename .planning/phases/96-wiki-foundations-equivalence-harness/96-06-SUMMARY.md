---
phase: 96-wiki-foundations-equivalence-harness
plan: 06
subsystem: wiki
tags: [research, jira, probe]
requires: [96-05]
provides:
  - Live Jira DC grammar comparison and mention-format answer for Phase 97
affects: [phase-97]
key-files:
  created: []
  modified:
    - .planning/phases/96-wiki-foundations-equivalence-harness/96-SPIKE-FINDINGS.md
requirements-completed: []
duration: 10min
completed: 2026-11-16
---

# Phase 96 Plan 06: Jira render probe Summary

Ran the D-11 probe against live Jira DC (`/rest/api/1.0/render`) with 9 placeholder snippets.

Results:
- Six snippets render the same as Jira.
- Header-less tables differ in a known way, because of the empty GFM header row.
- Unknown-user mentions differ: Jira shows error text, and we show a chip.
- Mixed `*#` list nesting is a real divergence. Jira nests the items, and WikiRenderer leaves the markers as literal text.

Mention format on DC is `[~username]`.

## Tasks

1. **Probe run:** the user ran a one-command probe script. It read the base URL from the app settings and the token from hidden input, kept the token in memory, and blanked the host in the saved responses.
2. **Findings:** appended the `## Jira render probe (D-11)` section to 96-SPIKE-FINDINGS.md. Jira's HTML was deleted from the scratchpad afterwards and never committed.

## Deviations

- **Probe script:** a script did the curl steps, so the user only pasted the token, and Claude did the comparison instead of the user. The account-id probe used both `accountid` and `accountId` casings.

## Self-Check: PASSED

- All required headings are present.
- No non-example URLs, no HTML lines and no Bearer token appear in the findings.
