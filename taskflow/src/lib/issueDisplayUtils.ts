/**
 * Shared display primitives for Jira issue done-state and priority stripe styling.
 *
 * All components that render a done-state strikethrough or priority color stripe
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
 * WCAG-verified priority → left-edge border color mapping.
 *
 * Full static class strings required so Tailwind JIT scanner detects all classes.
 * Never use template literals (e.g. `border-l-${color}`) — they are invisible to the scanner.
 *
 * Palette verified at WCAG ≥ 3:1 contrast against bg-card in both light and dark modes.
 * Note: Medium uses yellow-700 (4.92:1) in light mode — yellow-500 (1.92:1) fails WCAG.
 */
const PRIORITY_STRIPE: Record<string, string> = {
  Highest: 'border-l-red-600 dark:border-l-red-400',
  High: 'border-l-orange-600 dark:border-l-orange-400',
  Medium: 'border-l-yellow-700 dark:border-l-yellow-500',
  Low: 'border-l-gray-500 dark:border-l-gray-400',
  Lowest: 'border-l-gray-600 dark:border-l-gray-300',
};

/**
 * Neutral gray stripe for issues with no priority or an unmapped priority (D-03).
 * Never absent — every card gets a stripe.
 */
const DEFAULT_STRIPE = 'border-l-gray-600 dark:border-l-gray-300';

/**
 * Returns the border-l color class for a given Jira priority name.
 *
 * Returns a color class only — callers must add `border-l-4` (width) separately
 * per the UI-SPEC contract. This separation allows subtask cards to keep their
 * existing `border-l-2 border-l-muted` nesting marker without interference.
 */
export function priorityStripeClass(priorityName: string | null | undefined): string {
  return PRIORITY_STRIPE[priorityName ?? ''] ?? DEFAULT_STRIPE;
}
