---
phase: 99-mentions-media-smart-input
reviewed: 2026-11-17T12:00:00Z
depth: standard
files_reviewed: 47
files_reviewed_list:
  - taskflow/package.json
  - taskflow/src-tauri/Cargo.toml
  - taskflow/src-tauri/src/lib.rs
  - taskflow/src/components/wiki-editor/WikiEditor.tsx
  - taskflow/src/components/wiki-editor/extensions.ts
  - taskflow/src/components/wiki-editor/host.ts
  - taskflow/src/components/wiki-editor/input-extensions.ts
  - taskflow/src/components/wiki-editor/input-rules.ts
  - taskflow/src/components/wiki-editor/issue-key-decoration.ts
  - taskflow/src/components/wiki-editor/media/EditorMessages.tsx
  - taskflow/src/components/wiki-editor/media/embed-removal.ts
  - taskflow/src/components/wiki-editor/media/embed.ts
  - taskflow/src/components/wiki-editor/media/upload-plugin.ts
  - taskflow/src/components/wiki-editor/media/upload-state.ts
  - taskflow/src/components/wiki-editor/nodeviews/AttachmentChip.tsx
  - taskflow/src/components/wiki-editor/nodeviews/EmoticonView.tsx
  - taskflow/src/components/wiki-editor/nodeviews/ImageView.tsx
  - taskflow/src/components/wiki-editor/nodeviews/MentionView.tsx
  - taskflow/src/components/wiki-editor/nodeviews/events.ts
  - taskflow/src/components/wiki-editor/paste/html-normalise.ts
  - taskflow/src/components/wiki-editor/paste/jira-html.ts
  - taskflow/src/components/wiki-editor/paste/paste-plugin.ts
  - taskflow/src/components/wiki-editor/paste/wiki-text.ts
  - taskflow/src/components/wiki-editor/paste/word-html.ts
  - taskflow/src/components/wiki-editor/rich-extensions.ts
  - taskflow/src/components/wiki-editor/source/SourceSuggest.tsx
  - taskflow/src/components/wiki-editor/source/SourceView.tsx
  - taskflow/src/components/wiki-editor/source/source-uploads.ts
  - taskflow/src/components/wiki-editor/suggestion/SuggestionPopover.tsx
  - taskflow/src/components/wiki-editor/suggestion/create-suggestion.ts
  - taskflow/src/components/wiki-editor/suggestion/emoticon-data.ts
  - taskflow/src/components/wiki-editor/suggestion/emoticon-suggestion.ts
  - taskflow/src/components/wiki-editor/suggestion/key-suggestion.ts
  - taskflow/src/components/wiki-editor/suggestion/mention-suggestion.ts
  - taskflow/src/components/wiki-editor/suggestion/search.ts
  - taskflow/src/components/wiki-editor/suggestion/slash-items.ts
  - taskflow/src/components/wiki-editor/suggestion/slash-suggestion.ts
  - taskflow/src/components/wiki-editor/toolbar/BubbleToolbar.tsx
  - taskflow/src/components/wiki-editor/toolbar/CompactFooter.tsx
  - taskflow/src/components/wiki-editor/types.ts
  - taskflow/src/lib/issue-key.ts
  - taskflow/src/lib/shortcuts.ts
  - taskflow/src/lib/textarea-caret.ts
  - taskflow/src/routes/dashboard/WikiRenderer.tsx
  - taskflow/src/routes/dashboard/issue-detail/AttachmentPickerModal.tsx
  - taskflow/src/routes/dev-tools/EditorTab.tsx
  - taskflow/src/stores/settings.store.ts
findings:
  critical: 4
  warning: 7
  info: 7
  total: 18
status: issues_found
---

# Phase 99: Code Review Report

**Reviewed:** 2026-11-17T12:00:00Z
**Depth:** standard
**Files Reviewed:** 47
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

