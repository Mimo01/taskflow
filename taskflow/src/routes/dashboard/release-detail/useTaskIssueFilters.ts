import type React from 'react';
import { useCallback, useState } from 'react';
import { toggleFilterValues } from './taskTableFilters';

export type TaskIssueDimension = 'statuses' | 'types' | 'assignees';

type SetAction = React.SetStateAction<Set<string>>;

export interface TaskIssueFilterState {
  statuses: Set<string>;
  types: Set<string>;
  assignees: Set<string>;
  setStatuses: React.Dispatch<SetAction>;
  setTypes: React.Dispatch<SetAction>;
  setAssignees: React.Dispatch<SetAction>;
  /** Group toggle: all values present -> remove them, otherwise add them. */
  toggle: (dim: TaskIssueDimension, values: string[]) => void;
}

interface Stored {
  scope: string | undefined;
  statuses: Set<string>;
  types: Set<string>;
  assignees: Set<string>;
}

const empty = (scope: string | undefined): Stored => ({
  scope,
  statuses: new Set(),
  types: new Set(),
  assignees: new Set(),
});

/**
 * Release-scoped status/type/assignee filters of the Issues table, lifted so the
 * breakdown graphs can toggle them (261102-vuw). The page does not remount
 * between releases, so a stale scope reads as empty (no effect, no flash).
 */
export function useTaskIssueFilters(scope?: string): TaskIssueFilterState {
  const [state, setState] = useState<Stored>(() => empty(scope));
  const current = state.scope === scope ? state : empty(scope);

  const make = useCallback(
    (dim: TaskIssueDimension): React.Dispatch<SetAction> =>
      (action) =>
        setState((prev) => {
          const base = prev.scope === scope ? prev : empty(scope);
          const next = typeof action === 'function' ? action(base[dim]) : action;
          return { ...base, [dim]: next };
        }),
    [scope],
  );

  const setStatuses = make('statuses');
  const setTypes = make('types');
  const setAssignees = make('assignees');

  const toggle = (dim: TaskIssueDimension, values: string[]) =>
    make(dim)((prev) => toggleFilterValues(prev, values));

  return {
    statuses: current.statuses,
    types: current.types,
    assignees: current.assignees,
    setStatuses,
    setTypes,
    setAssignees,
    toggle,
  };
}
