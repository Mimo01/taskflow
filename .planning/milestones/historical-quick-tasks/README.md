---
type: archive
status: archived
---

# Historical Quick Tasks Archive

Quick task directories from v1.0 through v1.8 milestones, moved here during the v1.9 milestone close (2026-05-23) so the `audit-open` scanner stops flagging them as "open" — they lack the modern status frontmatter convention that the scanner expects, but every one of them was completed and committed long ago.

## Contents

- `1-` through `20-` — pre-naming-convention quick tasks from v1.0 / v1.1 (2026-03-10 → 2026-03-15)
- `260316-*` through `260317-*` — v1.2 / early v1.3 era
- `260318-*` through `260319-*` — late v1.3 era
- `260320-*` through `260329-*` — v1.3 / v1.4 era
- `260330-*` through `260418-*` — v1.5 / v1.6.3 / v1.7 era
- `260419-*` through `260519-*` — v1.7 / v1.8 era

## How to find one

Each subdirectory's name is a short slug summary of the task. The original commit for each one is discoverable via `git log` on its summary file (e.g. `git log -- .planning/milestones/historical-quick-tasks/260317-ric-redesign-linked-issues-and-merge-request/`).

## Why archived rather than deleted

These dirs hold the only complete record of the user's original intent + the resulting implementation rationale for each quick task. Git history shows the diff but not the conversational context that produced it.
