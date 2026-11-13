import { cn } from '@/lib/utils';

/**
 * Big title at the top of the scrolling content (page and peek). The key lives in the sticky
 * IssueDetailHeader, so it is only rendered here when `issueKey` is passed (header-less hosts).
 * The `<h2>` is the observation target for useScrolledPast: once it scrolls out of view the
 * header adds the compact title next to the key.
 */
export function IssueTitleBlock({
  issueKey,
  summary,
  size,
  titleRef,
}: {
  issueKey?: string;
  summary: string;
  size: 'page' | 'peek';
  titleRef?: (el: HTMLHeadingElement | null) => void;
}) {
  return (
    <div>
      {issueKey && <p className="text-xs font-mono text-muted-foreground mb-1">{issueKey}</p>}
      <h2
        ref={titleRef}
        className={cn(size === 'page' ? 'text-2xl' : 'text-xl', 'font-semibold leading-snug')}
      >
        {summary}
      </h2>
    </div>
  );
}
