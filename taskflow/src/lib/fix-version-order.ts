import type { JiraFixVersion } from '@/services/jira/types';

/** Date desc; undated sort first when `undatedFirst`, otherwise last. */
function byDateDesc(undatedFirst: boolean) {
  return (a: JiraFixVersion, b: JiraFixVersion): number => {
    if (!a.releaseDate && !b.releaseDate) return a.name.localeCompare(b.name);
    if (!a.releaseDate) return undatedFirst ? -1 : 1;
    if (!b.releaseDate) return undatedFirst ? 1 : -1;
    return b.releaseDate.localeCompare(a.releaseDate);
  };
}

/**
 * Display order for fix-version pickers: unreleased (undated first, then date desc),
 * then the 10 most recent released versions plus any older selected released ones.
 */
export function orderFixVersions(
  all: readonly JiraFixVersion[] | undefined,
  selectedIds: ReadonlySet<string>,
): JiraFixVersion[] {
  if (!all || all.length === 0) return [];

  const unreleased = all.filter((v) => !v.released);
  const released = all.filter((v) => v.released).sort(byDateDesc(false));
  const recentReleased = released.slice(0, 10);
  const recentIds = new Set(recentReleased.map((v) => v.id));
  const selectedOlder = released.filter((v) => !recentIds.has(v.id) && selectedIds.has(v.id));

  return [
    ...[...unreleased].sort(byDateDesc(true)),
    ...[...recentReleased, ...selectedOlder].sort(byDateDesc(false)),
  ];
}
