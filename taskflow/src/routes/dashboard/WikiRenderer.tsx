// @ts-expect-error — jira2md has no default export type declarations
import j2m from 'jira2md'
import { useState, type ComponentPropsWithoutRef } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { cn } from '@/lib/utils'
import { ImageLightbox } from './ImageLightbox'
import { AuthImage } from './AuthImage'

/** Map from filename → full URL for resolving Jira !filename.png! references */
export type AttachmentMap = Record<string, string>

/** Map from username/accountId → display name for resolving [~user] mentions */
export type UserMap = Record<string, string>

interface WikiRendererProps {
  wikiText: string | null | undefined
  className?: string
  /** Attachment filename→URL map for resolving inline images */
  attachments?: AttachmentMap
  /** Username/accountId→displayName map for resolving mentions */
  users?: UserMap
}

/**
 * Pre-process Jira wiki markup that jira2md does not handle:
 * - User mentions: [~username] and [~accountId:xxx]
 * - Info/warning/note panels
 * - Panel blocks with optional title
 * - Inline images: !filename.png! → resolved via attachment map
 */
export function preprocessJiraMarkup(wiki: string, attachments?: AttachmentMap, users?: UserMap): string {
  let result = wiki

  // Images: !filename.png|options! or !filename.png! → resolve via attachment map
  // Must run BEFORE jira2md which also handles !...! syntax
  if (attachments && Object.keys(attachments).length > 0) {
    result = result.replace(/!([^!\n]+?)(?:\|[^!]*)?\!/g, (_match, ref: string) => {
      // If it's already a full URL, keep it
      if (ref.startsWith('http://') || ref.startsWith('https://')) {
        return `!${ref}!`
      }
      // Look up in attachment map
      const url = attachments[ref]
      if (url) {
        return `!${url}!`
      }
      // Not found — leave as-is for jira2md
      return `!${ref}!`
    })
  }

  // Mentions: [~accountId:XXX] -> <mention data-id="XXX">DisplayName</mention>
  result = result.replace(/\[~accountId:([^\]]+)\]/g, (_match, id: string) => {
    const name = users?.[id] ?? id
    return `<mention data-id="${id}">${name}</mention>`
  })
  // Mentions: [~username] -> <mention data-id="username">DisplayName</mention>
  result = result.replace(/\[~([^\]]+)\]/g, (_match, username: string) => {
    const name = users?.[username] ?? username
    return `<mention data-id="${username}">${name}</mention>`
  })

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

export function WikiRenderer({ wikiText, className, attachments, users }: WikiRendererProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const preprocessed = wikiText ? preprocessJiraMarkup(wikiText, attachments, users) : ''
  const markdown = preprocessed ? j2m.to_markdown(preprocessed) : ''

  // Components map includes 'mention' which is a custom HTML element not in
  // the standard Components type — use Record<string, unknown> intersection
  const markdownComponents: Record<string, unknown> = {
    img: ({ src, alt }: ComponentPropsWithoutRef<'img'>) => (
      <AuthImage
        src={src ?? ''}
        alt={alt ?? ''}
        className="max-w-full rounded-md cursor-pointer"
        onClick={() => src && setLightboxSrc(src)}
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
