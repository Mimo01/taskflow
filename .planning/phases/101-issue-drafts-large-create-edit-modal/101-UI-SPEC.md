---
phase: 101
slug: issue-drafts-large-create-edit-modal
status: approved
reviewed_at: 2026-11-17
shadcn_initialized: true
preset: base-nova (neutral, cssVariables, lucide)
created: 2026-11-17
---

# Phase 101 — UI Design Contract

> Visual and interaction contract for the large two-column Create/Edit Issue modal (UI-01), "Create another" (UI-02), and issue drafts with a TopBar Drafts chip and popover (DRAFT-01..07).
> Sources: 101-CONTEXT.md D-01..D-20 (locked), 100-UI-SPEC (draft note, Esc/Cmd+Enter, Discard dialog), `CreateEditIssueModal.tsx` (current 680px single column), `draft-note.tsx`, `RecentItemsPopover` / `RecentItemRow`, `TopBar.tsx`, `components.json`. No user questions were needed. The sketch-findings skill (Releases pages) was not applied. All Claude-discretion items are resolved below.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (`taskflow/components.json` present) |
| Preset | base-nova, neutral, cssVariables (detected, not overridden) |
| Component library | Base UI via shadcn base-nova (`src/components/ui/`) |
| Icon library | lucide-react |
| Font | Geist Variable (`--font-sans`) |

Reuse, do not re-specify: `Dialog` (Base UI, as the modal does today), `Button`, `Popover`, `Tooltip` + `keycap.tsx`, `PersonPicker`, `EpicPicker`, `SearchableSelect`/`Select`, `IssueTypeIcon`, `PriorityIcon`, `DraftNote`, `DiscardChangesDialog`, `EmptyState`, `WikiEditorLazy` (`full` preset), `LinkRowsSection`, `CustomFieldsSection`, `StagedFilesStrip`. No new third-party UI, no toast.

---

## Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon-to-text gaps, note separators, label-to-control gap in the sidebar |
| sm | 8px | Footer button gap, chip internal gap, popover row padding |
| md | 16px | Field-to-field gap in both columns, sidebar padding |
| lg | 24px | Modal header/footer horizontal padding, main column padding |
| xl | 32px | Not used |
| 2xl-3xl | 48 / 64px | Not used |

Component sizing:
- Dialog popup: `w-[min(1080px,94vw)] h-[88vh]` fixed (D-01), `flex flex-col`, `overflow-hidden`, same `bg-background border rounded-lg shadow-xl`, backdrop and `z-50` as today. Portals to body.
- Header: `px-6 py-4`, `border-b`, does not scroll. Footer: `px-6 py-4`, `border-t`, sticky (outside the scroll areas).
- Body = two columns, `flex min-h-0 flex-1`.
  - Main column: `flex-1 min-w-0 overflow-y-auto`, `px-6 py-4`, `gap-4`.
  - Sidebar: `w-[300px] shrink-0 border-l overflow-y-auto`, `p-4`, `gap-4`.
- Narrow window: the sidebar stays beside the main column and shrinks to `w-[240px]` below a 900px dialog width (container query on the popup: `@container`, with the variant on an inner wrapper, not on the container itself). Only below 720px window width does the sidebar move under the main column and the body scroll as one column. Dialog height never drops below `min-h-[480px]` (`max-h-[calc(100vh-2rem)]` wins on tiny windows).
- Fixed height means the main column never grows the dialog. The editor fills the remaining main-column height with min-height 240px; Summary, strip and Links are natural height below/above it.
- Footer controls: Button default height. The "Create another" checkbox is 16px with a 14px label, row height 32px.
- Drafts chip: height 32px (`h-8`), `px-3`, `gap-1` between icon and text; matches the neighbouring TopBar controls' height.
- Drafts popover: width 360px, `p-1`, rows `px-2 py-2` min-height 40px, one line per row (no second line, per the one-row-one-line preference); max-height 360px, inner scroll.

Exceptions: the italic `Untitled` draft summary adds `pr-0.5` (2px) to avoid glyph clipping under `truncate`; 300px / 240px sidebar width, 360px popover width and 1080px dialog width are layout dimensions (D-01, discretion), not spacing tokens.

---

## Typography

Two weights only (400, 600). No new roles beyond the three below.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body (inputs, editor document, popover row text, button text, "Create another" label) | 14px | 400 | 1.5 |
| Label (sidebar field labels, footer status line, draft note, "edited 5m ago", stale-field notes, chip count) | 12px | 400 (labels 600 only for sidebar field labels) | 1.5 |
| Heading (modal title "Create issue" / "Edit {KEY}") | 18px | 600 | 1.2 |

