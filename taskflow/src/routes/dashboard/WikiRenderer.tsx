import { useQuery } from '@tanstack/react-query';
// @ts-expect-error — jira2md has no default export type declarations
import j2m from 'jira2md';
import { File, FileText } from 'lucide-react';
import {
  type ComponentPropsWithoutRef,
  createContext,
  type MouseEvent,
  useContext,
  useState,
} from 'react';
import Markdown from 'react-markdown';
import { useLocation, useNavigate } from 'react-router-dom';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { SKIP, visit } from 'unist-util-visit';
import { LinkContextMenu } from '@/components/ui/link-context-menu';
import { tryInternalPath } from '@/lib/internalLinks';
import { doneSummaryClass } from '@/lib/issueDisplayUtils';
import { openExternal } from '@/lib/openExternal';
import { cn } from '@/lib/utils';
import { type AttachmentMap, preprocessJiraMarkup, type UserMap } from '@/lib/wiki';
import { fetchIssueDetail } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';
import { useSettingsStore } from '@/stores/settings.store';
import { AuthImage } from './AuthImage';
import { ImageLightbox } from './ImageLightbox';

export type { AttachmentMap, UserMap } from '@/lib/wiki';
export {
  injectHeaderlessTableSeparators,
  JIRA_EMOTICON_MAP,
  mergeOpenTableRows,
  preprocessJiraMarkup,
  splitInlineSingleLineTables,
} from '@/lib/wiki';

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
const wikiSanitizeSchema = {
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

interface WikiRendererProps {
  wikiText: string | null | undefined;
  className?: string;
  /** Attachment filename→URL map for resolving inline images */
  attachments?: AttachmentMap;
  /** Username/accountId→displayName map for resolving mentions */
  users?: UserMap;
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
    '/epics': 'Epics',
    '/dashboard': 'Overview',
    '/releases': 'Releases',
    '/merge-requests': 'Merge Requests',
  };
  return { path: pathname, label: staticLabels[pathname] ?? 'Home' };
}

/**
 * Quick task 260610-fnk (D-02): decide whether a canonical issue key should be
 * linkified. "Known" is currently defined as "the active Jira project only" —
 * there is no persisted app-wide project list, so the only safe prefix to trust
 * is `auth.store.activeJiraProject`. Isolating the decision here means the rule
 * can be widened later (e.g. to a cached `['jira-projects']` query) without
 * touching any call site. Returns false when `activeJiraProject` is falsy.
 *
 * Module-private — not exported.
 */
function isKnownPrefix(key: string, activeJiraProject: string | null): boolean {
  if (!activeJiraProject) return false;
  return key.split('-')[0] === activeJiraProject;
}

/** Canonical Jira issue-key pattern, mirrored from internalLinks.ts `tryInternalPath`. */
const ISSUE_KEY_GLOBAL_RE = /\b[A-Z][A-Z0-9_]+-\d+\b/g;
const ISSUE_KEY_EXACT_RE = /^[A-Z][A-Z0-9_]+-\d+$/;

