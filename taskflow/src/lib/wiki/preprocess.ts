/**
 * Jira wiki markup preprocessing, moved from WikiRenderer.tsx in Phase 96.
 * Pure string logic: no React, Tauri or store imports.
 */

/** Map from filename → full URL for resolving Jira !filename.png! references */
export type AttachmentMap = Record<string, string>;

/** Map from username/accountId → display name for resolving [~user] mentions */
export type UserMap = Record<string, string>;

/**
 * Detect and expand "inline single-line tables": Jira table rows (including the
 * GFM separator row `|---|---|`) that appear collapsed onto a single source line
 * rather than split across multiple lines with `\n`.
 *
 * Background: Jira issues are sometimes created or imported with table content on
 * a single line — no `\n` between rows. The heading text, empty header cells,
 * separator cells, and data cells are all space-separated on one line:
 *
 *   h2. Title | | | | |---|---| |cell|cell| |cell|cell|
 *
 * Neither `mergeOpenTableRows` nor `injectHeaderlessTableSeparators` can detect
 * this, because both are line-based and the line does not start with `|`.
 * remark-gfm requires `\n` between rows, so the entire table renders as raw text.
 *
 * Detection heuristic: a line contains an inline table when it has a
 * multi-column GFM separator row (`|---|---|` — two or more separator cells)
 * that is NOT at the start of the line (i.e. preceded by a space).
 * A single `|---|` embedded in prose text does not qualify.
 *
 * Reconstruction:
 *  1. Split at the separator: everything before = prefix text + header row cells;
 *     everything after = data rows.
 *  2. Split the "before" portion at the first ` |` to extract the non-table prefix
 *     (heading text, etc.) and the header row.
 *  3. Split the "after" portion at every `| |` boundary (pipe-space-pipe) to
 *     recover individual data rows.
 *  4. Reassemble as `\n`-separated lines so that the downstream processors
 *     (`mergeOpenTableRows`, `injectHeaderlessTableSeparators`, jira2md) see a
 *     conventional multi-line table.
 *
 * Lines that already start with `|` (proper table rows) and lines with no inline
 * separator are passed through unchanged.
 *
 * Exported for unit-testing.
 */
export function splitInlineSingleLineTables(wiki: string): string {
  // Matches a multi-column GFM separator row that appears INLINE (not at line start):
  //   [space][|][:-dashes-:][|]([:-dashes-:][|])+ (two or more separator cells)
  // The {2,} quantifier prevents matching a single stray |---| in prose text.
  const INLINE_SEP_RE = / (\|(?::?-+:?\|){2,})(?=\s|$)/;

  const lines = wiki.split('\n');
  const out: string[] = [];

  for (const line of lines) {
    const trimmed = line.replace(/[ \t]+$/, '');

    // Lines that already start with `|` are proper table rows — leave them alone.
    if (trimmed.startsWith('|')) {
      out.push(line);
      continue;
    }

    const sepMatch = trimmed.match(INLINE_SEP_RE);
    if (!sepMatch) {
      out.push(line);
      continue;
    }

    const sepRowStr = sepMatch[1]; // e.g. "|---|---|---|"
    const sepStartInLine = trimmed.indexOf(` ${sepRowStr}`);
    if (sepStartInLine < 0) {
      out.push(line);
      continue;
    }

    // Everything before the separator: "prefix text | header cells |"
    const beforeSepPart = trimmed.substring(0, sepStartInLine);
    // Everything after the separator: "| data | cells | | more | data |"
    const afterSepRaw = trimmed.substring(sepStartInLine + 1 + sepRowStr.length);
    const afterSepPart = afterSepRaw.trim();

    // Split beforeSepPart into non-table prefix and header row at the first " |".
    const firstPipePos = beforeSepPart.indexOf(' |');
    const prefix =
      firstPipePos >= 0 ? beforeSepPart.substring(0, firstPipePos).trim() : beforeSepPart.trim();
    const headerRow = firstPipePos >= 0 ? beforeSepPart.substring(firstPipePos + 1) : '';

    // Split data rows at each pipe-space-pipe boundary (end of one row → start of next).
    const dataRows = afterSepPart
      ? afterSepPart.split(/(?<=\|) (?=\|)/).filter((r) => r.trim())
      : [];

    // When non-table prefix text precedes the table (e.g. a heading), insert a
    // blank line between the prefix and the first table row. Without the blank
    // line, remark-gfm may absorb the table rows into the preceding block context
    // (e.g. as continuation of a list item) and fail to render them as a table.
    const parts: string[] = [];
    if (prefix) {
      parts.push(prefix);
      parts.push(''); // blank line: table must start in its own block context
    }
    if (headerRow) parts.push(headerRow);
    parts.push(sepRowStr);
    parts.push(...dataRows);

    out.push(parts.join('\n'));
  }

  return out.join('\n');
}

/**
 * Plan 54-07 Gap 3 (Branch 3-A) — pre-merge multi-line table rows so jira2md
 * sees one logical `|cell|cell|…|` line.
 *
 * Real Jira wiki tables fit `|cell|cell|…|` on a single source line. When a
 * cell contains multi-line content (e.g. `{panel}…{panel}` with embedded
 * `# [name|url]` list, or trailing prose after `\\` hard breaks), the row
 * body spans multiple source lines and jira2md's row tokenizer terminates
 * on the first `\n`, splitting the table.
 *
 * Heuristic:
 *  1. Scan line-by-line. When we see a data row (line starts with `|` and
 *     not `||`) that does NOT end with `|`, the row is "open" and continues
 *     onto subsequent lines.
 *  2. Greedy-consume subsequent lines (capped at 50 for safety) until we
 *     find a line that ends with `|` AND brings any embedded `{panel}`
 *     markers back to balance.
 *  3. Inside the joined body, substitute `{panel}…{panel}` (and `{info}`,
 *     `{warning}`, `{note}`) to an inline `<span data-callout="…">…</span>`
 *     with internal `\n` flattened to `<br/>`. This keeps the body on one
 *     logical line for jira2md / remark-gfm.
 *  4. Replace any remaining `\n` inside the merged row with a single space
 *     so jira2md sees exactly one source line.
 *
 * Validated against the verbatim SHOP fixture from 54-06-UAT-FINDINGS.md
 * Finding 1 (recorded in 54-PROBE-FINDINGS.md ## Probe E).
 */
const PANEL_TAG_RE = /\{panel(?::[^}]*)?\}/g;

/**
 * Plan 54-09 Concern C (root cause #2): wiki numbered-list marker `# item`
 * inside a `{panel}` block inside a `|cell|` row loses its semantics when the
 * panel body is flattened into a `<span data-callout="panel">…</span>`. Round-2
 * UAT showed `# [img-a.png|url]` rendering as bare `#` text instead of an `<ol>`.
 *
 * Plan 54-09 Concern B (root cause #1): the literal `|` inside wiki-link
 * syntax `[name|url]` survives the panel flatten and is consumed by
 * remark-gfm's table tokenizer as a column separator, splitting the row.
 *
 * This helper scans the panel body for consecutive `# ` lines and converts
 * each run to `<ol><li>…</li></ol>`. When an item is a single wiki link
 * `[name|url]`, it is emitted as `<a href="url">name</a>` — consuming the
 * `|` directly so it never reaches the table tokenizer. Non-link items keep
 * any remaining `|` escaped to `\|` for the same reason. Plain (non-list)
 * panel content is returned unchanged; the caller (flattenInlineCalloutsForTableRow)
 * applies the final `|` → `\|` escape to the merged result.
 *
 * Private helper — not exported.
 */
