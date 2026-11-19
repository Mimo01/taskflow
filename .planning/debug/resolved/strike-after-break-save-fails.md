---
status: resolved
trigger: "Couldn't save safely — block 1 (paragraph) does not read back as the edited structure (struck \"vsmvofo\" between \\\\ breaks reads back as plain \"-vsmvofo-\")"
created: 2026-11-19
updated: 2026-11-19
---

## Symptoms
- expected: paragraph of 8 breaks, "vsmvofo" [strike], 2 breaks saves
- actual: produced `\\…\\-vsmvofo-\\\\`; save-check refuses, strike reads back as literal dashes
- reproduction: strike a word on a line that sits between Shift+Enter breaks, save

## Resolution
root_cause: `-x-` / `_x_` only open after whitespace, line start, `*` or `_`, and only close
before the same (parse/marks.ts). The emitter always wrote the canonical delimiter, so a strike or
italic next to a word character or a `\\` break (newly emitted since 8c20927e) read back as text.
Pre-existing for intraword marks (`a` + strike `bcd`); the non-risky text path also skipped the
read-back check entirely.
fix: inlineSegments (emit.ts) now read-back-checks any run with canonical flank-sensitive marks and,
when the plain spelling fails, switches the fewest such marks to the brace form (`{-}x{-}`, read
anywhere) — before and combined with the escape minimiser. Loaded text still emits byte-identical.
verification: 4 new cases in emit-edited.test.ts fail pre-fix and pass post-fix; two save-check
tests that pinned intraword italic / `*_hello _*` as unwritable updated (now write `x{_}a{_}y`,
`*{_}hello {_}*world` and read back); wiki + wiki-editor suites 1164/1164; biome + tsc clean.
files_changed: taskflow/src/lib/wiki/editor/emit.ts, taskflow/src/lib/wiki/editor/emit-edited.test.ts,
taskflow/src/lib/wiki/editor/save-check.test.ts
