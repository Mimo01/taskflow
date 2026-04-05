import type { ComponentType, ReactNode } from 'react';

interface Sprint {
  id: number;
  name: string;
  state?: string;
}

const activeBadgeClass =
  'ml-2 inline-flex items-center rounded-full bg-green-100 px-1.5 py-0 text-[10px] font-medium text-green-800 border border-green-300';

export interface SprintMoveMenuItemsProps {
  sprints: Sprint[];
  currentSprintId: number | null;
  showBacklog: boolean;
  onSelectSprint: (sprintId: number, sprintName: string) => void;
  onSelectBacklog?: () => void;
  /** Menu item component — must accept onClick and children */
  Item: ComponentType<{ onClick: () => void; children: ReactNode }>;
  /** Separator component */
  Separator: ComponentType;
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
  Separator,
  Label,
}: SprintMoveMenuItemsProps) {
  const targetSprints = sprints.filter(
    (s) => currentSprintId == null || s.id !== currentSprintId,
  );

  return (
    <>
      {targetSprints.length > 0 ? (
        targetSprints.map((sprint) => (
          <Item key={sprint.id} onClick={() => onSelectSprint(sprint.id, sprint.name)}>
            {sprint.name}
            {sprint.state === 'active' && <span className={activeBadgeClass}>Active</span>}
          </Item>
        ))
      ) : (
        <Label className="italic text-muted-foreground">No other sprints available</Label>
      )}
      {showBacklog && onSelectBacklog && (
        <>
          <Separator />
          <Item onClick={onSelectBacklog}>Backlog</Item>
        </>
      )}
    </>
  );
}
