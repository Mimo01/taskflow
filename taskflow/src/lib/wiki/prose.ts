/**
 * Shared wiki prose + callout styles. Used by WikiRenderer and the rich editor view so
 * rendered output looks identical. Must import nothing (keeps it out of the editor chunk graph).
 * Class strings stay plain literals so the Tailwind scanner finds them.
 */

export const calloutStyles: Record<string, string> = {
  info: 'border-l-4 border-blue-500 bg-blue-500/10 p-3 rounded-r-md my-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
  tip: 'border-l-4 border-green-600 bg-green-600/10 p-3 rounded-r-md my-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
  warning:
    'border-l-4 border-amber-500 bg-amber-500/10 p-3 rounded-r-md my-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
  note: 'border-l-4 border-yellow-500 bg-yellow-500/10 p-3 rounded-r-md my-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
  panel:
    'border-l-4 border-border bg-muted/50 p-3 rounded-r-md my-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
};

export const WIKI_PROSE_CLASSES: string[] = [
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
  'density-compact:prose-td:py-1 density-compact:prose-th:py-1',
  'density-compact:[&_p]:leading-normal density-compact:[&_li]:leading-normal',
  'density-comfortable:prose-p:my-5 density-comfortable:prose-ul:my-5 density-comfortable:prose-ol:my-5',
  'density-comfortable:prose-li:my-1.5 density-comfortable:prose-headings:mt-7 density-comfortable:prose-headings:mb-3.5',
  'density-comfortable:prose-td:py-3 density-comfortable:prose-th:py-3',
  'density-comfortable:[&_p]:leading-[1.8] density-comfortable:[&_li]:leading-[1.8]',
];

// Code block frame/pre shared by the editor CodeBlockView and WikiRenderer. `not-prose` drops
// Typography's gray-200 pre colour; token colours live in index.css (.wiki-code, unlayered).
export const WIKI_CODE_FRAME =
  'not-prose wiki-code my-2 overflow-hidden rounded-md border border-border bg-muted/40';
export const WIKI_CODE_PRE =
  'm-0 overflow-x-auto bg-transparent p-3 font-mono text-xs leading-relaxed whitespace-pre text-foreground density-compact:p-2 density-comfortable:p-4';
