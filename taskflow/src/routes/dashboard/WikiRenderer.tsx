import { openUrl } from '@tauri-apps/plugin-opener';
// @ts-expect-error — jira2md has no default export type declarations
import j2m from 'jira2md';
import { type ComponentPropsWithoutRef, type MouseEvent, useState } from 'react';
import Markdown from 'react-markdown';
import { useLocation, useNavigate } from 'react-router-dom';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { tryInternalPath } from '@/lib/internalLinks';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';
import { AuthImage } from './AuthImage';
import { ImageLightbox } from './ImageLightbox';

/**
 * Plan 54-07 T-54-07-01 (XSS) mitigation:
 * Apply `rehype-sanitize` AFTER `rehype-raw` to strip dangerous tags
 * (`<script>`, `<iframe>`, `<object>`, on-* event handlers, …) while
 * preserving the wiki-rendering surface this app already supports:
 *  - `<div>` / `<span>` with `data-callout` + `data-title` (panel/info/etc.)
 *  - `<mention data-id="…">` (user mentions)
 *  - `<img src alt>` (resolved attachment images)
 *  - `<br>` (hard breaks emitted by mergeOpenTableRows + Jira `\\` markers)
 *  - `<a href>` (external links, routed through `openUrl` in markdownComponents)
 * `<script>` payloads embedded in user content render as LITERAL TEXT after
 * sanitisation — verified by the T-54-07-01 XSS guard test in WikiRenderer.test.tsx.
 */
const wikiSanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'mention', 'br', 'span'],
  attributes: {
    ...defaultSchema.attributes,
    // hast property names are camelCased — `data-callout` ↔ `dataCallout`,
    // `data-title` ↔ `dataTitle`, `data-id` ↔ `dataId`. The whitelist must
    // match what hast-util-from-html produces from the raw HTML emitted by
    // mergeOpenTableRows / preprocessJiraMarkup.
    div: [...(defaultSchema.attributes?.div ?? []), 'dataCallout', 'dataTitle'],
    span: [...(defaultSchema.attributes?.span ?? []), 'dataCallout', 'dataTitle', 'dataColor'],
    strong: [...(defaultSchema.attributes?.strong ?? []), 'dataColor'],
    mention: ['dataId'],
    img: [...(defaultSchema.attributes?.img ?? []), 'src', 'alt'],
    a: [...(defaultSchema.attributes?.a ?? []), 'href', 'className'],
  },
};

/** Map from filename → full URL for resolving Jira !filename.png! references */
export type AttachmentMap = Record<string, string>;

/** Map from username/accountId → display name for resolving [~user] mentions */
export type UserMap = Record<string, string>;

interface WikiRendererProps {
  wikiText: string | null | undefined;
  className?: string;
  /** Attachment filename→URL map for resolving inline images */
  attachments?: AttachmentMap;
  /** Username/accountId→displayName map for resolving mentions */
  users?: UserMap;
}

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
    const sepStartInLine = trimmed.indexOf(' ' + sepRowStr);
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
 * Validated against the verbatim ESHOP fixture from 54-06-UAT-FINDINGS.md
 * Finding 1 (recorded in 54-PROBE-FINDINGS.md ## Probe E).
 */
const PANEL_TAG_RE = /\{panel(?::[^}]*)?\}/g;

