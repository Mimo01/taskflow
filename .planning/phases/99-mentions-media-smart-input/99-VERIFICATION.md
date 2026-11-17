---
phase: 99-mentions-media-smart-input
verified: 2026-11-17T18:40:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Launch the native Tauri build; press Cmd+Shift+V and use Edit > Paste and Match Style in the editor"
    expected: "Clipboard content pastes as plain text; the next Cmd+V pastes rich again"
    why_human: "Verified only in a Swift WKWebView harness with a Tauri-equivalent menu item; the native Rust menu (src-tauri/src/lib.rs, objc2 pasteAsPlainText:) was only cargo-checked"
  - test: "In the native app, drag a PNG and a PDF from Finder into the editor"
    expected: "Both upload and embed at the drop point, no outer drop zone fires"
    why_human: "dragDropEnabled:false confirmed in config; a physical Finder drag in the Tauri shell was not driven"
  - test: "Paste from a real Jira issue view and a real Word document (Capture next paste)"
    expected: "Mentions, keys, panels, lists and tables map correctly"
    why_human: "Only synthetic placeholder fixtures were exercised; real content must not be committed"
---

# Phase 99: Mentions, Media & Smart Input Verification Report

**Phase Goal:** Users can mention people, embed attachments and images, paste rich content and use smart autocompletes inside the editor
**Status:** human_needed (all automated checks pass)
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

## Human Verification Required

1. Native Cmd+Shift+V and Edit > Paste and Match Style in the built Tauri app (WKWebView harness only so far).
2. Physical Finder drag/drop into the Tauri shell.
3. Real Jira and Word paste captures (placeholder fixtures only so far).

## Gaps Summary

None. Remaining items are manual native-shell checks.

_Verifier: Claude (gsd-verifier)_
