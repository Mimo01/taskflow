import { Milestone } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface ReleaseDescriptionProps {
  jiraDescription?: string | null;
  milestoneDescription?: string | null;
}

/**
 * Muted release description clamped to 2 lines (D-09). The GitLab milestone
 * description is shown only when it differs from the Jira one. A more/less
 * toggle appears only when the clamped text actually overflows.
 *
 * Markdown goes through ReactMarkdown + remark-gfm only (no rehype-raw, no
 * innerHTML) so API-sourced text cannot inject markup (T-94-07).
 */
export function ReleaseDescription({
  jiraDescription,
  milestoneDescription,
}: ReleaseDescriptionProps) {
  const jira = jiraDescription?.trim() ?? '';
  const milestoneRaw = milestoneDescription?.trim() ?? '';
  const milestone = milestoneRaw && milestoneRaw !== jira ? milestoneRaw : '';

  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  // Measure only while clamped: once expanded, scrollHeight === clientHeight,
  // and the toggle must stay so the user can collapse again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: jira/milestone re-trigger the measurement when the text changes
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => setOverflowing(el.scrollHeight > el.clientHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [expanded, jira, milestone]);

  if (!jira && !milestone) return null;

  return (
    <div className="flex max-w-[78ch] flex-col items-start gap-0.5">
      <div
        ref={ref}
        data-testid="release-description"
        className={cn(
          'max-w-[78ch] text-[13px] text-muted-foreground',
          !expanded && 'line-clamp-2',
        )}
      >
        {jira && <p className="whitespace-pre-wrap">{jira}</p>}
        {milestone && (
          <div className={cn(jira && 'mt-0.5')} title="GitLab milestone description">
            <Milestone
              aria-hidden="true"
              className="mr-1.5 inline size-3 -translate-y-px text-muted-foreground/70"
            />
            <div
              className={cn(
                expanded
                  ? 'block [&_p]:my-1 [&_ul]:my-1 [&_ul]:pl-4'
                  : 'inline [&_li]:inline [&_p]:inline [&_ul]:inline',
              )}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{milestone}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
      {(overflowing || expanded) && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {expanded ? 'less' : 'more'}
        </button>
      )}
    </div>
  );
}
