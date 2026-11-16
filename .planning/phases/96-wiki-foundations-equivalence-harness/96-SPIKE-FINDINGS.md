# Phase 96: Editor Engine Spike Findings

Date: 2026-11-16. Plan 96-05 (D-01 to D-03).

## Decision

TipTap is the editor engine.
Under the D-02 rule, TipTap wins unless the spike finds a WKWebView caret or IME blocker.
The spike found none.

## How the smoke test was run

The user asked Claude to run the smoke test.
macOS denied the terminal Accessibility and Screen Recording access, so Claude couldn't drive the Tauri window with keystrokes.
Claude instead built a small native macOS harness, a Swift AppKit app in the session scratchpad.
It hosts a `WKWebView`, the same WebKit engine Tauri uses on macOS.
The harness loaded each prototype from the spike's Vite server, with a stub page that has no Tauri APIs.

The harness drove the editors as follows:
- **Keys:** it sent real `NSEvent` key events through the window. This covers arrow keys, Cmd+arrows, Shift+Down, Cmd+Z, Shift+Cmd+Z and plain letters.
- **IME:** it called the webview's `NSTextInputClient` methods, `setMarkedText` and then `insertText`. Japanese and Pinyin input sources use the same calls.
- **Paste:** it used the real system pasteboard and the `paste:` action. The user's clipboard was saved first and restored afterwards.
- **State:** it read the editor state back through `evaluateJavaScript`.

The test covered 6 to 11 hard fixtures per check.
They were mixed-nesting lists, headerless tables, the titled panel, all emoticons, username mentions and code with a language.
Table cells were also tested with inline callouts, color, unknown macros, an image and CRLF.

## Smoke results

| Check | TipTap | CodeMirror 6 |
|-------|--------|--------------|
| Caret: Down through nested lists, table rows, code lines | Pass. The caret moved on every press, and its rect was visible at every step (`coordsAtPos` height 18px). | Pass. One line per press. |
| Caret: Right across mention atom and emoji | Pass. One press selects the mention (NodeSelection), and emoji count as single graphemes. | Pass after adding `atomicRanges`. Without it, the caret stuck in front of a replace-widget at line start (prototype config, see Blockers). |
| Caret: Cmd+Left / Cmd+Right | Pass. One nuance: the first Cmd+Left right after a programmatic `setTextSelection` did not move. After any keyboard move it worked. A real click places the caret. | Pass (`defaultKeymap`). |
| IME: Japanese に→にほ→にほん→日本 in a paragraph, list item and table cell | Pass. A clean compositionstart/update/end sequence, with 日本 inserted once and no leftover kana. | Pass. Same event sequence and result. |
| IME: Pinyin z→zh→zhong→中 | Pass. | Pass. |
| Dead key: ´ then é | Pass through the IME path, the marked ´ committed as é. Synthetic Option+e key events gave a plain e because the harness can't run TIS dead-key handling. | Same as TipTap. |
| Typing right after a mention atom | Pass. Text lands after the atom, and the atom stays intact. | n/a. Mentions are raw `[~user]` text. |
| Typing at the end of a callout, then Enter | Pass. Text stays inside the callout, and Enter adds a paragraph inside it. | n/a. Raw `{panel}` text. |
| Undo / redo (Cmd+Z, Shift+Cmd+Z) | Pass. | Pass after adding `history()` and `historyKeymap` (the prototype had neither). |
| Rich paste (bold, link, list) from the system pasteboard | Pass. Kept `<strong>`, the link and the list. | Pass as plain text, which is expected for a source editor. |
| Selection across blocks (Shift+Down x3, then type) | Pass. The doc stayed valid. | Pass. |
| Re-render stability | Pass. One editor instance and the same root node across all edits. | Pass. Same. |

## Blockers seen

None.

