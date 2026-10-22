---
status: resolved
reviewed: f2495f16..ed1061be
fixed_in: 2987f608
---
# Code Review — 261022-h1q (quick depth)

| ID | Severity | Finding | Outcome |
|----|----------|---------|---------|
| CR-01 | Critical | FindBar stuck open (and Cmd+F dead) when the dialog/peek scope is removed — MutationObserver only watched inside the scope | Fixed: observe document.body, close as soon as scope is detached; regression test |
| WR-01 | Warning | `e.code === 'KeyF'` = physical key, wrong on non-QWERTY | Fixed: `e.key.toLowerCase() === 'f'` |
| WR-02 | Warning | Cmd+F while open never re-targets to a newly opened dialog/peek | Fixed: openFind re-resolves scope and switches |
| WR-03 | Warning | Whitespace-only text nodes dropped → "foo"+" "+"bar" matched as "foobar"; nbsp/newlines didn't match a space | Fixed: whitespace nodes kept inside runs; folding collapses whitespace/nbsp to one space; regression tests |
| WR-04 | Warning | Resetting debounce starves on constantly-mutating pages | Fixed: trailing throttle (150 ms) |
| WR-05 | Warning | Esc may also dismiss host dialog | Not changed: Base UI dismiss listens bubble-phase on document, React stopPropagation stops it (per RESEARCH). Left for UAT check |
| IN-01..03 | Info | Hangul jamo partial highlight; redundant scroll fallback; effect-order fragility | Not changed (non-blocking) |

All three new regression tests were confirmed to FAIL against the pre-fix code before landing.
