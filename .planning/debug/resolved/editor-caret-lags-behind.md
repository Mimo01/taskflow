---
status: resolved
trigger: "in the editor, some actions feel a bit laggy. the carret is behind the action i did, the content updates and the carret stays a little behind"
created: 2026-11-19
updated: 2026-11-19
---

## Symptoms

- expected: Caret moves together with the content change, in the same frame.
- actual: Content updates first and the caret visibly catches up later (noticeable delay, ~100ms+, on any page).
- actions: Backspace/delete and Enter/new block confirmed. Others possible ("I sometimes notice it").
- errors: none reported
- timeline: unknown, may be long-standing
- reproduction: wiki editor (TipTap), press Enter or Backspace in a paragraph/list

## Current Focus

hypothesis: CONFIRMED in a WKWebView harness — when ProseMirror rebuilds the DOM around a caret that sits between elements (after a hard break, empty line, next to the WebKit separator img), WebKit's mutation tracking already moves the DOM selection to the point PM then sets; no selectionchange fires and the caret repaint is skipped until a later update (100–500ms).
next_action: none — user confirmed fixed in the app; committed fd78860a

## Evidence

- timestamp: 2026-11-19 — jsdom bench (temp zz-perf.test.ts): Enter/Backspace dispatch 0.4–1.4ms, saveWiki 0.4–5.6ms on 1–27KB docs. Editor-side sync work is not ~100ms.
- timestamp: 2026-11-19 — Enter/Backspace go through PM keymap (structural change; gap-keeper appendTransaction setNodeMarkup redraws the block) unlike plain typing (text-only).
- timestamp: 2026-11-19 — no CSS transitions/animations on editor content; no rAF/timeout/late focus in the editor path.

- timestamp: 2026-11-19 — ~/Desktop/carret.mov (VFR, frames only on change): f19 t=1.200 Enter on an empty line moves text below; caret stays at old line (fading) until f20 t=1.725. Other block edits: caret 33–150ms after content (f40→41, f43→44, f48→49). Backspace inside text (f34–36): char and caret change in the same frame.
- timestamp: 2026-11-19 — jsdom: PM writes a fresh DOM selection into the new node on Enter/Backspace (not a stale-same-node case); so WebKit receives the selection change but paints late.

- timestamp: 2026-11-19 — first fix (re-apply range only when the caret's textblock changed) did not help in the app (user).
- timestamp: 2026-11-19 — harness: throwaway vite build of real WikiEditor (React Compiler) in a Swift WKWebView window, real NSEvent keys, CGWindowListCreateImage (via dlsym) every ~8ms. Plain Enter in isolation is mostly immediate; Shift+Enter x2 lagged 113ms. Page log: 2nd Shift+Enter → DOM "omo",BR,IMG,BR,BR, selection P@4, NO selectionchange event.
- timestamp: 2026-11-19 — artificial 300ms busy work after onChange delays content and caret together, so main-thread load is not the mechanism.
- timestamp: 2026-11-19 — re-apply on every element-anchored caret: selectionchange fires, caret in first capture. Batches: no fix / block-only plugin 4/104 late caret jumps; final 0/128 (Shift+Enter, Enter, Backspace, start-of-line Enter, typing).

## Eliminated

- hypothesis: block-change-only trigger is enough — Shift+Enter stays in the same textblock; harness + user showed lag remained.

- hypothesis: PM leaves the DOM selection on the same node/offset so WebKit sees no change — jsdom shows a new anchor node and a selection write every time.

- hypothesis: saveWiki/evaluateSave per keystroke is slow — measured ≤6ms on 27KB.
- hypothesis: unstable editorProps makes tiptap useEditor call setOptions (view.setProps + updateState) after every render — true without the compiler, but the React Compiler memoizes editorProps (checked compiled output), so not in the app.
- hypothesis: editor CSS transition shifting content under a static caret — none exist.

## Resolution

root_cause: WKWebView skips the caret repaint when PM rebuilds the DOM around an element-anchored caret: its own mutation tracking leaves the selection at the same DOM point PM sets, so no selection change is registered and the caret stays painted at its old spot for 100–500ms.
fix: caret-repaint.ts WikiCaretRepaint (rich view, WebKit UA only): after a doc change, when the caret moved to another textblock OR the DOM anchor is an element (not a text node), flush layout and remove/re-add the same range. Skips typing in text nodes, IME composition, unfocused views, non-collapsed selections.
verification: unit tests caret-repaint.test.ts (Enter/Backspace fail without plugin; Shift+Enter fails with the block-only version); wiki-editor + lib/wiki 1205/1205; tsc; biome. WKWebView harness 0/128 late jumps vs 4/104 before. User confirmed fixed in the Tauri app. Commit fd78860a.
files_changed: src/components/wiki-editor/caret-repaint.ts, caret-repaint.test.ts, rich-extensions.ts