The CodeMirror prototype had two problems that came from how it was set up:
- **Stuck caret:** it got stuck before the `(/)` emoji widget at line start (`emoticons/all-emoticons.wiki`, caret at 0, press Right).
- **No undo:** Cmd+Z did nothing.

Both came from the prototype missing a keymap, `history()` and `EditorView.atomicRanges`. Both went away once those were added, so neither is an engine blocker.

## API notes for Phase 97

- **Build the doc from the Phase 97 parser.** Feeding TipTap `wikiToHtml` output loses information, so it can't be the import path. The spike lost all of the following:
  - **`{color}`:** dropped entirely, leaving plain text.
  - **`!image!` attachments:** dropped, leaving an empty paragraph.
  - **Panel types:** `{info}`, `{note}`, `{panel}` and so on all collapsed into one callout, and panel titles were lost.
  - **Emoticons:** these became Unicode characters, so `(/)` can't be recovered from `✅`.
  - **Unknown macros:** `{expand}` and `{status}` survived only as literal paragraph text with `<br>`.
- **Mixed `*#` / `#*` nesting:** the current pipeline renders the second-level mixed marker as literal text after a `<br>`, not as a nested list. The parser must model mixed list nesting itself.
- **Headerless tables:** these come out of the pipeline with an injected empty header row (`<th><p></p></th>`). The doc model needs a "no header row" table attribute so the emitter doesn't write an empty `||` row back.
- **Node types needed:**
  - mention: an inline atom carrying the user id
  - emoticon: an inline atom carrying the wiki token, not the Unicode character
  - panel: a block carrying type and title, nestable inside table cells
  - color: a mark carrying the colour value
  - attachment image: an inline atom carrying the filename
  - raw or unknown macro: a block or inline atom holding the source text verbatim
  - code block: keep the language. TipTap kept it as `class="language-java"`.

## API notes for Phase 98

- **Packages:** `@tiptap/react`, `@tiptap/core`, `@tiptap/pm`, `@tiptap/starter-kit` and `@tiptap/extension-table`, all `^3.34.0`.
  - StarterKit 3.x already includes undo/redo, bold and link.
  - The user approved these packages at the Plan 02 gate.
  - All are published by ueberdosis, with no install scripts.
- **React Compiler:** `useEditor` with an `onCreate`/`onUpdate` that calls `setState` created exactly one editor per mount, and the editor never rebuilt while typing.
  - Keep `content` memoised on the source text.
  - Keep `setContent` behind an effect keyed on that memo, as the prototype did.
- **IME:** no special configuration was needed. WebKit sent standard composition events, and ProseMirror committed them correctly in paragraphs, list items and table cells.
- **Caret:** a programmatic `setTextSelection` before the first Cmd+Left can leave the native line-boundary move as a no-op. If keyboard shortcuts that run right after a programmatic focus matter, bind `Mod-ArrowLeft` and `Mod-ArrowRight` in a TipTap keymap rather than relying on WebKit's native move.
- **If CodeMirror is ever revisited:** it needs `history()`, `keymap.of([...defaultKeymap, ...historyKeymap])` and `EditorView.atomicRanges` for replace-widgets.

## SAFE-01 visual spot check

Pass.
Rather than opening real issues, which would have meant handling customer text, Claude rendered every corpus fixture through `<WikiRenderer>`. It did this twice: at the pre-extraction commit `62064e5f`, and on current main after Plans 01 to 04.
All 37 fixtures produced byte-identical HTML both times, 48 KB in total.

## Time spent

About 45 minutes. That covers building the prototype and running three harness rounds plus one follow-up probe, inside the one-session time-box.

## Spike disposal

The `spike/96-editor-engine` branch and the `/Users/mimo/Documents/Projects/taskflow-spike-96` worktree are both deleted.
The spike's dev app was stopped first.
Main's `taskflow/package.json` has no `@tiptap/*`, `@codemirror/*` or `codemirror` entry.
The Swift harness stays only in the session scratchpad and was never committed.