/**
 * Plan 54-09 Concern C (root cause #2): wiki numbered-list marker `# item`
 * inside a `{panel}` block inside a `|cell|` row loses its semantics when the
 * panel body is flattened into a `<span data-callout="panel">…</span>`. Round-2
 * UAT showed `# [VAS.png|url]` rendering as bare `#` text instead of an `<ol>`.
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
  [/\(\/\)/g,      '✅'],        // (/)      → ✅ green tick / check mark
  [/\(x\)/g,       '❌'],        // (x)      → ❌ red cross
  [/\(!\)/g,       '⚠️'],  // (!)      → ⚠️ warning
  [/\(\+\)/g,      '➕'],        // (+)      → ➕ plus / add
  [/\(-\)/g,       '➖'],        // (-)      → ➖ minus / remove
  [/\(\?\)/g,      '❓'],        // (?)      → ❓ question mark
  [/\(i\)/g,       'ℹ️'],  // (i)      → ℹ️ information
  [/\(\*r\)/g,     '⭐'],        // (*r)     → ⭐ red star (closest Unicode)
  [/\(\*g\)/g,     '🌟'],       // (*g)     → 🌟 green star
  [/\(\*b\)/g,     '💫'],       // (*b)     → 💫 blue star (closest Unicode)
  [/\(\*y\)/g,     '⭐'],        // (*y)     → ⭐ yellow star
  [/\(\*\)/g,      '⭐'],        // (*)      → ⭐ star (catch-all; after *r/*g/*b/*y)
  [/\(on\)/g,      '💡'],       // (on)     → 💡 light bulb on
  [/\(off\)/g,     '🔕'],       // (off)    → 🔕 muted bell / light off
  [/\(flagoff\)/g, '🏳️'], // (flagoff)→ 🏳️ white flag (before flag)
  [/\(flag\)/g,    '🚩'],       // (flag)   → 🚩 red flag
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
 * Pre-process Jira table data rows (`|cell|`) to normalize Jira inline formatting
 * (bold `*text*`, italic `_text_`) to markdown equivalents on a per-cell basis,
 * BEFORE passing the text to jira2md.
 *
 * Problem: jira2md's bold and italic regexes (greedy *...* and _..._ patterns) are
 * greedy and operate on the full input string. For a row like
 * `|*Header A*|*Header B*|`, the bold pattern matches from the FIRST `*` to the
 * LAST `*` across cell separators, producing `**Header A*|*Header B**` — corrupting
 * the entire row. The same applies to italic: `|_A_|_B_|` → `|*A_|_B*|`.
 *
 * Fix: split each data row into cell segments using a bracket-aware character walk
 * (so `[display|url]` named-links are treated as a single token), apply the bold
 * and italic conversion independently to each cell, then rejoin. This guarantees
 * that a `*` or `_` in one cell can never "pair" with a marker in a different cell.
 *
 * After this step, the matching Jira→markdown transformations in jira2md see no
 * unprocessed `*...*` or `_..._` in data rows and leave them untouched (the double
 * `**` is already markdown bold, and `*text*` inside `**...**` is unambiguous italic).
 *
 * Runs after `injectHeaderlessTableSeparators` (which may inject synthetic `| | |`
 * and `|---|---|` rows — both are safe, as they contain no `*` or `_` formatting).
 * Skips `||header||` rows and non-table lines unchanged.
 *
 * Private helper — not exported.
 */
