import { Milestone } from 'lucide-react';
import { type ComponentPropsWithoutRef, useLayoutEffect, useRef, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { openExternal } from '@/lib/openExternal';
import { cn } from '@/lib/utils';

/**
 * 94-REVIEW WR-07: a plain markdown `<a href>` navigates the Tauri webview away
 * from the app. Route links through openExternal (the app's sanctioned
 * external-URL boundary, as in WikiRenderer); in-document anchors and
 * href-less links stay plain. No styling change.
 */
const MARKDOWN_COMPONENTS: Components = {
  a: ({
    href,
    children,
    node: _node,
    ...rest
  }: ComponentPropsWithoutRef<'a'> & { node?: unknown }) => {
    if (!href || href.startsWith('#')) {
      return (
        <a href={href} {...rest}>
          {children}
        </a>
      );
    }
    return (
      <a
        href={href}
        {...rest}
        onClick={(e) => {
          e.preventDefault();
          openExternal(href);
        }}
      >
        {children}
      </a>
    );
  },
};

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
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                {milestone}
              </ReactMarkdown>
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
