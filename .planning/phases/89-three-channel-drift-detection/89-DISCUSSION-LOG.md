# Phase 89: Three-Channel Drift Detection - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-10
**Phase:** 89-three-channel-drift-detection
**Areas discussed:** Unified list shape, Row anatomy (flags + provenance), State classification & flaggability, Count semantics + fetch cost

---

## Unified list shape

The first pass at this question was rejected — the user asked for a recommendation before choosing. A written recommendation was given (new MR-first section), with reasoning: the two tables answer different questions, `UnmatchedMRsSection` is already a proto version of the union so this grows an existing 102-line section rather than rewriting the 230-line interaction-heavy Issues table, and Phase 90 needs a stable per-MR row to own action state. The question was then re-asked with the recommendation marked.

| Option | Description | Selected |
|--------|-------------|----------|
| New MR-first section | Issues table untouched; `UnmatchedMRsSection` grows into a full Merge Requests section listing the three-channel union | ✓ |
| Replace with one MR-first table | Rewrite `IssuesSection` into a single union table with "missing MR" coverage rows | |
| Issue table + drift-only section | New section lists only flagged MRs | |

**User's choice:** New MR-first section
**Notes:** Immediately after choosing, the user volunteered an unprompted constraint: *"i want it compact and easily readable."* Recorded as D-04 and applied to every subsequent rendering question.

### Follow-up: the existing wrong-milestone heuristic

| Option | Description | Selected |
|--------|-------------|----------|
| Replace it with Channel A | Delete `fetchRecentProjectMRs` + `buildWrongMilestoneMap`; re-source the Issues table's MR cell from the union | ✓ |
| Keep both, independent | Leave the existing warning alone, build the channels beside it | |
| Keep the UI, re-source the data | Same visuals, union as the data source | |

**User's choice:** Replace it with Channel A
**Notes:** Effectively also selects the third option's behaviour — the UI is preserved (D-06), the capped 100-MR fetch is what's deleted.

### Follow-up: ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Drift first, then the rest | Flagged MRs float to the top of one flat list | ✓ |
| Grouped by state | Open / Merged / Closed+Draft group headers, drift-sorted inside | |
| Flat, newest first | Reverse-chronological, flags inline wherever they fall | |

**User's choice:** Drift first, then the rest

---

## Row anatomy: flags + provenance

| Option | Description | Selected |
|--------|-------------|----------|
| Inline flag chips, only when set | Orange chip per active flag; clean rows show nothing | |
| One drift chip + tooltip | Single ⚠ per flagged row, hover for detail | |
| Three fixed status columns | BR / MS / TASK, each ✓/⚠/— on every row | ✓ |

**User's choice:** Three fixed status columns
**Notes:** Chosen despite being the widest option, against a stated compactness constraint — which is what forces D-20's flex-row layout prescription.

| Option | Description | Selected |
|--------|-------------|----------|
| No — internal only | Provenance in the data model and tests, never on screen | |
| Yes — compact letter badges | `A·B` / `C` marker per row | |
| Only in the tooltip | Revealed on hover, zero row cost | ✓ |

**User's choice:** Only in the tooltip

### Follow-up: MRs with no Jira key

| Option | Description | Selected |
|--------|-------------|----------|
| Neutral — not drift | Muted —, never counted; a dependency bump legitimately has no ticket | |
| Flag it — every MR needs a task | No key = drift | ✓ |
| Neutral, but visually distinct | Not counted, but rendered distinctly from a passing ✓ | |

**User's choice:** Flag it — every MR needs a task
**Notes:** The consequence (permanent floor of untraceable MRs with no Phase 90 corrective action) was stated in the option description and again after the choice. The user did not revise. Treated as a deliberate convention-enforcement decision.

### Follow-up: row columns

| Option | Description | Selected |
|--------|-------------|----------|
| `!iid · key · title · BR/MS/TASK` | Leanest row; state conveyed by icon color only | |
| + author avatar | Adds 20px `CachedAvatar` | |
| + author + state badge | Everything `UnmatchedMRsSection` shows today, plus status columns | ✓ |

