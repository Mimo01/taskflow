/**
 * Core wiki to markdown/HTML pipeline: preprocess, jira2md, and the shared
 * remark/rehype plugin list. This is the oracle for the Phase 96 equivalence
 * harness. Presentation-only steps (issue-key linkification, the React
 * components map, the lightbox) are deliberately excluded and stay in
 * WikiRenderer.tsx.
 * No React imports.
 */
// @ts-expect-error — jira2md has no default export type declarations
import j2m from 'jira2md';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import type { PluggableList } from 'unified';
import { visit } from 'unist-util-visit';
import { type AttachmentMap, preprocessJiraMarkup, type UserMap } from './preprocess';

/**
 * Plan 54-07 T-54-07-01 (XSS) mitigation:
 * Apply `rehype-sanitize` AFTER `rehype-raw` to strip dangerous tags
 * (`<script>`, `<iframe>`, `<object>`, on-* event handlers, …) while
 * preserving the wiki-rendering surface this app already supports:
 *  - `<div>` / `<span>` with `data-callout` + `data-title` (panel/info/etc.)
 *  - `<mention data-id="…">` (user mentions)
 *  - `<img src alt>` (resolved attachment images)
 *  - `<br>` (hard breaks emitted by mergeOpenTableRows + Jira `\\` markers)
 *  - `<a href>` (external links, routed through `openExternal` in markdownComponents)
 * `<script>` payloads embedded in user content render as LITERAL TEXT after
 * sanitisation — verified by the T-54-07-01 XSS guard test in WikiRenderer.test.tsx.
 */
export const wikiSanitizeSchema = {
  ...defaultSchema,
  // 260610-fnk: `issuekeylink` is a synthetic element emitted by rehypeIssueKeys
  // (before sanitize) to mark a bare active-project issue key. It is allowlisted
  // here so sanitize preserves it; the components map renders it as IssueKeyLink.
  // Its only attribute is `dataKey` (the issue key), a plain string we re-escape
  // through React — no raw HTML, no arbitrary href (T-fnk-01).
  tagNames: [...(defaultSchema.tagNames ?? []), 'mention', 'br', 'span', 'issuekeylink'],
  attributes: {
    ...defaultSchema.attributes,
    issuekeylink: ['dataKey'],
    // hast property names are camelCased — `data-callout` ↔ `dataCallout`,
    // `data-title` ↔ `dataTitle`, `data-id` ↔ `dataId`. The whitelist must
    // match what hast-util-from-html produces from the raw HTML emitted by
    // mergeOpenTableRows / preprocessJiraMarkup.
    div: [...(defaultSchema.attributes?.div ?? []), 'dataCallout', 'dataTitle'],
    span: [...(defaultSchema.attributes?.span ?? []), 'dataCallout', 'dataTitle', 'dataColor'],
    strong: [...(defaultSchema.attributes?.strong ?? []), 'dataColor'],
    mention: ['dataId'],
    img: [...(defaultSchema.attributes?.img ?? []), 'src', 'alt'],
    // T-sak-01: hast-util-sanitize requires className VALUES to be explicitly
    // allowlisted — a bare `'className'` entry keeps the attribute but strips every
    // value (proven empirically, see quick-260916-sak Task 3). defaultSchema already
    // ships its OWN `['className', 'data-footnote-backref']` tuple on `a`
    // (footnote back-references); findDefinition() returns only the FIRST matching
    // tuple it finds for a given key, so appending a second `className` tuple after
    // the spread would be silently ignored. Filter the inherited tuple out and
    // replace it with one merging BOTH allowed values — `data-footnote-backref`
    // (defaultSchema's) and `wiki-attachment-chip` (this renderer's, always the
    // literal constant from preprocessJiraMarkup — never user-controlled input).
    a: [
      ...(defaultSchema.attributes?.a ?? []).filter(
        (entry) => !(Array.isArray(entry) && entry[0] === 'className'),
      ),
      'href',
      ['className', 'data-footnote-backref', 'wiki-attachment-chip'],
    ],
  },
};

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
 * Exported for the lib/wiki pipeline.
 */