I reviewed the phase-99 changes (`git diff c30092f9..HEAD`) in the 47 listed files. Pre-existing code was out of scope. I traced each finding through the code it calls: `@tiptap/suggestion` 3.34 `plugin/view.ts`, `plugin/state.ts` and `floating-ui.ts`; `searchJiraForLink`; `SourceView.insert`/`applyInsert`; `editor-session.resetDoc`/`replaceDoc`; and `AuthImage`/`useAuthBlob`.

The HTML normaliser is sound. It parses with DOMParser, rebuilds an allowlist, and validates every `data-wiki-*` marker again. I found no XSS path, and `AuthImage` does not send the PAT to external hosts.

The defects are in the input behaviour around it:
- The implicit issue-key suggestion takes over Enter and Tab.
- A wiki-text paste ignores code-block context.
- Upload naming can make several embeds point at one attachment.
- A staged multi-file drop in source mode keeps only the last reference.
- Uploads still in flight are not tied to the document they started in.

Right now the editor is mounted only in dev tools (`EditorTab`), but Phase 100 wires these paths into the issue hosts.

## Critical Issues

### CR-01: Issue-key suggestion takes over Enter/Tab and swaps a typed key for a different issue

**File:** `taskflow/src/components/wiki-editor/suggestion/key-suggestion.ts:9-35`, `taskflow/src/components/wiki-editor/suggestion/SuggestionPopover.tsx:63-65,87-91`
**Issue:** The `-` suggestion has no explicit trigger. `findSuggestionMatch` matches whenever the text before the caret ends in `<KNOWN>-<digits>`. The tiptap state `apply` also runs this match on selection-only transactions, so the popover opens in three cases:
- while the user types `Blocked by DEMO-12`
- when the user clicks to the end of a line that already ends in a key
- when the user arrows to the end of such a line

`SuggestionPopover.onKeyDown` then handles Enter and Tab by selecting `display[active]`, which is row 0 by default. Pressing Enter to start a new line therefore replaces the key with the first row:
- `searchJiraForLink` runs `key = "DEMO-12" OR (project = DEMO AND text ~ "DEMO-12") ORDER BY updated DESC`. Any issue that mentions DEMO-12 and was updated more recently sorts above DEMO-12 itself.
- While the debounced request for `DEMO-12` is in flight, `display` is `kept`, which holds the rows from the previous query (`DEMO-1`). Typing fast and pressing Enter writes `DEMO-1 `.

The newline is swallowed and the issue reference changes without any warning.
**Fix:** Don't let an implicit trigger take over commit keys. One way:
```ts
// SuggestionSpec: commitOnEnter?: boolean (false for wikiIssueKey)
// SuggestionPopover: track `navigated` (set on ArrowUp/ArrowDown/pointer), and
if (event.key === 'Enter' || event.key === 'Tab') {
  if (loading || (!commitOnEnter && !navigated)) return false; // let Enter insert a newline
  ...
}
```
Also never commit from the `kept` rows while `loading` is true (see WR-02). Consider ranking an exact key match first in `items`.

### CR-02: Staged multi-file paste/drop in source mode keeps only the last file's reference

**File:** `taskflow/src/components/wiki-editor/source/source-uploads.ts:33-38` (with `taskflow/src/components/wiki-editor/source/SourceView.tsx` `insert`)
**Issue:** In staging mode the loop calls `insert(stagedAttachmentRef(renamed))` once per file, all in the same tick. `SourceHandle.insert` builds the new text from the `value` prop captured at render time and from `el.selectionStart`, then calls `onChange`. React has not re-rendered between calls, so every call starts from the same old `value`, and each `onChange` overwrites the one before. Dropping three files stages all three through `host.stageFile`, but only the third `!name!` or `[^name]` survives in the text. The other two are uploaded on create with nothing referencing them.
**Fix:** Build the markup once and insert it once:
```ts
const parts: string[] = [];
for (const original of files) { /* ...rename/stage... */ parts.push(stagedAttachmentRef(renamed)); }
if (parts.length) insert(parts.join(' '));
```
Alternatively, make `insert` read `textareaRef.current.value` instead of the closed-over prop.

