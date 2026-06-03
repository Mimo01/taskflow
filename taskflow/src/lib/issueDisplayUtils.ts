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
 * Severity-token → left-edge border color mapping, keyed by the filename of a
 * Jira priority icon URL (e.g. ".../priorities/major.svg" → "major").
 *
 * This is the PRIMARY mapping: it works for custom priority schemes whose display
 * names (e.g. "Must", "Should", "Critical", "Needed") are not the standard five.
 * Jira encodes severity in the icon filename even when admins rename priorities,
 * so it generalizes where the name-keyed PRIORITY_STRIPE map cannot.
 *
 * A graduated severity ramp (high → low) gives each icon token its own ordered,
 * distinct color rather than collapsing the top tiers onto a single red. Every
 * light shade clears WCAG ≥ 3:1 against the white light-mode card, and every dark
 * shade clears ≥ 3:1 against the dark-mode card (oklch 0.205 ≈ #171717):
 *
 *   blocker  → red-700  / red-400     (deepest red — top of the ramp)
 *   critical → red-600  / red-400
 *   major    → red-500  / red-500
 *   highest  → orange-600 / orange-400
 *   high     → amber-600  / amber-400
 *   medium   → yellow-700 / yellow-500
 *   low      → gray-500 / gray-400
 *   lowest   → gray-600 / gray-300
 *   minor    → gray-700 / gray-500
 *   trivial  → gray-700 / gray-500
 *
 * Note the ordering is tuned to this app's Jira priority scheme (Blocker > Must >
 * Critical > Should > High > … ), where `major` (Must) outranks `highest`
 * (Critical/Should). Custom priorities that share an icon (e.g. Critical and
 * Should both use highest.svg) are indistinguishable by color — that requires the
 * Jira priority scheme rank from REST /priority, deferred to a follow-up.
 *
 * Full static class strings only (Tailwind JIT) — same constraint as PRIORITY_STRIPE.
 */
const ICON_SEVERITY_STRIPE: Record<string, string> = {
  blocker: 'border-l-red-700 dark:border-l-red-400',
  critical: 'border-l-red-600 dark:border-l-red-400',
  major: 'border-l-red-500 dark:border-l-red-500',
  highest: 'border-l-orange-600 dark:border-l-orange-400',
  high: 'border-l-amber-600 dark:border-l-amber-400',
  medium: 'border-l-yellow-700 dark:border-l-yellow-500',
  low: 'border-l-gray-500 dark:border-l-gray-400',
  lowest: 'border-l-gray-600 dark:border-l-gray-300',
  minor: 'border-l-gray-700 dark:border-l-gray-500',
  trivial: 'border-l-gray-700 dark:border-l-gray-500',
};

/**
 * Neutral gray stripe for issues with no priority or an unmapped priority (D-03).
 * Never absent — every card gets a stripe.
 */
const DEFAULT_STRIPE = 'border-l-gray-600 dark:border-l-gray-300';

/**
 * Extract the severity token from a Jira priority icon URL.
 *
 * ".../images/icons/priorities/major.svg?v=2" → "major". Returns `''` when the
 * URL is absent or its filename is not a known severity token, so callers can
 * fall back to name-based mapping.
 */
export function prioritySeverityFromIcon(iconUrl: string | null | undefined): string {
  if (!iconUrl) return '';
  const path = iconUrl.split(/[?#]/)[0] ?? '';
  const file = path.substring(path.lastIndexOf('/') + 1).toLowerCase();
  const token = file.replace(/\.[a-z0-9]+$/, '');
  return token in ICON_SEVERITY_STRIPE ? token : '';
}

/**
 * Returns the border-l color class for a Jira priority.
 *
 * Resolution order (D-01/D-02/D-03, extended in Phase 76 for custom priority schemes):
 *   1. Icon severity (when given a priority object with an `iconUrl`) — handles
 *      renamed/custom priorities like "Must"/"Should"/"Needed".
 *   2. Standard priority name (PRIORITY_STRIPE) — Highest/High/Medium/Low/Lowest.
 *   3. Neutral gray default — null/undefined/unmapped.
 *
 * Accepts either a priority object `{ name, iconUrl }` (preferred — enables icon
 * mapping) or a bare name string (legacy name-only callers). Returns a color class
 * only — callers add `border-l-4` (width) separately per the UI-SPEC contract.
 */
export function priorityStripeClass(
  priority: { name?: string | null; iconUrl?: string | null } | string | null | undefined,
): string {
  if (priority == null) return DEFAULT_STRIPE;
  if (typeof priority === 'string') {
    return PRIORITY_STRIPE[priority] ?? DEFAULT_STRIPE;
  }
  const token = prioritySeverityFromIcon(priority.iconUrl);
  if (token) return ICON_SEVERITY_STRIPE[token];
  return PRIORITY_STRIPE[priority.name ?? ''] ?? DEFAULT_STRIPE;
}
