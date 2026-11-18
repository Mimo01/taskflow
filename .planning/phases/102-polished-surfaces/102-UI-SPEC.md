---
phase: 102
slug: polished-surfaces
status: approved
reviewed_at: 2026-11-18
shadcn_initialized: true
preset: base-nova (neutral, cssVariables)
created: 2026-11-18
---

# Phase 102 — UI Design Contract

> Visual and interaction contract. Tokens are extracted from the Phase 101 `CreateEditIssueModal` and the shared `components/ui` primitives, not invented. All D-xx decisions in 102-CONTEXT.md are locked and reflected here.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (`components.json` present, style `base-nova`, baseColor neutral) |
| Preset | base-nova, as installed. No preset change in this phase |
| Component library | Base UI (`@base-ui/react`): `Dialog.*`, `Input` primitive |
| Icon library | lucide-react |
| Font | Geist Variable (`--font-sans`) |

---

## Spacing Scale

Declared values (multiples of 4). Tailwind class in brackets.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | `gap-1` label-to-control, icon gaps |
| sm | 8px | `gap-2` footer/action-row item gap |
| md | 16px | `gap-4` between fields, sidebar `p-4`, header/footer `py-4` |
| lg | 24px | `px-6` modal header, body and footer horizontal padding |
| xl | 32px | not used in this phase |
| 2xl | 48px | not used in this phase |
| 3xl | 64px | not used in this phase |

Exceptions: field control `px-2.5` (10px) and `h-8` (32px) come from the shared `Input`/`Button` primitives and are kept as-is; sidebar width 300px (240px between 721px and 900px container width) is copied from the Issue modal.

---

## Typography

Declared exactly as in the Issue modal. Four sizes, two weights.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body (inputs, buttons, editor text) | 14px (`text-sm`; primitives are `text-base` below `md`, `md:text-sm` applies on desktop) | 400 regular (buttons 500 via primitive) | 1.5 |
| Label (field labels, draft note, footer status) | 12px (`text-xs`) | 600 semibold, `text-muted-foreground` | 1.5 |
| Heading (modal title) | 18px (`text-lg`) | 600 semibold | 1.2 (`leading-tight` is 1.25; accepted) |
| Subtitle (Bulk "Parent: KEY") | 12px (`text-xs`) | 400, `text-muted-foreground` | 1.5 |

Note: button `font-medium` (500) is inherited from the shared `Button` primitive and is not re-declared per surface.

Field label contract (D-01): `<label className="text-xs font-semibold text-muted-foreground">Name <span className="text-destructive">*</span></label>`, placed above the control in a `flex flex-col gap-1` wrapper, with `htmlFor` wired to the control id. The red `*` appears only when required.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `bg-background` | Modal popup, main column, comment card surface |
| Secondary (30%) | `bg-muted/30` + `border` | Modal sidebar (`aside`), borders `border-b`/`border-t`/`border-l` |
| Accent (10%) | `--primary` / `ring-ring` | See reserved list |
| Destructive | `--destructive` | Required `*`, `aria-invalid` field state, error text |

