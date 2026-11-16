---
phase: 97-round-trip-engine
reviewed: 2026-11-16T22:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - taskflow/src/lib/wiki/preprocess.ts
  - taskflow/src/lib/wiki/pipeline.ts
  - taskflow/src/lib/wiki/editor/parse/inline.ts
  - taskflow/src/lib/wiki/editor/parse/tables.ts
  - taskflow/src/lib/wiki/editor/emit.ts
  - taskflow/src/lib/wiki/pipeline.test.tsx
  - taskflow/src/lib/wiki/editor/raw.test.ts
  - taskflow/src/lib/wiki/editor/escape.test.ts
  - taskflow/src/lib/wiki/editor/save-check.test.ts
  - taskflow/src/lib/wiki/editor/roundtrip.test.ts
  - taskflow/src/lib/wiki/editor/typed-render.test.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 97: Code Review Report (re-review after 97-15..97-17)

**Reviewed:** 2026-11-16T22:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

I reviewed the diff `17eb5f9a..HEAD` for the listed files. The wiki test suite passes (22 files, 431 tests). I confirmed the fixes with `wikiToHtml` probes.

Prior findings from the last review:

- **CR-01 (typed block macros mid-line go live): resolved.** `parse/inline.ts` now reads mid-line `{code}`, `{info}`, `{quote}` and similar as `rawInline` atoms, so the emitter escapes typed look-alikes. The `{{info}}` monospace case is excluded and still renders `<code>info</code>`.
- **CR-02 (backslash escapes render as tag text): mostly resolved.** `preprocessJiraMarkup` now turns every `\X` for X in `JIRA_ESCAPE_CHARS` into a numeric entity. `pipeline.ts` decodes them in inline code from the same constant. Verified outputs:
  - `\*not bold\* and *bold*` renders `*not bold* and <strong>bold</strong>`.
  - `\{code}x{code}` renders literally.
  - An escaped `_` in a named link or image name is fine.
  - One regression remains (WR-01).
- **WR-04 (minimiser keeps the inner `\~`): addressed** by trying opening delimiters last in `emit.ts`.

No new blockers found.

## Warnings

### WR-01: An escaped character in a bare URL now corrupts the link href and text

**File:** `taskflow/src/lib/wiki/preprocess.ts:753-755`
**Issue:** The escape neutraliser runs before markdown autolinking, so a bare URL containing a Jira escape such as `\_` becomes `&#95;` inside the URL. remark's literal autolink keeps that raw text and then encodes the `&`. Verified:

```
wikiToHtml('see http://a.com/x\\_y_z')
  -> <a href="http://a.com/x&#x26;#95;y_z">http://a.com/x&#x26;#95;y_z</a>
```

Named links (`[l|http://a.com/x\_y]`) and images are fine. This is reachable from the editor. A user types a bare URL containing `_` as plain text. When `_y_` could pair as italic, the minimiser escapes the `_`, and the saved text then renders with a broken link. Whether the emitter takes that path was not verified.
**Fix:** Skip the entity replacement inside bare URLs. Either match `https?://\S+` first and decode the escapes there, or add a post-pass in the renderer (a rehype step on `a` hrefs and text) that restores `&#NN;` for `JIRA_ESCAPE_CHARS`. Add a renderer test with a URL containing `\_`.

### WR-02: Cell-panel opener lookbehind ignores even backslash runs, unlike the `{code}` rule

**File:** `taskflow/src/lib/wiki/editor/parse/tables.ts:134`
**Issue:** The `cellBlocks` regex uses `(?<!\\)`, so `\\{info}x{info}` in a cell (a hard break followed by a real panel) is not recognised as a panel. `preprocess.ts:708` deliberately treats an even run of backslashes as a real opener. The editor model and the renderer therefore disagree for that input. Nothing is lost, because the raw atoms replay verbatim. But the editor models the content differently from what is rendered, and the two rules are inconsistent. I did not reproduce this one.
**Fix:** Reuse the odd-run lookbehind from `preprocess.ts`: `(?<!(?<!\\)(?:\\\\)*\\)\{(panel|info|note|warning|tip)...`. Extract it as a shared constant.

## Info

### IN-01: Lookbehind regexes require a WebKit that supports them

**File:** `taskflow/src/lib/wiki/preprocess.ts:708`, `taskflow/src/lib/wiki/editor/parse/tables.ts:134`
**Issue:** Both new patterns use lookbehind, and the `preprocess.ts` one is nested and variable-length. The pattern fails to compile on WKWebView older than Safari 16.4. One failing compile at module load would break the whole wiki renderer. Tauri on a current macOS should be fine.
**Fix:** Confirm the minimum macOS target. If older systems are supported, replace the lookbehind with a capture group (`(^|[^\\])((?:\\\\)*)`) handled in the callback.

---

_Reviewed: 2026-11-16T22:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