function transformPanelListItems(panelBody: string): string {
  const lines = panelBody.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*#\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*#\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*#\s+/, ''));
        i++;
      }
      const liItems = items
        .map((item) => {
          const linkMatch = /^\[([^|\]]+)\|([^\]]+)\]$/.exec(item.trim());
          if (linkMatch) {
            return `<li><a href="${linkMatch[2]}">${linkMatch[1]}</a></li>`;
          }
          // Non-link item — still escape any remaining `|` to prevent table split.
          return `<li>${item.replace(/\|/g, '\\|')}</li>`;
        })
        .join('');
      out.push(`<ol>${liItems}</ol>`);
      continue;
    }
    out.push(line);
    i++;
  }
  return out.join('\n');
}

function flattenInlineCalloutsForTableRow(body: string): string {
  let result = body;
  result = result.replace(
    /\{panel:title=([^}]+)\}([\s\S]*?)\{panel\}/g,
    (_m, title: string, inner: string) => {
      const withLists = transformPanelListItems(inner);
      // Escape any remaining literal `|` (e.g. in non-list panel prose) so the
      // markdown table tokenizer does not split the row. The <ol><li><a href="…">
      // HTML emitted by transformPanelListItems contains no `|` chars by
      // construction, so this escape is safe.
      const escaped = withLists.replace(/\|/g, '\\|');
      // Trim BEFORE the newline→<br/> substitution. Trimming after is a no-op
      // for <br/> tokens (they aren't whitespace), so leading/trailing newlines
      // — the ones immediately after `{panel}` opening and immediately before
      // `{panel}` closing — would otherwise become stray <br/> elements at the
      // start/end of the panel span, adding a full line of line-height padding
      // on each side (UAT round-3 finding: visible doubled padding around the
      // inner <ol> was caused by exactly these stray edge <br/> tags).
      const flattened = escaped.trim().replace(/\n/g, '<br/>');
      return `<span data-callout="panel" data-title="${title}">${flattened}</span>`;
    },
  );
  result = result.replace(/\{panel\}([\s\S]*?)\{panel\}/g, (_m, inner: string) => {
    const withLists = transformPanelListItems(inner);
    const escaped = withLists.replace(/\|/g, '\\|');
    const flattened = escaped.trim().replace(/\n/g, '<br/>');
    return `<span data-callout="panel">${flattened}</span>`;
  });
  result = result.replace(
    /\{info\}([\s\S]*?)\{info\}/g,
    (_m, inner: string) =>
      `<span data-callout="info">${inner.trim().replace(/\n/g, '<br/>')}</span>`,
  );
  result = result.replace(
    /\{warning\}([\s\S]*?)\{warning\}/g,
    (_m, inner: string) =>
      `<span data-callout="warning">${inner.trim().replace(/\n/g, '<br/>')}</span>`,
  );
  result = result.replace(
    /\{note\}([\s\S]*?)\{note\}/g,
    (_m, inner: string) =>
      `<span data-callout="note">${inner.trim().replace(/\n/g, '<br/>')}</span>`,
  );
  return result;
}

export function mergeOpenTableRows(wiki: string): string {
  const lines = wiki.split('\n');
  const out: string[] = [];
  let i = 0;
  const MAX_LOOKAHEAD = 50;
  while (i < lines.length) {
    const line = lines[i];
    const trimmedRight = line.replace(/[ \t]+$/, '');
    const isDataRow = trimmedRight.startsWith('|') && !trimmedRight.startsWith('||');
    const endsWithPipe = trimmedRight.endsWith('|');
    if (isDataRow && !endsWithPipe) {
      const buf: string[] = [line];
      let j = i + 1;
      let panelOpenCount = (line.match(PANEL_TAG_RE) ?? []).length;
      while (j < lines.length && j - i <= MAX_LOOKAHEAD) {
        const next = lines[j].replace(/[ \t]+$/, '');
        buf.push(lines[j]);
        panelOpenCount += (next.match(PANEL_TAG_RE) ?? []).length;
        if (next.endsWith('|') && panelOpenCount % 2 === 0) {
          j++;
          break;
        }
        j++;
      }
      // Join with `\n` first so the inline-callout substitution sees the panel
      // body intact, then flatten any remaining `\n` (inside the merged row,
      // outside callouts) to a single space so jira2md gets one source line.
      const joined = buf.join('\n');
      // Plan 54-09 hard-break handling (rounds 2+3): Jira `\\` is unambiguously
      // a hard break wherever it appears — prose-with-whitespace, immediately
      // before `{panel}` with NO surrounding whitespace (round-3 UAT report),
      // or inside a panel body. Convert ALL `\\` to `<br/>` BEFORE callout
      // substitution so the resulting `<br/>` sits OUTSIDE the panel `<span>`
      // when the source was `text\\{panel}…{panel}` and the panel renders on
      // a new line as Jira does natively. Inside the panel body, `\\` also
      // becomes `<br/>`, matching Jira's render of multi-line panel content.
      // This single pattern subsumes the two prior whitespace-padded patterns
      // (`/[ \t]*\\\\[ \t]*\n/` and `/[ \t]\\\\[ \t]/`).
      const hardBreaksReplaced = joined.replace(/\\\\/g, '<br/>');
      const calloutsFlattened = flattenInlineCalloutsForTableRow(hardBreaksReplaced);
      const flattened = calloutsFlattened.replace(/\n/g, ' ');
      out.push(flattened);
      i = j;
      continue;
    }
    out.push(line);
    i++;
  }
  return out.join('\n');
}

/**
 * Count the logical number of columns in a Jira table data row, ignoring
 * pipe characters that appear inside `[display|url]` named-link brackets.
 *
 * A row like `|phone|plan|[Shop|https://url]|` has 3 logical columns, but a
 * naive `split('|')` would yield 5 tokens. This function walks the string and
 * only counts `|` characters that are not enclosed in square brackets.
 *
 * Private helper used by injectHeaderlessTableSeparators.
 */
function countJiraTableRowColumns(row: string): number {
  let cols = 0;
  let depth = 0;
  const trimmed = row.replace(/[ \t]+$/, '');
  // Skip the mandatory leading `|`
  let pos = trimmed.startsWith('|') ? 1 : 0;
  for (; pos < trimmed.length; pos++) {
    const ch = trimmed[pos];
    if (ch === '[') depth++;
    else if (ch === ']') depth--;
    else if (ch === '|' && depth === 0) cols++;
  }
  return cols;
}

/**
 * Jira tables that have only data rows (no `||header||` row) are not rendered
 * as HTML tables by remark-gfm, because GFM table syntax requires a header row
 * followed by a `| --- | --- |` separator row. jira2md only emits the separator
 * when it sees a `||header||` source row; rows with only `|data|` are passed
 * through unchanged.
 *
 * This function scans the wiki source (after mergeOpenTableRows) and, for each
 * run of data rows that is NOT preceded by a header row or separator, injects a
 * synthetic empty header row and a separator row sized to the column count of
 * the first data row in the run.
 *
 * Column counting is bracket-aware so that `[display|url]` named-link syntax
 * (which contains a literal `|`) does not inflate the column count.
 *
 * Exported for unit-testing.
 */