export function fixMarkdownLinkUnderscores(md: string): string {
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
  // jira-wiki-italic-non-ascii (round 2): restore the `\x00USCORE\x00` placeholder
  // preprocessJiraMarkup inserted for every underscore inside `[...]` link bracket
  // syntax (protecting it from jira2md's per-line italic regex, which runs BEFORE
  // link extraction and would otherwise pair an unrelated preceding `_..._` span's
  // opening delimiter with an underscore inside the link). By this point jira2md
  // has already converted the brackets into `[text](url)` / `<url>` markdown link
  // forms, so it's safe to restore the placeholder back to a literal `_` everywhere.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: \x00 (null byte) is the same sentinel inserted by preprocessJiraMarkup — cannot appear in real content
  result = result.replace(/\x00USCORE\x00/g, '_');
  return result;
}

// Minimal hast shapes — `unist-util-visit` over a rehype tree. We only touch the
// fields we need; the full hast types live in @types/hast (not depended on here).
export type HastText = { type: 'text'; value: string };
export type HastElement = {
  type: 'element';
  tagName: string;
  properties?: Record<string, unknown>;
  children: Array<HastText | HastElement>;
};

/**
 * wiki-mono-entities: rehype plugin that decodes the entities preprocessJiraMarkup
 * injects (the raw-source `& < >` HTML escape, plus the `&#43;` / `&#33;`
 * neutralisers) back to literal characters inside INLINE `<code>` only.
 *
 * Prose entities are decoded by the markdown parser, but jira2md turns `{{...}}`
 * into a backtick code span and markdown never decodes entities inside code
 * spans — so `{{<TAG>}}` rendered as the literal text `&lt;TAG&gt;`. Code inside
 * `<pre>` is skipped: {code}/{noformat} bodies are extracted before the escape and
 * restored verbatim, so decoding them would corrupt a literal `&lt;` the user typed.
 * The result stays a text node (React re-escapes it), so nothing becomes markup.
 * `&amp;` is decoded last so an escaped `&amp;lt;` yields `&lt;`, not `<`.
 */
function rehypeDecodeInlineCodeEntities() {
  return (tree: HastElement) => {
    visit(
      tree,
      'element',
      (node: HastElement, _index: number | undefined, parent: HastElement | undefined) => {
        if (node.tagName !== 'code' || parent?.tagName === 'pre') return;
        for (const child of node.children) {
          if (child.type !== 'text') continue;
          child.value = child.value
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#43;/g, '+')
            .replace(/&#33;/g, '!')
            .replace(/&amp;/g, '&');
        }
      },
    );
  };
}

/**
 * Wiki text to the markdown string react-markdown consumes: preprocess,
 * jira2md, link-underscore repair, then restore {code}/{noformat} block bodies
 * (see preprocessJiraMarkup) now that jira2md.to_markdown() has produced the
 * fenced code block around them. The placeholder was opaque to jira2md's own
 * wiki-markup regexes, which run before its {code}/{noformat} conversion and
 * would otherwise corrupt code content the same way prose gets corrupted.
 */
export function wikiToMarkdown(
  wikiText: string | null | undefined,
  attachments?: AttachmentMap,
  users?: UserMap,
): string {
  const { text: preprocessed, codeBlockBodies } = wikiText
    ? preprocessJiraMarkup(wikiText, attachments, users)
    : { text: '', codeBlockBodies: [] };
  return preprocessed
    ? fixMarkdownLinkUnderscores(j2m.to_markdown(preprocessed)).replace(
        // biome-ignore lint/suspicious/noControlCharactersInRegex: \x00 (null byte) sentinel, see preprocessJiraMarkup
        /\x00CODEBODY(\d+)\x00/g,
        (_, i) => codeBlockBodies[Number.parseInt(i, 10)],
      )
    : '';
}

export const wikiRemarkPlugins: PluggableList = [remarkGfm, remarkBreaks];

/**
 * Builds the rehype plugin list. T-54-07-01 mitigation: rehypeRaw passes raw
 * HTML through to the rehype tree; rehypeSanitize then strips dangerous tags
 * before render. Order matters: sanitize MUST run AFTER raw so it sees the
 * parsed HTML.
 *
 * 260610-fnk: presentation plugins (e.g. issue-key linkification) are spliced
 * AFTER raw HTML is parsed (so text nodes are present) and BEFORE sanitize (so
 * synthetic elements such as <issuekeylink> are kept by the allowlist).
 */
export function wikiRehypePlugins(presentation: PluggableList = []): PluggableList {
  return [
    rehypeRaw,
    ...presentation,
    rehypeDecodeInlineCodeEntities,
    [rehypeSanitize, wikiSanitizeSchema],
  ];
}
