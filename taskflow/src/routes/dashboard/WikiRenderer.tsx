import { openUrl } from '@tauri-apps/plugin-opener';
// @ts-expect-error — jira2md has no default export type declarations
import j2m from 'jira2md';
import { type ComponentPropsWithoutRef, type MouseEvent, useState } from 'react';
import Markdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { tryInternalPath } from '@/lib/internalLinks';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
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
    span: [...(defaultSchema.attributes?.span ?? []), 'dataCallout', 'dataTitle'],
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

      if (!prevIsHeader && !prevIsSeparator && !prevIsDataRow) {
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
 * Pre-process Jira wiki markup that jira2md does not handle:
 * - Jira emoticon shortcodes: (/) (x) (!) (+) (-) (?) (i) (*) (on) (off) (flag) etc.
 * - User mentions: [~username] and [~accountId:xxx]
 * - Info/warning/note panels
 * - Panel blocks with optional title
 * - Inline images: !filename.png! → resolved via attachment map
 */
export function preprocessJiraMarkup(
  wiki: string,
  attachments?: AttachmentMap,
  users?: UserMap,
): string {
  // Jira emoticons: replace shortcodes like "(/)", "(x)" with Unicode emoji.
  // Must run before jira2md (which would corrupt certain patterns like (*) → bold).
  let result = replaceJiraEmoticons(wiki);

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

  // Plan 54-06: real ESHOP test-run content uses `hN.X` (no space) and `\\` as
  // a hard line break. jira2md leaves both unmodified. Normalize before jira2md:
  // - `h1.foo` … `h6.foo` → `h1. foo` (so jira2md emits valid `#…# foo`)
  // - `\\` at end-of-line or surrounded by spaces → markdown hard break (`  \n`)
  result = result.replace(/^(h[1-6]\.)(\S)/gm, '$1 $2');
  // Convert standalone `\\` (Jira hard break) to a markdown hard break.
  // Two trailing spaces + newline is the markdown hard-break form remark-gfm preserves.
  result = result.replace(/[ \t]*\\\\[ \t]*\n/g, '  \n');
  result = result.replace(/[ \t]\\\\[ \t]/g, '  \n');

  // Images: !filename.png|options! or !filename.png! → resolve via attachment map
  // Must run BEFORE jira2md which also handles !...! syntax.
  // Resolved URLs are output as markdown ![](url) instead of Jira !url! to
  // prevent jira2md from mangling URLs that contain + characters (Jira encodes
  // spaces as + in attachment URLs, and jira2md interprets +text+ as <ins>).
  if (attachments && Object.keys(attachments).length > 0) {
    result = result.replace(/!([^!\n]+?)(?:\|[^!]*)?!/g, (_match, ref: string) => {
      // If it's already a full URL, output as raw HTML <img> to bypass jira2md.
      // Replace + with %20 so jira2md doesn't interpret +text+ as underline.
      if (ref.startsWith('http://') || ref.startsWith('https://')) {
        return `<img src="${ref.replace(/\+/g, '%20')}" alt="" />`;
      }
      // Look up in attachment map — same treatment
      const url = attachments[ref];
      if (url) {
        return `<img src="${url.replace(/\+/g, '%20')}" alt="" />`;
      }
      // Not found — leave as-is for jira2md
      return `!${ref}!`;
    });
  }

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
      return <span {...rest}>{children}</span>;
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
    <article className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
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
