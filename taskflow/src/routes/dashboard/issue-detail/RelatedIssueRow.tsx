import { StackedTimeBar } from '@/components/jira/StackedTimeBar';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { statusPillClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import type { JiraIssue } from '@/services/jira';

/*
 * Responsive relationship row (Epic -> Stories, Story -> Subtasks, Subtask -> Parent).
 *
 * Stages are measured against the ROW width (the `@container` wrapper), not the viewport,
 * because IssueDetailContent renders in both the full page and the resizable PeekPanel
 * (default 480px = 30rem). Approximate fixed widths: key ~4.5rem, avatar 1.25rem, name <=9rem,
 * time bar 6rem, pill ~6rem, gaps + padding ~3rem. All columns together is ~30rem; without the
 * bar ~24rem. Showing the bar from 42rem and the name from 36rem keeps the summary at >= ~12rem
 * at every stage. Below 36rem only key + avatar + pill (~13rem) are fixed.
 * The avatar never drops. The `@container` sits on the wrapper, not the button, because
 * container variants never style the container element itself.
 */
export function RelatedIssueRow({
  issueKey,
  summary,
  assignee,
  statusName,
  statusCategoryKey,
  timeBarIssues,
  onClick,
  ariaLabel,
  buttonClassName,
}: {
  issueKey: string;
  summary: string;
  assignee?: { displayName: string; avatarUrls?: { '48x48'?: string } } | null;
  statusName?: string;
  statusCategoryKey?: string;
  timeBarIssues?: JiraIssue[];
  onClick: () => void;
  ariaLabel?: string;
  buttonClassName?: string;
}) {
  return (
    <div className="@container">
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={onClick}
        className={cn(
          'w-full flex items-center gap-2 px-2 rounded hover:bg-accent text-sm text-left cursor-pointer',
          'py-1.5 density-compact:py-1 density-comfortable:py-2.5',
          buttonClassName,
        )}
      >
        <span className="font-mono text-xs text-muted-foreground shrink-0">{issueKey}</span>
        <span className="flex-1 min-w-0 truncate">{summary}</span>
        {assignee && (
          <div className="flex items-center gap-1.5 shrink-0" title={assignee.displayName}>
            <CachedAvatar
              url={assignee.avatarUrls?.['48x48']}
              name={assignee.displayName}
              size={20}
            />
            <span className="hidden @[36rem]:block max-w-[9rem] truncate text-xs text-muted-foreground">
              {assignee.displayName}
            </span>
          </div>
        )}
        {timeBarIssues && (
          <span className="hidden @[42rem]:flex shrink-0">
            <StackedTimeBar
              issues={timeBarIssues}
              widthClassName="w-24"
              caption="none"
              testId="story-time-bar"
              alwaysShowTrack
            />
          </span>
        )}
        {statusName && <span className={statusPillClass(statusCategoryKey)}>{statusName}</span>}
      </button>
    </div>
  );
}
