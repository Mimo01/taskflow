# Quick Task 260606-rgc: Make the Epics Page Match the Backlog View — Research

**Researched:** 2026-06-06
**Domain:** React/TSX UI parity — single file (`EpicsPage.tsx`)
**Confidence:** HIGH (all findings verified by direct source read)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Table header:** Remove the `<thead>` block entirely; backlog renders no column-header row.
- **Status component:** Keep the **static** status pill (do NOT switch to `StatusPopover`).
  Render via `statusPillClass(epic.status.statusCategory?.key)` from `@/lib/statusStyles`.
  No extra geometry classes (per statusStyles contract).
- **Assignee:** Always render `CachedAvatar`, matching BacklogRow exactly:
  `<CachedAvatar url={epic.assignee?.avatarUrls?.['48x48'] || null} name={epic.assignee?.displayName || 'Unassigned'} size={24} />`.
  Replaces the current conditional so unassigned epics get the distinct dashed-avatar treatment.
- **Layout scope:** Targeted only. Keep table/`<tbody>`; keep color bar, epic-name badge, key column.
  Do NOT import the full BacklogRow anatomy (issue-type icon, priority icon, story points).

### Claude's Discretion
- Keep the `<table>`/`<tbody>` structure; only `<thead>` removed.
- Trivial cell-padding tweaks to echo backlog row density (optional).

### Deferred Ideas (OUT OF SCOPE)
- None stated.
</user_constraints>

## Summary

All three changes live in `taskflow/src/routes/dashboard/EpicsPage.tsx`. The file is a
**non-virtualized static `<table className="w-full text-sm">`** rendered inside an
`overflow-auto` div (lines 150, 185–208). It is NOT the virtualized backlog table, so the
project's "0-width column in position:absolute rows" pitfall does **not** apply here — normal
CSS table-auto column sizing is in effect.

Two of the three changes are real edits (thead removal + assignee parity). The status pill is
**already canonical and matches StoryHeaderRow exactly — it is a no-op confirmation** (see
Finding 3).

**Primary recommendation:** Delete the `<thead>` block (lines 186–202), move the column width
classes onto the `<td>` cells via a `<colgroup>` OR onto the first body row's cells to preserve
current sizing, and replace the conditional assignee cell with the verbatim BacklogRow snippet.
Leave the status `<span>` untouched.

## Finding 1 — Table Header Removal + Column Sizing

**The `<thead>` block is lines 186–202** of `EpicsPage.tsx`:

```tsx
<thead className="border-b bg-muted/10">
  <tr>
    <th className="w-1 p-0" />
    <th className="px-4 py-2 ...">Name</th>
    <th className="w-28 px-3 py-2 ...">Key</th>
    <th className="w-32 px-3 py-2 ...">Status</th>
    <th className="w-12 px-3 py-2 ...">Assignee</th>
  </tr>
</thead>
```

Delete lines 186–202 entirely (the whole `<thead>…</thead>`). Keep `<tbody>` (203–207).

**Column-width consequence — MUST be addressed:**
Under CSS table-`auto` layout the browser computes column widths from the **widest cell across
ALL rows including the header**. The header currently carries the only explicit width
constraints: `w-28` (Key), `w-32` (Status), `w-12` (Assignee), `w-1` (color bar). The body
`<td>` cells (lines 44–78) have NO width classes — only the color-bar `<td>` repeats `w-1`
(line 44).

Therefore **removing the thead alone WILL change column widths**: Key/Status/Assignee lose their
explicit caps and will size to content. The visible effect is usually minor (content is short —
a key, a pill, a 24px avatar), but to *preserve current sizing exactly* the widths must move.

