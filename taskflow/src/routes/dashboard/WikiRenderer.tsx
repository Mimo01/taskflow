// @ts-expect-error — jira2md has no default export type declarations
import j2m from 'jira2md'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

interface WikiRendererProps {
  wikiText: string | null | undefined
  className?: string
}

export function WikiRenderer({ wikiText, className }: WikiRendererProps) {
  const markdown = wikiText ? j2m.to_markdown(wikiText) : ''
  return (
    <article className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
    </article>
  )
}