function normalizeTableCellInlineFormatting(wiki: string): string {
  const lines = wiki.split('\n');
  const out: string[] = [];

  for (const line of lines) {
    const trimmed = line.replace(/[ \t]+$/, '');
    // Only process single-pipe data rows: starts with | but not ||
    if (!trimmed.startsWith('|') || trimmed.startsWith('||')) {
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
      if (ch === '[') { depth++; current += ch; }
      else if (ch === ']') { depth--; current += ch; }
      else if (ch === '|' && depth === 0) {
        segments.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    segments.push(current);

    // Apply Jira→markdown inline formatting per cell (non-greedy, no cross-cell bleed).
    // Link syntax [display|url] is protected from bold/italic conversion by replacing
    // [...] substrings with null-byte placeholders before the regex runs, then
    // restoring them. This prevents the italic regex from matching underscores inside
    // URLs (e.g. hash=1A_B2_C3) or bold/italic markers spanning a named link token.
    const normalized = segments.map((cell) => {
      const linkPlaceholders: string[] = [];
      const withPlaceholders = cell.replace(/\[[^\]]*\]/g, (match) => {
        const idx = linkPlaceholders.length;
        linkPlaceholders.push(match);
        return `\x00LINK${idx}\x00`;
      });
      // Bold: *text* → <strong>text</strong>
      // Output HTML directly so jira2md won't re-process: *text* would become
      // **text** under jira2md's bold rule, and _text_ → *text* → **text**.
      // <strong> and <em> pass through jira2md unmodified and are allowed by
      // the rehype-sanitize default schema.
      let c = withPlaceholders.replace(/(?<!\*)\*(\S[^*\n]*?\S|\S)\*(?!\*)/g, '<strong>$1</strong>');
      // Italic: _text_ → <em>text</em>
      c = c.replace(/(?<!_)_(\S[^_\n]*?\S|\S)_(?!_)/g, '<em>$1</em>');
      // Restore link placeholders
      return c.replace(/\x00LINK(\d+)\x00/g, (_, i) => linkPlaceholders[parseInt(i, 10)]);
    });

    out.push(normalized.join('|'));
  }

  return out.join('\n');
}

/**
 * Pre-process Jira wiki markup that jira2md does not handle:
 * - Jira emoticon shortcodes: (/) (x) (!) (+) (-) (?) (i) (*) (on) (off) (flag) etc.
 * - User mentions: [~username] and [~accountId:xxx]
 * - Info/warning/note panels
 * - Panel blocks with optional title
 * - Inline images: !filename.png! → resolved via attachment map (always run; strips
 *   Jira options like `|width=N,height=N` unconditionally so jira2md never sees them)
 * - Table cell inline formatting: *bold* / _italic_ normalized per cell before jira2md
 */
export function preprocessJiraMarkup(
  wiki: string,
  attachments?: AttachmentMap,
  users?: UserMap,
): string {
  // Normalize CRLF → LF. Jira Server/Data Center returns descriptions with \r\n
  // line endings. All line-based processors (mergeOpenTableRows, splitInlineSingleLineTables,
  // injectHeaderlessTableSeparators, normalizeTableCellInlineFormatting) split by \n
  // and trim only [ \t]+$ — leaving \r on every line, which breaks endsWithPipe
  // checks and causes mergeOpenTableRows to greedily consume entire documents.
  let result = wiki.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Jira emoticons: replace shortcodes like "(/)", "(x)" with Unicode emoji.
  // Must run before jira2md (which would corrupt certain patterns like (*) → bold).
  result = replaceJiraEmoticons(result);

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

  // Table cell inline formatting: normalize Jira bold (*text*) and italic (_text_)
  // to markdown equivalents on a per-cell basis, BEFORE jira2md. jira2md's bold and
  // italic regexes are greedy and cross cell separators, corrupting rows like
  // |*Header A*|*Header B*| into |**Header A*|*Header B**|. Running the conversion
  // per cell prevents any cross-boundary pairing.
  result = normalizeTableCellInlineFormatting(result);

  // Plan 54-06: real ESHOP test-run content uses `hN.X` (no space) and `\\` as
  // a hard line break. jira2md leaves both unmodified. Normalize before jira2md:
  // - `h1.foo` … `h6.foo` → `h1. foo` (so jira2md emits valid `#…# foo`)
  // - `\\` at end-of-line or surrounded by spaces → markdown hard break (`  \n`)
  result = result.replace(/^(h[1-6]\.)(\S)/gm, '$1 $2');
  // Convert standalone `\\` (Jira hard break) to a markdown hard break.
  // Two trailing spaces + newline is the markdown hard-break form remark-gfm preserves.
  result = result.replace(/[ \t]*\\\\[ \t]*\n/g, '  \n');
  result = result.replace(/[ \t]\\\\[ \t]/g, '  \n');

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

  return result;
}

/**
 * jira2md applies its italic transformation (`_text_` → `*text*`) globally
 * across the entire input string — including inside `[display|url]` and
 * `[URL]` link syntax — before it extracts the link parts. When a URL
 * contains two or more underscores (e.g. a hash parameter like
 * `hash=L_0mIHoqvPqgwUAu6FML8le7k8K_uXCDZ8OUVHEeqnheLRQ%3D`), the first
 * and last `_` form an "italic pair" and the content between them is wrapped
 * in `*`, corrupting both the display text and the href.
 *
 * jira2md emits two markdown link forms:
 *  - `[display|url]` → standard link `[display](url)`
 *  - `[URL]`         → autolink `<https://…>` (URL-only bracket syntax)
 *
 * URLs never contain `*` as a valid character in practice, so we can safely
 * revert any `*` back to `_` in:
 *  1. The URL portion (inside the closing parens) of every `[text](url)` link.
 *  2. The display text of links where the display text is itself a URL (starts
 *     with `http://` or `https://`) — the same italic corruption applies there.
 *  3. The body of every `<https://…>` or `<http://…>` autolink — jira2md
 *     emits these for `[URL]` bracket syntax (URL-only, no display text).
 *
 * This function is applied to the full markdown string produced by
 * `j2m.to_markdown()` before it is passed to react-markdown. It does NOT
 * touch display text that is not URL-shaped, preserving intentional bold/italic
 * markdown formatting in link labels.
 *
 * Private helper — not exported.
 */
function fixMarkdownLinkUnderscores(md: string): string {
  // Fix standard markdown links: [text](url)
  let result = md.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_match, text: string, url: string) => {
    // Always restore * → _ in the URL (href) portion — * is not valid in URLs.
    const fixedUrl = url.replace(/\*/g, '_');
    // Only restore * → _ in display text when the text itself is a URL.
    // This preserves *bold* and *italic* in human-readable link labels.
    const fixedText = /^https?:\/\//.test(text) ? text.replace(/\*/g, '_') : text;
    return `[${fixedText}](${fixedUrl})`;
  });
  // Fix markdown autolinks: <https://…> or <http://…>
  // jira2md emits these for `[URL]` bracket syntax (no display text).
  // The italic pass runs before link extraction, so underscores in the URL
  // are already corrupted to `*` by the time we see the autolink token.
  result = result.replace(/<(https?:\/\/[^>]*)>/g, (_match, url: string) => {
    return `<${url.replace(/\*/g, '_')}>`;
  });
  return result;
}

