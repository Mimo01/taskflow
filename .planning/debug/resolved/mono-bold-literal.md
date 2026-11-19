---
status: resolved
trigger: "block 1 (paragraph) does not read back as the edited structure — bold inside monospace saved as {{*dv*fdv}}"
created: 2026-11-19
updated: 2026-11-19
---

## Symptoms
- expected: paragraph with breaks, "dv" [bold, mono], "fdv" [mono]
- actual: emitted `{{*dv*fdv}}`, reads back as one mono run "*dv*fdv"
- reproduction: in the wiki editor, apply monospace over a range and bold to part of it, save

## Resolution
root_cause: parse/marks.ts reads `{{…}}` content as literal (no nested marks), but
  emit.ts markedSegments nests marks by extent, so a mono mark spanning children with
  different other marks opened outermost and wrapped their delimiters.
fix: markedSegments keys a mono mark by the child's other marks (so it closes/reopens where
  they change) and always opens mono innermost → `*{{dv}}*{{fdv}}`.
verification: approved by user 2026-11-19; new marks.test.ts case (failed pre-fix with `{{*dv*fdv}}`); src/lib/wiki 501/501
  incl. lossless fuzz; biome + tsc clean.
files_changed: taskflow/src/lib/wiki/editor/emit.ts, taskflow/src/lib/wiki/editor/marks.test.ts

## Not fixed (separate)
Text containing a typed literal `\\` (e.g. "a\\b") is emitted unescaped and reads back as a
line break — save fails independent of mono.
