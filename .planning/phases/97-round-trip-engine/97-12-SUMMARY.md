---
phase: 97-round-trip-engine
plan: 12
subsystem: wiki-editor
tags: [escape, safe-06, cr-05, gap-closure]
requirements: [SAFE-06]
key-files:
  modified:
    - taskflow/src/lib/wiki/editor/emit.ts
    - taskflow/src/lib/wiki/editor/escape.ts
    - taskflow/src/lib/wiki/editor/escape.test.ts
metrics:
  tasks: 1
  completed: 2026-11-16
---

# Phase 97 Plan 12: Typed atom look-alikes stay text (CR-05)

emit.ts `display()` now tags atoms by type (`\u0001type:spelling\u0001`), so typed text that looks like a mention, image, attachment or macro no longer compares equal to the parsed atom and gets escaped. escape.ts gains emoticon-token escape sites (inner character) and `unspellableReason()`.

## What changed

- emit.ts: atom-tagged `display()`; `risky` pre-check also matches `(`.
- escape.ts: emoticon tokens from `JIRA_EMOTICON_TOKENS` mark their first escapable inner character as an escape site; exported `unspellableReason(text, lineStart)` for `hN. `/`bq. ` prefixes (workaround: monospace) and non-escapable emoticons like `(x)` (monospace does not help).
- escape.test.ts: strict oracle (any non text/escape/hardBreak node fails), atom-shaped PARTS, UNSPELLABLE built from `unspellableReason`, CR-05 exact cases, emoticon render check, reason tests.

## RED evidence

Before the implementation, 6 tests failed: the three 1000-case property tests, plus:
- `typed atom look-alikes stay text (CR-05)`: `AssertionError: ping [~admin] now: expected null to be 'ping [~admin] now'` (typed `[~admin]` re-parsed as a mention atom).
- `escapes emoticon tokens through their inner character`: `expected 'see (+) here' to be 'see (\+) here'`.
- `unspellableReason names the token and the workaround` (function absent).
The property tests failed partly because `unspellableReason` did not exist yet.

## Deviations

- Exact spelling of the mention case is `ping [\~admin] now` (escape on `~`, the minimal site the emitter picks) rather than `\[~admin]`; the plan allowed any spelling that re-parses as text. Test asserts that spelling.
- Plan 97-14 (unspellable fail-closed) is not part of this plan; `(x)`, `h1. ` remain unspellable here.

## Verification

`npx vitest run src/lib/wiki/editor src/lib/wiki/equivalence.test.ts` passes (corpus emit unchanged/idempotent); biome check clean on the three files; `tsc --noEmit` clean.
