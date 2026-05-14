import { openUrl } from '@tauri-apps/plugin-opener';
// @ts-expect-error — jira2md has no default export type declarations
import j2m from 'jira2md';
import { type ComponentPropsWithoutRef, type MouseEvent, useState } from 'react';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
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
      const flattened = escaped.replace(/\n/g, '<br/>').trim();
      return `<span data-callout="panel" data-title="${title}">${flattened}</span>`;
    },
  );
  result = result.replace(
    /\{panel\}([\s\S]*?)\{panel\}/g,
    (_m, inner: string) => {
      const withLists = transformPanelListItems(inner);
      const escaped = withLists.replace(/\|/g, '\\|');
      const flattened = escaped.replace(/\n/g, '<br/>').trim();
      return `<span data-callout="panel">${flattened}</span>`;
    },
  );
  result = result.replace(
    /\{info\}([\s\S]*?)\{info\}/g,
    (_m, inner: string) =>
      `<span data-callout="info">${inner.replace(/\n/g, '<br/>').trim()}</span>`,
  );
  result = result.replace(
    /\{warning\}([\s\S]*?)\{warning\}/g,
    (_m, inner: string) =>
      `<span data-callout="warning">${inner.replace(/\n/g, '<br/>').trim()}</span>`,
  );
  result = result.replace(
    /\{note\}([\s\S]*?)\{note\}/g,
    (_m, inner: string) =>
      `<span data-callout="note">${inner.replace(/\n/g, '<br/>').trim()}</span>`,
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
      // Plan 54-09 phantom-row prevention: Jira `\\` hard-break markers
      // inside the merged row body would otherwise be converted to `  \n`
      // (markdown hard break) by preprocessJiraMarkup *after* this merge,
      // re-fracturing the row into phantom <tr> children of <tbody>.
      // Pre-emptively substitute `\\` markers to `<br/>` inside the merged
      // row content so they survive the markdown-table tokenizer as inline
      // line breaks. (Outside merged rows, preprocessJiraMarkup's existing
      // `\\` → `  \n` substitution still runs and preserves prose hard breaks.)
      const calloutsFlattened = flattenInlineCalloutsForTableRow(joined);
      const hardBreaksReplaced = calloutsFlattened
        .replace(/[ \t]*\\\\[ \t]*\n/g, '<br/>')
        .replace(/[ \t]\\\\[ \t]/g, '<br/>');
      const flattened = hardBreaksReplaced.replace(/\n/g, ' ');
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
 * Pre-process Jira wiki markup that jira2md does not handle:
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
  // Plan 54-07 Gap 3 (Branch 3-A): merge multi-line table rows BEFORE jira2md
  // tokenises them. Inline `{panel}` blocks inside the merged row body are
  // substituted to `<span data-callout="panel">…</span>` here so they survive
  // through to the markdown layer and render INSIDE the table cell.
  let result = mergeOpenTableRows(wiki);

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

const calloutStyles: Record<string, string> = {
  info: 'border-l-4 border-blue-500 bg-blue-500/10 p-3 rounded-r-md my-2',
  warning: 'border-l-4 border-amber-500 bg-amber-500/10 p-3 rounded-r-md my-2',
  note: 'border-l-4 border-yellow-500 bg-yellow-500/10 p-3 rounded-r-md my-2',
  panel: 'border-l-4 border-border bg-muted/50 p-3 rounded-r-md my-2',
};

export function WikiRenderer({ wikiText, className, attachments, users }: WikiRendererProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const preprocessed = wikiText ? preprocessJiraMarkup(wikiText, attachments, users) : '';
  const markdown = preprocessed ? j2m.to_markdown(preprocessed) : '';

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
      <span className="mention-badge inline-flex items-center rounded-full bg-primary/15 text-primary px-2 py-0.5 text-xs font-medium">
        @{children}
      </span>
    ),
    // External link override (Plan 54-06 Finding 1 sub-issue + UAT follow-ups):
    // - Image attachment links ([filename.png|url] where filename ends in an
    //   image extension) render as inline text anchors (preserves prose flow).
    //   Click opens the existing ImageLightbox in-app — no OS browser.
    // - All other external links route through openUrl from
    //   @tauri-apps/plugin-opener so the Tauri webview is not hijacked.
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
