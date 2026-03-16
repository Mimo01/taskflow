// @ts-expect-error — jira2md has no default export type declarations
import j2m from 'jira2md'
import { useState, type ComponentPropsWithoutRef } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { cn } from '@/lib/utils'
import { ImageLightbox } from './ImageLightbox'

interface WikiRendererProps {
  wikiText: string | null | undefined
  className?: string
}

/**
 * Pre-process Jira wiki markup that jira2md does not handle:
 * - User mentions: [~username] and [~accountId:xxx]
 * - Info/warning/note panels
 * - Panel blocks with optional title
 */
export function preprocessJiraMarkup(wiki: string): string {
  let result = wiki

  // Mentions: [~accountId:XXX] -> <mention>XXX</mention>
  result = result.replace(/\[~accountId:([^\]]+)\]/g, '<mention>$1</mention>')
  // Mentions: [~username] -> <mention>username</mention>
  result = result.replace(/\[~([^\]]+)\]/g, '<mention>$1</mention>')

  // Panels with title: {panel:title=TITLE}...{panel}
  result = result.replace(
    /\{panel:title=([^}]+)\}([\s\S]*?)\{panel\}/g,
    '<div data-callout="panel" data-title="$1">$2</div>',
  )
  // Panels without title: {panel}...{panel}
  result = result.replace(
    /\{panel\}([\s\S]*?)\{panel\}/g,
    '<div data-callout="panel">$1</div>',
  )

  // Info panels
  result = result.replace(
    /\{info\}([\s\S]*?)\{info\}/g,
    '<div data-callout="info">$1</div>',
  )

  // Warning panels
  result = result.replace(
    /\{warning\}([\s\S]*?)\{warning\}/g,
    '<div data-callout="warning">$1</div>',
  )

  // Note panels
  result = result.replace(
    /\{note\}([\s\S]*?)\{note\}/g,
    '<div data-callout="note">$1</div>',
  )

  return result
}

const calloutStyles: Record<string, string> = {
  info: 'border-l-4 border-blue-500 bg-blue-500/10 p-3 rounded-r-md my-2',
  warning: 'border-l-4 border-amber-500 bg-amber-500/10 p-3 rounded-r-md my-2',
  note: 'border-l-4 border-yellow-500 bg-yellow-500/10 p-3 rounded-r-md my-2',
  panel: 'border-l-4 border-border bg-muted/50 p-3 rounded-r-md my-2',
}

export function WikiRenderer({ wikiText, className }: WikiRendererProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const preprocessed = wikiText ? preprocessJiraMarkup(wikiText) : ''
  const markdown = preprocessed ? j2m.to_markdown(preprocessed) : ''

  // Components map includes 'mention' which is a custom HTML element not in
  // the standard Components type — use Record<string, unknown> intersection
  const markdownComponents: Record<string, unknown> = {
    img: ({ src, alt, ...rest }: ComponentPropsWithoutRef<'img'>) => (
      <img
        src={src}
        alt={alt ?? ''}
        className="max-w-full rounded-md cursor-pointer"
        onClick={() => src && setLightboxSrc(src)}
        {...rest}
      />
    ),
    div: ({ node, children, ...rest }: ComponentPropsWithoutRef<'div'> & { node?: unknown }) => {
      const props = rest as Record<string, unknown>
      const calloutType = props['data-callout'] as string | undefined
      if (calloutType && calloutStyles[calloutType]) {
        const title = props['data-title'] as string | undefined
        return (
          <div data-callout={calloutType} className={calloutStyles[calloutType]}>
            {title && <div className="font-bold mb-1">{title}</div>}
            {children}
          </div>
        )
      }
      return <div {...rest}>{children}</div>
    },
    // Custom element for <mention> tags produced by preprocessJiraMarkup
    mention: ({ children }: { children?: React.ReactNode }) => (
      <span className="mention-badge inline-flex items-center rounded-full bg-primary/15 text-primary px-2 py-0.5 text-xs font-medium">
        @{children}
      </span>
    ),
  }

  return (
    <article className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={markdownComponents}
      >
        {markdown}
      </Markdown>
      <ImageLightbox
        src={lightboxSrc ?? ''}
        open={lightboxSrc !== null}
        onClose={() => setLightboxSrc(null)}
      />
    </article>
  )
}