Backdrop: `bg-black/40 backdrop-blur-sm`, `z-50` (replaces Create Epic's un-blurred `z-40`).

Accent reserved for: the primary button of each surface (Comment, Save, Create epic, Save for Edit Release, Create subtasks); the field focus ring/border (`border-ring` + `ring-ring/50`); the checked state of the Released `Switch`. Nothing else.

### Single field surface (D-01), applies to Input, Textarea and the WikiEditor frame

| Property | Value |
|----------|-------|
| Shape | `rounded-lg border border-input` |
| Background | `bg-transparent dark:bg-input/30` |
| Padding | `px-2.5` (input `py-1`, textarea/editor body `py-2`) |
| Focus | `border-ring ring-3 ring-ring/50` (`focus-visible:` on Input/Textarea, `focus-within:` on the editor frame) |
| Placeholder | `text-muted-foreground` |
| Disabled | `disabled:bg-input/50 disabled:opacity-50 dark:disabled:bg-input/80` |
| Invalid | `aria-invalid:border-destructive ring-3 ring-destructive/20` (`dark:` variants as in primitives) |

Reconciliation: `Input`/`Textarea` are the reference and stay unchanged. The WikiEditor frame at `WikiEditor.tsx:447` changes from `bg-background focus-within:ring-1 focus-within:ring-ring` to `bg-transparent dark:bg-input/30 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 transition-colors`. Toolbar, bubble menu and the editor's internal divider keep their current colours. Plain-text areas that must look like the editor (Edit Release descriptions, D-14) use `Textarea` with the same classes, no toolbar. The wiki frame change is global (all hosts), as intended by "consistent across the app". Screenshot light and dark before sign-off.

---

## Shared Modal Shell (D-08, D-12, D-13)

Extract one shell (preferred, per CONTEXT discretion); values copied from `CreateEditIssueModal.tsx:633-892`:

| Part | Classes / value |
|------|-----------------|
| Backdrop | `fixed inset-0 z-50 bg-black/40 backdrop-blur-sm` |
| Popup | `fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(1080px,94vw)] h-[88vh] min-h-[480px] max-h-[calc(100vh-2rem)] overflow-hidden bg-background border rounded-lg shadow-xl flex flex-col`, inner `@container` |
| Header | `flex items-center gap-3 border-b px-6 py-4`; `Dialog.Title` `text-lg font-semibold leading-tight`; Close `ml-auto rounded p-1 hover:bg-accent`, lucide `X` `h-4 w-4`, `aria-label="Close"` |
| Body (two-column) | `flex min-h-0 flex-1 max-[720px]:flex-col max-[720px]:overflow-y-auto`; main `flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4 max-[720px]:overflow-visible` |
| Sidebar | `w-[300px] shrink-0 overflow-y-auto border-l bg-muted/30 p-4 min-[721px]:@max-[900px]:w-[240px] max-[720px]:w-full max-[720px]:overflow-visible max-[720px]:border-l-0 max-[720px]:border-t` |
| Footer | `flex items-center gap-2 border-t px-6 py-4`; left slot `flex min-w-0 flex-1 items-center gap-3` (`data-testid="modal-footer-status"`); right: Cancel (`variant="outline"`), primary (`gap-1.5`, `Loader2 size-3.5 animate-spin` while pending) |
| Tooltips | Cancel shows `Keycap` Esc; primary shows `Keycap` ⌘ and ↵ |

All dialogs use `Dialog.Title` (Edit Release's current `h2` is replaced). Esc inside a nested dialog or popover must not close the parent. Overlays portal to body.

### Per-surface layout

| Surface | Layout |
|---------|--------|
| Create Epic (D-08, D-10) | Two-column shell. Main: Epic name (`Input`, required, autofocus, placeholder "Epic name"), Description (`WikiEditor` preset `full`, Attach, `StagedFilesStrip`). Sidebar: `ModalSidebar` from the Epic createmeta, same order as Create Issue; `epicNameFieldKey` is filtered out of the sidebar. Footer left: draft/status line only (no "Create another"); right: Cancel, "Create epic". |
| Bulk Create Subtasks (D-12) | One-column shell, same fixed size. Header: title "Bulk create subtasks" with "Parent: KEY" (`text-xs text-muted-foreground`) on a line below it. Template/type toolbar pinned directly under the header (`border-b px-6 py-3`, non-scrolling). Only the dnd-kit row list scrolls (`min-h-0 flex-1 overflow-y-auto px-6 py-4`). Footer as shell. Row inputs use `Input`; no label above each row input (column heads instead, `text-xs font-semibold text-muted-foreground`). |
| Edit Release (D-13, D-14) | Two-column shell. Main: Name (`Input`), "Description" (`Textarea`, fills remaining height: `flex-1 min-h-40 resize-none`, internal scroll), then if a GitLab milestone matches a subsection with a `border-t pt-4` divider and heading `text-xs font-semibold text-muted-foreground` "GitLab milestone", Title (`Input`) and Description (`Textarea`, `min-h-24`, auto-grow). Sidebar: "Release date" (`DatePicker`), "Released" row using the shared `Switch` (label left, switch right). Footer left: per-source errors/status (`text-xs`, errors `text-destructive`); right: Cancel, Save. |

Narrow behaviour (Discretion): follows Issue modal. Sidebar stays side-by-side and shrinks to 240px, stacks under the main column below 720px.

---

## Comment Hosts (UI-03)

### Composer states (D-03, D-06, D-07)

| State | Appearance |
|-------|------------|
| Idle, empty, unfocused | Single-line collapsed field, height 32px (`h-8`), same field surface, placeholder "Add a comment…". No toolbar, no action row. |
| Expanded (focus, or holds text/draft) | Compact `WikiEditor` (bubble-menu preset) with min height 96px (`min-h-[96px]`, unchanged), action row below with `mt-2`. |
| Blurred empty | Collapses to idle. |
| Blurred with text | Stays expanded. |
| Esc | Blurs, keeps text. |
| Notification Reply (`useComposerFocus`) | Expands and focuses. |

Max height cap (Discretion): replace fixed `max-h-[280px]` for the comment hosts with `max-h-[min(50vh,480px)]` (about half of the viewport, never above the `full` preset cap), internal scroll beyond it. Same cap for composer and comment edit. Expand/collapse: no height animation (instant swap), to avoid shifting the activity list; the collapsed field and the expanded editor are anchored at the same top edge.

### Comment edit (D-04)

Opens already expanded, with the same editor, min height and cap as the composer. Opens at the larger of its content height and 96px; no fixed bigger minimum, so the card changes height only by the toolbar-less editor padding.

### Shared action row (D-05)

One component used by both hosts. Layout: `flex items-center gap-2`, left slot `flex-1 min-w-0` holding `DraftNote` ("Draft saved · Discard", muted `text-xs`); right cluster in order:

1. Attach: `Button variant="ghost" size="icon-sm"` with lucide `Paperclip` (`size-4`, `text-muted-foreground`), `aria-label="Attach files"`, tooltip "Attach files".
2. Cancel (edit only): `Button variant="outline" size="sm"`, keycap tooltip Esc.
3. Primary: `Button size="sm"`, "Comment" (composer) or "Save" (edit), keycap tooltip ⌘↵. Pending: `Loader2 size-3.5 animate-spin` with "Posting…" / "Saving…".

Button sizes: `sm` (h-7) in comment rows because they sit in a dense card; modal footers use default (h-8). Gap `gap-2` matches the modal footer. The composer has no Cancel button.

---

## Interaction Rules

- Cmd/Ctrl+Enter submits from any field in the modals; Esc requests cancel with the discard warning if dirty (100 D-08/D-09, 101 D-13); X and backdrop close silently, keeping the draft.
- Create Epic payload includes sidebar values; drafts store them and restore with stale-field handling (101 D-15).
- Submit is disabled until required fields are valid; pending disables all fields.
- Focus: first field autofocus on create modals; focus returns to the opener on close.
- Accessibility: every control has a visible label or `aria-label`; icon buttons min target 28px (`icon-sm`), accepted for dense rows; focus ring from primitives is never removed.

---

## Copywriting Contract

Sentence case everywhere (D-02). Note: the Phase 101 Issue modal currently uses Title Case ("Create Issue", "Save Changes"); CONTEXT D-02 requires sentence case for this phase's surfaces. Planner should also normalise the Issue modal strings to "Create issue" / "Save changes" for true consistency (low-risk, update tests).

| Element | Copy |
|---------|------|
| Primary CTA, Create Epic | "Create epic" (pending "Creating…") |
| Primary CTA, Bulk | "Create subtasks" (pending "Creating…") |
| Primary CTA, Edit Release | "Save" (pending "Saving…") |
| Primary CTA, comment composer / edit | "Comment" / "Save" |
| Titles | "Create epic", "Bulk create subtasks", "Edit release" |
| Field labels | "Epic name *", "Description", "Name *", "Release date", "Released", "GitLab milestone", "Title" |
| Placeholders | "Epic name", "Add a comment…" |
| Empty state (Bulk, no rows) | Heading "No subtasks yet"; body "Add a row or pick a template to start." |
| Error state | Field: "{Field} is required." Submit failure in footer: "Couldn't create the epic. Check your connection and try again." Edit Release per source: "Couldn't update the Jira version: {reason}. Try again." / "Couldn't update the GitLab milestone: {reason}. Try again." Draft: "Couldn't save your draft" |
| Draft note | "Draft saved · Discard" (unchanged, 100 D-04) |
| Destructive confirmation | Discard draft / close with unsaved changes: reuse existing `DiscardChangesDialog` copy ("Discard changes?" with "Keep editing" / "Discard"); no new destructive actions in this phase |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none new (existing `Button`, `Input`, `Textarea`, `Switch`, `Dialog`, `Tooltip`, `DatePicker`) | not required |
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