### CR-03: Pasting wiki-looking text into a code block converts it and splits the block

**File:** `taskflow/src/components/wiki-editor/paste/paste-plugin.ts:149-168,195-199`
**Issue:** `handleWikiText` runs whenever `looksLikeWiki(text)` is true, and it never checks the paste context. Step 1 inserts literal text, which ProseMirror handles correctly inside code. Step 2 then calls `replaceRange(from, end, parsed)` with block content from `loadWiki`. Inside a `codeBlock` (`spec.code`), `replaceRange` closes the code block and inserts headings, panels and lists. Pasting `h1. Title` or a `{code}`/`{panel}` sample into a `{code}` or `{noformat}` block breaks the block apart. Jira users often paste markup examples, so this is a common case. `insideProtectedContext` protects suggestions but nothing protects this path. The mono mark is also unprotected.
**Fix:** At the top of `handlePaste`, before the wiki and HTML branches:
```ts
const { $from } = view.state.selection;
if ($from.parent.type.spec.code || $from.marks().some((m) => m.type.name === 'mono')) return false;
```

### CR-04: Pasted remote images get colliding names, so several embeds show the same attachment

**File:** `taskflow/src/components/wiki-editor/paste/paste-plugin.ts:55-57,124-138`
**Issue:** `handleHtml` works out a deduplicated `name` for each image (alt text, then URL basename, then a generic name checked against `taken`). The remote `load` then throws that name away: `fetchPastedImage(src).then((f) => renameFile(f, f.name))` is a no-op rename. Inside `fetchPastedImage`, a URL without an extension falls back to `clipboardImageName(..., new Date(), new Set())`, which is deduplicated against an empty set.

Pasting an article with two or more extension-less CDN images in the same second uploads them all as `image-YYYYMMDD-HHMMSS.png`. Every embed becomes `!image-…png!`, and Jira resolves all of them to one attachment. The placeholder shows the computed name, but the uploaded name differs.
**Fix:**
```ts
load: () => src.startsWith('data:')
  ? Promise.resolve(decodeDataUrl(src, name))
  : fetchPastedImage(src).then((f) => renameFile(f, name)),
```
Also see WR-03: dedupe `name` against `taken`.

## Warnings

### WR-01: Uploads that finish after a mode toggle or an external value reset lose or misplace their embed

**File:** `taskflow/src/components/wiki-editor/media/upload-plugin.ts:112-128,272-293`, `taskflow/src/components/wiki-editor/WikiEditor.tsx:129-133,232-253`, `taskflow/src/components/wiki-editor/source/source-uploads.ts:41-44`
**Issue:** Placeholders are mapped through every transaction, including `replaceDoc`/`resetDoc` (`WIKI_TOGGLE_META`), and nothing ever removes them. Three cases fail:
- **Toggle to source while an upload is in flight.** `dispatchResolution` inserts the embed into the hidden rich doc, `onUpdate` returns early (`!e.isEditable`), and the markup never reaches `value`. A later `toRich` with changed source text runs `replaceDoc`, which wipes it.
- **External reset while an upload is in flight** (for example, the host clears the comment after Save). The embed is inserted at an arbitrary mapped position in the new document and emitted as a stray change.
- **Toggle to rich while a source-mode upload is in flight.** `sourceRef.current` is null, so `insert` does nothing and the markup is dropped.

In every case the attachment is uploaded (or staged) but nothing references it.
**Fix:** In `apply`, clear placeholders when `tr.getMeta(WIKI_TOGGLE_META)` is set, and record each one as a failure or a "not inserted" notice. Route source-mode completions through a callback that reads the current mode and inserts into whichever surface is active.