**User's choice:** + author + state badge

---

## State classification & flaggability

| Option | Description | Selected |
|--------|-------------|----------|
| Shown, muted, never flagged | All states listed; only open MRs evaluated; merged/closed/draft show — | ✓ |
| Shown and flagged, just not counted | Every MR gets real ✓/⚠ regardless of state; only open feeds the count | |
| Closed hidden, merged+draft shown | Closed MRs drop out entirely | |

**User's choice:** Shown, muted, never flagged

| Option | Description | Selected |
|--------|-------------|----------|
| Own class — excluded like merged/closed | Draft explicitly excluded per DRIFT-08 | |
| Treat as open — flag and count it | Drafts fully evaluated and counted | ✓ |
| Flagged but not counted | Real ✓/⚠ on drafts, kept out of the aggregate | |

**User's choice:** Treat as open — flag and count it
**Notes:** **Conflict.** The preview on the previous question showed drafts muted with — in all columns; this answer says the opposite. Resolved in favour of the more specific answer (drafts evaluated and counted), stated back to the user explicitly with an invitation to correct it. Not contested. This overrides DRIFT-08's literal wording, recorded as D-10.

---

## Count semantics + fetch cost

| Option | Description | Selected |
|--------|-------------|----------|
| Branch + milestone only on the row | One project-wide paginated open-MR fetch serves every row; task check only on the detail page | ✓ |
| Full three-channel count on every row | Adds a Jira issue-key fetch per visible release row | |
| Full count, unreleased rows only | Complete count, bounded fan-out | |

**User's choice:** Branch + milestone only on the row
**Notes:** Accepted consequence — the detail-page count can legitimately exceed the row count.

| Option | Description | Selected |
|--------|-------------|----------|
| MRs with ≥1 flag | "3 drift" = 3 rows need attention | ✓ |
| Total flags | "5 drift" = 5 individual problems | |

**User's choice:** MRs with ≥1 flag

| Option | Description | Selected |
|--------|-------------|----------|
| Eager on mount, like every other query | Own scoped queries, matching the 6 existing ones | ✓ |
| Eager, but reuse one project-wide fetch | Detail page derives all three channels from the shared cached fetch | |
| Lazy — load when the section scrolls into view | | |

**User's choice:** Eager on mount
**Notes:** Chose independent scoped reads over the cheaper shared fetch that was presented as the economical option.

| Option | Description | Selected |
|--------|-------------|----------|
| Channel A only, with a stated reason | Show Jira-linked MRs; BR/MS columns as —; one-line explanation | ✓ (Claude) |
| Section disabled with a reason | Hide the list, show "create the milestone first" | |
| Hide the section completely | | |

**User's choice:** "You decide" → delegated to Claude. Claude selected Channel A only with a stated reason: partial signal beats a blank section, and flagging every MR "no milestone" when no milestone exists is pure noise.

---

## Claude's Discretion

- **D-18** — explicitly delegated ("you decide"): the no-matched-milestone degraded state.
- **D-06** — the Issues table keeps its current MR-cell visuals; only the data source changes.
- **D-12** — the TASK predicate is two-part (no key / key not in fix version), same ⚠, distinguished in the tooltip.
- **D-15** — the row drift count goes in the slot `ReleasesTab.tsx:558-561` already reserves for it.
- **D-20** — `div` + flex rows rather than a `<table>`, with explicit px widths on the narrow cells.

## Deferred Ideas

- Per-MR corrective actions (Phase 90) — status columns should stay extensible so actions attach per cell without a redesign.
- A corrective action for keyless MRs — D-11 flags them with nothing to do about them.
- Routing the detail page through the shared project-wide open-MR fetch — presented and declined (D-16).
- Correcting DRIFT-08's wording in `REQUIREMENTS.md` — doc-only, same class as P88's still-open RELMS-03 correction.
- Virtualizing the MR list — not discussed; flex rows are the safer default given the known 0-width-column defect in the absolute-row table.
- Reviewed but not folded: `priority-stripe-rest-rank.md` — matched on generic keywords only, no overlap with release drift.
