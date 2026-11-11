/**
 * Distinguishes "the board has no active sprint" from "you have no tasks in
 * the active sprint".
 *
 * fetchActiveSprint returns null both for "no sprint" and for a failed
 * request, which is why real items always win over the no-sprint signal.
 */
export const NO_ACTIVE_SPRINT_TITLE = 'No active sprint';

export type SprintScopeState = 'loading' | 'items' | 'no-sprint' | 'empty';

export function resolveSprintScopeState(args: {
  itemsLoading: boolean;
  hasItems: boolean;
  sprint: { noActiveSprint: boolean; isResolving: boolean };
}): SprintScopeState {
  const { itemsLoading, hasItems, sprint } = args;
  if (hasItems) return 'items';
  if (itemsLoading || sprint.isResolving) return 'loading';
  return sprint.noActiveSprint ? 'no-sprint' : 'empty';
}