Sidebar and main-column field labels: 12px / 600 label above the control (D-04), `text-muted-foreground`; the required `*` uses `text-destructive`, as today. Summary input: 14px/400. Drafts chip text 14px/400 with count 12px.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--background` | Dialog surface, main column, popover |
| Secondary (30%) | `--muted` / `--muted-foreground` | Sidebar tint (`bg-muted/30`), footer status line, draft note, row meta, chip fill (`bg-muted`) |
| Accent (10%) | `--primary` / `--ring` | See list below |
| Destructive | `--destructive` | Required `*`, error message block (existing `bg-destructive/10`), the confirm button of the Discard dialog only |

Accent reserved for: the primary Create Issue / Save Changes button (existing `Button` default); focus rings on inputs, editor frame and checkbox; the keyboard-highlighted row in the drafts popover (existing `accent` hover/active row style).

No status colour, no warning colour: stale-field notes, "Draft saved", "Created ABC-123" and the chip are muted neutral. The chip is distinguished from `PinnedTabStrip` by shape and fill (rounded-full, `bg-muted`, `border`), not by colour. Type icons keep their existing issue-type colours (`IssueTypeIcon`).

---

## Interaction Contract

### Modal shell (D-01, D-02, D-04, D-05)
- Header (left to right): `IssueTypeSelector` (Story / Subtask / Bug, plus Epic is not offered here, Epics keep `CreateEpicDialog`), title text, then a trailing X close button (existing `rounded p-1 hover:bg-accent`, `aria-label="Close"`). In Edit mode the type selector is replaced by the key + `IssueTypeIcon` and the title reads `Edit {KEY}`.
- Focal point: Summary (autofocused in Create) then the flexing Description editor lead the main column; everything else is visually secondary.
- Main column, top to bottom: Summary (full-width `Input`, autofocus in Create), Description (`full` preset editor, flexes to fill), `StagedFilesStrip` (attach button in the Description label row stays as today), Links (`LinkRowsSection`, own `h3`-style label "Links", no card panel). Error block (`bg-destructive/10`) sits above Links, never in the footer.
- Sidebar: label above a full-width control, no cards, no collapsible groups. Order (resolved): Assignee, Priority, Epic / Parent, Labels, Fix version (only if present in createmeta), Story points, Estimate, then remaining `CustomFieldsSection` fields in createmeta order. Parent (subtask) replaces Epic and is read-only text when set from context (as today). Labels use the existing custom-field input if createmeta exposes `labels` there; otherwise a single multi-value token input of the same height as other controls.
- Required fields marked with `*`; the sidebar scrolls on its own if it overflows.
- Footer: left, "Create another" checkbox (Create only) then the status line; right, `Cancel` (outline) then primary (`Create Issue` / `Save Changes`), each with the existing tooltip + keycap (`Create Issue  ⌘ ↵`, `Save Changes  ⌘ ↵`, `Cancel  Esc`). The status line is a single 12px `truncate min-w-0` line, reserved 24px, never wraps.
- Loading: `WikiEditorLazy` skeleton at the equal final height; sidebar controls render as `Skeleton` of control height while createmeta loads. No spinner.
- One row = one line: sidebar rows never stack a second line; long values truncate.

### Esc and keys (D-11, 100 D-11/D-14)
- Esc: popover/picker/editor menu first; otherwise close the modal. Create mode closes silently and keeps the draft (no "Discard changes?" ever). Edit mode keeps the Phase 100 Cancel flow (Discard changes dialog only when changed; X/backdrop close silently).
- Cmd+Enter submits from any field. Esc and Cmd+Enter registered in `lib/shortcuts.ts` already; no new shortcuts. The overlay uses the Base UI Dialog, so `usePreviewEscape` is not needed.

### Create another (D-06..D-09)
- Checkbox label: `Create another`. Always unticked on open, not persisted.
- When ticked and a create succeeds: modal stays open, form is reset per the kept-field list, the status line shows `✓ Created ABC-123 · Open` (12px, muted; "Open" is a text-button like draft-note actions, opens the issue in the peek and leaves the modal open), Summary regains focus. The line is replaced by the next create's result and is cleared when the user types in Summary of the new form.
- Kept: issue type, project, epic/parent, assignee, priority, labels, fix version and other context custom fields. Cleared: summary, description, estimate, story points, links, staged files.
- Unticked: modal closes on success, as today. Each submit removes its draft; the reset form is a new draft only once it has user-entered content (D-12).
- The primary button shows the existing spinner while pending; checkbox and fields are disabled while pending.

### Draft autosave and note (D-10..D-16)
- Autosave debounced about 500ms after the last change, flush on blur and close. A draft exists only after user-entered content (summary, description text, staged file, filled link row).
- Footer status line shows `Draft saved · Discard` (reuse `DraftNote`, `state="draft"`) once a draft exists, in the slot right of the "Create another" checkbox. `Create another` result line takes the slot instead while it is showing. Edit mode shows no draft note (Edit keeps its Phase 100 description draft note below the editor).
- Discard in the note: removes the draft and its staged copies, closes the modal, no confirmation (D-14).
- Opening Create from anywhere gives a blank form (D-13). Resume hint (resolved): none in the modal. Discoverability comes from the TopBar chip only. This keeps it zero-cost to add later.
- Stale draft on resume (D-15): each invalid piece is cleared and a muted 12px note sits directly under that field's control, copy below; the notes persist until the field is edited or the modal is closed. Never blocks submit. The footer shows the normal draft note.

### Staged files (DRAFT-05)
- Same `StagedFilesStrip` look as today. A missing copy renders as a tile with the muted note `{name} is missing` and a remove action, never a broken preview. Previews use data: URIs (WKWebView blob gotcha).

### Drafts chip (D-18)
- Placement: TopBar, immediately left of the Search icon button. Visible on every page, rendered only when at least one draft exists (mount/unmount without animation, so no layout shift beyond the TopBar's flex gap).
- Look: `rounded-full border bg-muted h-8 px-3 text-sm`, lucide `PenLine` icon 14px + `Drafts` + count in 12px muted. Tooltip: `Resume a saved draft`. Opens a `Popover` anchored below-right.
- Chip is a button (`aria-haspopup="dialog"`, `aria-label="Drafts, {N}"`), keyboard reachable in TopBar tab order before Search.

### Drafts popover (D-19, D-20)
- Header row: `Drafts` 12px/600 muted label. Rows newest first, one line each: `IssueTypeIcon` (16px) · summary (14px, `truncate`, italic muted `Untitled` when empty; add `pr-0.5` for italic clip) · parent/epic key (12px muted mono, fixed right of summary, hidden when none) · `edited 5m ago` (12px muted, `shrink-0`, right-aligned). Row styling and hover/active classes copy `RecentItemsPopover` / `RecentItemRow`.
- Click or Enter on a row resumes: popover closes, Create modal (or `CreateEpicDialog` for Epic drafts) opens with the draft. Arrow keys move the active row; Esc closes the popover only.
- Discard from the list (resolved): a trailing `X` icon button (16px, `aria-label="Discard draft"`) appears on row hover/focus-within in a reserved trailing slot (always takes width, so the time text never shifts). Click replaces that row inline with `Draft discarded · Undo` (12px muted, same row height) for 5 seconds. Undo restores the row; on expiry the row disappears and staged file copies are deleted. Closing the popover or app within the window commits the discard.
- When the last draft is discarded, the popover closes and the chip unmounts.
- Empty state: not reachable in normal use (chip hidden when no drafts). If the popover is open when the last draft expires, it closes; no empty copy.

### Edit mode (UI-01)
- Same shell as Create. No "Create another", no draft note in the footer, no drafts. Primary `Save Changes`. The Edit modal's initial values come from Jira; the Phase 100 description draft behaviour and Discard changes dialog are unchanged.

### Accessibility
- Dialog traps focus and returns it to the opener (resume: to the chip's former position is gone, so return to `body`/main). Sidebar controls have programmatic labels (`htmlFor`/`id`). Chip, X and Open actions are real buttons. Contrast follows existing muted tokens (no new colours).

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA (Create) | `Create Issue` (tooltip `Create Issue  ⌘ ↵`). Changed from Phase 100's `Create`: the Phase 100 label/tooltip tests must be updated to match |
| Primary CTA (Edit) | `Save Changes` (tooltip `Save Changes  ⌘ ↵`). Changed from Phase 100's `Save`: the Phase 100 label/tooltip tests must be updated to match |
| Secondary | `Cancel` (tooltip `Cancel  Esc`) |
| Modal title | `Create issue` / `Edit {KEY}` |
| Create another | `Create another` |
| Create-another result | `✓ Created {KEY} · Open` |
| Draft note | `Draft saved · Discard` |
| Chip | `Drafts` + count; tooltip `Resume a saved draft` |
| Popover heading | `Drafts` |
| Untitled draft | `Untitled` |
| Row time | `edited 5m ago` (existing relative-time helper) |
| Discard from list | `Draft discarded · Undo` |
| Discard icon label | `Discard draft` |
| Stale: epic | `Epic {KEY} no longer exists` |
| Stale: parent | `Parent {KEY} no longer exists` |
| Stale: file | `{name} is missing` |
| Stale: custom field | `{Field name} is no longer available on this screen` |
| Stale: option value | `{Value} is no longer an option, choose another` |
| Empty state | Not applicable (chip hidden when there are no drafts) |
| Error state (create) | `Couldn't create the issue. Your draft is kept, try again.` (the error block shows Jira's message under it when available) |
| Error state (draft save fails) | `Couldn't save your draft` in the footer status line, 12px muted; retried on the next change |
| Destructive confirmation | Discard draft (note or list): no dialog, single click with inline `Undo` in the list; Discard changes (Edit mode only): existing `Discard changes?` / `Your unsaved changes will be lost.` / `Keep editing` + `Discard` |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | existing `dialog`, `button`, `popover`, `tooltip`, `input`, `select`, `skeleton` (no new blocks). Checkbox: native `<input type="checkbox">` styled with tokens (`accent-primary`, focus ring), matching existing app usage in `AioBlock.tsx`, `IntegrationsSection.tsx` and `DebugModeSection.tsx`; do not add the shadcn `checkbox` | not required |
| Third-party | none | not applicable |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