/** Derives a breadcrumb TrailEntry for the given pathname.
 * Labels mirror the `routeLabel()` mapping in main.tsx so the breadcrumb
 * header is consistent regardless of where the push originates.
 */
function deriveSourceCrumb(pathname: string): { path: string; label: string } {
  // /issue/:key  →  label is the key itself (e.g. "PROJ-123")
  const issueMatch = pathname.match(/^\/issue\/(.+)$/);
  if (issueMatch) return { path: pathname, label: issueMatch[1] };

  // /mr/:projectId/:iid  →  label "!{iid}"
  const mrMatch = pathname.match(/^\/mr\/[^/]+\/(\d+)/);
  if (mrMatch) return { path: pathname, label: `!${mrMatch[1]}` };

  // /aio-cycle/:proj/:cycle/run/:runId  →  label "Run {runId}"
  const aioRunMatch = pathname.match(/^\/aio-cycle\/[^/]+\/[^/]+\/run\/([^/]+)/);
  if (aioRunMatch) return { path: pathname, label: `Run ${aioRunMatch[1]}` };

  // /aio-cycle/:proj/:cycle  →  label is the cycle key (last segment)
  const aioCycleMatch = pathname.match(/^\/aio-cycle\/[^/]+\/([^/]+)/);
  if (aioCycleMatch) return { path: pathname, label: aioCycleMatch[1] };

  // /release/:id  →  "Release"
  if (pathname.startsWith('/release/')) return { path: pathname, label: 'Release' };

  // Static roots — match routeLabel() in main.tsx
  const staticLabels: Record<string, string> = {
    '/sprint-board': 'Sprint Board',
    '/backlog': 'Backlog',
    '/my-tasks': 'My Tasks',
    '/epics': 'Epics',
    '/dashboard': 'Overview',
    '/sprint-progress': 'Sprint Progress',
    '/workload': 'Workload',
    '/releases': 'Releases',
    '/merge-requests': 'Merge Requests',
  };
  return { path: pathname, label: staticLabels[pathname] ?? 'Home' };
}

