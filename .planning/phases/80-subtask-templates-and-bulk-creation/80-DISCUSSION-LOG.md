# Phase 80: Subtask Templates and Bulk Creation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 80-Subtask Templates and Bulk Creation
**Areas discussed:** Template scope & portability, Subtask type selection, Field depth in editors, Placeholder & inheritance semantics

---

## Template Scope & Portability

| Option | Description | Selected |
|--------|-------------|----------|
| Global + resolve at apply, drop unsupported | One shared list; resolve against current project's subtask createmeta at apply; silently drop unsupported fields with a "N skipped" badge | ✓ |
| Project-scoped templates | Templates keyed by projectKey; no portability, no field mismatch | |
| Global + block on missing required | Shared list, but block rows whose required fields are unresolvable | |

**User's choice:** Global + resolve at apply, drop unsupported (Recommended)
**Notes:** Maximizes cross-project reuse; missing-required surfaces via normal create-time validation, never a hard pre-preview block.

---

## Subtask Issue Type Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Per-template selector, default to project's first | Template stores its subtask type; createmeta drives fields; ad-hoc defaults to first subtask type | ✓ |
| Single default, no selector | Always subtaskIssueTypes()[0] | |
| Per-row selector | Each row picks its own subtask type | |

**User's choice:** Per-template selector, default to project's first (Recommended)
**Notes:** All rows in one run share a type. Identify subtask types via `issuetype.subtask === true`, not name.

---

## Field Depth in Editors

| Option | Description | Selected |
|--------|-------------|----------|
| Curated core inline + Advanced expand | Inline: title, assignee, priority, labels, due date, estimate, story points; components + custom fields behind per-row expand | ✓ |
| Title inline, everything else in row expand | Only title visible; full editor on expand | |
| Full field set inline | All createmeta fields in the row (wide table) | |

**User's choice:** Curated core inline + Advanced expand (Recommended)
**Notes:** Applies to both Settings template editor and bulk preview rows.

---

## Placeholder & Inheritance Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| @inherit = assignee+priority+labels+components+due date; default @inherit | Broad inheritance; new lines default @inherit; chips with resolved hints | ✓ |
| @inherit = assignee only; default @unassigned | Narrow inheritance | |
| @inherit = all shared fields; default @current | Broadest inheritance; default to current user | |

**User's choice:** @inherit = assignee+priority+labels+components+due date; default @inherit (Recommended)
**Notes:** Resolution is authoritative at Create time (SUBTPL-08). Preview chips show resolved-value hints (e.g. `@inherit → Alice`) to satisfy SUBTPL-05; user can override inline. Empty parent value resolves to empty, no error.

---

## Claude's Discretion

- Chip colors/styling, "N fields skipped" badge copy, ad-hoc empty-state affordance.
- Whether the Settings editor and bulk preview share the same row component (recommended).

## Deferred Ideas

None — discussion stayed within phase scope. Per-row subtask-type selection and project-scoped storage were considered and explicitly rejected.