// Minimal hast shapes — `unist-util-visit` over a rehype tree. We only touch the
// fields we need; the full hast types live in @types/hast (not depended on here).
type HastText = { type: 'text'; value: string };
type HastElement = {
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
 * Quick task 260610-fnk (D-02/D-04/D-05): rehype plugin that linkifies bare
 * active-project issue keys in prose text nodes.
 *
 * react-markdown 10 dropped the `text` component override, so transforming bare
 * prose keys must happen in the rehype tree. This plugin walks every text node and:
 *  - SKIPs any text inside an `<a>`, `<code>`, or `<pre>` ancestor — so anchor
 *    labels are never re-linkified (D-05) and code spans/blocks stay literal (D-04).
 *  - Splits the remaining text on the canonical key pattern and replaces each
 *    exact-match part that passes `isKnownPrefix` with an `<issuekeylink data-key>`
 *    element (rendered as IssueKeyLink by the components map). Non-matching parts
 *    stay as plain text nodes (D-02).
 *
 * Runs BEFORE rehype-sanitize so the synthetic `issuekeylink` elements (allowlisted
 * in wikiSanitizeSchema) survive sanitisation. Emits no raw HTML and no href — the
 * key is a plain string re-escaped by React (T-fnk-01).
 */
function rehypeIssueKeys(activeJiraProject: string | null) {
  // unified plugins are "attachers" — a function that returns a transformer.
  // We close over `activeJiraProject` and return the attacher so it can be passed
  // directly into `rehypePlugins`.
  return function attacher() {
    return (tree: HastElement) => {
      if (!activeJiraProject) return;
      visit(
        tree,
        'text',
        (textNode: HastText, index: number | undefined, parent: HastElement | undefined) => {
          if (!parent || index === undefined) return;
          const tag = parent.tagName;
          // Skip text directly inside link/code containers — D-04/D-05 guard.
          if (tag === 'a' || tag === 'code' || tag === 'pre') return SKIP;

          const value = textNode.value;
          // Walk matches with matchAll so we keep both the keys and the gaps between
          // them; `split` would drop the matched delimiters.
          const segments: Array<HastText | HastElement> = [];
          let lastEnd = 0;
          let replaced = false;
          for (const m of value.matchAll(ISSUE_KEY_GLOBAL_RE)) {
            const key = m[0];
            const start = m.index ?? 0;
            if (start > lastEnd) {
              segments.push({ type: 'text', value: value.slice(lastEnd, start) });
            }
            if (ISSUE_KEY_EXACT_RE.test(key) && isKnownPrefix(key, activeJiraProject)) {
              segments.push({
                type: 'element',
                tagName: 'issuekeylink',
                properties: { dataKey: key },
                children: [],
              });
              replaced = true;
            } else {
              segments.push({ type: 'text', value: key });
            }
            lastEnd = start + key.length;
          }
          // Nothing was linkified (no keys, or only foreign-project keys) — leave the
          // original text node untouched rather than splicing it into equivalent
          // fragments. Preserves the documented fast path (WR-02).
          if (!replaced) return;
          if (lastEnd < value.length) {
            segments.push({ type: 'text', value: value.slice(lastEnd) });
          }
          parent.children.splice(index, 1, ...segments);
          // Resume visiting AFTER the inserted segments (none contain further text
          // keys). SKIP makes the resume index robust to the inserted nodes rather
          // than relying on them being keyless (WR-03).
          return [SKIP, index + segments.length];
        },
      );
    };
  };
}

/**
 * Quick task 260610-fnk (D-01/D-03): renders a bare in-app issue-key link.
 *
 * - The anchor renders immediately with the key as its text, independent of
 *   query state (non-blocking — strikethrough may appear a beat later).
 * - Status is resolved via the SAME query key/queryFn/staleTime/enabled as
 *   PeekPanel / IssueDetailView (`['jira-issue-detail', issueKey, jiraBaseUrl]`),
 *   so TanStack dedupes against the app-wide cache and cached keys cost zero
 *   network. We deliberately do NOT use findJiraIssueInCache — that returns
 *   summary-shaped/partial data with no reliable status (RESEARCH §On-Demand Status).
 * - `doneSummaryClass` applies `line-through` only once statusCategory.key === 'done'.
 * - Clicking mirrors the existing `a` override: preventDefault → breadcrumbPush →
 *   navigate(`/issue/${issueKey}`).
 *
 * Module-level so the override maps can render it as JSX (its label is then React
 * JSX, never a markdown-AST text node — the basis of the D-05 no-nesting guard).
 */
function IssueKeyLink({ issueKey }: { issueKey: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const breadcrumbPush = useBreadcrumbStore((s) => s.push);
  const { jiraBaseUrl, jiraConnected } = useAuthStore();
  const {
    epicLinkFieldKey,
    epicNameFieldKey,
    sprintFieldKey,
    storyPointsFieldKey,
    epicColorFieldKey,
  } = useSettingsStore();

  // Deduped status read — query key/queryFn/staleTime/enabled copied verbatim from
  // PeekPanel.tsx:77-92 so this shares the app-wide issue-detail cache exactly.
  const { data } = useQuery({
    queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl) throw new Error('No credentials');
      return fetchIssueDetail(jiraBaseUrl, token, issueKey ?? '', {
        epicLinkFieldKey,
        epicNameFieldKey,
        sprintFieldKey,
        storyPointsFieldKey,
        epicColorFieldKey,
      });
    },
    staleTime: 30_000,
    enabled: !!issueKey && !!jiraBaseUrl && !!jiraConnected,
    // A missing PAT / transient miss is the unknown-status case (D-03: link, no
    // strike), not an error worth retrying. Without this, the default retry:3
    // churns the network + logs for every unresolved key in a description (WR-01).
    retry: false,
  });

  const doneClass = doneSummaryClass(data?.fields?.status?.statusCategory);

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    breadcrumbPush(deriveSourceCrumb(location.pathname));
    navigate(`/issue/${issueKey}`);
  };

  return (
    <a
      href={`#issue-${issueKey}`}
      className={cn('text-primary hover:underline', doneClass)}
      onClick={handleClick}
    >
      {issueKey}
    </a>
  );
}