### WR-02: Suggestions can commit stale rows while a new query is loading

**File:** `taskflow/src/components/wiki-editor/suggestion/SuggestionPopover.tsx:63-65,87-91`
**Issue:** `display = loading ? kept : rows`, and Enter or Tab selects `display[active]` even when `loading` is true. The mention suggestion uses a 250 ms debounce plus a network request. Typing `@jo`, pausing, typing `hn` and pressing Enter mentions the first user returned for `jo`. `SourceSuggest` uses the same popover, so source mode has the same race.
**Fix:** Return `false` from `onKeyDown` for Enter and Tab while `loading`, or keep the old rows visible but disable committing them.

### WR-03: Uploaded file names are only deduplicated for generic clipboard names

**File:** `taskflow/src/components/wiki-editor/media/upload-plugin.ts:216-224`, `taskflow/src/components/wiki-editor/paste/paste-plugin.ts:129-131`, `taskflow/src/components/wiki-editor/source/source-uploads.ts:40`
**Issue:** `clipboardImageName` returns `file.name` unchanged unless the name is generic (`image.png`). Other names are never checked against `taken`:
- a dropped `screenshot.png` when the issue already has a `screenshot.png`
- two pasted images whose alt or URL basename is `logo.png`

Both files upload under the same name, and every `!screenshot.png!` then resolves to a single attachment. The staged path deduplicates through `stagedFileName`; the upload path does not.
**Fix:** In the non-staged paths, run every name through `dedupe` against `docNames(editor)` and the names already claimed in the batch. For example, call `stagedFileName(f, taken)` there as well.

### WR-04: The "Also delete attachment?" notice stays up after the embed is pasted back in

**File:** `taskflow/src/components/wiki-editor/media/embed-removal.ts:59-84`
**Issue:** Cut (Cmd+X) of a session-uploaded embed counts as a removal and raises the notice. The paste that puts it back is a normal transaction. The loop only checks names present in `before`, so `next = prev` and the notice stays for up to 6 s. If the user clicks Delete, `deleteAttachment` removes an attachment that is still referenced. Only undo and redo clear the notice when the name reappears.
**Fix:** Run the "still referenced" check for every doc-changing transaction:
```ts
if (prev && (after.get(prev.filename) ?? 0) > 0) next = null;
```

### WR-05: Source-mode triggers open inside `{code}`/`{noformat}` blocks

**File:** `taskflow/src/components/wiki-editor/source/SourceSuggest.tsx:29-51,186-207`
**Issue:** `detectSourceTrigger` has no equivalent of the rich editor's `insideProtectedContext`. Two examples inside a code block in source mode:
- Ruby `validates :id` followed by Enter. `filterEmoticons('id')` matches the keyword `idea`, so Enter replaces `:id` with `(on)` and swallows the newline.
- Java `@Override` at the start of a line opens a people search.

Forced-source documents are often the ones that contain code.
**Fix:** Before matching, scan `value.slice(0, caret)` for an unclosed `{code…}` or `{noformat}` and return `null` when one is open.

### WR-06: In source mode the compact footer's Emoticon and Mention buttons don't open anything

**File:** `taskflow/src/components/wiki-editor/toolbar/CompactFooter.tsx:30-47`
**Issue:** In source mode, Emoticon inserts a bare `:`. `EMOTICON_RE` needs at least one letter after the colon, and source mode has no "force" state, so no list opens. Mention inserts `@` with no leading space, so after a word (`foo@`) `MENTION_RE` does not match. In addition, the controlled re-render moves the caret to the end before the rAF restores it, so `sync()` checks the wrong position. In both cases the button does nothing useful.
**Fix:** Add a forced-open state to `SourceSuggest`, exposed through an imperative `open(kind)`. Insert ` @` or ` :` with a leading space after a non-space character, and re-run `sync()` after the caret is restored.

