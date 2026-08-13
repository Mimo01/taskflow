# Phase 91: Post-Release Merge-Back Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-11
**Phase:** 91-post-release-merge-back-verification
**Areas discussed:** Detection when the branch is gone, Verdict vs. the existing "released" row, Verdict states + wording, The manual override

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Verdict vs. the existing 'released' row | Sidebar already asserts "was merged and deleted" unverified; replace, sit beside, or banner? Detail-only or list indicator too? | ✓ |
| Detection when the branch is gone | Branches are deleted on merge, so 404 is normal and there's no ref to compare. What counts as evidence? | ✓ |
| Verdict states + wording | How many states; what the advisory reads like when unsure vs. certain. | ✓ |
| The manual override | Where it persists, reversibility, whether new evidence clears it. | ✓ |

**User's choice:** all four.
**Notes:** Discussion started with Detection rather than the listed order, because the available evidence determines what the verdict can honestly claim.

---

## Detection when the branch is gone

### Q1 — What does the content-comparison fallback compare when the branch is deleted?

| Option | Description | Selected |
|--------|-------------|----------|
| Compare the `v<version>` tag | Use the surviving tag as the ref; no tag ⇒ "couldn't determine". Reuses `searchProjectTags` / `findReleaseTag`. | ✓ |
| No compare when branch is gone | Compare only while the branch exists; otherwise "couldn't determine", full stop. | |
| Branch gone = merged | Make today's implicit assumption explicit; zero new API calls, but inference not verification. | |
| You decide | | |

**User's choice:** Compare the `v<version>` tag.
**Notes:** → D-01. Grounded in the Phase 88 live probe: only `release/33.7.0` survived across 265 milestones.

### Q2 — What does a CLOSED (not merged) tracking MR mean?

| Option | Description | Selected |
|--------|-------------|----------|
| Fall through to tag compare | `merged` is the only positive signal; content is the authority. One extra call in a rare case. | ✓ (Claude) |
| Closed = likely not merged | Cheaper, treats a deliberate close as a human signal; risks a confident wrong verdict on a superseded MR. | |
| You decide | | ✓ |

**User's choice:** You decide → Claude chose fall-through.
**Notes:** → D-02. A closed MR is routinely how a superseded/retargeted MR ends.

### Q3 — What merge method is set on the GitLab project?

