/**
 * Shared container-query tier classes for Today issue rows (In Progress + Up Next).
 *
 * Tiers key to the TodayColumn inner `@container` (content width, padding excluded).
 * As the column narrows the trailing cluster compacts in this order so the title keeps
 * a floor and the assignee avatar never disappears:
 *
 *   < 36rem  SP slot hidden
 *   < 32rem  time bar narrows w-24 -> w-16
 *   < 28rem  time bar hidden
 *   < 24rem  status pill compacts (no min width, capped + truncated)
 */

/** Title span: takes the free space but never collapses to zero. */
export const TODAY_TITLE_CLASS = 'flex-1 min-w-16 truncate text-sm';

export const TODAY_SP_SLOT_CLASS = '@max-[36rem]:hidden';

export const TODAY_TIME_BAR_WIDTH_CLASS = 'w-24 @max-[32rem]:w-16 @max-[28rem]:hidden';

export const TODAY_PILL_COMPACT_CLASS =
  '@max-[24rem]:min-w-0 @max-[24rem]:max-w-20 @max-[24rem]:truncate';

/** Trailing text label (review state / tag) on MR rows: dropped before the title shrinks. */
export const TODAY_ROW_TAG_CLASS = 'shrink-0 @max-[28rem]:hidden';
