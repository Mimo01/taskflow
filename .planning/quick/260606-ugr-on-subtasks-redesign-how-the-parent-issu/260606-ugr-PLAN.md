---
phase: quick-260606-ugr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/jira.ts
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
autonomous: true
requirements: [UGR-01]
must_haves:
  truths:
    - "On a subtask's full page AND peek panel, the parent issue renders as a prominent, distinct, clickable card/banner above the issue key + title (not a faint muted breadcrumb)."
    - "The parent card shows the parent's real issue-type icon, a 'Parent' context label, the parent key in mono, and the parent summary in foreground weight (truncating on overflow)."
    - "A trailing navigation affordance (ArrowUpRight) is pinned to the right edge of the card."
    - "Clicking the parent card opens the parent via the existing onOpenIssue(parent.key), preserving the recent peek breadcrumb-trail behavior."
    - "The card has an accessible label (e.g. 'Open parent issue PROJ-12')."
    - "If the parent's issuetype is absent at runtime, the icon is omitted and the layout still holds (graceful fallback)."
    - "When present, the parent status pill is CORRECTLY COLORED — the color class is derived from statusCategory.key (not the human status name), and the pill text shows the status name."
    - "npm run check (biome check + tsc) stays GREEN with no new `any` casts."
  artifacts:
    - path: "taskflow/src/services/jira.ts"
      provides: "Widened parent type (optional issuetype + status with statusCategory.key) on the JiraIssueDetail.fields.parent that IssueDetailContent consumes (jira.ts:1239)"
      contains: "statusCategory?: { key: string }"
    - path: "taskflow/src/routes/dashboard/IssueDetailContent.tsx"
      provides: "Prominent clickable parent card replacing the muted breadcrumb row, with a correctly-keyed status pill"
      contains: "IssueTypeIcon"
  key_links:
    - from: "taskflow/src/routes/dashboard/IssueDetailContent.tsx"
      to: "onOpenIssue(parent.key)"
      via: "button onClick"
      pattern: "onOpenIssue\\?\\(parent\\.key\\)"
    - from: "taskflow/src/routes/dashboard/IssueDetailContent.tsx"
      to: "IssueTypeIcon"
      via: "parent.fields.issuetype.name typeName prop"
      pattern: "IssueTypeIcon"
    - from: "taskflow/src/routes/dashboard/IssueDetailContent.tsx"
      to: "statusPillClass (color) keyed on parent.fields.status.statusCategory.key"
      via: "statusPillClass takes a statusCategory KEY, not the status name; pill text is parent.fields.status.name"
      pattern: "statusPillClass\\(parent\\.fields\\.status\\?\\.statusCategory\\?\\.key\\)"
    - from: "taskflow/src/routes/dashboard/IssueDetailContent.tsx"
      to: "JiraIssueDetail.fields.parent.fields.issuetype (widened at jira.ts:1239)"
      via: "JiraIssueDetail imported from @/services/jira (resolves to jira.ts)"
      pattern: "parent\\.fields\\.issuetype"
---

<objective>
Redesign how a subtask's parent-issue link is displayed. Replace the small muted
breadcrumb row (`IssueDetailContent.tsx` ~225-235) with a prominent, polished,
clickable parent card/banner that gives the parent real visual weight — because
for a subtask, the parent matters. This component is shared by the full page
(IssueDetailView two-column) and the peek panel (PeekPanel → IssueDetailView
single-column), so one edit covers BOTH surfaces.

Purpose: A subtask without obvious parent context is disorienting. The current
breadcrumb reads as a faint afterthought. The locked design makes the parent a
distinct, tappable object with type icon, "Parent" label, key, summary, status,
and a nav affordance.

Output: Widened parent TS type at the consumed site (so the icon renders without
`any` casts) + the new parent card in the shared content component. npm run check GREEN.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/quick/260606-ugr-on-subtasks-redesign-how-the-parent-issu/260606-ugr-CONTEXT.md
@taskflow/src/routes/dashboard/IssueDetailContent.tsx
@taskflow/src/services/jira.ts
@taskflow/src/components/ui/issue-type-icon.tsx

Key facts (verified during scouting — do not re-discover):
- `IssueDetailContent.tsx` line 219: `const parent = issue.fields.parent;`. Line 190:
  `const isSubtask = issue.fields.issuetype.subtask;`. Both already in scope.
- The breadcrumb to REPLACE is lines ~225-235 (the `{isSubtask && parent && (...)}` block).
- `IssueTypeIcon` (`@/components/ui/issue-type-icon`) takes `typeName: string` and a
  `className` (default `w-3.5 h-3.5 shrink-0`). It has a graceful default branch for
  unknown type names. NOT yet imported in IssueDetailContent — add the import.