const calloutStyles: Record<string, string> = {
  info: 'border-l-4 border-blue-500 bg-blue-500/10 p-3 rounded-r-md my-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
  warning:
    'border-l-4 border-amber-500 bg-amber-500/10 p-3 rounded-r-md my-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
  note: 'border-l-4 border-yellow-500 bg-yellow-500/10 p-3 rounded-r-md my-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
  panel:
    'border-l-4 border-border bg-muted/50 p-3 rounded-r-md my-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
};

export function WikiRenderer({ wikiText, className, attachments, users }: WikiRendererProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const breadcrumbPush = useBreadcrumbStore((s) => s.push);
  const { jiraBaseUrl, gitlabBaseUrl, activeGitlabProject, activeGitlabProjectPath } = useAuthStore();
  const linkCtx = { jiraBaseUrl, gitlabBaseUrl, activeGitlabProject, activeGitlabProjectPath };

  const preprocessed = wikiText ? preprocessJiraMarkup(wikiText, attachments, users) : '';
  const markdown = preprocessed ? fixMarkdownLinkUnderscores(j2m.to_markdown(preprocessed)) : '';

  const markdownComponents: Record<string, unknown> = {
    img: ({ src, alt }: ComponentPropsWithoutRef<'img'>) => {
      if (!src) return null;
      return (
        <AuthImage
          src={src}
          alt={alt ?? ''}
          className="max-w-full rounded-md cursor-pointer"
          onClick={() => setLightboxSrc(src)}
        />
      );
    },
    // Plan 54-08 Gap 3: wrap rendered tables in an overflow-x-auto container so
    // nested wiki tables (which can be wider than their constraining outer cell —
    // e.g. AioTestRunsSection.StepTable's Step column when the wiki blob contains
    // its OWN ||header||/|row| table with embedded {panel} content) scroll
    // horizontally instead of bleeding past the column boundary. `max-w-full`
    // keeps the container from growing past its parent.
    // Pairs with the `min-w-0` additions in AioTestRunsSection.StepTable
    // cell wrappers (see .planning/debug/panel-overflows-table-cell.md fixes 1+2).
    table: ({ children, ...rest }: ComponentPropsWithoutRef<'table'>) => (
      <div className="overflow-x-auto max-w-full">
        <table {...rest}>{children}</table>
      </div>
    ),
    div: ({ node, children, ...rest }: ComponentPropsWithoutRef<'div'> & { node?: unknown }) => {
      const props = rest as Record<string, unknown>;
      const calloutType = props['data-callout'] as string | undefined;
      if (calloutType && calloutStyles[calloutType]) {
        const title = props['data-title'] as string | undefined;
        return (
          <div data-callout={calloutType} className={calloutStyles[calloutType]}>
            {title && <div className="font-bold mb-1">{title}</div>}
            {children}
          </div>
        );
      }
      return <div {...rest}>{children}</div>;
    },
    // Plan 54-07 Gap 3 (Branch 3-A): inline callout span emitted by
    // mergeOpenTableRows when a `{panel}…{panel}` block is embedded inside a
    // table cell. `<div>` is illegal as a child of `<td>` (HTML spec) so we
    // emit `<span data-callout>` instead, with inline styling that matches
    // the block-level callout colours but uses `inline-block` so it sits
    // inside the cell flow without breaking the row.
    span: ({ node, children, ...rest }: ComponentPropsWithoutRef<'span'> & { node?: unknown }) => {
      const props = rest as Record<string, unknown>;
      const calloutType = props['data-callout'] as string | undefined;
      if (calloutType && calloutStyles[calloutType]) {
        const title = props['data-title'] as string | undefined;
        return (
          <span data-callout={calloutType} className={`inline-block ${calloutStyles[calloutType]}`}>
            {title && <span className="font-bold mr-1">{title}</span>}
            {children}
          </span>
        );
      }
      // Color macro: {color:#hex}...{color} — preprocessed to <span data-color="#hex">
      const colorValue = props['data-color'] as string | undefined;
      if (colorValue) {
        return <span style={{ color: colorValue }}>{children}</span>;
      }
      return <span {...rest}>{children}</span>;
    },
    strong: ({ node, children, ...rest }: ComponentPropsWithoutRef<'strong'> & { node?: unknown }) => {
      const colorValue = (rest as Record<string, unknown>)['data-color'] as string | undefined;
      if (colorValue) {
        return <strong style={{ color: colorValue }}>{children}</strong>;
      }
      return <strong {...rest}>{children}</strong>;
    },
    // Custom element for <mention> tags produced by preprocessJiraMarkup
    mention: ({ children }: { children?: React.ReactNode }) => (
      <span className="mention-badge inline-flex items-center rounded bg-primary/15 text-primary px-1.5 py-0.5 text-xs font-medium">
        @{children}
      </span>
    ),
    // External link override (Plan 54-06 Finding 1 sub-issue + UAT follow-ups,
    // updated 260518-pq2):
    // - Image attachment links ([filename.png|url] where filename ends in an
    //   image extension) render as inline text anchors (preserves prose flow).
    //   Click opens the existing ImageLightbox in-app — no OS browser.
    // - Other external links first consult tryInternalPath (Jira browse URLs
    //   → /issue/:key; GitLab MR URLs → /mr/:projectId/:iid when the URL's
    //   group/project path matches activeGitlabProjectPath). On a hit, the app
    //   navigates in-app via useNavigate() without touching the OS browser.
    // - Only on a miss (no known internal route) do links fall through to
    //   openUrl from @tauri-apps/plugin-opener so the Tauri webview is not
    //   hijacked.
    a: ({ href, children, ...rest }: ComponentPropsWithoutRef<'a'>) => {
      // Falsy href → render plain <a> with no openUrl, no preventDefault.
      if (!href) {
        return <a {...rest}>{children}</a>;
      }
      // In-document anchor → render plain <a>, let default scroll behavior apply.
      if (href.startsWith('#')) {
        return (
          <a href={href} {...rest}>
            {children}
          </a>
        );
      }
      // Image attachment link → inline text anchor that opens ImageLightbox on
      // click. AuthImage inside the lightbox translates AIO bridge URLs to the
      // direct download endpoint, so both same-instance bridge URLs and direct
      // `/secure/attachment/...` URLs work.
      const childText =
        typeof children === 'string'
          ? children
          : Array.isArray(children)
            ? children.filter((c): c is string => typeof c === 'string').join('')
            : '';
      if (/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(childText)) {
        const handleImageClick = (e: MouseEvent<HTMLAnchorElement>) => {
          e.preventDefault();
          setLightboxSrc(href);
        };
        return (
          <a href={href} onClick={handleImageClick} {...rest}>
            {children}
          </a>
        );
      }
      const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        const internalPath = tryInternalPath(href, linkCtx);
        if (internalPath !== null) {
          breadcrumbPush(deriveSourceCrumb(location.pathname));
          navigate(internalPath);
          return;
        }
        openUrl(href).catch(() => {});
      };
      // Preserve href on the rendered anchor for accessibility (right-click
      // "Copy link", screen readers, keyboard navigation).
      return (
        <a href={href} onClick={handleClick} {...rest}>
          {children}
        </a>
      );
    },
  };

  return (
    <article className={cn('prose prose-sm dark:prose-invert max-w-none break-words', className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        // T-54-07-01 mitigation: rehypeRaw passes raw HTML through to the
        // rehype tree; rehypeSanitize then strips dangerous tags before render.
        // Order matters: sanitize MUST run AFTER raw so it sees the parsed HTML.
        rehypePlugins={[rehypeRaw, [rehypeSanitize, wikiSanitizeSchema]]}
        components={markdownComponents}
      >
        {markdown}
      </Markdown>
      {lightboxSrc && <ImageLightbox src={lightboxSrc} open onClose={() => setLightboxSrc(null)} />}
    </article>
  );
}