const calloutStyles: Record<string, string> = {
  info: 'border-l-4 border-blue-500 bg-blue-500/10 p-3 rounded-r-md my-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
  warning:
    'border-l-4 border-amber-500 bg-amber-500/10 p-3 rounded-r-md my-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
  note: 'border-l-4 border-yellow-500 bg-yellow-500/10 p-3 rounded-r-md my-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
  panel:
    'border-l-4 border-border bg-muted/50 p-3 rounded-r-md my-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
};

/**
 * File-type icon for a resolved `[^filename]` attachment chip. Mirrors
 * attachment-format.ts's getFileIcon rule, but keyed off the filename
 * extension since the renderer only has a filename here, not a mimeType.
 */
function getChipFileIcon(filename: string) {
  if (/\.(pdf|txt|log|md)$/i.test(filename)) {
    return FileText;
  }
  return File;
}

const OlDepthContext = createContext(0);
const OL_LIST_STYLES = ['decimal', 'lower-alpha', 'lower-roman'] as const;

const OlRenderer = ({ children, ...rest }: ComponentPropsWithoutRef<'ol'>) => {
  const depth = useContext(OlDepthContext);
  const listStyle = OL_LIST_STYLES[depth % OL_LIST_STYLES.length];
  return (
    <OlDepthContext.Provider value={depth + 1}>
      <ol {...rest} style={{ listStyleType: listStyle }}>
        {children}
      </ol>
    </OlDepthContext.Provider>
  );
};

