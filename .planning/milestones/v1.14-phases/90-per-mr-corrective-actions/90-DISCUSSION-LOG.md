# Phase 90: Per-MR Corrective Actions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-11
**Phase:** 90-Per-MR Corrective Actions
**Areas discussed:** Action affordance, Pending / failure states, Post-success behavior, Unavailable states

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Action affordance | Is the ⚠ in the BR/MS cell itself the button, or a separate control? | ✓ |
| Pending / failure states | What a cell shows mid-flight and after a failure; how retry is triggered | ✓ |
| Post-success behavior | Does a fixed row re-sort? Does the header count decrement immediately? | ✓ |
| Unavailable states | MRFIX-04 rendering when the release branch doesn't exist | ✓ |

**User's choice:** all four.

---

## Action affordance

### Q1 — How does the user trigger a fix on a flagged cell?

| Option | Description | Selected |
|--------|-------------|----------|
| The ⚠ mark itself is the button | Zero extra width; risk that a status mark doesn't read as clickable | |
| Trailing 'Fix' buttons per row | Unambiguous; adds ~90px permanent row width, squeezes the title | |
| Hover-reveal control in the cell | ⚠ at rest, swaps to a clickable icon on hover; no layout shift | ✓ |

**User's choice:** Hover-reveal control in the cell.
**Notes:** Consistent with the recorded "hover affordance, no layout shift" pattern and P89 D-04's compactness constraint.

### Q2 — What reveals the control: row hover or cell hover?

| Option | Description | Selected |
|--------|-------------|----------|
| Row hover reveals both actionable cells | Row announces "there are fixes here" | |
| Cell hover — only the hovered cell swaps | Quieter; a 28px target nobody hovers is near-invisible | |
| Row hover reveals, cell hover emphasizes | Discoverable at row level, precise at cell level | ✓ |

**User's choice:** Row hover reveals, cell hover emphasizes.

### Q3 — What icon replaces the ⚠ on hover?

| Option | Description | Selected |
|--------|-------------|----------|
| Distinct icon per action | GitBranch in BR, Milestone in MS — icon says what happens | ✓ (Claude) |
| One generic 'fix' icon in both cells | Consistent but visually identical; relies on column position | |
| Arrow-right → into a check | Lightest weight, vaguest meaning | |

**User's choice:** "You decide."
**Notes:** Claude chose distinct icons plus a tooltip naming the exact change ("Retarget to release/33.7.0").

### Q4 — Should the action be focus-reachable?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — focus reveals it like hover | Real `<button>` in tab order; `:focus-visible` shares the reveal rule | ✓ (Claude) |
| No — mouse-only is fine here | Desktop app, mouse-driven; no other row surface is keyboard-complete | |

**User's choice:** "You decide."
**Notes:** Claude chose yes — the cell must be a `<button>` to be clickable at all, so the cost is one CSS selector.

---

## Pending / failure states

### Q1 — What does the cell show while the write is in flight?

| Option | Description | Selected |
|--------|-------------|----------|
| Spinner in the cell, optimistic ✓ on settle | Honest about the async gap; slight tension with "optimistic" | ✓ |
| Immediate optimistic ✓, no spinner | Truest to MRFIX-01/02 wording and the StatusPopover precedent | |
| Optimistic ✓ with a dimmed/pulsing treatment | Both at once; subtle on a 14px glyph | |

**User's choice:** Spinner in the cell, ✓ on settle.
**Notes:** Reconciled in CONTEXT D-06 — the cache write stays optimistic-with-rollback; only the glyph waits for the server. Recorded explicitly so downstream agents don't "correct" it toward the requirement's literal wording.

### Q2 — What does the user see when the write fails?

| Option | Description | Selected |
|--------|-------------|----------|
| Cell reverts to ⚠ in red + tooltip carries the error | All inside 28px; nothing reflows; error text is hover-only | ✓ (Claude) |
| Red cell + a one-line error under the row | Readable without hovering; costs vertical height and reflows | |
| Red cell + error summary above the table | Fixed cost; puts the error far from its row | |

**User's choice:** "You decide."
**Notes:** Claude chose the in-cell red mark + tooltip; clicking retries. Surfaced during this answer: `88-REVIEW.md` WR-01 (`[object Object]` error bodies) becomes blocking here, since the tooltip renders that string directly. Recorded as CONTEXT D-10.

### Q3 — Does the red failure state survive a background refetch?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — error state is local and sticky until retried | Component state keyed by MR+action; the P78 drag-gate class of fix | ✓ (Claude) |
| No — refetch resets it to a plain ⚠ | Simpler; a failure the user stepped away from loses its explanation | |
| Sticky, but auto-clears after ~30s | Middle ground; costs a timer and the IN-01 uncleared-setTimeout hazard | |

