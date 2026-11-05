import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Container-query stages shared by every page header. They are measured on the PageHeader's own
 * width (it is the `@container`), so a drawer that narrows the content area triggers them too.
 *
 * - >= 52rem: secondary status text appears ("synced Nm ago", "Updated ...", last refreshed).
 * - >= 44rem: action button text labels appear; below this, labelled buttons are icon-only.
 * - >= 30rem: the Standup WatchedPersonPicker shows its "Showing:" prefix and a wider name cap.
 * - below that the actions wrap under the title (flex-wrap), the only stacking allowed.
 *
 * Kept as plain string literals so the Tailwind v4 source scan picks the classes up.
 */
export const headerSecondaryText = 'hidden @[52rem]:inline';
export const headerActionLabel = 'hidden @[44rem]:inline';

interface PageHeaderProps {
  title: string;
  /** Muted line under the title. Its presence switches the title to text-3xl. */
  subtitle?: ReactNode;
  /** Inline adornment after the title (e.g. a mono project key). */
  titleAside?: ReactNode;
  actions?: ReactNode;
  /** Overrides the subtitle-derived title size. */
  titleSize?: '2xl' | '3xl';
  className?: string;
  'data-testid'?: string;
}

/**
 * The standard main-page header bar: title top-left, actions on the right, one line at every
 * width. `@container` sits on the outer element and padding on the inner row, because container
 * queries measure the content box and variants never style the container itself.
 *
 * The wrap happens before the truncate: flex-wrap breaks lines using each item's max-content
 * size, so the actions drop to a second line before the title is forced to ellipsize. `truncate`
 * only applies once the title alone is wider than the header.
 */
export function PageHeader({
  title,
  subtitle,
  titleAside,
  actions,
  titleSize,
  className,
  'data-testid': testId,
}: PageHeaderProps) {
  const size = titleSize ?? (subtitle ? '3xl' : '2xl');
  return (
    <header
      data-testid={testId}
      className={cn('@container shrink-0 border-b border-border', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className={cn('truncate font-semibold', size === '3xl' ? 'text-3xl' : 'text-2xl')}>
              {title}
            </h1>
            {titleAside}
          </div>
          {subtitle ? (
            <div className="mt-1 min-w-0 truncate text-xs text-muted-foreground">{subtitle}</div>
          ) : null}
        </div>
        {actions ? <div className="flex flex-none items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
