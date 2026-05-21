import { BookOpen, Bug, CheckSquare, CornerDownRight } from 'lucide-react';

interface IssueTypeIconProps {
  typeName: string;
  className?: string;
}

export function IssueTypeIcon({ typeName, className = 'w-3.5 h-3.5 shrink-0' }: IssueTypeIconProps) {
  switch (typeName) {
    case 'Bug':
      return <Bug className={`${className} text-red-500`} />;
    case 'Story':
      return <BookOpen className={`${className} text-green-600`} />;
    case 'Subtask':
    case 'Sub-task':
      return <CornerDownRight className={`${className} text-blue-500`} />;
    case 'Epic':
      return <BookOpen className={`${className} text-purple-500`} />;
    default:
      return <CheckSquare className={`${className} text-blue-500`} />;
  }
}
