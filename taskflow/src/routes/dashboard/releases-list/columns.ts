/** Shared by the header strip, data rows and skeleton so columns line up. */
export const CELL_PADDING = 'py-2 density-compact:py-1 density-comfortable:py-3';

// Explicit-px flex-none cells with a flex-1 min-w-0 expander (WebKit 0-width collapse).
// The `@[720px]` variants need an `@container` OUTER wrapper, never the cell itself.
export const RELEASE_COL = {
  version: 'flex-1 min-w-0 pl-4 pr-2',
  package: 'flex-none w-44 px-2 hidden @[720px]:flex items-center',
  date: 'flex-none w-28 px-2 hidden @[720px]:flex items-center',
  status: 'flex-none w-28 px-2 flex items-center',
  issues: 'flex-none w-44 pl-2 pr-4 flex items-center',
} as const;