### WR-07: The plain-paste flag only works for the keyboard path and can stay set

**File:** `taskflow/src/components/wiki-editor/paste/paste-plugin.ts:175-187`
**Issue:** `plainNext` is set only by a Cmd+Shift+V keydown that reaches ProseMirror. Choosing Edit > "Paste and Match Style" with the mouse (the new `lib.rs` menu item) sends `pasteAsPlainText:` without that keydown. The paste then carries only `text/plain` with `plainNext === false`, so `looksLikeWiki` converts the text to rich content, which is the opposite of what was asked. Separately, if Cmd+Shift+V is pressed while the clipboard is empty or non-text, no paste event fires and the flag stays `true`. The next context-menu paste is then forced to plain.
**Fix:** Have the menu handler emit an event the editor listens for, or have it set a short-lived flag through `eval`/`emit` before sending `pasteAsPlainText:`. Clear `plainNext` on a timeout or on the next keydown that is not V.

## Info

### IN-01: Cmd/Ctrl+Shift+V is registered on every platform but does nothing outside macOS

**File:** `taskflow/src-tauri/src/lib.rs:21-22,376-379`
**Issue:** `tauri.conf.json` has `"targets": "all"`. On Windows and Linux the menu accelerator captures Ctrl+Shift+V, and the no-op `paste_as_plain_text` drops it.
**Fix:** Add the menu item only under `#[cfg(target_os = "macos")]`.

### IN-02: Cmd+click on a decorated key is consumed when the host has no `onOpenIssue`

**File:** `taskflow/src/components/wiki-editor/issue-key-decoration.ts:71-78`
**Fix:** Check `getHost(editor).onOpenIssue` before calling `preventDefault()`, and return `false` when it is absent.

### IN-03: Delete in the removal notice silently does nothing when the host has no `deleteAttachment`

**File:** `taskflow/src/components/wiki-editor/media/EditorMessages.tsx:50-57`
**Fix:** Don't raise the notice in `embed-removal` when `getHost(editor).deleteAttachment` is undefined.

### IN-04: `searchPeople` sends requests with an empty project scope

**File:** `taskflow/src/components/wiki-editor/suggestion/search.ts:29-41`
**Issue:** `useAssignableUserSearch` is disabled when there is neither an issue key nor a project key. `searchPeople` still sends `project=` and caches the `[]` result for 60 s under a key whose scope is `''`.
**Fix:** `if (!issueKey && !projectKey) return [];`

### IN-05: Hazardous-name image uploads lose their local preview and the delete-attachment notice

**File:** `taskflow/src/components/wiki-editor/media/upload-plugin.ts:164-171`, `taskflow/src/components/wiki-editor/media/embed.ts:17-20`
**Issue:** For filenames containing `!`, `|` or `]`, the node `name` is `att.content` (the URL). The preview and the session map are keyed by `created.filename`, so the image falls back to AuthImage and deleting the embed never offers the delete-attachment notice.
**Fix:** Key both by the node's name, using `embedContentFor(created).attrs.name`.

### IN-06: Comment in `input-extensions.ts` is wrong

**File:** `taskflow/src/components/wiki-editor/input-extensions.ts:11`
**Issue:** The comment says WikiSmartPaste is appended "inside buildEditorExtensions". It is actually in `WIKI_INPUT_EXTENSIONS`, which `rich-extensions.ts` spreads after `WikiUpload`/`WikiEmbedRemoval`.
**Fix:** Update the comment.

### IN-07: The dev-tools paste capture listener is never removed on unmount

**File:** `taskflow/src/routes/dev-tools/EditorTab.tsx` (`armCapture`)
**Issue:** The `once` window listener outlives the tab if the user navigates away while it is armed, and the next paste anywhere calls `setCaptured` on an unmounted component.
**Fix:** Keep the handler in a ref and remove it in an effect cleanup.

---

_Reviewed: 2026-11-17T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
