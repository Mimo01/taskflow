import { Plus } from 'lucide-react';
import type { IssueLinkType } from '@/services/jira';
import { IssueLinkRow, type IssueLinkRowValue } from '../IssueLinkRow';
import type { FormAction } from './useCreateEditForm';

// ── Types ────────────────────────────────────────────────────────────────────

interface LinkRowsSectionProps {
  linkRows: IssueLinkRowValue[];
  linkTypes: IssueLinkType[];
  linkTypesLoading: boolean;
  isPending: boolean;
  dispatch: React.Dispatch<FormAction>;
}

// ── Component ────────────────────────────────────────────────────────────────

export function LinkRowsSection({
  linkRows,
  linkTypes,
  linkTypesLoading,
  isPending,
  dispatch,
}: LinkRowsSectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Issue Links</label>
        <button
          type="button"
          disabled={isPending || linkTypesLoading}
          aria-label="Add link"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          onClick={() =>
            dispatch({
              type: 'ADD_LINK_ROW',
              row: {
                id: crypto.randomUUID?.() ?? `link-${Date.now()}-${Math.random()}`,
                linkTypeId: '',
                issueKey: '',
              },
            })
          }
        >
          <Plus className="h-3 w-3" />
          Add link
        </button>
      </div>
      {linkRows.map((row) => (
        <IssueLinkRow
          key={row.id}
          linkTypes={linkTypes}
          value={row}
          onChange={(updated) => dispatch({ type: 'UPDATE_LINK_ROW', row: updated })}
          onRemove={() => dispatch({ type: 'REMOVE_LINK_ROW', id: row.id })}
        />
      ))}
    </div>
  );
}
