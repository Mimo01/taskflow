import { BookOpen, Bug, CheckSquare, CornerDownRight } from 'lucide-react';

interface IssueTypeIconProps {
  typeName: string;
  className?: string;
  /** Colour = status only: render every type in the muted foreground colour. */
  muted?: boolean;
}

const MUTED = 'text-muted-foreground';

export function IssueTypeIcon({
  typeName,
  className = 'w-3.5 h-3.5 shrink-0',
  muted = false,
}: IssueTypeIconProps) {
  switch (typeName) {
    case 'Bug':
      return <Bug className={`${className} ${muted ? MUTED : 'text-red-500'}`} />;
    case 'Story':
      return <BookOpen className={`${className} ${muted ? MUTED : 'text-green-600'}`} />;
    case 'Subtask':
    case 'Sub-task':
      return <CornerDownRight className={`${className} ${muted ? MUTED : 'text-blue-500'}`} />;
    case 'Epic':
      return <BookOpen className={`${className} ${muted ? MUTED : 'text-purple-500'}`} />;
    default:
      return <CheckSquare className={`${className} ${muted ? MUTED : 'text-blue-500'}`} />;
  }
}