Recommended approach (cleanest, Claude's discretion permits): add a `<colgroup>` immediately
after the opening `<table>` tag, before `<tbody>`:

```tsx
<table className="w-full text-sm">
  <colgroup>
    <col className="w-1" />
    <col />            {/* Name — flexes */}
    <col className="w-28" />   {/* Key */}
    <col className="w-32" />   {/* Status */}
    <col className="w-12" />   {/* Assignee */}
  </colgroup>
  <tbody>
    ...
  </tbody>
</table>
```

Alternative: replicate the width classes onto the `<td>`s in `EpicRow` (e.g. add `w-28` to the
key cell line 62, `w-32` to the status cell line 65, `w-12` to the assignee cell line 70). The
color-bar `<td>` already has `w-1` (line 44) so it's safe either way.

> NOTE: BacklogRow itself does NOT use a colgroup — it relies on per-`<td>` width classes plus
> explicit-px inner spans (a virtualization workaround that does not apply here). For a static
> table, `<colgroup>` is the idiomatic and least-invasive way to keep sizing after the header
> goes. Either approach satisfies the "no visual width change" goal; pick one.

**Confirmation:** EpicsPage table is static/non-virtualized — verified (lines 185–208, plain
`<table>`/`<tbody>`/`.map()`, no react-virtual, no `position:absolute` rows). The
virtualized-table 0-width pitfall is NOT in play.

## Finding 2 — Assignee Parity

**BacklogRow's exact assignee cell** (`BacklogRow.tsx` lines 196–203):

```tsx
{/* Assignee cell */}
<td className="w-10 pl-2 pr-4 py-2 density-compact:py-1 density-comfortable:py-3">
  <CachedAvatar
    url={issue.fields.assignee?.avatarUrls['48x48'] || null}
    name={issue.fields.assignee?.displayName || 'Unassigned'}
    size={24}
  />
</td>
```

**Type confirmation:** `EpicEnriched.assignee` is `JiraIssue['fields']['assignee']`
(verified — `src/services/jira.ts:1956` and `src/services/jira/types.ts:259`, identical). So the
shape is exactly the same as BacklogRow's `issue.fields.assignee`. `avatarUrls['48x48']` and
`displayName` are valid.

**Current EpicRow assignee cell** (`EpicsPage.tsx` lines 69–78) — conditional, no Unassigned
fallback:

```tsx
<td className="px-3 py-3">
  {epic.assignee ? (
    <CachedAvatar
      url={epic.assignee.avatarUrls?.['48x48']}
      name={epic.assignee.displayName}
      size={24}
    />
  ) : null}
</td>
```

**Exact replacement** (keep the existing `<td className="px-3 py-3">` wrapper per "targeted
changes / keep epic-specific cells"; only the inner content changes to match backlog semantics):

```tsx
<td className="px-3 py-3">
  <CachedAvatar
    url={epic.assignee?.avatarUrls?.['48x48'] || null}
    name={epic.assignee?.displayName || 'Unassigned'}
    size={24}
  />
</td>
```

This matches the CONTEXT.md decision verbatim. Note `avatarUrls?.['48x48']` keeps the optional
chain (epic's existing safer access); BacklogRow uses non-optional `avatarUrls['48x48']`. The
optional-chain form is strictly safer and produces identical output, so prefer it.

**Why this fixes the bug:** `CachedAvatar` computes `showUnassigned = !url && isUnassigned(name)`
(`cached-avatar.tsx` line 63, where `isUnassigned` lowercase-matches `"unassigned"`). Passing
`name="Unassigned"` with `url=null` triggers the dashed-border `User`-icon treatment (lines
72–84). The current conditional renders nothing for unassigned epics, so the fallback never
fires — that is exactly the parity gap.

## Finding 3 — Status Pill (NO-OP CONFIRMATION)

**EpicsPage status span** (`EpicsPage.tsx` lines 65–67):

```tsx
<td className="px-3 py-3">
  <span className={statusPillClass(epic.status.statusCategory?.key)}>{epic.status.name}</span>
</td>
```

**Canonical usage in StoryHeaderRow** (`StoryHeaderRow.tsx` line 184):

```tsx
<span className={statusPillClass(statusCategoryKey)}>{statusName}</span>
```

**Verdict: NO visual drift. The status pill is already canonical — this is a no-op confirmation,
not an edit.**

- Same helper: `statusPillClass` imported from `@/lib/statusStyles` in both files
  (EpicsPage line 19, StoryHeaderRow line 30).
- Same category-key access: `…statusCategory?.key` (EpicsPage passes
  `epic.status.statusCategory?.key`; StoryHeaderRow receives the same value upstream).
- Same wrapping element: a bare `<span className={statusPillClass(...)}>` with the status name as
  text — identical.
- **No extra geometry classes** on EpicsPage's span. The statusStyles contract
  (`statusStyles.ts` lines 56–59, 72–73) forbids adding `rounded*`, `px-*`, `py-*`, `text-xs`,
  `font-*`, `inline-flex`, `min-w-*`, `text-center` — all already baked into
  `STATUS_PILL_LAYOUT_CLASS` (line 68). EpicsPage adds none. Compliant.

The planner should record this as "verify only — no code change to the status span."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unassigned avatar fallback | Custom `epic.assignee ? … : <placeholder>` | `CachedAvatar` with `name="Unassigned"` + `url={null}` | The dashed-border + User-icon treatment is built into `CachedAvatar` (cached-avatar.tsx 63, 72–84). Re-deriving it diverges from backlog. |
| Status pill styling | Inline `rounded px-… bg-…` classes | `statusPillClass(key)` | Single source of truth; adding geometry classes violates the statusStyles contract. |
| Column widths after thead removal | Leaving widths only on a deleted `<thead>` | `<colgroup>` or per-`<td>` width classes | Header-only widths vanish with the header under table-auto layout. |

## Common Pitfalls

### Pitfall 1: Removing `<thead>` silently shrinks/regrows columns
**What goes wrong:** Key/Status/Assignee columns reflow because their only width constraints
(`w-28`/`w-32`/`w-12`) lived on the deleted `<th>`s.
**How to avoid:** Add a `<colgroup>` (preferred) or copy the width classes onto the body `<td>`s.
**Warning sign:** Status pill column visibly narrower/wider than before; avatar column hugging.

### Pitfall 2: Forgetting the `|| 'Unassigned'` name fallback
**What goes wrong:** Passing `name={epic.assignee?.displayName}` (undefined when unassigned)
makes `isUnassigned()` return false → no dashed avatar → blank cell, defeating the change.
**How to avoid:** Use `name={epic.assignee?.displayName || 'Unassigned'}` exactly.

## Runtime State Inventory

Not applicable — pure UI/markup change, no rename/migration, no stored or external state.
- Stored data: None.
- Live service config: None.
- OS-registered state: None.
- Secrets/env vars: None.
- Build artifacts: None.

## Environment Availability

SKIPPED — code-only change, no external dependencies.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-1 | Remove `<thead>` from epics table | Finding 1 — lines 186–202; add `<colgroup>` to preserve widths |
| REQ-2 | Assignee renders like BacklogRow (always CachedAvatar + Unassigned fallback) | Finding 2 — exact replacement snippet, type-verified identical assignee shape |
| REQ-3 | Status pill visually identical to canonical static pill | Finding 3 — already canonical, NO-OP confirmation |

## Assumptions Log

Empty — all claims verified by direct source read in this session.

## Sources

### Primary (HIGH confidence)
- `taskflow/src/routes/dashboard/EpicsPage.tsx` — target file (thead 186–202, EpicRow 35–81)
- `taskflow/src/routes/dashboard/BacklogRow.tsx` — assignee cell 196–203
- `taskflow/src/routes/dashboard/StoryHeaderRow.tsx` — canonical status pill 184
- `taskflow/src/lib/statusStyles.ts` — `statusPillClass` + contract 56–77
- `taskflow/src/components/ui/cached-avatar.tsx` — unassigned logic 63, 72–84
- `taskflow/src/services/jira.ts:1956` & `taskflow/src/services/jira/types.ts:259` — `EpicEnriched.assignee` type

## Metadata

**Confidence breakdown:**
- Header removal + sizing: HIGH — exact line numbers, table-auto behavior well established.
- Assignee parity: HIGH — type identity verified, exact snippet from both files.
- Status pill: HIGH — byte-level comparison of both usages, confirmed no-op.

**Research date:** 2026-06-06
**Valid until:** 2026-07-06 (stable; only invalidated if EpicsPage.tsx is refactored)
</content>
</invoke>
