---
phase: 99-mentions-media-smart-input
verified: 2026-11-17T18:40:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification_results:
  - test: "Cmd+Shift+V and Edit > Paste and Match Style in the running Tauri app (tauri dev)"
    result: pass
    evidence: "Clipboard HTML <b>Bold</b> text + plain ' *star* text': menu item and Cmd+Shift+V both insert '*star* text' literally (saved as \\*star\\*), the following Cmd+V pastes bold"
  - test: "Real Finder drag of a PNG into the editor (CGEvent mouse drag from a Finder window)"
    result: pass
    evidence: "Image embedded at the drop point, saved as !finder-drop.png!, page did not navigate"
  - test: "Real Jira paste (Chrome copy of a public Apache Jira issue description)"
    result: pass_after_fix
    evidence: "Lists, headings, bold, table and {code:java} kept; {{monospace}} was dropped (Jira renders it as <tt>) and is fixed in adcba3ea; known WebKit limitation below"
  - test: "Real Word paste"
    result: not_run
    evidence: "Microsoft Word is not installed on this machine; covered by the Word fixture test only"
---

# Phase 99: Mentions, Media & Smart Input Verification Report

**Phase Goal:** Users can mention people, embed attachments and images, paste rich content and use smart autocompletes inside the editor
**Status:** passed (automated checks plus in-app checks on 2026-11-17)
**Re-verification:** No

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | @ picks a person via server-side search, saves as `[~username]` | VERIFIED | `suggestion/mention-suggestion.ts` inserts a mention node (`id: user.name`) via per-query search (`suggestion/search.ts`); MentionView node view, source-mode `SourceSuggest.tsx`; tests mention.test.tsx, mention-search.test.ts, schema-parity |
| 2 | Attachment picker embeds; paste/drop uploads or stages and embeds | VERIFIED | `media/upload-plugin.ts` (WikiUpload registered in rich-extensions.ts), `embed.ts`, AttachmentPickerModal mounted in WikiEditor.tsx, source-uploads.ts; UAT 1-6, 12 pass |
| 3 | Rich HTML paste keeps supported formatting, drops the rest | VERIFIED | `paste/html-normalise.ts` allowlist plus jira-html.ts, word-html.ts, wiki-text.ts, WikiSmartPaste in WIKI_INPUT_EXTENSIONS; tests html-normalise, paste-plugin, plain-paste; UAT 8 (fixtures) |
| 4 | `/` slash menu for any block, issue-key autocomplete and decoration, `:` emoticons | VERIFIED | slash-suggestion.ts and slash-items.ts (text, block and insert groups), key-suggestion.ts and issue-key-decoration.ts, emoticon-suggestion.ts, all in WIKI_INPUT_EXTENSIONS; tests slash, emoticon, issue-key |
| 5 | Compact hosts show floating bubble menu (no toolbar); popovers close with Esc before dialog | VERIFIED | BubbleToolbar and CompactFooter wired in WikiEditor.tsx; create-suggestion.ts handles Escape; lifecycle.test.tsx and popover.test.tsx cover Esc-in-Dialog; UAT 9, 11 pass |

**Score:** 5/5

## Requirements Coverage

INPUT-01..07 and BLOCK-05 are SATISFIED by the artifacts above (all declared in the roadmap for Phase 99; no orphans). Note: REQUIREMENTS.md checkboxes and traceability table still read Pending and should be flipped at phase completion.

## Behavioral Spot-Checks

`npx vitest run src/components/wiki-editor`: 56 files, 631 tests passed. Full suite reported green by orchestrator (6448 passed, tsc and cargo check clean). Probe execution: none declared.

## Anti-Patterns

No TBD/FIXME/XXX markers in src/components/wiki-editor or src-tauri/src/lib.rs. UAT gaps (Cmd+Shift+V, stray popover, Docs heading) resolved in 41dd7b80; review findings CR-01..04, WR-01..07, IN-01 fixed. Issue-page wiring is Phase 100 scope, not a gap.

## Human Verification Results

Run in the live `tauri dev` app (Dev tools > Editor) with a native CGEvent/Accessibility driver.

1. **Plain paste:** pass. The menu item and Cmd+Shift+V paste text/plain literally; Cmd+V right after stays rich.
2. **Finder drag:** pass. A real drag from Finder embeds the image (`!finder-drop.png!`) with no outer drop.
3. **Jira paste:** pass after fix adcba3ea. A real Chrome copy of a public Jira issue lost every `{{monospace}}` span because Jira renders it as `<tt>`. With the fix, the capture saves equivalent to the issue's own wiki markup.
4. **Word paste:** not run. Word is not installed here; the Word fixture test still covers it.

Known limitation (WebKit, not phase code): WKWebView sanitises cross-origin clipboard HTML before the paste event and can drop a space after an inline element (`<tt>x</tt> nulls` arrived as `<tt>x</tt>nulls`). Fixing it would mean reading the raw HTML from the native clipboard; logged as a follow-up.

Dev-environment note: a second Vite instance run from the same folder rewrote `node_modules/.vite/deps` under the running dev server, which loaded two copies of prosemirror-model and made every plain-text paste throw. Restarting Vite fixed it; it does not affect builds.

## Gaps Summary

None. Remaining items are manual native-shell checks.

_Verifier: Claude (gsd-verifier)_
