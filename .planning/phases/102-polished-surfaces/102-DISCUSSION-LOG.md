# Phase 102: Polished Surfaces - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-18
**Phase:** 102-polished-surfaces
**Areas discussed:** Comment editor growth, Comment action row, Create Epic modal shape, Bulk & Edit Release sizing

---

## Comment editor growth

| Option | Description | Selected |
|--------|-------------|----------|
| Collapsed, expands on focus | A one-line idle field that grows on focus and shows the action row | ✓ |
| Always open, auto-grows | A 3-line minimum that grows to a cap | |
| Keep today's sizing | 96px min / 280px max | |

**Max height:** "You decide. I want it to feel consistent and easy to use."
**Edit sizing:** "Same as previous answer" (Claude decides, consistent with the composer).

## Comment action row

| Option | Description | Selected |
|--------|-------------|----------|
| Note left · Attach + buttons right | One shared row for the composer and the edit | ✓ |
| Attach left, buttons right | | |
| Today's row, tidied | No Attach | |

**Notes:** "Make it feel consistent across the app."
**Composer Cancel:** you decide → none. **Row visibility:** you decide → only when expanded.

## Create Epic modal shape

| Option | Description | Selected |
|--------|-------------|----------|
| Same shell, single column | | |
| Same shell, narrower | | |
| Two-column with sidebar | | ✓ |

**Notes:** "Make it feel consistent."
- **Sidebar contents:** reuse the Issue sidebar (createmeta-driven), selected over minimal context and over going back to a single column.
- **Create another:** no.
- **Copy and controls:** align fully.

## Bulk & Edit Release sizing

- **Bulk:** you decide → the Issue-modal shell in one column, with the toolbar pinned and the rows scrolling.
- **Edit Release:** two-column (main: name and descriptions; sidebar: date and Released), selected over a larger single column.
- **Release text:** you decide → plain textareas, no preview.

**Mid-discussion user message:** "I want the inputs and editors to feel consistent across the app." Captured as cross-cutting D-01/D-02.

## Claude's Discretion

- The composer/edit height cap and the edit opening size.
- The shared shell vs an Epic mode of the Issue modal.
- Bulk's fixed or fit height.
- Narrow behaviour.

## Deferred Ideas

- A Markdown preview for the milestone description.
