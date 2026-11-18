import { BookOpen, Bug, CheckSquare, CornerDownRight } from 'lucide-react';

interface IssueTypeIconProps {
  typeName: string;
  className?: string;
  /** Colour = status only: render every type in the muted foreground colour. */
  muted?: boolean;
  /** Keep the type colour inside menus whose highlight recolours descendants (Select items). */
  keepColor?: boolean;
}

const MUTED = 'text-muted-foreground';

export function IssueTypeIcon({
  typeName,
  className = 'w-3.5 h-3.5 shrink-0',
  muted = false,
  keepColor = false,
}: IssueTypeIconProps) {
  // Highlight rules like `focus:**:text-*` also recolour the SVG's <path>s (stroke is
  // currentColor per element), so kept colours pin the svg and make its children inherit.
  const c = (normal: string, kept: string) =>
    `${className} ${muted ? MUTED : keepColor ? `${kept} *:text-inherit!` : normal}`;
  switch (typeName) {
    case 'Bug':
    case 'Defect':
      return <Bug className={c('text-red-500', 'text-red-500!')} />;
    case 'Story':
      return <BookOpen className={c('text-green-600', 'text-green-600!')} />;
    case 'Subtask':
    case 'Sub-task':
      return <CornerDownRight className={c('text-blue-500', 'text-blue-500!')} />;
    case 'Epic':
      return <BookOpen className={c('text-purple-500', 'text-purple-500!')} />;
    default:
      return <CheckSquare className={c('text-blue-500', 'text-blue-500!')} />;
  }
}
