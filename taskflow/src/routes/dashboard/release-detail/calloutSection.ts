// Shared orange-callout look used by "Deployment package mismatches" and
// "Not covered by tasks above". Values are the ones DeploymentPackageSection
// has always used; the caller adds its own top margin (mt-6 / mt-4).

/** Callout container: orange accent bar + `@container` for the narrow-width breakpoints. */
export const CALLOUT_SECTION_CLASS =
  '@container border-l-[3px] border-orange-400 bg-orange-50/60 px-6 py-4 dark:border-orange-500/70 dark:bg-orange-500/[0.06]';
export const CALLOUT_TITLE_CLASS =
  'mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold';
export const CALLOUT_ICON_CLASS = 'size-3.5 text-orange-600 dark:text-orange-400';
export const CALLOUT_COUNT_CLASS =
  'rounded-full bg-orange-500/15 px-1.5 text-xs font-medium tabular-nums text-orange-700 dark:text-orange-300';
export const CALLOUT_HINT_CLASS = 'text-xs font-normal text-muted-foreground @max-[760px]:hidden';
export const CALLOUT_HEADER_CLASS =
  'flex items-center gap-3 border-b border-orange-200/70 px-2 py-1 text-xs font-medium text-muted-foreground @max-[860px]:gap-2 dark:border-orange-500/20';
export const CALLOUT_LIST_CLASS =
  'flex flex-col divide-y divide-orange-200/60 dark:divide-orange-500/15';
export const CALLOUT_ROW_CLASS =
  'flex min-h-8 min-w-0 items-center gap-3 px-2 @max-[860px]:gap-2 py-1 text-sm transition-colors hover:bg-orange-100/50 dark:hover:bg-orange-500/10';
export const CALLOUT_STATE_PILL_CLASS =
  'inline-flex items-center justify-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-400';
/** Warning-tone outline shared by Apply and "Apply ▾": same width, one clean edge. */
export const CALLOUT_APPLY_CLASS =
  'w-full justify-center border-orange-300 bg-background text-orange-700 hover:bg-orange-100 hover:text-orange-800 dark:border-orange-500/40 dark:bg-transparent dark:text-orange-300 dark:hover:bg-orange-500/15 dark:hover:text-orange-200';
export const CALLOUT_FIX_ACTION_COL = 'flex w-[4.75rem] flex-none justify-end';
export const CALLOUT_ERROR_CLASS = 'break-words px-2 pb-1.5 text-xs text-destructive';
export const CALLOUT_SHOW_ALL_CLASS =
  'mt-2 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline';
/** Rows shown before the "Show all N" toggle. */
export const CALLOUT_VISIBLE_ROWS = 5;
