/**
 * Priority ranking for the custom 9-level Jira priority scheme
 * (Blocker > Must > Critical > Should > High > Medium > Low > Lowest > Minor),
 * with the standard `Highest` placed between Critical and Should.
 * Lower rank = higher priority.
 */

const ORDER = [
  'Blocker',
  'Must',
  'Critical',
  'Highest',
  'Should',
  'High',
  'Medium',
  'Low',
  'Lowest',
  'Minor',
] as const;

const RANK: Record<string, number> = Object.fromEntries(
  ORDER.map((name, i) => [name.toLowerCase(), i]),
);

type PriorityLike = { name?: string | null; id?: string | null } | null | undefined;

export function priorityRank(priority: PriorityLike): number {
  if (!priority) return 1000;
  const known = priority.name ? RANK[priority.name.toLowerCase()] : undefined;
  if (known !== undefined) return known;
  if (priority.id != null && priority.id !== '' && Number.isFinite(Number(priority.id))) {
    return 100 + Number(priority.id);
  }
  return 999;
}

export function compareDefectPriority(a: PriorityLike, b: PriorityLike): number {
  return priorityRank(a) - priorityRank(b);
}