- `statusPillClass` (from `@/lib/statusStyles`) and `cn` (from `@/lib/utils`) are ALREADY imported.
- `ArrowUpRight` from lucide-react is ALREADY imported (line 3).
- STATUS PILL CONTRACT (verified at statusStyles.ts:75): `statusPillClass(categoryKey: string | undefined)`
  expects a statusCategory KEY (e.g. "done", "indeterminate", "new") — NOT the human-readable
  status name. Passing the name falls through to the default branch and renders a MISCOLORED pill,
  and tsc will NOT catch it (the fn accepts any string). All existing callers pass the key, e.g.
  `IssueDetailContent.tsx:296`: `statusPillClass(story.fields.status.statusCategory?.key)` with
  `{story.fields.status.name}` as the pill TEXT. Task 2 MUST follow this exact pattern.
- TYPE GOTCHA (jira.ts dual-file): `IssueDetailContent.tsx:15-17` imports `JiraIssueDetail`
  from `@/services/jira`. With both `jira.ts` and `jira/index.ts` present, that bare specifier
  resolves to the FILE `jira.ts`. The CONSUMED interface is `export interface JiraIssueDetail`
  at **jira.ts:1212**, and the parent field the component types against is **jira.ts:1239**
  (`parent?: { id: string; key: string; fields: { summary: string } }`). `fetchIssueDetail`
  (jira.ts:1351) returns THIS type. VERIFIED: no consumer in src/ imports `JiraIssueDetail`
  from `@/services/jira/types`, so widening `jira/types.ts:191` is DEAD for this component —
  it does NOT affect the typecheck. Widen ONLY jira.ts:1239.
- DATA: `fetchIssueDetail` requests the top-level `parent` field. Jira DC returns parent's
  nested `issuetype` + `status` (with statusCategory) + `summary`. Proof: `jira.ts:832` already reads
  `issue.fields.parent?.fields?.issuetype?.name` at runtime. The data is present; only the
  TS type at jira.ts:1239 narrows `parent.fields` to `{ summary }`.
- Respect commit 943cba44 (peek breadcrumb-trail fix): clicking parent must keep routing
  through `onOpenIssue(parent.key)` — do NOT change the navigation contract.
- Out of scope: `SubtasksPanel.tsx` inline parent display. No backend/API field changes.
  Also out of scope: the other narrowed parent sites (`jira/types.ts:46`, `jira/types.ts:191`,
  `jira.ts:169`) — no code consumed by this card reads them, so leave them untouched to avoid churn.
- `statusPillClass` requires a flex-item parent for its min-w/text-center to hold (project
  memory: statuspill-needs-flex-parent) — wrap any status pill in a `flex` container.
- Run `npm run check` from the `taskflow/` directory. `biome lint` ≠ `check`.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Widen the consumed JiraIssueDetail parent type (jira.ts:1239) to expose issuetype + status (with statusCategory.key)</name>
  <files>taskflow/src/services/jira.ts</files>
  <action>
    Widen the parent field on the `JiraIssueDetail` interface — the type
    `IssueDetailContent.tsx` actually consumes — so the parent's issue-type icon and the
    correctly-keyed status pill can render without `any` casts.

    Edit the SINGLE site at **jira.ts:1239** (inside `export interface JiraIssueDetail`
    that starts at jira.ts:1212). Change:
      `parent?: { id: string; key: string; fields: { summary: string } };`
    to:
      `parent?: { id: string; key: string; fields: { summary: string; issuetype?: { name: string; iconUrl?: string }; status?: { name: string; statusCategory?: { key: string } } } };`

    The `status` shape MUST expose `statusCategory?: { key: string }` (not just `{ name }`).
    Task 2 colors the pill from `status.statusCategory.key` — `statusPillClass` takes a
    category KEY, not the status name. Without `statusCategory.key` in the type, the correct
    call cannot be made.

    Do NOT touch any other parent site (`jira/types.ts:46`, `jira/types.ts:191`,
    `jira.ts:169`): verified that no code consumed by this card imports those types, so
    editing them is dead churn. jira.ts:1239 is the only site that makes Task 2's
    `parent.fields.issuetype.name` and `parent.fields.status?.statusCategory?.key` access typecheck.

    Keep `issuetype` and `status` OPTIONAL (the `?`) — runtime may omit them for some
    issue types. Do NOT alter the field-request strings in `fetchIssueDetail` — `parent` is
    already requested and Jira DC expands its nested fields automatically (proven by jira.ts:832
    reading `parent.fields.issuetype.name`). This task is type-only; no behavior change.
  </action>
  <verify>
    <automated>cd taskflow && awk 'NR>=1212 && NR<=1300 && /parent\?:/ && /issuetype\?:/ && /status\?:/ && /statusCategory\?:/{f=1} END{exit f?0:1}' src/services/jira.ts && echo PARENT_WIDENED_AT_1239</automated>
  </verify>
  <done>The `JiraIssueDetail.fields.parent` at jira.ts:1239 (interface body 1212+) includes optional `issuetype?: { name: string; iconUrl?: string }` and `status?: { name: string; statusCategory?: { key: string } }`. No other parent site was edited. tsc resolves `parent.fields.issuetype` and `parent.fields.status.statusCategory.key` without `any` (proven by the Task 3 gate).</done>
