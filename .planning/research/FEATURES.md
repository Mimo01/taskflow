# Feature Landscape

**Domain:** WYSIWYG + source-toggle Jira wiki markup editor, and polished editor-host surfaces (Tauri desktop, Jira DC)
**Milestone:** v1.15 Rich Wiki Editor
**Researched:** 2026-11-16
**Confidence:** MEDIUM. Based on well-established behaviour of Jira/Confluence/Linear/Notion/GitHub/Slack editors (training knowledge, not re-verified against live products this session). Dependencies on existing code were checked against the repo file list. Interaction details should be treated as a hypothesis, not verified fact.

## Reference Behaviour (what "great" looks like)

| Product | Pattern worth copying | Pattern to skip |
|---------|----------------------|-----------------|
| Jira Cloud / Confluence | Fixed toolbar (text style dropdown, B/I, lists, link, table, mention, emoji, "+" insert menu); `/` slash menu; markdown-style input rules; `@` mention; panels as insert-menu items; Cmd+Enter / "Save" buttons; draft is kept per issue | ADF-only features (inline cards, status lozenge, decisions, layouts, extensions) have no wiki-markup equivalent |
| Linear | Quiet UI, no permanent toolbar; bubble menu on selection; `/` menu; Cmd+Enter submits; paste URL on selection makes link; drag/drop images | Heavy reliance on markdown-only output |
| Notion | `/` slash as primary insertion; block handles | Block drag handles, columns, databases (no wiki-markup mapping) |
| GitHub | Persistent compact toolbar over a textarea; Write/Preview; Cmd+Enter submit; paste/drop image upload with placeholder; `@` and `#` autocomplete; saved drafts | Preview tab as the only rich view (this is what is being replaced) |
| Slack | Composer: Enter sends or newline by setting, minimal formatting bar, Cmd+Shift+U link, emoji `:` autocomplete | Enter-to-send in a long-form editor |

