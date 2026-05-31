# Quick Task 260531-saz: Enhance the wiki editing input - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Task Boundary

Enhance the rich-text ("wiki") editing input used for issue descriptions and
comments into a fuller editor that supports all kinds of styles. The
rendered/raw input must be preserved — i.e. the editor must let the user work
in a rendered view AND see/edit the raw Jira wiki markup, and round-trip back
to the canonical Jira wiki markup (what the Jira API stores) without data loss.

**Current state (from codebase scout):**
- All editing is a plain `<textarea>` + a 4-button toolbar that inserts Jira
  wiki markup syntax (`*bold*`, `_italic_`, `{code}`, `* ` bullets).
- Canonical raw format = **Jira wiki markup** (sent to/from the Jira API).
- Rendering goes through `WikiRenderer.tsx` (Jira wiki → `jira2md` → markdown →
  `react-markdown` + remark-gfm/breaks → `rehype-raw`/`rehype-sanitize` → HTML).
  `preprocessJiraMarkup()` already handles panels/info/warning/note callouts,
  `{color}` macros, `[~mentions]`, emoticons, tables, hardbreaks.
- No rich-text editor library is installed today.

**Editing surfaces sharing the Jira-wiki-markup editor:**
- `DescriptionEditor.tsx` (used by `CreateEditIssueModal.tsx`)
- `CommentComposer.tsx` (used by `IssueDetailPage.tsx`) — has @mention autocomplete
- `InlineComment.tsx` (used by `TaskRow.tsx`)
- `CommentCard` edit mode (internal to `IssueDetailPage.tsx`)

</domain>

<decisions>
## Implementation Decisions

### Editor approach
- **WYSIWYG (TipTap / ProseMirror).** True what-you-see editing where bold
  renders as bold inline. Provide a **Source toggle** so the user can view and
  edit the raw Jira wiki markup directly.
- The editor model converts **⇄ Jira wiki markup** at load and save.
- **Round-trip fidelity is the #1 risk and constraint.** "Rendered/raw input
  should be preserved" means: a field the user doesn't meaningfully change must
  serialize back to equivalent Jira wiki markup, and markup constructs the
  WYSIWYG model can't represent must NOT be silently dropped — preserve them
  (e.g. raw/passthrough nodes) or keep raw mode authoritative for them.

### Style coverage (all selected)
- **Core text:** bold, italic, strikethrough, inline code, headings (h1–h6), links.
- **Lists & blocks:** bullet/numbered lists, checklists/task lists, blockquotes,
  fenced code blocks with language, horizontal rules.
- **Jira panels & colors:** `{panel}` / `{info}` / `{warning}` / `{note}`
  callouts and `{color}` text — already rendered by WikiRenderer's preprocessor.
- **Tables, mentions & media:** tables, `@user` mentions with autocomplete
  (preserve the existing `[~accountId]` behavior), image/attachment embeds.

### Rollout scope
- Apply to **issue Description + all comment editors**: DescriptionEditor,
  CommentComposer, InlineComment, and CommentCard edit mode.
- **Extract a single reusable `<WikiEditor>` component** and replace the
  duplicated toolbars/textarea editors with it (do not enhance each separately).
- Release/milestone descriptions and worklog comments are OUT of scope for this
  task (plain-text fields today; can adopt `<WikiEditor>` later).

### Dependencies
- **OK to add a library.** TipTap/ProseMirror (and optionally CodeMirror for the
  syntax-highlighted Source view) are permitted. Reuse the existing
  jira2md/react-markdown/WikiRenderer pipeline where it helps (e.g. for the
  Jira→editor parse path and/or preview), rather than reinventing it.

### Claude's Discretion
- Exact library choice within the WYSIWYG family (TipTap StarterKit + custom
  extensions) and whether the Source view is a styled textarea or CodeMirror.
- Mechanism for lossless preservation of unsupported markup (passthrough nodes
  vs. raw-mode authority) — research should recommend the safest approach.
- Whether @mention autocomplete is ported into the shared component or kept as a
  composable add-on.

</decisions>

<specifics>
## Specific Ideas

- Keep the existing `[~accountId:XXX]` mention format and the sanitize
  allowlist/XSS protections already in WikiRenderer.
- The Source toggle is the embodiment of "rendered/raw preserved" — both views
  must stay in sync and the raw must remain the canonical save format.

</specifics>

<canonical_refs>
## Canonical References

- `taskflow/src/routes/dashboard/WikiRenderer.tsx` — existing render pipeline +
  `preprocessJiraMarkup()`; the reference for what styles must round-trip.
- `taskflow/src/routes/dashboard/CommentComposer.tsx` — existing @mention
  autocomplete + toolbar to preserve/port.
- `package.json` — installed libs: jira2md, react-markdown, remark-gfm,
  remark-breaks, rehype-raw, rehype-sanitize.

</canonical_refs>
