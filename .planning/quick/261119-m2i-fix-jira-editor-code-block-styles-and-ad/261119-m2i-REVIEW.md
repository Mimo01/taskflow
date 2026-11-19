# Quick Task 261119-m2i — Code Review

**Depth:** quick · **Reviewed:** 84e4d392..b3a2a28d · **Fixes:** c0dc021e

| ID | Severity | Finding | Outcome |
|----|----------|---------|---------|
| CR-01 | Critical | `CodeBlock.extend({ addProseMirrorPlugins: () => [...] })` dropped the parent's `codeBlockVSCodeHandler` paste plugin | Fixed — chain `this.parent?.()`; test asserts both plugin keys |
| WR-01 | Warning | Editor flattened nested hljs classes onto one span → descendant selectors never matched and (0,3,0) groups won (`${}` subst took string colour) | Fixed — one nested `nodeName: 'span'` decoration per hast element; regression test proven failing pre-fix |
| WR-02 | Warning | `unist-util-visit` / `@types/hast` used but undeclared | Fixed — pinned explicitly |
| WR-03 | Warning | No size cap on sync tokenising | Fixed — plain above 100k chars or any line > 2000 chars (measured: hljs quadratic on one long token, 100k-char token ≈ 13.5 s; 100k chars normal Java ≈ 10 ms). Case-insensitivity not needed (parser only models lowercase `{code:x}`) |
| WR-04 | Warning | Whole-doc decoration rebuild per doc change | Skipped — tokenising is cached per persistent node; only decoration objects rebuild |
| IN-01..06 | Info | Post-sanitize XSS safety, doc model untouched, React Compiler, github-dark specificity | No change needed — every compound github-dark selector is covered by a higher-specificity `.wiki-code :is()` group |