Overall pattern: a hybrid of a persistent compact toolbar (discoverability, matches Jira users' muscle memory) plus slash menu and input rules (speed). Bubble menu is optional polish.

## Table Stakes

Missing any of these and the editor feels worse than the textarea it replaces.

| Feature | Why Expected | Complexity | Dependencies / Notes |
|---------|--------------|------------|----------------------|
| Fixed toolbar: text style dropdown (paragraph, h1-h6, quote), bold, italic, underline, strike, inline code, bullet/ordered list, link, table, code block, panel, mention, attachment, emoticon | Jira users expect it; replaces existing toolbar (bold/italic/code/list) | Med | Existing toolbar in DescriptionEditor/CommentComposer to be superseded; keep icon-button style. Compact variant for comments |
| Keyboard shortcuts: Cmd/Ctrl+B, I, U, Shift+X (strike), E (inline code), K (link), Cmd+Alt+1..6 headings, Cmd+Shift+7/8 lists, Cmd+Alt+C code block, Tab/Shift+Tab list indent, Cmd+Z / Cmd+Shift+Z | Universal | Low | Must register with the existing shortcuts registry (Cmd+/ help panel) and respect input-suppression rules so J/K nav does not fire inside editor |
| Cmd/Ctrl+Enter submit, Esc cancel (with dirty guard) | Standard in comment composers (GitHub, Linear, Jira) | Low | CommentComposer, InlineComment, DescriptionEditor, modals. Esc must not conflict with open mention/slash popover (popover consumes Esc first) |
| Markdown-style input rules: `**x**`/`*x*` bold, `_x_` italic, `~~x~~` strike, `` `x` `` code, `# ` to `###### ` headings, `- `/`* ` bullet, `1. ` ordered, `> ` quote, ``` ``` ``` code block, `---` rule. Also Jira-wiki habits: `h2. ` heading, `{code}`, `{{mono}}` | Jira/Confluence/GitHub users type these reflexively; Jira users type wiki syntax | Med | Backspace right after a rule fires should undo it (standard). Do not fire inside code blocks |
| Undo/redo that survives toolbar actions, input rules, and paste; per-document history | Basic trust | Low (library-provided) | Source toggle must not wipe history (or must clearly reset it; prefer keeping a shared history by treating source edit as a single transaction) |
| Lists: nesting, Enter on empty item exits, Tab indent, mixed `*`/`#` nesting | Core | Med | Wiki markup `*`/`**`/`#`/`##`/`*#` mixed nesting is the hard part of round-trip |
| Links: Cmd+K dialog (text + URL), paste URL onto selection = link, auto-link bare URLs on paste/space, edit/remove popover on click, `[text\|url]` round trip | Table stakes in all modern editors | Med | Reuse lib/internalLinks.ts so Jira issue URLs and internal links behave as WikiRenderer renders them |
| Tables: insert (grid picker or default 3x3), header row, Tab/Shift+Tab cell navigation, Tab in last cell adds row, add/remove row/column via hover handles or context toolbar, delete table | Jira users edit tables often; textarea wiki tables are painful, which is a primary reason for this milestone | High | Wiki tables are `\|\|head\|\|` / `\|cell\|`; no colspan/rowspan. Cells that contain block content (lists, panels, code) need verbatim preservation when the editor cannot model them. Must render like WikiRenderer table |
| Code blocks: `{code:lang}` with language selector, monospaced, Tab inserts indent, no formatting marks inside, escape to exit | Dev audience; Jira `{code}` and `{noformat}` | Med | Language list = what WikiRenderer highlights. Existing syntax highlighting reused if any. `{noformat}` as a separate/plain variant |
| Panels and macros: insert `{panel}`, `{info}`, `{note}`, `{warning}`, `{tip}`, `{quote}`, `{color}`; edit title/colour; render identically to WikiRenderer panels | Named in milestone scope | High | Panels are block containers: need a node with attrs (title, borderColor, bgColor). Macro params preserved verbatim if unknown |
| @mentions: `@` triggers inline popover, fuzzy search users, arrow/Enter/Tab select, Esc dismiss, inserted as chip, serialises to `[~username]` | Existing capability; must not regress | Med | MentionPopover + useMentionUserMap exist. Rework to an editor-anchored suggestion (position at caret) instead of textarea offset math; keep server-side search per PersonPicker convention |
| Issue-key autocomplete and linking: typing `ABC-123` renders as a link (matches WikiRenderer); optional `#`/key-prefix picker with summary | Jira-wide expectation; WikiRenderer already links keys | Med | Rendering in editor via decoration only (do not write markup around a key; Jira auto-links plain text keys). Picker can reuse global search/command-palette query. Do not insert extra markup |
| Attachments `!file.png!` and `[^file.pdf]`: toolbar picker, staged uploads, shows image inline in editor, non-images as chips | Existing capability | High | lib/attachment-markup.ts and the attachment picker/staged upload flow. Staged (not-yet-uploaded) files in create flow must resolve in the editor view |
| Image paste / drag-drop: clipboard image becomes staged upload + `!image.png!` inserted at caret, with placeholder/progress | GitHub/Linear/Jira baseline | High | Tauri `dragDropEnabled` swallows DOM drops (existing memory: attachments DnD gotcha); must use the existing Tauri drop handling. Generic-MIME images need extension classification. Generated filenames for pasted blobs (`image-<ts>.png`) |
| Emoticons: `:)` `:(` `;)` `(y)` etc. render as WikiRenderer shows; `:` autocomplete or picker | Existing renderer supports them; wiki-markup convert them | Med | Only the Jira emoticon set, not unicode emoji universe. Input rule converts `:)` to emoticon node on type |
| Source toggle (WYSIWYG <-> raw wiki markup) button in toolbar; raw view is a monospace textarea/code editor | Core milestone ask; escape hatch for unsupported constructs | Med | See "Source toggle UX" below |
| Round-trip safety: unknown/unmodelable constructs kept as verbatim "raw block/inline" nodes, shown as a labelled chip; load then save with no edit leaves text exactly untouched | Core milestone ask | High | Fixture corpus. Strongest recommendation: if the user made no edit, save the original string (do not re-serialise). Only re-serialise when dirty |
| Paste handling: paste plain text, paste rich HTML (from browser/Confluence/Jira) converted to supported nodes, paste as plain text (Cmd+Shift+V), paste wiki markup text recognised in WYSIWYG | Everyone pastes from Jira web | Med | HTML-to-node mapping only for supported nodes; strip the rest. Pasting raw wiki markup (`h2. x`) into WYSIWYG: decide parse vs literal (recommend: parse when it clearly contains wiki syntax, offer undo) |
| Unsaved-changes guard: dirty state on every host; confirm on close/navigate/pin-tab switch; Esc/backdrop on a dirty modal asks first | Data loss is the worst editor failure | Med | Modals, inline description edit, comment edit, peek. Reuse existing confirm dialog pattern |
| Draft autosave for new comments and new issues (localStorage/store keyed by issue key + field), restore on reopen, cleared on submit | Jira/GitHub/Linear all keep drafts | Med | Persist wiki-markup string (not editor state). Key: `comment:<issueKey>`, `create-issue:<project>`; edit comment: `comment-edit:<id>`. Beware credential reset clearing caches (drafts should not live in React Query) |
| Focus management: autofocus on open (title for create, editor for edit), focus returns to trigger on close, click anywhere on the editor surface focuses it, readable focus ring | Polish baseline | Low | Match existing Base UI dialog behaviour |
| Editor sized to content with min/max height, internal scroll above max, sticky toolbar inside scroll area | Required for big modal and inline hosts | Med | Mind sr-only/relative scroller gotcha (non-positioned scroller + abspos) |
| Disabled/readonly and saving states; errors keep content | Basic robustness | Low | Existing mutations; preserve content on failure |
| Large Create/Edit Issue dialog: ~min(1100px, 90vw) wide, two columns: main (summary, description editor, subtasks/links) and sidebar (issue type, status/assignee/priority/labels/epic/sprint/custom fields); sticky footer with Create/Cancel and "Create another" toggle | Matches Jira Cloud create dialog and Linear's create issue | Med | CreateEditIssueModal.tsx, CustomFieldsSection, LinkRowsSection, IssueTypeSelector, SubtaskTemplateRow, useCreateEditForm. Detail-page rule from memory: no card panels; sidebar uses h3/rows/border-l, narrow layout keeps side-by-side and shrinks. Use shared PersonPicker and SearchableSelect for fields |

## Differentiators

Valued, not expected. Pick a few; the user asked for "everything", but order by value/cost.

| Feature | Value Proposition | Complexity | Dependencies / Notes |
|---------|-------------------|------------|----------------------|
| `/` slash menu (headings, lists, table, panel types, code block, quote, rule, image/attachment, mention, emoticon) with filter-as-you-type | Fast, matches Notion/Linear/Confluence; surfaces panels/macros without the toolbar | Med | Share the suggestion-popover infrastructure with @mention and `:` emoticon |
| Bubble (selection) menu: B/I/U/S/code/link/heading | Linear-like polish for inline hosts where a full toolbar is too heavy | Low-Med | Use only in compact hosts (inline comment); keep the fixed toolbar on the large dialog. Avoid duplicating both in the same host |
| Source toggle with cursor/selection preservation: map selection to source offset and back | Makes toggle feel like a lens not a mode switch | High | Needs position mapping from serializer (node to source offset). Cheap fallback: restore scroll proportion plus selecting the nearest block. Recommend fallback first |
| Source view with Jira-wiki syntax highlighting and monospace line numbers | Power-user value in raw mode | Med | CodeMirror 6 or Monaco is heavy; a lightweight highlighted textarea overlay is enough |
| Live "Looks like Jira" parity check: toggling shows the WikiRenderer output preview in a side pane in source mode | Confidence that save equals what Jira shows | Med | WikiRenderer already exists; cheap since it is the existing Preview, now optional in source mode |
| Unmodelable-construct chips: click to edit raw fragment inline | Turns round-trip fallback into a feature | Med | Same machinery as the verbatim fallback |
| Panel/macro editing popover (change type, title, colour) and `{expand}`, `{status}`, `{anchor}`, `{toc}`, `{noformat}` if time | Jira-specific completeness | Med each | Only those WikiRenderer already renders |
| Issue picker (`#` or typed `ABC-`) showing summary/status inline | Fast cross-linking | Med | Reuse global search cache (ranked cache-backed search) |
| Floating table toolbar (add/delete row/col, toggle header, delete table) and column handles | Makes tables pleasant | Med | Part of table work |
| Quote/reply on comment: "Quote" action pre-fills composer with `{quote}`/`bq.` of selected text | Jira users expect | Low | ActivityTimeline, CommentComposer |
| Saved/recoverable draft indicator ("Draft saved") and restore banner | Confidence | Low | Part of draft autosave |
| Word/character count, max length warning (Jira description limit 32,767 chars) | Prevents failed saves | Low | Only warn near the limit |
| Cmd+Shift+V paste as plain text, Cmd+Shift+C copy as wiki markup | Power-user | Low | Copy-as-wiki is a nice side-effect of the serializer |
| Find-in-editor | Long descriptions | Low | Existing FindBar may be reusable; flaky test noted in memory |
| Expand editor to full-screen / "focus mode" for long descriptions | Slack/Notion-like | Low | Mostly layout; important in the compact hosts (Edit Release) |
| Mention chips displaying real names (resolved from useMentionUserMap) instead of usernames | Readability; matches WikiRenderer | Low | Already needed for parity |
| Link hover preview for issue keys / MRs | Linear-like | Med | Peek highlight store exists; may be overkill, defer |
| Per-host presets: full (create/edit modal, description), compact (comments), minimal (Bulk Create, Create Epic summary/description, Release description) | One editor, right-sized toolbars | Low-Med | Prop-driven toolbar config. Keeps adoption cheap across 8 surfaces |

## Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Markdown or ADF as storage format | Jira DC stores wiki markup; any conversion risks silently changing rendering | Wiki markup is the only persisted format. Editor state is derived |
| Byte-exact round-trip guarantee | Unachievable and not needed; the milestone defines semantic equivalence | Fixture corpus on rendered output; skip re-serialising untouched docs |
| Dropping unknown constructs silently | Data loss in the user's Jira issues | Preserve verbatim as raw nodes |
| Real-time collaboration / cursors / comments-on-selection | No backend; Jira DC has none | n/a |
| Notion-style block drag handles, columns, databases, embeds | No wiki-markup mapping | Lists, tables, panels only |
| Enter-to-send in comment composer | Long-form content; accidents | Cmd/Ctrl+Enter sends, Enter newline |
| Full unicode emoji picker | Wiki markup renders only Jira emoticons; unicode may be mangled by Jira DC DB (utf8 issues) | Jira emoticon set only; allow pasted unicode as plain text |
| Text colour/size/font pickers beyond `{color}` | Not Jira-standard styling; WikiRenderer parity | Provide `{color}` with a small palette only |
| Both fixed toolbar and bubble menu in the same host | Visual noise | Toolbar in large hosts, bubble (or compact toolbar) in inline hosts |
| Autosaving to Jira (server drafts) while typing | Creates edit history noise and conflicts | Local drafts only; explicit Save |
| Auto-rewriting existing issue text on open (normalisation) | Triggers false "dirty" and silent history changes | Dirty only when the user edits |
| Heavy source editor (Monaco) | Bundle size in a portable Tauri app | Lightweight highlighted textarea or CodeMirror 6 only if justified |
| Raw-HTML paste passthrough | Wiki markup has no HTML; sanitisation risk | Convert supported nodes, drop the rest |
| Per-surface bespoke editors | Defeats the milestone | One shared component with presets |
| Revert of the previous TipTap attempt unexplained | Reason unrecorded; may repeat | Re-evaluate the library choice and inspect tag `backup/wiki-editor-before-revert-260531` for the failure cause before committing to the same approach |

## Source Toggle UX (recommended behaviour)

- Toolbar toggle (icon + label "Source"), shortcut Cmd+Shift+M or similar; the toggle state persisted per user (not per issue); default WYSIWYG.
- Switching WYSIWYG to source: serialise once; if the doc is not dirty show the original string untouched.
- Switching source to WYSIWYG: parse; if the parse produces unmodelable fragments show them as raw chips, never an error. Show a non-blocking warning only if parsing alters semantics (should be zero by design).
- Cursor: fallback is preserving scroll position and selecting the block under the caret; true offset mapping is a later differentiator.
- Toolbar actions disabled in source mode except toggle; mention/attachment inserts still work at the textarea caret (reuse the existing textarea logic, so existing attachment/mention paths remain as the source-mode implementation).
- Drafts and dirty checks operate on the wiki string regardless of mode.

## Comment Composer UX

- Collapsed by default as a one-line "Add a comment..." field; expands on focus to full editor with toolbar plus Save / Cancel; Cmd+Enter saves; Esc cancels with dirty guard.
- Quick-reply pills are optional (Jira Cloud's "Looks good", etc.). Skip.
- Edit-in-place for existing comments uses the same compact editor with Save/Cancel; keeps scroll position in ActivityTimeline.
- Draft per issue persists across navigation and pin-tab switching.
- Keep Enter on empty list item exiting the list, not submitting.

## Large Create/Edit Modal Layout Patterns

- Two columns: left (about 65%) summary input (large, borderless), description editor (fills height), then subtasks/links; right (about 35%) fields with labelled rows, sticky; footer sticky with primary Create, Cancel, and "Create another".
- Header: project and issue type selector left, close right; no heavy chrome.
- Collapse to one column under about 800px by stacking sidebar below, though memory says narrow layouts prefer side-by-side shrinking; follow that unless the width is genuinely too small.
- Required custom fields (from createmeta) go to the top of the sidebar with an indicator; optional ones fold under "More fields".
- Esc/backdrop on a dirty form asks for confirmation.
- Editor grows with content up to the modal height; the main column scrolls independently of the sidebar.

## Feature Dependencies

```
Core editor engine + wiki parser/serializer (round-trip fixtures)
  -> toolbar, input rules, shortcuts (need schema nodes)
  -> source toggle (needs serializer; fallback raw nodes)
  -> tables, panels/macros, code blocks (each needs node + serialiser + fixtures)
  -> suggestion popover infrastructure
       -> @mention (replaces MentionPopover internals, uses useMentionUserMap)
       -> slash menu
       -> emoticon ':' autocomplete
       -> issue-key picker
  -> attachment/image nodes (needs lib/attachment-markup.ts, staged-upload flow, Tauri DnD handling)
  -> link handling (needs lib/internalLinks.ts)
Editor presets (full/compact/minimal)
  -> adoption per host: DescriptionEditor, CommentComposer/InlineComment/ActivityTimeline edit,
     CreateEditIssueModal, CreateEpicDialog, BulkCreateSubtasksModal, EditReleaseModal
Draft store + dirty guard (independent of engine; operate on wiki string)
  -> every host
Large modal layout (independent of engine; can ship with textarea first)
WikiRenderer parity (styling of editor content shares CSS/tokens with WikiRenderer; do not refactor WikiRenderer except behind its tests)
```

## MVP Recommendation

Prioritise (phase order):
1. Engine + schema + parser/serializer + fixture corpus with verbatim fallback and "untouched doc saves original string" (everything depends on this; highest risk).
2. Core text formatting, lists, links, code blocks, toolbar, shortcuts, input rules, undo/redo, source toggle (fallback cursor behaviour).
3. Mentions, attachments, image paste/drop, emoticons, issue-key rendering (ports of existing features).
4. Tables and panels/macros (highest complexity; each is its own phase-sized work).
5. Adopt in hosts with presets, Cmd+Enter, dirty guard, drafts; large Create/Edit modal and polished host surfaces.
6. One or two differentiators: slash menu (reuses suggestion infrastructure) and bubble menu or compact toolbar for comments.

Defer: cursor-offset-preserving toggle, source syntax highlighting, issue hover previews, find-in-editor, word count, expand/focus mode, `{expand}`/`{toc}`/`{status}` macros.

## Research Flags

- Library choice (TipTap/ProseMirror vs Lexical vs CodeMirror-based) is fresh-evaluate; see STACK.md. Check why the 2026-05-31 TipTap build was reverted.
- Tables with block content in cells and nested mixed lists are the likeliest round-trip failures; need dedicated fixtures.
- Tauri drag-drop with image drop requires phase-specific verification on a real build (WKWebView).
- Pasting rich HTML from Jira/Confluence needs sample-driven mapping.

## Sources

- Product behaviour of Jira Cloud, Confluence, Linear, Notion, GitHub, Slack editors: training-data knowledge, LOW-MEDIUM confidence, not re-verified live this session.
- Repo: .planning/PROJECT.md (milestone scope), file inventory of taskflow/src/routes/dashboard (WikiRenderer, MentionPopover, DescriptionEditor, CommentComposer, InlineComment), create-edit-issue/, lib/attachment-markup.ts, lib/internalLinks.ts, hooks/useMentionUserMap.ts (existence verified; contents not read).
- Project memory notes (Tauri dnd/MIME, shared pickers, shortcuts, detail-page layout rules).