export function injectHeaderlessTableSeparators(wiki: string): string {
  const lines = wiki.split('\n');
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.replace(/[ \t]+$/, '');
    const isDataRow = trimmed.startsWith('|') && !trimmed.startsWith('||');

    if (isDataRow) {
      // Look back through `out` to the last non-blank line to decide whether
      // this data row already belongs to a table that has a header/separator.
      let prevIdx = out.length - 1;
      while (prevIdx >= 0 && out[prevIdx].trim() === '') prevIdx--;

      const prevLine = prevIdx >= 0 ? out[prevIdx].replace(/[ \t]+$/, '') : '';
      const prevIsHeader = prevLine.startsWith('||');
      const prevIsSeparator = /^\|[\s]*:?-+:?[\s]*\|/.test(prevLine);
      const prevIsDataRow = prevLine.startsWith('|') && !prevLine.startsWith('||');
      // Look ahead: if the very next source line is already a GFM separator row
      // (|---|---|), this row is already a proper GFM table header — injecting a
      // synthetic header + separator before it would double-up and break the table.
      // This case arises after `splitInlineSingleLineTables` reconstructs an inline
      // single-line table: the split output has a header row followed by a separator
      // row, but the preceding line is non-table text (a heading, prose, etc.).
      const nextTrimmed = i + 1 < lines.length ? lines[i + 1].replace(/[ \t]+$/, '') : '';
      const nextIsSeparator = /^\|[\s]*:?-+:?[\s]*\|/.test(nextTrimmed);

      if (!prevIsHeader && !prevIsSeparator && !prevIsDataRow && !nextIsSeparator) {
        // First data row of a headerless table — inject synthetic header + separator.
        const cols = countJiraTableRowColumns(trimmed);
        if (cols >= 1) {
          const emptyCells = Array(cols).fill(' ').join('|');
          const sepCells = Array(cols).fill('---').join('|');
          out.push(`|${emptyCells}|`);
          out.push(`|${sepCells}|`);
        }
      }
    }

    out.push(line);
  }

  return out.join('\n');
}

/**
 * Map of Jira emoticon shortcodes to Unicode equivalents.
 * jira2md does not handle these — they pass through as raw text without this step.
 * Source: https://confluence.atlassian.com/jiracoreserver/jira-emoticons-939937237.html
 *
 * Ordering matters: multi-char variants (e.g. `(*r)`, `(*g)`) must appear
 * before the single-char catch-all `(*)` so they are matched first.
 *
 * Exported for unit-testing.
 */
export const JIRA_EMOTICON_MAP: ReadonlyArray<[RegExp, string]> = [
  [/\(\/\)/g, '✅'], // (/)      → ✅ green tick / check mark
  [/\(x\)/g, '❌'], // (x)      → ❌ red cross
  [/\(!\)/g, '⚠️'], // (!)      → ⚠️ warning
  [/\(\+\)/g, '➕'], // (+)      → ➕ plus / add
  [/\(-\)/g, '➖'], // (-)      → ➖ minus / remove
  [/\(\?\)/g, '❓'], // (?)      → ❓ question mark
  [/\(i\)/g, 'ℹ️'], // (i)      → ℹ️ information
  [/\(\*r\)/g, '⭐'], // (*r)     → ⭐ red star (closest Unicode)
  [/\(\*g\)/g, '🌟'], // (*g)     → 🌟 green star
  [/\(\*b\)/g, '💫'], // (*b)     → 💫 blue star (closest Unicode)
  [/\(\*y\)/g, '⭐'], // (*y)     → ⭐ yellow star
  [/\(\*\)/g, '⭐'], // (*)      → ⭐ star (catch-all; after *r/*g/*b/*y)
  [/\(on\)/g, '💡'], // (on)     → 💡 light bulb on
  [/\(off\)/g, '🔕'], // (off)    → 🔕 muted bell / light off
  [/\(flagoff\)/g, '🏳️'], // (flagoff)→ 🏳️ white flag (before flag)
  [/\(flag\)/g, '🚩'], // (flag)   → 🚩 red flag
];

/**
 * Replace Jira emoticon shortcodes with their Unicode equivalents.
 * Must run before jira2md because jira2md's bold pattern `*...*` would
 * otherwise corrupt `(*)` into `(**)` and similar sequences.
 *
 * Private helper — not exported (the map is exported for unit-tests).
 */
function replaceJiraEmoticons(text: string): string {
  let result = text;
  for (const [pattern, replacement] of JIRA_EMOTICON_MAP) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Pre-process Jira table data rows (`|cell|`) AND ordinary prose lines to
 * normalize Jira inline formatting (bold `*text*`, italic `_text_`) to HTML
 * equivalents on a per-cell / per-line basis, BEFORE passing the text to jira2md.
 *
 * Problem: jira2md's bold and italic regexes (greedy *...* and _..._ patterns) are
 * greedy and operate on the full input string (bounded to one source line, since
 * `.` does not cross newlines). For a row like `|*Header A*|*Header B*|`, the bold
 * pattern matches from the FIRST `*` to the LAST `*` across cell separators,
 * producing `**Header A*|*Header B**` — corrupting the entire row. The same applies
 * to italic: `|_A_|_B_|` → `|*A_|_B*|`. The identical defect corrupts ordinary prose
 * lines that contain two or more `*...*` (or `_..._`) spans on the same physical
 * line: e.g. `*1. -TEXT-* niečo *Letná Akcia Prima-*` bleeds into one `<strong>`
 * spanning both spans and the text between them (wiki-bold-corrupts-text).
 *
 * Fix: for table data rows, split into cell segments using a bracket-aware
 * character walk (so `[display|url]` named-links are treated as a single token),
 * apply the bold and italic conversion independently to each cell, then rejoin —
 * guaranteeing a `*` or `_` in one cell can never "pair" with a marker in a
 * different cell. For ordinary prose lines, apply the same non-greedy conversion
 * directly to the whole line, so each opening marker pairs with its own nearest
 * closing marker instead of jira2md's greedy first-to-last-on-line pairing.
 *
 * After this step, the matching Jira→markdown transformations in jira2md see no
 * unprocessed `*...*` or `_..._` in data rows/prose lines and leave them untouched
 * (already-emitted `<strong>`/`<em>` pass through jira2md unmodified).
 *
 * Runs after `injectHeaderlessTableSeparators` (which may inject synthetic `| | |`
 * and `|---|---|` rows — both are safe, as they contain no `*` or `_` formatting).
 * Skips `||header||` rows unchanged (pre-existing scope; jira2md's own table-header
 * handling processes them separately).
 *
 * Private helper — not exported.
 */
// wiki-bold-corrupts-text: apply Jira bold (*text*) / italic (_text_) → HTML
// conversion to a single segment of text (a table cell, or an entire prose
// line). Non-greedy, link-protected — each opening marker pairs with its own
// nearest closing marker instead of jira2md's greedy first-to-last-on-line
// pairing (see normalizeTableCellInlineFormatting doc comment below).
//
// Link syntax [display|url] is protected from bold/italic conversion by
// replacing [...] substrings with null-byte placeholders before the regex
// runs, then restoring them. This prevents the italic regex from matching
// underscores inside URLs (e.g. hash=1A_B2_C3) or bold/italic markers
// spanning a named link token.
//
// Private helper — not exported.
function convertInlineBoldItalic(segment: string): string {
  const linkPlaceholders: string[] = [];
  const withPlaceholders = segment.replace(/\[[^\]]*\]/g, (match) => {
    const idx = linkPlaceholders.length;
    linkPlaceholders.push(match);
    return `\x00LINK${idx}\x00`;
  });
  // wiki-bold-corrupts-text (round 2): Strikethrough `-text-` → <del>text</del>.
  // jira2md's own strikethrough rule (`/(\s+)-(\S+.*?\S)-(\s+)/g`, applied further
  // down the pipeline in to_markdown()) REQUIRES whitespace immediately before the
  // opening `-` and after the closing `-`. That already works for ordinary
  // mid-sentence strikethrough ("this -text- is struck"), so it is intentionally
  // NOT duplicated here. It fails, however, when the strikethrough span is nested
  // directly inside a bold/italic span — e.g. `*1. -TEXT-*` — because the dash
  // touches the bold delimiter `*` instead of whitespace: `-TEXT-*` has no
  // whitespace after the closing `-`, so jira2md's regex never matches and the
  // dashes render as literal characters instead of a struck-through span.
  // Fix: convert `-text-` directly to `<del>` HTML here, BEFORE the bold/italic
  // conversion below, treating `*`/`_` (in addition to whitespace/start/end-of-line)
  // as valid boundaries on either side. This mirrors the non-greedy, \S-boundary
  // technique already used for bold/italic/underline in this file, and runs before
  // bold/italic conversion so `*1. -TEXT-*` becomes `*1. <del>TEXT</del>*` first,
  // then the bold pass below wraps it as `<strong>1. <del>TEXT</del></strong>`.
  // Link bracket content is already hidden behind \x00LINK\x00 placeholders above,
  // so this cannot touch dashes inside `[display|url]` (that case has its own,
  // narrower fix — see the `[-text-|url]` conversion later in preprocessJiraMarkup).
  // Content chars deliberately exclude `*`/`_` (not just require `\S`): `\S+`
  // alone would greedily consume through an adjacent bold/italic delimiter
  // (and even an entire second `-...-` span further along the line) before
  // backtracking, since `*`/`_` are themselves non-whitespace — reproduced
  // directly: `\S+[^\n]*?\S` against a line with two dash-wrapped spans each
  // followed by `*` swallowed both spans and everything between them into one
  // match, mirroring the exact bug this whole fix is meant to prevent.
  let c = withPlaceholders.replace(
    /(?<=^|[\s*_])-([^\s*_\n]+[^*_\n]*?[^\s*_\n])-(?=[\s*_]|$)/g,
    '<del>$1</del>',
  );
  // Bold: *text* → <strong>text</strong>
  // Output HTML directly so jira2md won't re-process: *text* would become
  // **text** under jira2md's bold rule, and _text_ → *text* → **text**.
  // <strong> and <em> pass through jira2md unmodified and are allowed by
  // the rehype-sanitize default schema.
  c = c.replace(/(?<!\*)\*(\S[^*\n]*?\S|\S)\*(?!\*)/g, '<strong>$1</strong>');
  // Italic: _text_ → <em>text</em>
  // wiki-underscore-intraword: Jira only treats `_` as a delimiter at a word
  // boundary, so intra-word underscores (DEMO_STD_VAS) must stay literal.
  c = c.replace(/(?<![_\p{L}\p{N}])_(\S[^_\n]*?\S|\S)_(?![_\p{L}\p{N}])/gu, '<em>$1</em>');
  // Restore link placeholders
  // biome-ignore lint/suspicious/noControlCharactersInRegex: \x00 (null byte) is intentionally used as a unique sentinel delimiter — it cannot appear in wiki markup text, making false-positive matches impossible
  return c.replace(/\x00LINK(\d+)\x00/g, (_, i) => linkPlaceholders[parseInt(i, 10)]);
}

