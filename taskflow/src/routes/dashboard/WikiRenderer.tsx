// @ts-expect-error — jira2md has no default export type declarations

import { openUrl } from '@tauri-apps/plugin-opener';
import j2m from 'jira2md';
import { type ComponentPropsWithoutRef, type MouseEvent, useState } from 'react';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { AuthImage } from './AuthImage';
import { ImageLightbox } from './ImageLightbox';

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
  let result = wiki;

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
    // Custom element for <mention> tags produced by preprocessJiraMarkup
    mention: ({ children }: { children?: React.ReactNode }) => (
      <span className="mention-badge inline-flex items-center rounded-full bg-primary/15 text-primary px-2 py-0.5 text-xs font-medium">
        @{children}
      </span>
    ),
    // External link override (Plan 54-06 Finding 1 sub-issue): route external <a>
    // clicks through openUrl from @tauri-apps/plugin-opener so the Tauri webview
    // is not hijacked by Jira-wiki links (e.g. [name|https://...]). This applies
    // globally to ALL WikiRenderer surfaces — every caller had the same problem
    // (IssueDetailContent, InlineComment, IssueDetailPage, DescriptionEditor,
    // MergeRequestDetailPage, ActivityTimeline, plus AIO step content).
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
        rehypePlugins={[rehypeRaw]}
        components={markdownComponents}
      >
        {markdown}
      </Markdown>
      {lightboxSrc && <ImageLightbox src={lightboxSrc} open onClose={() => setLightboxSrc(null)} />}
    </article>
  );
}
