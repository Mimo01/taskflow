import type { ComponentType, ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';

interface Sprint {
  id: number;
  name: string;
  state?: string;
}

export interface SprintMoveMenuItemsProps {
  sprints: Sprint[];
  currentSprintId: number | null;
  showBacklog: boolean;
  onSelectSprint: (sprintId: number, sprintName: string) => void;
  onSelectBacklog?: () => void;
  /** Menu item component — must accept onClick and children */
  Item: ComponentType<{ onClick: () => void; children: ReactNode }>;
  /** Label component for empty state — must accept className and children */
  Label: ComponentType<{ className?: string; children: ReactNode }>;
}

export function SprintMoveMenuItems({
  sprints,
  currentSprintId,
  showBacklog,
  onSelectSprint,
  onSelectBacklog,
  Item,
  Label,
}: SprintMoveMenuItemsProps) {
  const targetSprints = sprints.filter((s) => currentSprintId == null || s.id !== currentSprintId);

  return (
    <>
      {targetSprints.length > 0 ? (
        targetSprints.map((sprint) => (
          <Item key={sprint.id} onClick={() => onSelectSprint(sprint.id, sprint.name)}>
            {sprint.name}
            {sprint.state === 'active' && (
              <Badge tone="green" className="ml-2">
                Active
              </Badge>
            )}
          </Item>
        ))
      ) : (
        <Label className="italic text-muted-foreground">No other sprints available</Label>
      )}
      {showBacklog && onSelectBacklog && <Item onClick={onSelectBacklog}>Backlog</Item>}
    </>
  );
}