export function WikiRenderer({ wikiText, className, attachments, users }: WikiRendererProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const breadcrumbPush = useBreadcrumbStore((s) => s.push);
  const {
    jiraBaseUrl,
    gitlabBaseUrl,
    activeGitlabProject,
    activeGitlabProjectPath,
    activeJiraProject,
  } = useAuthStore();
  const linkCtx = { jiraBaseUrl, gitlabBaseUrl, activeGitlabProject, activeGitlabProjectPath };

  const { text: preprocessed, codeBlockBodies } = wikiText
    ? preprocessJiraMarkup(wikiText, attachments, users)
    : { text: '', codeBlockBodies: [] };
  // Restore {code}/{noformat} block bodies (see preprocessJiraMarkup) now that
  // jira2md.to_markdown() has produced the fenced code block around them —
  // the placeholder was opaque to jira2md's own wiki-markup regexes, which run
  // before its {code}/{noformat} conversion and would otherwise corrupt code
  // content the same way prose gets corrupted.
  const markdown = preprocessed
    ? fixMarkdownLinkUnderscores(j2m.to_markdown(preprocessed)).replace(
        // biome-ignore lint/suspicious/noControlCharactersInRegex: \x00 (null byte) sentinel, see preprocessJiraMarkup
        /\x00CODEBODY(\d+)\x00/g,
        (_, i) => codeBlockBodies[Number.parseInt(i, 10)],
      )
    : '';

  const markdownComponents: Record<string, unknown> = {
    // Quick task 260610-fnk (D-02): the `rehypeIssueKeys` plugin replaces bare
    // active-project keys in prose text nodes with <issuekeylink data-key="KEY"/>
    // hast elements (skipping any text under <a>/<code>/<pre> — D-04/D-05). This
    // component renders each such element as an IssueKeyLink. Using a rehype plugin
    // rather than a `text` component is required: react-markdown 10 dropped support
    // for overriding the `text` node via the components map.
    issuekeylink: ({ node }: { node?: { properties?: Record<string, unknown> } }) => {
      const key = node?.properties?.dataKey as string | undefined;
      if (!key) return null;
      return <IssueKeyLink issueKey={key} />;
    },
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
    hr: () => <hr className="!my-3 border-muted-foreground/40" />,
    ol: OlRenderer,
    blockquote: ({ children, ...rest }: ComponentPropsWithoutRef<'blockquote'>) => (
      <blockquote
        className="border-l-4 border-muted-foreground/30 pl-3 text-muted-foreground my-2"
        {...rest}
      >
        {children}
      </blockquote>
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
    strong: ({
      node,
      children,
      ...rest
    }: ComponentPropsWithoutRef<'strong'> & { node?: unknown }) => {
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
    //   openExternal (the sanctioned external-URL boundary), which honors the
    //   user-selected browser preference and falls back to the OS default so
    //   the Tauri webview is not hijacked.
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
      // Quick task 260610-fnk (D-05): when the href resolves to an internal
      // /issue/KEY path, this `a` override OWNS the key — it renders a single
      // <IssueKeyLink> (the sole anchor, with status/strikethrough) instead of an
      // <a> wrapper. The key string inside IssueKeyLink is React JSX, not a markdown
      // text node, so the `text` override above cannot re-wrap it. This makes a full
      // browse/KEY URL render EXACTLY ONE anchor — nested <a><a> is structurally
      // impossible. `internalPath` is computed once here and reused in handleClick.
      const internalPath = tryInternalPath(href, linkCtx);
      const issueRouteMatch = internalPath?.match(/^\/issue\/([A-Z][A-Z0-9_]+-\d+)$/);
      if (issueRouteMatch) {
        return <IssueKeyLink issueKey={issueRouteMatch[1]} />;
      }
      const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        // Reuse the `internalPath` computed at render time — single source of truth.
        if (internalPath !== null) {
          breadcrumbPush(deriveSourceCrumb(location.pathname));
          navigate(internalPath);
          return;
        }
        openExternal(href);
      };
      // Resolved [^filename] attachment reference (preprocessJiraMarkup emits the
      // literal `wiki-attachment-chip` class — never user-controlled, T-sak-01).
      // The chip is still an external attachment URL, so it reuses `handleClick`
      // rather than forking its own click handling.
      const restProps = rest as Record<string, unknown>;
      const chipClassName = restProps.className;
      const isAttachmentChip =
        typeof chipClassName === 'string' &&
        chipClassName.split(/\s+/).includes('wiki-attachment-chip');
      if (isAttachmentChip) {
        const filename =
          typeof children === 'string'
            ? children
            : Array.isArray(children)
              ? children.filter((c): c is string => typeof c === 'string').join('')
              : '';
        const ChipIcon = getChipFileIcon(filename);
        return (
          <a
            href={href}
            onClick={handleClick}
            className="wiki-attachment-chip inline-flex items-center gap-1 rounded border bg-muted/40 px-1.5 py-0.5 text-xs no-underline hover:bg-muted"
          >
            <ChipIcon className="size-3.5 text-muted-foreground shrink-0" />
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
      // Preserve href on the rendered anchor for accessibility (right-click
      // "Copy link", screen readers, keyboard navigation). Wrapped in
      // LinkContextMenu via the render prop so no extra element is
      // introduced — this stays a single inline <a> (260827-f6e).
      return (
        <LinkContextMenu
          href={href}
          render={
            <a href={href} onClick={handleClick} {...rest}>
              {children}
            </a>
          }
        />
      );
    },
  };

  return (
    <article
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none break-words',
        // @tailwindcss/typography wraps <code> in literal ::before/::after backticks;
        // wiki {{mono}} spans are not markdown, so suppress them.
        'prose-code:before:content-none prose-code:after:content-none',
        // Default tier is set explicitly rather than inherited from prose-sm, so all
        // three density tiers sit on one monotonic scale. prose-sm's own defaults
        // (p my-4, leading 1.714) read looser than we want as the neutral baseline.
        'prose-p:my-3 prose-ul:my-3 prose-ol:my-3',
        'prose-li:my-0.5 prose-headings:mt-5 prose-headings:mb-2',
        '[&_p]:leading-relaxed [&_li]:leading-relaxed',
        'density-compact:prose-p:my-1.5 density-compact:prose-ul:my-1.5 density-compact:prose-ol:my-1.5',
        'density-compact:prose-li:my-0.5 density-compact:prose-headings:mt-4 density-compact:prose-headings:mb-1.5',
        'density-compact:prose-pre:p-2 density-compact:prose-td:py-1 density-compact:prose-th:py-1',
        'density-compact:[&_p]:leading-normal density-compact:[&_li]:leading-normal',
        'density-comfortable:prose-p:my-5 density-comfortable:prose-ul:my-5 density-comfortable:prose-ol:my-5',
        'density-comfortable:prose-li:my-1.5 density-comfortable:prose-headings:mt-7 density-comfortable:prose-headings:mb-3.5',
        'density-comfortable:prose-pre:p-4 density-comfortable:prose-td:py-3 density-comfortable:prose-th:py-3',
        'density-comfortable:[&_p]:leading-[1.8] density-comfortable:[&_li]:leading-[1.8]',
        className,
      )}
    >
      <Markdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        // T-54-07-01 mitigation: rehypeRaw passes raw HTML through to the
        // rehype tree; rehypeSanitize then strips dangerous tags before render.
        // Order matters: sanitize MUST run AFTER raw so it sees the parsed HTML.
        rehypePlugins={[
          rehypeRaw,
          // 260610-fnk: linkify bare active-project keys AFTER raw HTML is parsed
          // (so text nodes are present) and BEFORE sanitize (so the emitted
          // <issuekeylink> elements are kept by the allowlist).
          rehypeIssueKeys(activeJiraProject),
          rehypeDecodeInlineCodeEntities,
          [rehypeSanitize, wikiSanitizeSchema],
        ]}
        components={markdownComponents}
      >
        {markdown}
      </Markdown>
      {lightboxSrc && <ImageLightbox src={lightboxSrc} open onClose={() => setLightboxSrc(null)} />}
    </article>
  );
}
