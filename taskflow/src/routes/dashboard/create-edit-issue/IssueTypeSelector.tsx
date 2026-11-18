import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FormAction, IssueType } from './useCreateEditForm';

/** Types offered in Create issue. Subtasks are created only from a parent (no picker). */
const CREATE_TYPES = ['Story', 'Bug', 'Defect'] as const satisfies readonly IssueType[];

export const ISSUE_TYPE_CONTROL_ID = 'issue-type-select';

interface IssueTypeSelectorProps {
  selectedIssueType: IssueType;
  /** Issue type names the project offers; until loaded, every create type is shown. */
  availableTypeNames?: string[];
  dispatch: React.Dispatch<FormAction>;
}

/** First sidebar control of the Create modal (not rendered for subtasks). */
export function IssueTypeSelector({
  selectedIssueType,
  availableTypeNames,
  dispatch,
}: IssueTypeSelectorProps) {
  const types = CREATE_TYPES.filter(
    (t) => !availableTypeNames || availableTypeNames.includes(t) || t === selectedIssueType,
  );
  const items = types.map((t) => ({ value: t, label: t }));

  return (
    <Select
      items={items}
      value={selectedIssueType}
      onValueChange={(v) => dispatch({ type: 'SET_ISSUE_TYPE', issueType: v as IssueType })}
    >
      <SelectTrigger id={ISSUE_TYPE_CONTROL_ID} className="w-full">
        <span className="flex items-center gap-1.5">
          <IssueTypeIcon typeName={selectedIssueType} />
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {types.map((t) => (
          <SelectItem key={t} value={t}>
            <IssueTypeIcon typeName={t} keepColor />
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