**User's choice:** "You decide."
**Notes:** Claude chose sticky with no timer.

### Q4 — What can the user do while one action is in flight?

| Option | Description | Selected |
|--------|-------------|----------|
| Other cell stays live; only the in-flight cell locks | Truest reading of MRFIX-03 "independent"; double-click can't double-fire | ✓ (Claude) |
| Whole row locks until the action settles | Safer against concurrent PUTs; costs an unnecessary wait | |
| Other cell live, but queued not concurrent | Avoids the race without blocking input; adds a per-row queue to build | |

**User's choice:** "You decide."
**Notes:** Claude chose per-cell locking — the two PUTs send disjoint fields and cannot clobber each other, so no queue is warranted.

---

## Post-success behavior

### Q1 — Does a fixed row jump out of the flagged block?

| Option | Description | Selected |
|--------|-------------|----------|
| No — sort freezes while you're working the list | Row turns ✓ in place; re-sorts on next mount | ✓ (Claude) |
| Yes — live re-sort | Flagged block visibly shrinks; row moves between the two fixes | |
| Freeze only while the pointer is in the list | Rearranges when you move the mouse away — startling in its own way | |

**User's choice:** "You decide."
**Notes:** Claude chose the freeze — wrong-branch and missing-milestone co-occur constantly, so live re-sorting would move a two-flag row out from under the pointer mid-repair.

### Q2 — What refreshes beyond the cell?

| Option | Description | Selected |
|--------|-------------|----------|
| Header count now; Releases-list count on its own refetch | No cross-page invalidation fired | |
| Both — invalidate the list page's MR query too | Correct on back-navigation; costs a project-granularity invalidation | ✓ (Claude, then corrected) |
| Header count only after server confirms | Never shows a number the server disagrees with; count lags the ✓ | |

**User's choice:** "You decide."
**Notes:** Claude initially chose "both", then corrected the premise on verification: there **is no Releases-list drift count** — DRIFT-09 was built in Phase 89 and removed at UAT (`c681931e`), and `ReleasesTab.tsx` has no project-wide open-MR query. The surviving decision (CONTEXT D-12/D-13) is: header badge decrements immediately, and all three detail-page channel queries are invalidated at project granularity. Nothing cross-page.

---

## Unavailable states

### Q1 — What does the BR cell show when the release branch doesn't exist? (MRFIX-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Still flagged ⚠, but inert with an explanatory tooltip | Keeps the column honest; points at the P88 create-branch button | ✓ (Claude) |
| ⚠ stays, control appears but is visibly disabled | Teaches that the action exists; a control that can never fire | |
| BR renders — (not evaluated) while no branch exists | Cleanest logically; hides a real problem and shrinks the count | |

**User's choice:** "You decide."
**Notes:** Claude chose the inert flagged cell. The *no matched milestone* case was not asked — P89 D-18 already locks BR and MS to `—` under the degraded banner.

### Q2 — If the probe confirms approvals really reset on retarget, does "no warning" change?

| Option | Description | Selected |
|--------|-------------|----------|
| No — no warning either way, decision stands | Probe outcome is a doc fact, not a dialog | ✓ |
| Yes — if approvals really reset, add a tooltip line | Still no dialog; consequence visible before the click | |
| Yes — that would earn a confirm on retarget specifically | Reverses a locked decision for one action | |

**User's choice:** No — decision stands.
**Notes:** Asked deliberately as a challenge to the locked no-dialog decision, with a confirm option on the table. The user held the line, making this a reaffirmed decision rather than an unexamined default. Recorded as CONTEXT D-16 (hard).

---

## Claude's Discretion

The user delegated nine of thirteen questions: the action icon (D-03), focus-reachability (D-04), failure rendering (D-07), failure stickiness (D-08), concurrency locking (D-09), sort freeze (D-11), count decrement (D-12), invalidation scope (D-13), and the missing-branch BR cell (D-14).

They gave firm answers on the four that change what they will actually see: hover-reveal inside the cell (D-01), row-reveals/cell-emphasizes (D-02), spinner before checkmark (D-06), and no warning on retarget regardless of the probe (D-16).

## Deferred Ideas

- A corrective action for keyless MRs ("link an issue") — carried from P89 D-11
- A bulk / "fix all flagged" action — excluded by the milestone goal
- Restoring the Releases-list aggregate drift count (DRIFT-09, removed at P89 UAT)
- Keyboard-complete rows across the app's row surfaces
- An undo affordance after a successful fix
- Applying this phase's GitLab error extractor back to the P88 create dialogs (closes WR-01)
