import type { Dispatch } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useProjectFixVersions } from '@/hooks/useProjectFixVersions';
import { orderFixVersions } from '@/lib/fix-version-order';
import type { FormAction } from './useCreateEditForm';

interface FixVersionFieldProps {
  id: string;
  value: { id: string; name: string }[];
  dispatch: Dispatch<FormAction>;
  disabled?: boolean;
  /** Whether the modal is open; versions load while it is. */
  open: boolean;
}

/** Fix version multi-select (Popover) bound to FormState.fixVersions. */
export function FixVersionField({ id, value, dispatch, disabled, open }: FixVersionFieldProps) {
  const query = useProjectFixVersions(open);
  const selectedIds = new Set(value.map((v) => v.id));
  const ordered = orderFixVersions(query.data, selectedIds);

  const toggle = (version: { id: string; name: string }) => {
    const next = selectedIds.has(version.id)
      ? value.filter((v) => v.id !== version.id)
      : [...value, { id: version.id, name: version.name }];
    dispatch({ type: 'SET_FIELD', field: 'fixVersions', value: next });
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className="w-full justify-start font-normal"
          />
        }
      >
        {value.length > 0 ? (
          <span className="min-w-0 truncate">{value.map((v) => v.name).join(', ')}</span>
        ) : (
          <span className="text-muted-foreground">None</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2">
        {query.isLoading && (
          <p className="px-1 text-xs text-muted-foreground">Loading versions...</p>
        )}
        {query.isError && <p className="px-1 text-xs text-destructive">Failed to load versions</p>}
        {query.data && query.data.length === 0 && (
          <p className="px-1 text-xs text-muted-foreground">No versions found</p>
        )}
        {ordered.map((version) => (
          <button
            key={version.id}
            type="button"
            onClick={() => toggle(version)}
            className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-accent"
          >
            <span className="w-4 text-center">{selectedIds.has(version.id) ? '✓' : ''}</span>
            <span className="flex-1 truncate">{version.name}</span>
            {version.released && (
              <Badge
                variant="outline"
                className="h-3.5 border-green-300 bg-green-100 px-1 py-0 text-[9px] leading-none text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-400"
              >
                released
              </Badge>
            )}
            {!version.released && !version.releaseDate && (
              <Badge
                variant="outline"
                className="h-3.5 border-muted-foreground/30 px-1 py-0 text-[9px] leading-none text-muted-foreground"
              >
                no date
              </Badge>
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