function normalizeTableCellInlineFormatting(wiki: string): string {
  const lines = wiki.split('\n');
  const out: string[] = [];

  for (const line of lines) {
    const trimmed = line.replace(/[ \t]+$/, '');

    // wiki-bold-corrupts-text: prose/paragraph lines (not `|` table rows, and
    // not `||` header rows — see below) are just as exposed as table cells to
    // jira2md's greedy same-line bold/italic pairing: a line with TWO OR MORE
    // *...* (or _..._) spans gets its formatting bled from the FIRST opening
    // marker to the LAST closing marker on the line, silently wrapping any
    // unrelated intervening text (including a second, unrelated bold span
    // later on the line) inside one <strong>/<em>. `||header||` rows are left
    // untouched here (pre-existing scope, unchanged) since jira2md's own
    // table-header handling processes them separately.
    if (!trimmed.startsWith('|')) {
      out.push(convertInlineBoldItalic(line));
      continue;
    }
    if (trimmed.startsWith('||')) {
      out.push(line);
      continue;
    }

    // Split the row into cell segments using a bracket-aware character walk.
    // This ensures `[display|url]` named-link syntax is treated as a single token
    // so its inner `|` is not confused with a cell separator.
    const segments: string[] = [];
    let current = '';
    let depth = 0;
    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (ch === '[') {
        depth++;
        current += ch;
      } else if (ch === ']') {
        depth--;
        current += ch;
      } else if (ch === '|' && depth === 0) {
        segments.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    segments.push(current);

    // Apply Jira→markdown inline formatting per cell (non-greedy, no cross-cell bleed).
    const normalized = segments.map(convertInlineBoldItalic);

    out.push(normalized.join('|'));
  }

  return out.join('\n');
}

/**
 * Jira nests a list of the other kind under an item when the marker run mixes
 * `*` and `#` (`*#` under a bullet is a nested ordered list, `#*` under a number
 * a nested bullet list). jira2md only understands pure `**`/`##` runs, so a mixed
 * run rendered as literal text. Each mixed marker run is replaced by a
 * `\x00LI{indent}{b|o}\x00` sentinel (indent = parent content offset: 2 per `*`,
 * 3 per `#`, over all markers but the last; b = bullet, o = ordered) that
 * wikiToMarkdown turns into an indented markdown marker after jira2md has run.
 * The sentinel starts the line, so no jira2md/list regex can touch it.
 *
 * Must run BEFORE the numeric-prefix rewrite (`^\s*\d+\.\s+` becomes `#`), which
 * would otherwise turn a produced `1.` back into `#`. Pure runs are left alone.
 */
export function convertMixedListMarkers(wiki: string): string {
  return wiki.replace(/^[ \t]*([*#]{2,})[ \t]+(?=\S)/gm, (m, marks: string) => {
    if (!(marks.includes('*') && marks.includes('#'))) return m;
    let indent = 0;
    for (let i = 0; i < marks.length - 1; i++) indent += marks[i] === '*' ? 2 : 3;
    return `\x00LI${indent}${marks[marks.length - 1] === '*' ? 'b' : 'o'}\x00`;
  });
}

/**
 * Pre-process Jira wiki markup that jira2md does not handle:
 * - Jira emoticon shortcodes: (/) (x) (!) (+) (-) (?) (i) (*) (on) (off) (flag) etc.
 * - User mentions: [~username] and [~accountId:xxx]
 * - Info/warning/note panels
 * - Panel blocks with optional title
 * - Inline images: !filename.png! → resolved via attachment map (always run; strips
 *   Jira options like `|width=N,height=N` unconditionally so jira2md never sees them)
 * - Brace-quoted bold/italic: {*}text{*} → *text* and {_}text{_} → _text_ (jira2md does not handle these)
 * - Attachment references: [^filename] → markdown link [filename](url) resolved via attachment map
 * - Table cell inline formatting: *bold* / _italic_ normalized per cell before jira2md
 */
export function preprocessJiraMarkup(
  wiki: string,
  attachments?: AttachmentMap,
  users?: UserMap,
): { text: string; codeBlockBodies: string[] } {
  // Normalize CRLF → LF. Jira Server/Data Center returns descriptions with \r\n
  // line endings. All line-based processors (mergeOpenTableRows, splitInlineSingleLineTables,
  // injectHeaderlessTableSeparators, normalizeTableCellInlineFormatting) split by \n
  // and trim only [ \t]+$ — leaving \r on every line, which breaks endsWithPipe
  // checks and causes mergeOpenTableRows to greedily consume entire documents.
  let result = wiki.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // wiki-plus-in-code-block: real Jira does NOT process wiki markup (bold,
  // italic, lists, underline, emoticons, ...) inside {code}/{noformat} block
  // BODIES — only literal text. jira2md doesn't honor that: its `to_markdown()`
  // applies every one of its regexes (bold, italic, underline, ordered/unordered
  // lists, ...) to the ENTIRE string BEFORE its own {code}/{noformat} → fenced
  // code-block conversion (jira2md's index.js runs "Inserts" at line 59 and
  // "Ordered lists" at line 41 well before "Code Block" at line 67), so content
  // inside a code block is just as exposed to jira2md's buggy global regexes
  // (e.g. the unscoped `/\+([^+]*)\+/g` underline rule pairing two unrelated
  // '+' characters inside the block) as prose is — corrupting code with literal
  // `<ins>`/`</ins>` text, mangled list numbering, etc. Extract each block's
  // BODY only (never the `{code}`/`{noformat}` delimiter tags themselves, so
  // jira2md's own code-block regex further down can still recognize and
  // convert them into a fence) into an opaque null-byte placeholder here,
  // before ANY transformation in this function or in jira2md's to_markdown()
  // can see it. The caller restores the placeholder to this literal body text
  // AFTER jira2md.to_markdown() has produced the fenced code block — by then
  // the content sits inside a markdown fence that remark/rehype render as
  // plain, safely-escaped text rather than re-parsed markup.
  // A real newline (not part of the placeholder — never restored away) is
  // inserted right after the open tag when the body doesn't already start
  // with one. jira2md's fenced-code output is `` ``` `` + language + content,
  // with no separator forced between them: a body that starts immediately
  // after `{code}` (no blank line before the first line of code, as Jira
  // wiki source often has) would otherwise land on the *same* markdown line
  // as the opening fence and get parsed as the fence's info-string, silently
  // dropping that whole first line from the rendered code block.
  const codeBlockBodies: string[] = [];
  result = result.replace(
    /(\{code[^}]*\}|\{noformat\})([\s\S]*?)(\{code\}|\{noformat\})/g,
    (_match, open: string, body: string, close: string) => {
      const leadingNewline = body.startsWith('\n') ? '' : '\n';
      // Strip exactly one trailing newline — the one separating the last code
      // line from the closing tag on its own line — mirroring jira2md's own
      // `\n?` it consumes right before `{code}` in the unprotected case.
      // Left in place, it would double up with the `\n` jira2md's own fenced-
      // code template already appends before the closing ``` , producing a
      // stray blank line at the bottom of the rendered code block.
      const trimmedBody = body.endsWith('\n') ? body.slice(0, -1) : body;
      const idx = codeBlockBodies.push(trimmedBody) - 1;
      return `${open}${leadingNewline}\x00CODEBODY${idx}\x00${close}`;
    },
  );

  // wiki-code-block-in-list-item: an empty list-marker line (` * `) directly
  // before a {code}/{noformat} block. jira2md's list regex `^\s*(\*+)\s+` lets
  // `\s+` swallow the newline, gluing the fence onto the bullet (`* ```java`),
  // so the fence opens inside the list item while its closing ``` sits at
  // column 0 — the pairing flips and a stray fence swallows the rest of the
  // document. An empty bullet carries no content, so drop it.
  result = result.replace(/^[ \t]*[*#]+[ \t]*\n(?=[ \t]*(?:\{code[^}]*\}|\{noformat\}))/gm, '');

  // html-in-description-rendered fix: escape literal HTML metacharacters in the
  // RAW wiki source before any preprocessing runs. Real Jira wiki markup has no
  // legitimate use of '<', '>', or '&' — Jira itself treats HTML a user types
  // directly into a description as inert text (escaped), not live markup (raw
  // HTML requires the permission-gated {html} macro). Without this step,
  // react-markdown's rehype-raw parses ANY '<tag>' in the source — including
  // ordinary tags a user happens to type like <b>, <h1>, <table> — into real
  // DOM elements, because rehype-sanitize's schema (based on defaultSchema)
  // allowlists a large set of ordinary tags and only strips genuinely dangerous
  // ones (script, iframe, on* attributes). This escape runs BEFORE every other
  // step in this function that injects the app's OWN trusted HTML (mentions,
  // panels, <strong>/<em>, <img>, <tt>, <br/>, issue-key links) — those are all
  // added via template-literal string concatenation further down and are
  // therefore untouched by this pass, so they still parse and render normally.
  result = result.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Jira emoticons: replace shortcodes like "(/)", "(x)" with Unicode emoji.
  // Must run before jira2md (which would corrupt certain patterns like (*) → bold).
  result = replaceJiraEmoticons(result);

  // Brace-quoted bold/italic: Jira allows {*}text{*} as an alternative bold syntax
  // (equivalent to *text*) and {_}text{_} for italic. jira2md does not handle these —
  // its bold regex \*(.*)\* matches the * inside {*}, producing {**}text{**} in the
  // output, which renders as literal brace characters. Convert directly to HTML
  // (<strong>/<em>) rather than to *text* / _text_ because jira2md's bold/italic regexes
  // are greedy and cross word boundaries — two adjacent *a* *b* spans get merged into
  // *a* b** by jira2md. <strong>/<em> pass through jira2md unmodified and are allowed
  // by the rehype-sanitize default schema.
  result = result.replace(/\{\*\}(.*?)\{\*\}/gs, '<strong>$1</strong>');
  result = result.replace(/\{_\}(.*?)\{_\}/gs, '<em>$1</em>');

  // Triple-brace teletype: Jira {{{TEXT}}} (triple curly brace) is a teletype / monospace
  // macro that jira2md does not handle. jira2md's {{...}} double-brace → backtick code
  // regex partially matches {{{TEXT}}} — it consumes the inner {{TEXT}} and leaves a
  // stray leading `{` and trailing `}` as literal characters in the output.
  // Fix: consume the full triple-brace span HERE (before jira2md) and emit raw <tt>TEXT</tt>.
  // The `s` flag allows content to span newlines (consistent with {*} and {_} replacements).
  // <tt> is in defaultSchema.tagNames and passes through rehype-sanitize untouched.
  // MUST run before the {{[link]}} guard below so {{{[URL]}}} is consumed as a single unit.
  result = result.replace(/\{\{\{\}?(.*?)\{?\}\}\}/gs, '<tt>$1</tt>');

  // Monospace-wrapped links: Jira allows {{[URL]}} and {{[display|URL]}} — the outer
  // {{...}} is Jira monospace syntax (equivalent to backtick code). jira2md converts
  // {{...}} to a backtick-delimited inline code span; inside code spans, markdown link
  // syntax is NOT processed, so [URL] becomes the literal text <URL> rendered as raw
  // angle-bracket text instead of a clickable hyperlink. Strip the {{...}} wrapper
  // specifically when the content is a wiki bracket-link [...], so jira2md sees a plain
  // [URL] or [display|URL] and emits a proper link. Non-link monospace ({{code}}) is
  // unaffected because it does not match the \{\{\[...\]\}\} pattern.
  result = result.replace(/\{\{(\[[^\]]*\])\}\}/g, '$1');

  // wiki-mono-leading-space: Jira only opens monospace when `{{` is directly
  // followed by non-whitespace — `{{ text}}` renders as literal text, braces and
  // all. jira2md's `\{\{([^}]+)\}\}` accepts any content, so neutralise such an
  // opener to `&#123;&#123;` (decoded back to `{{` in prose). Only a plain
  // space/tab disqualifies: `\s` would also match a non-breaking space, which
  // Jira treats as content (`{{  x}}` IS monospace).
  result = result.replace(/\{\{(?=[ \t])/g, '&#123;&#123;');

  // Underscores inside {{monospace}}: jira2md applies its `_text_` → `*text*` italic rule
  // inside the {{...}} span before emitting the backtick code span, so
  // `{{HW_SALE_FIX}}` renders as `HW*SALE*FIX` (and the Jira escape `\_` leaves a stray
  // backslash: `{{HW\_SALE\_FIX}}` → `HW\*SALE\*FIX`). Monospace content is literal, so
  // unescape `\_` and hide every `_` behind the USCORE sentinel; fixMarkdownLinkUnderscores
  // restores it after jira2md has run.
  result = result.replace(/\{\{([^{}\n]+?)\}\}/g, (_m, inner: string) => {
    return `{{${inner.replace(/\\?_/g, '\x00USCORE\x00')}}}`;
  });

  // Jira backslash-escaped plus: \\+ is a Jira escape sequence meaning a literal `+`.
  // jira2md does not understand Jira escape sequences — it applies its `+text+` →
  // `<ins>text</ins>` underline rule globally, so a bare `+` left after stripping
  // the backslash can pair with another `+` in a different cell, producing cross-cell
  // <ins> tags that corrupt the table structure. Replace \\+ with the HTML entity
  // &#43; (renders as `+`) so the underline regex in jira2md never sees it.
  result = result.replace(/\\\+/g, '&#43;');

  // Inline single-line table expansion: detect table rows (including the GFM
  // separator |---|---|) collapsed onto a single line and split them into proper
  // multi-line form so that mergeOpenTableRows and remark-gfm can process them.
  // Must run BEFORE mergeOpenTableRows (which is line-based and skips non-| lines).
  result = splitInlineSingleLineTables(result);

  // Plan 54-07 Gap 3 (Branch 3-A): merge multi-line table rows BEFORE jira2md
  // tokenises them. Inline `{panel}` blocks inside the merged row body are
  // substituted to `<span data-callout="panel">…</span>` here so they survive
  // through to the markdown layer and render INSIDE the table cell.
  result = mergeOpenTableRows(result);

  // Headerless table fix: inject a synthetic GFM header+separator row before
  // any run of Jira data rows (`|cell|`) that has no preceding `||header||`
  // row. Without the separator, remark-gfm does not recognise the rows as a
  // table and renders them as plain text.
  result = injectHeaderlessTableSeparators(result);

  // Horizontal divider: Jira `----` on its own line must render as a full-width <hr>.
  // jira2md's strikethrough regex /(\s+)-(\S+.*?\S)-(\s+)/g matches `----` when it
  // is surrounded by newlines — the outer two dashes become strikethrough delimiters
  // and the inner `--` becomes the struck content, producing `~~--~~` which renders
  // as literal struck-through dashes. Fix: convert any line that consists entirely of
  // 4 or more dashes to the markdown thematic break form `---` BEFORE jira2md runs.
  // `---` is safe: jira2md's strikethrough inner-content pattern requires at least 2
  // chars (\S+.*?\S), so a 1-char inner portion (`-`) is never matched and `---`
  // passes through jira2md unchanged. react-markdown renders standalone `---` as <hr>.
  //
  // Must run BEFORE normalizeTableCellInlineFormatting/convertInlineBoldItalic below
  // (wiki-bold-corrupts-text): that step now also converts Jira strikethrough
  // (`-text-`) directly to `<del>` HTML on a per-line basis, and its boundary rule
  // treats a run of dashes as potentially "content" (any `\S`, including `-` itself).
  // If it ran on a still-untouched `----`/`-----` line, it would corrupt the divider
  // into `<del>--</del>` instead of leaving it for the `<hr>` conversion. Converting
  // pure-dash-run lines to the 3-dash `---` form first sidesteps this entirely (3
  // total characters can never satisfy the strikethrough rule's 4-character minimum
  // of open + 2-char content + close).
  result = result.replace(/^-{4,}$/gm, '\n---\n');

  result = convertMixedListMarkers(result);

  // Table cell inline formatting: normalize Jira bold (*text*), italic (_text_), and
  // strikethrough (-text-) to markdown/HTML equivalents on a per-cell basis, BEFORE
  // jira2md. jira2md's bold and italic regexes are greedy and cross cell separators,
  // corrupting rows like |*Header A*|*Header B*| into |**Header A*|*Header B**|.
  // Running the conversion per cell prevents any cross-boundary pairing.
  result = normalizeTableCellInlineFormatting(result);

  // Numeric/alpha/roman ordered-list prefixes: some Jira content uses `1. item`,
  // `a. sub`, `i. sub-sub` instead of jira2md's recognized `# item` / `## sub` /
  // `### sub-sub` hash-prefix syntax. jira2md's ordered-list regex only matches
  // `^[ \t]*(#+)\s+` — it leaves `1.`, `a.`, `i.` lines unchanged. When
  // react-markdown then parses the output, `1. text` starts an ordered list but
  // `a. text` and `i. text` (no intervening blank line) become lazy paragraph
  // continuations inside the single top-level <li>, collapsing all sub-levels
  // into one bullet.  Pre-normalize to jira2md's `#` syntax here.
  //
  // Level convention (mirrors Jira DC rendering):
  //   numeric  (1., 2., …)          → # (level 1)
  //   alpha    (a., b., …)          → ## (level 2)
  //   roman    (i., ii., iii., …)   → ### (level 3)
  //
  // Order matters: roman must run before alpha so that `i.`, `v.`, `x.` etc.
  // are caught as level-3 before the single-letter alpha rule fires.
  // Roman pattern covers values up to ~39 (xxxix) via the standard sub-tractive
  // form `x{0,3}(ix|iv|v?i{0,3})`.  The empty-string guard (`num` truthy check)
  // prevents matching a bare `.` if the alternation collapses to zero chars.
  result = result.replace(/^[ \t]*(x{0,3}(?:ix|iv|v?i{0,3}))\.\s+/gm, (_m: string, num: string) =>
    num ? '### ' : _m,
  );
  result = result.replace(/^[ \t]*[a-z]\.\s+/gm, '## ');
  result = result.replace(/^[ \t]*\d+\.\s+/gm, '# ');

  // Unicode bullet character (U+2022 •): some Jira descriptions use `• item`
  // instead of jira2md's recognized `* item` asterisk-prefix syntax. jira2md
  // does not recognise `•` as a list marker — it passes the line through as
  // plain inline text and react-markdown wraps it in a `<p>` instead of
  // `<ul><li>`. Pre-normalize to the asterisk form jira2md expects.
  result = result.replace(/^[ \t]*•[ \t]*/gm, '* ');

  // Plan 54-06: real SHOP test-run content uses `hN.X` (no space) and `\\` as
  // a hard line break. jira2md leaves both unmodified. Normalize before jira2md:
  // - `h1.foo` … `h6.foo` → `h1. foo` (so jira2md emits valid `#…# foo`)
  // - `\\` at end-of-line or surrounded by spaces → markdown hard break (`  \n`)
  result = result.replace(/^(h[1-6]\.)(\S)/gm, '$1 $2');

  // Table data rows (starting with `|` but not `||`) may contain `\\` hard-break
  // markers that were not processed by mergeOpenTableRows (which only handles merged
  // multi-line rows, not rows that already end with `|`). Convert remaining `\\`
  // in single-line table rows to `<br/>` before the global `\\` → markdown
  // hard-break pass below, which would otherwise insert a raw `\n` inside the row
  // and break the GFM table structure.
  result = result
    .split('\n')
    .map((line) => {
      const trimmed = line.replace(/[ \t]+$/, '');
      if (trimmed.startsWith('|') && !trimmed.startsWith('||')) {
        return line.replace(/\\\\/g, '<br/>');
      }
      return line;
    })
    .join('\n');
  // Convert standalone `\\` (Jira hard break) to a markdown hard break.
  // Two trailing spaces + newline is the markdown hard-break form remark-gfm preserves.
  // The table-row pass above ensures no `\\` remains in table rows by this point.
  result = result.replace(/[ \t]*\\\\[ \t]*\n/g, '  \n');
  result = result.replace(/[ \t]\\\\[ \t]/g, '  \n');
  // jira-wiki-italic-non-ascii: the two whitespace-padded patterns above miss a
  // Jira `\\` hard break that directly touches adjacent text on one or both sides
  // (no ASCII space/tab neighbor) — e.g. `Project\\_Špecifikácia:_` where a
  // non-breaking space or no space at all precedes/follows the marker. Left
  // unconverted, the `\\` keeps two logically separate lines glued onto ONE
  // source line; jira2md's per-line italic/bold regexes (`/_(\S.*)_/g`,
  // `/\*(\S.*)\*/g`) are greedy and pair the FIRST opening delimiter with the
  // LAST closing delimiter on that line, corrupting everything between two
  // separate `_..._`/`*...*` spans. Convert any remaining `\\\\` unconditionally
  // to a plain `\n` — remark-breaks (registered in the react-markdown pipeline)
  // treats every soft line break as a hard break, so no trailing two-space
  // padding is needed. Mirrors the unconditional `\\` → `<br/>` handling already
  // used for table rows in mergeOpenTableRows / the single-line-table pass above.
  result = result.replace(/\\\\/g, '\n');

  // Images: !filename.png|options! or !filename.png! → resolve via attachment map.
  // Always run unconditionally so that Jira image-option syntax (!file.png|width=N!)
  // is stripped before jira2md. jira2md's /!(.+)!/g passes the full
  // "filename|options" string as the image URL, producing ![](filename|options)
  // with a garbage URL. When no attachment map is provided (or the filename is not
  // in the map), strip the options part and emit !filename! for jira2md to convert
  // to the clean markdown form ![](filename).
  // Must run BEFORE jira2md which also handles !...! syntax.
  // Resolved URLs are output as markdown ![](url) instead of Jira !url! to
  // prevent jira2md from mangling URLs that contain + characters (Jira encodes
  // spaces as + in attachment URLs, and jira2md interprets +text+ as <ins>).
  result = result.replace(/!([^!\n]+?)(?:\|[^!\n]*)?!/g, (_match, ref: string) => {
    // If it's already a full URL, output as raw HTML <img> to bypass jira2md.
    // Replace + with %20 so jira2md doesn't interpret +text+ as underline.
    // Append \n so that a blank line separates the <img> from any following content.
    // jira2md's heading conversion adds no blank lines, so without the extra \n,
    // an <img> immediately followed by a heading has only one \n between them —
    // CommonMark treats <img> on its own line as an HTML block that consumes
    // everything until the next blank line, swallowing the heading.
    if (ref.startsWith('http://') || ref.startsWith('https://')) {
      return `<img src="${ref.replace(/\+/g, '%20')}" alt="" />\n`;
    }
    // Look up in attachment map — same treatment
    const url = attachments?.[ref];
    if (url) {
      return `<img src="${url.replace(/\+/g, '%20')}" alt="" />\n`;
    }
    // Not in map (or no attachment map): strip Jira options, emit plain !filename!
    // for jira2md to convert cleanly to ![](filename).
    return `!${ref}!`;
  });

  // Consecutive exclamation marks: jira2md's image regex /!(.+)!/g is greedy and
  // matches ANY content between two ! characters, including a lone ! in !!!.
  // Example: 'ponuka!!!' -> jira2md matches '!!' (ref='!') -> '![](!)', which
  // react-markdown renders as a broken image element. Since the preprocessor's own
  // image regex (!([^!\\n]+?)...!) has already consumed all valid Jira !filename!
  // references above, any ! characters that remain are prose punctuation. Replace
  // runs of 2 or more consecutive ! with the first ! plus &#33; entities for the
  // remainder -- &#33; renders as '!' in the browser and jira2md ignores it.
  result = result.replace(/!{2,}/g, (match) => `!${'&#33;'.repeat(match.length - 1)}`);

  // Mentions: [~accountId:XXX] -> <mention data-id="XXX">DisplayName</mention>
  result = result.replace(/\[~accountId:([^\]]+)\]/g, (_match, id: string) => {
    const name = users?.[id] ?? id;
    return `<mention data-id="${id}">${name}</mention>`;
  });
  // Mentions: [~username] -> <mention data-id="username">DisplayName</mention>
  result = result.replace(/\[~([^\]]+)\]/g, (_match, username: string) => {
    const name = users?.[username] ?? username;
    return `<mention data-id="${username}">${name}</mention>`;
  });

  // Attachment references: [^filename] -> raw HTML anchor resolved via attachment map.
  // jira2md does not handle this Jira syntax — it treats [^name] as a superscript autolink and
  // emits <^name> (literal angle-bracket text). jira2md also converts any [text](url) form it
  // sees by consuming [text] as a bracket link and emitting <text>, leaving (url) dangling —
  // so standard markdown link syntax cannot be used here. Instead, emit a raw <a href> element
  // which jira2md passes through unchanged, and rehype-raw + rehype-sanitize will render as a
  // proper clickable anchor. When the filename is not in the attachment map (no map provided,
  // or the attachment is unknown), emit a plain code span `filename` so the reference is
  // visible but does not produce a broken link.
  // Labelled form [label|^filename]: same chip with the label as its text; unresolved
  // keeps just the label (jira2md would otherwise emit a relative href="%5Efilename").
  result = result.replace(
    /\[([^|\]\n]+)\|\^([^\]\n]+)\]/g,
    (_match, label: string, filename: string) => {
      const url = attachments?.[filename];
      // T-sak-01: constant class literal, never user-controlled.
      return url ? `<a href="${url}" class="wiki-attachment-chip">${label}</a>` : label;
    },
  );
  result = result.replace(/\[\^([^\]]+)\]/g, (_match, filename: string) => {
    const url = attachments?.[filename];
    if (url) {
      // T-sak-01: the class attribute is ALWAYS the literal constant below —
      // never interpolate user-controlled content into it. rehype-sanitize
      // already allowlists `className` on `a` (wikiSanitizeSchema, line ~64).
      return `<a href="${url}" class="wiki-attachment-chip">${filename}</a>`;
    }
    return `\`${filename}\``;
  });

  // Panels with title: {panel:title=TITLE}...{panel}
  result = result.replace(
    /\{panel:title=([^}]+)\}([\s\S]*?)\{panel\}/g,
    '<div data-callout="panel" data-title="$1">$2</div>',
  );
  // Panels without title: {panel}...{panel}
  result = result.replace(/\{panel\}([\s\S]*?)\{panel\}/g, '<div data-callout="panel">$1</div>');

  // Info panels
  result = result.replace(/\{info\}([\s\S]*?)\{info\}/g, '<div data-callout="info">$1</div>');

  // Warning panels
  result = result.replace(
    /\{warning\}([\s\S]*?)\{warning\}/g,
    '<div data-callout="warning">$1</div>',
  );

  // Note panels
  result = result.replace(/\{note\}([\s\S]*?)\{note\}/g, '<div data-callout="note">$1</div>');

  // Quote blocks: {quote}...{quote} -> markdown blockquote (> prefix per line).
  // jira2md only handles the single-paragraph bq. prefix form, not the block {quote} macro.
  // Must run BEFORE jira2md so jira2md can process Jira inline markup (bold, italic, etc.)
  // inside the quote. Using markdown > prefix (not <blockquote> HTML) ensures jira2md
  // converts inline syntax like *bold* → **bold** before react-markdown renders it.
  // Strip trailing newlines from the captured content before prefixing: when the closing
  // {quote} tag is on its own line, the captured content ends with '\n', which produces a
  // trailing empty '> ' blockquote continuation line. That trailing '> ' line immediately
  // before a following '* list item' (or other block) causes the content to appear inside
  // the blockquote visually (wiki-renderer-list-in-quote). A trailing '\n' is appended to
  // the replacement so that the following line is separated by a blank line from the blockquote.
  result = result.replace(
    /\{quote\}([\s\S]*?)\{quote\}/g,
    (_match, content: string) =>
      `${content
        .replace(/\n+$/, '')
        .split('\n')
        .map((line: string) => `> ${line}`)
        .join('\n')}\n`,
  );

  // Color macros: {color:#hex}...{color} -> <span data-color="#hex">...</span>
  // Must run BEFORE jira2md, which strips {color} entirely (jira2md index.js line 82).
  // We use data-color rather than inline style so rehype-sanitize can allowlist it
  // without permitting arbitrary CSS (an XSS vector).
  result = result.replace(
    /\{color:([^}]+)\}([\s\S]*?)\{color\}/g,
    (_match: string, hex: string, inner: string) => {
      // jira2md won't process Jira inline markup inside raw HTML, so convert it here.
      // data-color goes on <strong> too so its inline style beats .prose strong { color }.
      const html = inner.replace(/\*([^*\n]+)\*/g, `<strong data-color="${hex}">$1</strong>`);
      return `<span data-color="${hex}">${html}</span>`;
    },
  );

  // Underline: Jira `+text+` syntax. jira2md's `to_markdown()` underline rule
  // (`/\+([^+]*)\+/g` → `<ins>$1</ins>`) runs on the ENTIRE string with no
  // per-line scoping and no whitespace-boundary requirement — it pairs the
  // FIRST literal '+' anywhere in the document with the NEXT literal '+'
  // anywhere after it, wrapping everything between them in `<ins>` underline
  // styling. A lone '+' by itself (C++, 3+2, version strings, "text + text")
  // has no visible effect, but as soon as a SECOND unrelated '+' exists
  // anywhere later in the same rendered field (a different paragraph, a
  // different table cell, etc.), the two incorrectly pair up and corrupt all
  // text between them. This is the bare/unescaped counterpart of the
  // already-fixed `\+` (backslash-escaped plus) case above — real Jira only
  // treats `+...+` as underline when the opening `+` is immediately followed
  // by non-whitespace and the closing `+` is immediately preceded by
  // non-whitespace, matching the same convention as bold (`*`) and italic
  // (`_`). Convert genuine same-line pairs directly to `<ins>` HTML here
  // (mirroring the non-greedy, \S-boundary bold/italic pattern already used
  // in normalizeTableCellInlineFormatting), bypassing jira2md's buggy global
  // regex entirely, then neutralize any remaining literal '+' to the HTML
  // entity `&#43;` (same technique already used for the escaped-\+ case
  // above) so jira2md's own regex never sees an unpaired '+' left to mis-pair
  // with an unrelated one elsewhere in the document. Must run AFTER the
  // image/attachment steps above (which rely on literal '+' inside URLs for
  // their own %20 substitution) and after the emoticon (+) replacement.
  // Boundary characters (`[^+\s]`) — not just `\S` — deliberately exclude '+'
  // itself: `\S` alone matches '+' (it is non-whitespace), which let a content
  // group's boundary swallow an adjacent '+' from a run of 2+ plus signs
  // (e.g. "C++ ... +3 ...") and incorrectly pair the FIRST '+' with a '+'
  // several words later instead of correctly failing to pair at all.
  result = result.replace(/(?<!\+)\+([^+\s][^+\n]*?[^+\s]|[^+\s])\+(?!\+)/g, '<ins>$1</ins>');
  result = result.replace(/\+/g, '&#43;');

  // jira-wiki-italic-non-ascii (round 2): protect underscores inside remaining
  // `[display|url]` / `[url]` link bracket syntax from jira2md's per-line,
  // greedy italic regex (`/_(\S.*)_/g`) and bold regex (`/\*(\S.*)\*/g`).
  // jira2md runs Bold/Italic BEFORE it extracts Named/Un-named links, and its
  // `.` does not match `\n` but matches every other character — including `_`,
  // `|`, `[`, `]`. So an underscore anywhere inside a link's URL or display
  // text on the SAME line as a preceding `_..._` span becomes a candidate
  // delimiter: the greedy match pairs the span's opening `_` with the
  // underscore inside the link instead of the span's own closing `_`,
  // swallowing the real closing `_` as literal text and leaving the italic
  // span unrendered (reported shape: `*Špecifikácia:_ [TEXT|url_with_underscore]`
  // instead of `<em>Špecifikácia:</em> <a>TEXT</a>`). This is NOT
  // theoretical — reproduced directly against jira2md.to_markdown().
  // `fixMarkdownLinkUnderscores` (below) already fixes the narrower case where
  // BOTH the opening and closing `_` of the corrupting pair live entirely
  // inside the URL — but it runs AFTER jira2md and cannot recover a span whose
  // real closing delimiter was stolen by an unrelated link elsewhere on the
  // line. The only complete fix is to stop jira2md from ever seeing the
  // underscore in the first place, by protecting it here.
  //
  // This mirrors the placeholder-swap technique `normalizeTableCellInlineFormatting`
  // already uses for the identical problem scoped to table cells ("This
  // prevents the italic regex from matching underscores inside URLs") —
  // extended here to ALL prose (table cells already resolve their own
  // bold/italic locally before jira2md and are unaffected by this pass).
  // The placeholder uses `\x00` (a null byte that can never appear in real
  // wiki text) so it cannot collide with any other content or be
  // reintroduced by a later step; it is restored to `_` by
  // `fixMarkdownLinkUnderscores` after jira2md and link extraction complete.
  result = result.replace(/\[([^\]\n]*)\]/g, (match) => match.replace(/_/g, '\x00USCORE\x00'));

  // wiki-underscore-intraword: real Jira only treats `_` as an italic delimiter
  // at a word boundary, so identifiers like DEMO_STD_VAS or AS_ID are literal
  // text. jira2md's italic regex has no such boundary rule and turns the
  // underscores into `*...*` emphasis (DEMO<em>STD</em>VAS). Protect any `_`
  // flanked by letters/digits on both sides with the same placeholder used for
  // link brackets; fixMarkdownLinkUnderscores restores it after jira2md runs.
  result = result.replace(/(?<=[\p{L}\p{N}])_(?=[\p{L}\p{N}])/gu, '\x00USCORE\x00');

  // wiki-strikethrough-dashes: Jira strikethrough markup `-text-` wrapping a
  // named-link display label — `[-text-|url]` — never renders struck-through.
  // jira2md's own strikethrough rule (`/(\s+)-(\S+.*?\S)-(\s+)/g`, applied in
  // to_markdown() further down the pipeline) REQUIRES whitespace immediately
  // before the opening `-` and after the closing `-`. Inside `[-text-|url]`
  // the opening `-` is immediately preceded by `[` and the closing `-` is
  // immediately followed by `|` — neither is whitespace, so the rule never
  // matches. The untouched `-text-` then falls through to jira2md's Named
  // Links rule (`/\[(.+?)\|(.+?)\]/g` → `[$1]($2)`), which treats the dashes
  // as literal display-text characters, producing a plain link labelled
  // "-text-" instead of a struck-through "text" link.
  // Fix: convert the display-text strikethrough directly to `<del>text</del>`
  // HERE — before jira2md ever sees the string — so jira2md's Named Links
  // rule extracts `[<del>text</del>](url)` unmodified and rehype-raw renders
  // the struck-through link text natively. HTML (not markdown `~~text~~`) is
  // used deliberately: jira2md's Subscript rule (`/~([^~]*)~/g` →
  // `<sub>$1</sub>`) runs on the same string and would immediately pair up
  // adjacent `~` characters in `~~text~~`, corrupting it into
  // `<sub></sub>text<sub></sub>` — the same "convert straight to HTML to
  // dodge jira2md's own regexes" technique already used above for
  // `{*}bold{*}` and `{_}italic{_}`. `<del>` is in rehype-sanitize's
  // defaultSchema, so it survives sanitisation unchanged. Only the
  // display-text side of a named link is handled (the reported/expected
  // shape); the URL portion is left untouched.
  result = result.replace(
    /\[-(\S(?:[^|\]\n]*\S)?)-\|([^\]\n]+)\]/g,
    (_match, label: string, url: string) => `[<del>${label}</del>|${url}]`,
  );

  return { text: result, codeBlockBodies };
}
