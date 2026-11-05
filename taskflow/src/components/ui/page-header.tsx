import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Container-query stages shared by every page header. They are measured on the PageHeader's own
 * width (it is the `@container`), so a drawer that narrows the content area triggers them too.
 *
 * - >= 52rem: secondary status text appears ("synced Nm ago", "Updated ...", last refreshed).
 * - >= 50rem: the Refresh button label appears (it collapses to icon-only first).
 * - >= 44rem: primary action button labels appear; below this, labelled buttons are icon-only.
 * - >= 34rem: the Standup WatchedPersonPicker shows its "Showing:" prefix and a wider name cap.
 * - below that the actions wrap under the title (flex-wrap), the only stacking allowed.
 *
 * Pair each `*Label` with its `*Button` class on a padded <Button> so the icon-only state is a
 * square (size-7, sm) instead of a wide rectangle that leaves empty padding around the icon.
 *
 * Kept as plain string literals so the Tailwind v4 source scan picks the classes up.
 */
export const headerSecondaryText = 'hidden @[52rem]:inline';
export const headerRefreshLabel = 'hidden @[50rem]:inline';
export const headerRefreshButton = '@max-[50rem]:w-7 @max-[50rem]:px-0';
export const headerActionLabel = 'hidden @[44rem]:inline';
export const headerActionButton = '@max-[44rem]:w-7 @max-[44rem]:px-0';

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
 * Only the title decides when the actions wrap: the subtitle has `contain: inline-size`, so it
 * adds nothing to the title block's intrinsic width and truncates instead of pushing the actions
 * onto a second line. The title block is `flex-auto` so it fills the row and the subtitle gets
 * all the room left of the actions. `truncate` on the h1 only kicks in once the title alone is
 * wider than the header.
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
        <div className="min-w-0 flex-auto">
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className={cn('truncate font-semibold', size === '3xl' ? 'text-3xl' : 'text-2xl')}>
              {title}
            </h1>
            {titleAside}
          </div>
          {subtitle ? (
            <div className="mt-1 min-w-0 truncate text-xs text-muted-foreground [contain:inline-size]">
              {subtitle}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex flex-none items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
