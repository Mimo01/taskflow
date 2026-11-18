/**
 * Shared look for the Create/Edit modal's picker triggers. Matches PersonPicker's
 * `field` variant and the Select trigger: 32px, rounded-lg, input border, chevron at the end.
 */
export const FIELD_TRIGGER =
  'flex h-8 w-full items-center gap-1.5 rounded-lg border border-input bg-transparent pr-2 pl-2.5 text-left text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50';

/** Popover panel for modal pickers: at least 20rem, grows to the trigger, never past the viewport. */
export const FIELD_POPOVER = 'w-[max(20rem,var(--anchor-width))] max-w-(--available-width) p-2';

/** Scrolling result list inside a picker popover. */
export const FIELD_LIST = 'max-h-64 overflow-y-auto';

/** One result row; `bg-accent` marks the keyboard-active row. */
export const FIELD_ROW =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent';