| Option | Description | Selected |
|--------|-------------|----------|
| Merge commit | SHAs preserved; commit-based comparison reliable. | ✓ |
| Squash | SHAs rewritten; commit comparison produces false negatives (GitLab #36963). | |
| Rebase / fast-forward | Same SHA-mismatch problem as squash. | |
| Not sure | Fall back to a strategy-agnostic diff-based comparison. | |

**User's choice:** Merge commit.
**Notes:** → D-03 and D-04. **This resolves the roadmap's probe for Phase 91 without running one.** Phase 90's `probe.sh` never executed in any environment (no live PAT reachable); asking the user directly settled it in one turn. Comparison is still specified as diff-based (D-04) so it cannot silently break if the project setting changes.

### Q4 — When should the check run?

| Option | Description | Selected |
|--------|-------------|----------|
| Released versions, on load | MERGE-01's exact trigger; zero cost on unreleased releases. | ✓ (Claude) |
| Released versions, on demand | Zero cost until clicked, but a verdict you must remember to fetch. | |
| Always, released or not | Early visibility, but noise + cost on the most-visited pages. | |
| You decide | | ✓ |

**User's choice:** You decide → Claude chose released-versions-on-load.
**Notes:** → D-05.

**Continue check:** "Next area" — how the tracking MR is located left to the planner as mechanical.

---

## Verdict vs. the existing "released" row

### Q1 — Where does the verdict live relative to the Release Branch row?

| Option | Description | Selected |
|--------|-------------|----------|
| New "Merged back" row below it | Two separate facts stay separate; P88 D-20 precedent; Release Branch wording softened. | ✓ (Claude) |
| Fold into the Release Branch row | One row, nothing duplicated — but that row would carry existence + verdict + evidence + control. | |
| Row + banner when not merged | Page-level weight for a rare actionable state; P88 D-20 rejected banners as too heavy. | |
| You decide | | ✓ |

**User's choice:** You decide → Claude chose the separate row, plus softening the existing wording, no banner.
**Notes:** → D-07, D-08. MERGE-03 forbids anything reading as blocking, which rules the banner out independently.

### Q2 — Releases-list indicator, or detail-page only?

| Option | Description | Selected |
|--------|-------------|----------|
| Detail page only | Avoids 1–2 calls per released row; matches P89's UAT removal of the list drift count. | ✓ (Claude) |
| Indicator on released rows | Matches the user's P88 D-17 instinct for list-level visibility, but needs a batched strategy to be viable. | |
| You decide | | ✓ |

**User's choice:** You decide → Claude chose detail-only.
**Notes:** → D-06. Noted as the third list-level release signal considered and dropped.

**Continue check:** "Next area".

---

## Verdict states + wording

### Q1 — Is "no evidence either way" its own state?

| Option | Description | Selected |
|--------|-------------|----------|
| Its own state | Four outcomes; the app admits a gap rather than implying a problem. | ✓ (Claude) |
| Collapse into "likely not merged" | Three outcomes; simpler, but soft-accuses old releases that shipped fine and have no tag. | |
| You decide | | ✓ |

**User's choice:** You decide → Claude chose its own state.
**Notes:** → D-09.

### Q2 — How should the states read?

| Option | Description | Selected |
|--------|-------------|----------|
| Factual, evidence in tooltip | One-line verdict naming the real default branch; advisory tone in "Likely". | ✓ (Claude) |
| Explanatory sentences | Nothing hidden behind hover, but 2–3× vertical space in a one-line-row block. | |
| Glyph only + tooltip | Tightest, but a once-per-release fact is too easy to miss as a bare mark. | |
| You decide | | ✓ |

**User's choice:** You decide → Claude chose factual + tooltip.
**Notes:** → D-10. Options were presented with rendered previews of each wording style.

### Q3 — What happens when the check can't be attempted at all?

| Option | Description | Selected |
|--------|-------------|----------|
| Hide the row entirely | No dead `—` row; P89 D-18's degraded banner already covers no-milestone. | ✓ (Claude) |
| Always show for released versions | Stable row position, discoverable blocker — but restates the P89 banner. | |
| You decide | | ✓ |

**User's choice:** You decide → Claude chose hiding the row.
**Notes:** → D-11.

**Continue check:** "Next area".

---

## The manual override

### Q1 — Where does the override persist?

| Option | Description | Selected |
|--------|-------------|----------|
| Local Tauri Store | Existing Zustand + `createTauriStorage` pattern; survives restarts; local to one machine. | |
| Write back to Jira/GitLab | Genuinely shared, but mutates release metadata to store an app-local UI opinion. | |
| Session only | Zero persistence surface, but means re-confirming forever. | |
| You decide | | |
| **Other (free text)** | **"I dont want to store anything"** | ✓ |

**User's choice:** free text — "I dont want to store anything".
**Notes:** Because MERGE-03 explicitly requires an override, the consequence was put back to the user in plain text with three readings offered: session-only dismissal, no override control at all (and MERGE-03 recorded as descoped), or "you only meant the Jira/GitLab write-back, a local store is fine". The user answered: **"no override control at all"** → D-12. MERGE-03 descoped, not satisfied.

### Q2 — Does the negative wording need softening now that it can't be silenced?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep it as locked | "Likely" carries the advisory; the tooltip makes a wrong verdict visibly wrong. | ✓ (Claude) |
| Soften further | Pure measurement, no judgement — can never be "wrong", but under-delivers MERGE-01. | |
| You decide | | ✓ |

**User's choice:** You decide → Claude chose keeping the locked wording.
**Notes:** → D-13.

---

## Claude's Discretion

Delegated by the user with an explicit "You decide": **D-02** (closed MR falls through), **D-04** (diff-based comparison), **D-05** (released-only, on load), **D-06** (detail page only), **D-07** (separate sidebar row), **D-08** (soften the `released` wording), **D-09** ("couldn't verify" as its own state), **D-10** (factual text + evidence tooltip), **D-11** (hide the row when inapplicable), **D-13** (keep the negative wording as locked).

User decisions, hard: **D-01** (tag as compare ref), **D-03** (merge commit — resolves the roadmap probe), **D-12** (no override control — descopes MERGE-03).

---

## Deferred Ideas

- A manual override in any persisted form — MERGE-03, descoped by D-12
- A Releases-list merge-back indicator — declined on fan-out cost (D-06)
- Linking the verdict out to GitLab's compare view or the tracking MR
- The released-version-with-a-surviving-branch case (drift in the other direction)
- Closing `flattenGitLabError` back into the P88 create dialogs (carried from P90)
- Correcting RELMS-03's `1.1.0` milestone format in `REQUIREMENTS.md` (carried from P88 D-01)

**Reviewed todo, not folded:** `priority-stripe-rest-rank.md` — generic-keyword false positive, declined for the third phase running.
