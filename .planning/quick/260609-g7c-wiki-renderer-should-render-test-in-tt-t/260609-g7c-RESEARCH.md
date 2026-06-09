# Quick Task 260609-g7c: Wiki {{{...}}} → `<tt>` Research

**Researched:** 2026-06-09
**Domain:** WikiRenderer.tsx — preprocessJiraMarkup
**Confidence:** HIGH

---

## Summary

`{{{TEXT}}}` is Jira's teletype/monospace macro that should render as `<tt>TEXT</tt>`. The renderer currently lets `{{{` pass through to jira2md, which misparses it: jira2md's `{{...}}` regex (`/\{\{([^}]+)\}\}/g`) is greedy and matches the inner `{{TEST}` portion, emitting `` `{TEST` `` with a trailing literal `}`. The outer `{` and `}` become dangling prose characters. The result is garbled output — not plain passthrough.

The fix belongs entirely in `preprocessJiraMarkup` in `WikiRenderer.tsx`, as a single regex replacement that runs **before** jira2md, converting `{{{...}}}` to `<tt>...</tt>` HTML. That HTML passes through jira2md unmodified and is already allowed by the `wikiSanitizeSchema` (rehype-sanitize's `defaultSchema.tagNames` includes `tt`).

No changes are needed to jiraToTiptap or jiraWikiSerializer — those paths handle the TipTap editor round-trip (write path), not the read/display path. The bug is display-only.

**Primary recommendation:** Add one `result.replace(/\{\{\{(.*?)\}\}\}/gs, '<tt>$1</tt>')` call in `preprocessJiraMarkup`, before jira2md, following the same pattern as `{*}`, `{_}`, and `{color}` handling.

---

## Key Findings

### 1. The bug: jira2md mangles `{{{...}}}`

Verified by running jira2md directly:

```
j2m.to_markdown('{{TEST}}')   → `TEST`          ← correct (double brace)
j2m.to_markdown('{{{TEST}}}') → `{TEST`}         ← wrong (triple brace)
```

jira2md's monospace regex `/\{\{([^}]+)\}\}/g` matches `{{TEST}` (stops at the first `}` because of `[^}]+`), leaving a dangling `}` literal after the backtick span. The outer `{` becomes prose.

### 2. The fix layer: `preprocessJiraMarkup` in WikiRenderer.tsx [VERIFIED: codebase]

All non-jira2md inline markup is handled in `preprocessJiraMarkup` before calling `j2m.to_markdown()`. The pattern is:

| Jira syntax | preprocessJiraMarkup converts to | jira2md sees |
|-------------|----------------------------------|--------------|
| `{*}text{*}` | `<strong>text</strong>` | raw HTML (passthrough) |
| `{_}text{_}` | `<em>text</em>` | raw HTML (passthrough) |
| `{color:#hex}text{color}` | `<span data-color="#hex">text</span>` | raw HTML (passthrough) |
| `{{{text}}}` | `<tt>text</tt>` ← **add this** | raw HTML (passthrough) |

The conversion to HTML (not to Jira `{{...}}` double-brace) is intentional — jira2md's regexes are greedy and can cause cross-item pairing if given `*text*` or `{{code}}` in certain contexts. Using raw HTML sidesteps jira2md entirely.

### 3. rehype-sanitize already allows `<tt>` [VERIFIED: npm registry]

`defaultSchema.tagNames` from `rehype-sanitize` already includes `tt`. The `wikiSanitizeSchema` in WikiRenderer.tsx spreads `defaultSchema.tagNames`, so `<tt>` will pass through the sanitizer unchanged without any schema modification.

### 4. Ordering constraint

The `{{{...}}}` replacement must run **before** the `{{...}}` monospace-wrapped-links guard (line ~624):

```ts
result = result.replace(/\{\{\{(.*?)\}\}\}/gs, '<tt>$1</tt>');  // triple-brace FIRST
result = result.replace(/\{\{(\[[^\]]*\])\}\}/g, '$1');         // then {{[link]}} unwrap
```

If the order is reversed, `{{{[URL]}}}` would first have its `{{[URL]}}` unwrapped to `[URL]`, leaving `{[URL]}` as a stray Jira shortcut syntax. Running triple-brace first correctly converts the whole thing to `<tt>[URL]</tt>` (literal monospace, no link click — consistent with Jira's own behaviour where `{{{text}}}` treats content as literal teletype).

The `{*}` and `{_}` replacements (lines ~613-614) run before the monospace block, so the new replacement should also go in that group.

### 5. No TipTap / jiraWikiSerializer changes needed

The CONTEXT.md scope is "display/preview renderer where the visual regression is observed." The TipTap editor (write path) is `jiraToTiptap` + `jiraWikiSerializer` — a separate code path not involved in reading/displaying issue descriptions. Those files do not need changes for this fix.

### 6. Test infrastructure [VERIFIED: codebase]

`WikiRenderer.test.tsx` has comprehensive inline tests for every `preprocessJiraMarkup` feature. The test pattern for `{*}`, `{_}`, and `{{...}}` is:

```ts
it('renders {*}text{*} as bold', () => {
  const { container } = render(<WikiRenderer wikiText="{*}hello{*}" />);
  expect(container.querySelector('strong')).not.toBeNull();
});
```

Two tests are needed for the new feature:
1. `{{{TEST}}}` renders a `<tt>TEST</tt>` element
2. `{{someCode}}` (double brace, existing behaviour) is not affected — still renders `<code>`

---

## Exact Location for the Fix

**File:** `taskflow/src/routes/dashboard/WikiRenderer.tsx`
**Function:** `preprocessJiraMarkup` (line ~589)
**Insert after:** the `{_}text{_}` replacement (~line 614), before the `{{[link]}}` guard (~line 624)

```ts
// Teletype (monospace): {{{text}}} → <tt>text</tt>
// Must run BEFORE the {{[link]}} guard below so {{{[URL]}}} is consumed as
// a single triple-brace unit rather than partially matched as {{[link]}}.
result = result.replace(/\{\{\{(.*?)\}\}\}/gs, '<tt>$1</tt>');
```

**Test file:** `taskflow/src/routes/dashboard/WikiRenderer.test.tsx`
Add inside the `describe('ISSUE-02: wiki markup rendering', ...)` block (or a new focused describe block).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Sanitize `<tt>` | Custom allowlist entry | Already in `defaultSchema.tagNames` — no change needed |

---

## Assumptions Log

All claims verified against codebase and running jira2md. No assumed claims.