</task>

<task type="auto">
  <name>Task 2: Replace the muted breadcrumb with a prominent clickable parent card</name>
  <files>taskflow/src/routes/dashboard/IssueDetailContent.tsx</files>
  <action>
    Add the import for `IssueTypeIcon` from `@/components/ui/issue-type-icon` to the import
    block (statusPillClass, cn, ArrowUpRight are already imported).

    Replace the existing breadcrumb block (the `{isSubtask && parent && ( ... )}` `<button>`
    at lines ~225-235) with a prominent, clickable parent card implementing the LOCKED design
    from CONTEXT.md. Render it in the same location — above the issue key `<p>` and title `<h2>`.

    Card requirements (per CONTEXT.md locked design):
      - Render as a single full-width `<button type="button">` (so it is keyboard/tappable as one object).
      - Container styling: rounded, a subtle elevated surface (use `bg-muted/50` with `border`),
        comfortable padding (`px-3 py-2`), `w-full`, left-aligned content, and a clear hover
        state that shifts the background (e.g. `hover:bg-muted`) — NOT merely underline. Use `cn(...)`.
      - Layout: a horizontal flex row, `items-center gap-2`, with `mb-2` below the card.
      - Content left→right:
          1. Parent issue-type icon: `<IssueTypeIcon typeName={parent.fields.issuetype.name} />`,
             rendered ONLY when `parent.fields.issuetype?.name` exists (graceful fallback: omit icon,
             layout still holds via flex).
          2. A muted uppercase xs "Parent" context label (e.g. `text-[10px] font-medium uppercase
             tracking-wide text-muted-foreground`), kept `shrink-0`.
          3. Parent key in mono (`font-mono text-xs`), `shrink-0`.
          4. Parent summary in FOREGROUND weight (`text-sm font-medium text-foreground`), wrapped so
             it truncates on overflow (peek is narrow): give it `truncate` and ensure the wrapper has
             `min-w-0 flex-1` so truncation engages. Add `pr-0.5` if needed to avoid glyph clipping.
          5. OPTIONALLY the parent status pill (lean toward including per CONTEXT discretion): render
             ONLY when `parent.fields.status?.name` is present. CRITICAL — `statusPillClass` takes a
             statusCategory KEY, not the status name (statusStyles.ts:75; all callers pass the key,
             e.g. IssueDetailContent.tsx:296). So:
               - COLOR class: `statusPillClass(parent.fields.status?.statusCategory?.key)`
               - TEXT content: `{parent.fields.status?.name}`
             Passing `status.name` to statusPillClass renders a miscolored pill and tsc will NOT
             catch it. WRAP the pill in a `flex shrink-0` div (statusPillClass needs a flex-item
             parent — project memory statuspill-needs-flex-parent).
          6. Trailing nav affordance pinned right: `<ArrowUpRight className="size-4 text-muted-foreground shrink-0 ml-auto" />`
             (the summary wrapper's `flex-1` already pushes it right; `ml-auto` is a safety belt).
      - Behavior: `onClick={() => onOpenIssue?.(parent.key)}` — unchanged navigation contract
        (preserves the commit 943cba44 peek breadcrumb-trail behavior).
      - Accessibility: `aria-label={`Open parent issue ${parent.key}`}`.

    Do NOT touch the `<p>{issue.key}</p>` and `<h2>{summary}</h2>` lines below — only replace
    the breadcrumb block above them. Do NOT modify SubtasksPanel.tsx.
  </action>
  <verify>
    <automated>cd taskflow && grep -q "import { IssueTypeIcon }" src/routes/dashboard/IssueDetailContent.tsx && grep -q "onOpenIssue?.(parent.key)" src/routes/dashboard/IssueDetailContent.tsx && grep -q "Open parent issue" src/routes/dashboard/IssueDetailContent.tsx && grep -q "IssueTypeIcon typeName={parent.fields.issuetype" src/routes/dashboard/IssueDetailContent.tsx && grep -q "statusPillClass(parent.fields.status?.statusCategory?.key)" src/routes/dashboard/IssueDetailContent.tsx && ! grep -q "statusPillClass(parent.fields.status.name)" src/routes/dashboard/IssueDetailContent.tsx && ! grep -q "— {parent.fields.summary}" src/routes/dashboard/IssueDetailContent.tsx && echo CARD_OK</automated>
  </verify>
  <done>The muted breadcrumb is gone; a prominent clickable parent card with type icon, "Parent" label, mono key, foreground truncating summary, optional CORRECTLY-COLORED status pill (color keyed on statusCategory.key, text = status.name), and a trailing ArrowUpRight renders above the key/title for subtasks. Clicking still calls onOpenIssue(parent.key) and the card has an aria-label.</done>
</task>

<task type="auto">
  <name>Task 3: Verify the lint/typecheck gate stays GREEN</name>
  <files>taskflow/src/routes/dashboard/IssueDetailContent.tsx, taskflow/src/services/jira.ts</files>
  <action>
    Run the project's full check gate from the `taskflow/` directory and confirm it passes
    with no errors and no new warnings. This is biome check + tsc together — `biome lint`
    alone is NOT sufficient (project memory). This is the REAL gate that proves the type
    widening at jira.ts:1239 actually flows to the component: if jira.ts:1239 were still
    narrow, the `parent.fields.issuetype.name` / `parent.fields.status?.statusCategory?.key`
    access in Task 2 would fail tsc here. If anything fails, fix it (formatting, unused
    imports, type errors) before declaring done. Confirm no `any` casts were introduced for
    the parent type access.

    NOTE: tsc cannot catch a miscolored status pill (statusPillClass accepts any string).
    Task 2's grep gate is what enforces the correct `statusCategory?.key` call — do not relax it.
  </action>
  <verify>
    <automated>cd taskflow && npm run check</automated>
  </verify>
  <done>`npm run check` exits 0 (biome check + tsc both clean). No `any` casts on parent.fields access.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira DC API → app | Parent issue fields (issuetype/status/summary) arrive from the remote Jira instance and are rendered. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-ugr-01 | Information Disclosure | Parent summary/key rendered in card | accept | Read-only display of data the user already has access to via fetchIssueDetail; no new data surfaced, no PII beyond existing issue view. |
| T-ugr-02 | Tampering | Missing/malformed parent.fields.issuetype or status at runtime | mitigate | issuetype + status (incl. statusCategory.key) typed optional and rendered conditionally; layout holds with graceful fallback (no icon / no pill) — no crash on absent nested fields. |
| T-ugr-SC | Tampering | npm/pip/cargo installs | mitigate | N/A — no new packages installed; all building blocks (IssueTypeIcon, statusPillClass, lucide ArrowUpRight) already in the codebase. |
</threat_model>

<verification>
- `npm run check` GREEN from taskflow/ (biome check + tsc).
- Manual (covered by must_haves): open a subtask on the full page → prominent parent card visible above key/title; open same subtask in the peek panel → identical card (shared component); click parent → navigates via onOpenIssue and breadcrumb trail preserved.
- Parent with no nested issuetype → card still renders (no icon), no crash.
- Status pill (when present) is colored correctly — matches the same color the parent shows elsewhere (color comes from statusCategory.key, not the status name).
</verification>

<success_criteria>
- Muted breadcrumb row replaced by a prominent, polished, clickable parent card on BOTH the full page and the peek panel (one shared component edit).
- Card shows: type icon (conditional), "Parent" label, mono key, foreground truncating summary, optional CORRECTLY-COLORED status pill, trailing ArrowUpRight.
- Status pill color is keyed on `parent.fields.status.statusCategory.key`; pill text is `parent.fields.status.name`.
- Clicking opens parent via onOpenIssue(parent.key); peek breadcrumb-trail behavior unregressed; aria-label present.
- The consumed `JiraIssueDetail.fields.parent` (jira.ts:1239) widened (issuetype + status with statusCategory.key, all optional); no other parent site touched; no `any` casts; proven by tsc in Task 3.
- npm run check GREEN.
</success_criteria>

<output>
Create `.planning/quick/260606-ugr-on-subtasks-redesign-how-the-parent-issu/260606-ugr-SUMMARY.md` when done.
</output>
