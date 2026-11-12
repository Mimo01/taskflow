// Hand-written placeholder fixtures mirroring the real release-note shapes
// (variants V1-V16). Generic wording only: no customer/company names.

export const V1_ADDED_FIXED = [
  '### Added',
  '- **Quick filter** — narrows the list as you type, across all columns',
  '',
  '### Fixed',
  '- **Stale badge** — the count now refreshes after a transition',
].join('\n');

export const V2_INNER_DASH =
  '### Added\n- **Board — time-in-column badge** — each card shows how long it has been there';

export const V3_NO_SEPARATOR =
  '### Changed\n- **Dashboard greeting** now handles long display names';

export const V4_NESTED = [
  '### Changed',
  '- **Issue detail — redesigned Changes tab:**',
  '  - **Grouping:** entries are grouped by day',
  '  - **Colours:** old and new values are plain text',
].join('\n');

export const V5_PLAIN_NO_BLANK = [
  '### Fixed',
  '- Worklogs: entry actions no longer overlap the row',
  '- Backlog: the empty state is centred',
].join('\n');

export const V6_LEAD_PARAGRAPH = [
  'Performance overhaul: every view now feels instant.',
  '',
  '### Added',
  '- **Virtual lists** — long tables render only visible rows',
].join('\n');

export const V7_LEAD_PLUS_BULLETS = [
  'A small maintenance release.',
  '- Tidied the settings page',
  '- Updated a few labels',
].join('\n');

export const V9_H2 =
  '## Added\n- **Example feature** — does a thing\n\n## Fixed\n- **Example fix**';

export const V10_STRIPPED_HEADINGS = [
  '- First group item',
  '- Second group item',
  '',
  '- Another group item',
].join('\n');

export const V11_COMMIT_SUBJECTS = [
  '- fix: handle empty list',
  '- feat: add small option',
  '- chore: tidy imports',
].join('\n');

export const V12_PROSE_TRAILER = [
  'Fix the thing that was broken in the sidebar and polish the spacing.',
  '',
  'Co-Authored-By: Example Bot <bot@example.com>',
].join('\n');

export const V13_LEADING_NEWLINE =
  '\nShort lead sentence.\n\n### Added\n- **Greeting** — says hello to a placeholder user';

export const V14_EMPTY = '';

export const V15_VERSION_HEADING = '## v2.0\n- New feature';

export const V16_INLINE_CODE =
  '### Fixed\n- **Literal `{{monospace}}` handling** — keeps braces intact';

/** The approved new-format example, verbatim. */
export const APPROVED_EXAMPLE = [
  'Notifications got a full redesign.',
  '',
  '### New',
  '- **Notification panel** — stacks per issue, quick actions',
  '- **Epic picker on stories**',
  '- **Searchable pickers** in Settings and setup',
  '',
  '### Improved',
  '- **Attachment tiles**',
  '- **No active sprint** messaging',
  '',
  '### Fixed',
  '- Duplicate notifications, package mismatches, peek over-scroll',
  '',
].join('\n');

/** A second new-format fixture, used by the legacy-render test. */
export const SECOND_NEW_FORMAT = [
  'Search got faster and calmer.',
  '',
  '### New',
  '- **Saved searches** — pin your favourites',
  '',
  '### Removed',
  '- **Old search bar**',
  '',
  '### Fixed',
  '- Result flicker, wrong highlight',
].join('\n');

/** 1.14.20-style wordy entry: no headline, long titles and details. */
export const WORDY_ENTRY = [
  '### Added',
  '- **Updates history now loads every release and groups them by minor version in collapsible groups** — each group can be opened to read the notes. The newest group is open by default; search works across all of it.',
  '- **Another long bullet title that goes on well past what anybody could call a title** — with a long detail that keeps going and going, and then some more; and more.',
  '',
  '### Fixed',
  '- **Fix one** — a long explanation of the first fix that is quite detailed. And a second sentence.',
  '- **Fix two** — a long explanation of the second fix that is quite detailed.',
  '- **Fix three** — a long explanation of the third fix that is quite detailed.',
  '- **Fix four** — a long explanation of the fourth fix that is quite detailed.',
].join('\n');
