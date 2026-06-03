/**
 * BoardPicker — shared Jira scrum board selector (FB8-4).
 *
 * Used by the onboarding wizard (JiraStep) and Settings -> Connections to let
 * the user choose which scrum board a project consumes when several exist
 * (e.g. a near-duplicate "Copy of … Scrum Board"). Options are labelled
 * `name (id)` so visually-identical names stay distinguishable.
 *
 * State machine:
 * - isLoading           -> spinner + "Loading boards…"
 * - error               -> destructive message + Retry button (onRetry)
 * - boards.length === 0 -> render nothing (caller falls back to first board)
 * - boards.length === 1 -> read-only line + auto-select that board once
 * - boards.length  > 1  -> a Select dropdown
 */
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { JiraBoard } from '@/services/jira/sprints';

export interface BoardPickerProps {
  boards: JiraBoard[];
  value: number | null;
  onChange: (id: number) => void;
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export default function BoardPicker({
  boards,
  value,
  onChange,
  isLoading,
  error,
  onRetry,
}: BoardPickerProps) {
  // Auto-select the only board when a single board resolves. Driven off the
  // `value` prop (not a private ref) so it self-corrects across project switches:
  // if the current value doesn't match the only board, re-select it.
  const singleBoardId = boards.length === 1 ? boards[0].id : null;
  useEffect(() => {
    if (singleBoardId != null && value !== singleBoardId) {
      onChange(singleBoardId);
    }
  }, [singleBoardId, value, onChange]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading boards…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <span>{error}</span>
        {onRetry && (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    );
  }

  // No boards: render nothing — the caller's first-board fallback applies.
  if (boards.length === 0) return null;

  // Single board: read-only line (auto-selected via the effect above).
  if (boards.length === 1) {
    const board = boards[0];
    return (
      <div className="flex flex-col gap-1.5">
        <Label>Board</Label>
        <p className="text-sm text-muted-foreground">
          {board.name} ({board.id})
        </p>
      </div>
    );
  }

  // Multiple boards: a labelled Select so near-duplicate names are distinguishable.
  const selected = boards.find((b) => b.id === value);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="jira-board-picker">Board</Label>
      <Select
        value={value != null ? String(value) : ''}
        onValueChange={(v) => v && onChange(Number(v))}
      >
        <SelectTrigger id="jira-board-picker" className="w-full">
          <span className="flex flex-1 text-left text-sm">
            {selected ? (
              `${selected.name} (${selected.id})`
            ) : (
              <span className="text-muted-foreground">Choose a board…</span>
            )}
          </span>
        </SelectTrigger>
        <SelectContent>
          {boards.map((board) => (
            <SelectItem key={board.id} value={String(board.id)}>
              {board.name} ({board.id})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
