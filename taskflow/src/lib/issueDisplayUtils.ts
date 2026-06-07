/**
 * Shared display primitives for Jira issue done-state and issue-type stripe styling.
 *
 * All components that render a done-state strikethrough or an issue-type color stripe
 * should use these utilities instead of local inline checks.
 *
 * Pure string utilities — no imports required.
 */

/**
 * Returns true if the given statusCategory represents a done state.
 * Single source of truth for `statusCategory?.key === 'done'` (D-07).
 */
export function isDoneStatus(statusCategory: { key: string } | null | undefined): boolean {
  return statusCategory?.key === 'done';
}

/**
 * Returns a Tailwind `line-through` class when the issue is done, empty string otherwise.
 *
 * Despite the name, this class is applied to the issue KEY element (not the summary text).
 * Name kept per roadmap export contract (D-06).
 */
export function doneSummaryClass(statusCategory: { key: string } | null | undefined): string {
  return isDoneStatus(statusCategory) ? 'line-through' : '';
}

/**
 * Issue-type → left-edge border color mapping (full literal Tailwind strings).
 *
 * Mirrors the color palette established in `IssueTypeIcon`
 * (src/components/ui/issue-type-icon.tsx): Bug=red, Story=green, Subtask=blue,
 * Epic=purple, default/Task=blue. Light + dark variants per class.
 *
 * The `subtask` flag is checked FIRST so renamed/custom subtask types (whose
 * display name is not "Subtask"/"Sub-task") still get the blue subtask color —
 * the flag is authoritative over the name (RESEARCH §4, jira.ts subtask flag).
 *
 * Returns a color class only — callers add `border-l-4` (width) separately.
 * Full static class strings only (Tailwind JIT) — never template-interpolated class names.
 */
export function issueTypeStripeClass(
  issuetype: { name?: string | null; subtask?: boolean } | null | undefined,
): string {
  const BLUE = 'border-l-blue-500 dark:border-l-blue-400';
  if (issuetype?.subtask) return BLUE;
  switch (issuetype?.name) {
    case 'Bug':
      return 'border-l-red-500 dark:border-l-red-400';
    case 'Story':
      return 'border-l-green-600 dark:border-l-green-400';
    case 'Subtask':
    case 'Sub-task':
      return BLUE;
    case 'Epic':
      return 'border-l-purple-500 dark:border-l-purple-400';
    default:
      return BLUE;
  }
}
