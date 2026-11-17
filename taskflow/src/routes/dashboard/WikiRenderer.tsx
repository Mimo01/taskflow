import { useQuery } from '@tanstack/react-query';
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
import { SKIP, visit } from 'unist-util-visit';
import { LinkContextMenu } from '@/components/ui/link-context-menu';
import { tryInternalPath } from '@/lib/internalLinks';
import { doneSummaryClass } from '@/lib/issueDisplayUtils';
import { openExternal } from '@/lib/openExternal';
import { cn } from '@/lib/utils';
import {
  type AttachmentMap,
  type HastElement,
  type HastText,
  type UserMap,
  wikiRehypePlugins,
  wikiRemarkPlugins,
  wikiToMarkdown,
} from '@/lib/wiki';
import { calloutStyles, WIKI_PROSE_CLASSES } from '@/lib/wiki/prose';
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

interface WikiRendererProps {
  wikiText: string | null | undefined;
  className?: string;
  /** Attachment filename→URL map for resolving inline images */
  attachments?: AttachmentMap;
  /** Username/accountId→displayName map for resolving mentions */
  users?: UserMap;
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

  const markdown = wikiToMarkdown(wikiText, attachments, users);

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
    <article className={cn(WIKI_PROSE_CLASSES, className)}>
      <Markdown
        remarkPlugins={wikiRemarkPlugins}
        // Plugin order (raw, presentation, decode, sanitize) is defined once in
        // wikiRehypePlugins; rehypeIssueKeys is the presentation step.
        rehypePlugins={wikiRehypePlugins([rehypeIssueKeys(activeJiraProject)])}
        components={markdownComponents}
      >
        {markdown}
      </Markdown>
      {lightboxSrc && <ImageLightbox src={lightboxSrc} open onClose={() => setLightboxSrc(null)} />}
    </article>
  );
}
