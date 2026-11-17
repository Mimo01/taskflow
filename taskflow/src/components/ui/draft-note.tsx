import { cn } from '@/lib/utils';

const ACTION = 'py-1 underline-offset-2 hover:text-foreground hover:underline';

/** Muted draft / stale-base line under an editor (D-04, D-05). Always reserves its line. */
export function DraftNote({
  state,
  onDiscard,
  onUseJira,
  className,
}: {
  state: 'draft' | 'stale' | null;
  onDiscard: () => void;
  onUseJira: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-h-6 min-w-0 items-center gap-1 text-xs text-muted-foreground',
        className,
      )}
    >
      {state === 'draft' && (
        <>
          <span className="truncate">Draft saved</span>
          <span aria-hidden>·</span>
          <button type="button" className={ACTION} onClick={onDiscard}>
            Discard
          </button>
        </>
      )}
      {state === 'stale' && (
        <>
          <span className="truncate">Changed in Jira since your draft</span>
          <span aria-hidden>·</span>
          <button type="button" className={ACTION} onClick={onUseJira}>
            Use Jira version
          </button>
        </>
      )}
    </div>
  );
}
