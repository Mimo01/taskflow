---
status: resolved
trigger: "Couldn't save safely — the saved text has 1 top-level blocks, the edit has 2 (paragraph \"\\\\\" read back as nothing)"
created: 2026-11-19
updated: 2026-11-19
---

## Symptoms
- expected: a typed paragraph containing `\\` saves
- actual: save fails closed with "the saved text has 1 top-level blocks, the edit has 2"; produced markup ends with `\\`
- reproduction: in the wiki editor, type `\\` as its own paragraph and save

## Resolution
root_cause: Typed `\\` is emitted as-is and `\\` is always a hard break in Jira wiki (parse/inline.ts) — even inside `{{}}`. The paragraph reads back as a lone break = empty paragraph, which is skipped, so the block count differs. There is no escape spelling for a backslash; the fuzz test already lists it as UNSPELLABLE. Failing closed was correct; the message was not: `unspellableReason` had no backslash case and the block-count-mismatch path never consulted it.
fix: `unspellableReason` names `\\` (line break) and `\X` before an escapable char (escape drops the backslash), pointing to a code block. `diagnoseSave` adds the reason to count-mismatch failures; `unspellableIn` also checks backslashes split across adjacent text nodes.
verification: 3 new tests fail on HEAD, pass after; src/lib/wiki + components/wiki-editor 1217 tests pass; biome + tsc clean.
files_changed: src/lib/wiki/editor/escape.ts, save-check.ts (+ tests)
