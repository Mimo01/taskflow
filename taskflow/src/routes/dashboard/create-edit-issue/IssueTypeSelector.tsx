import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FormAction, IssueType } from './useCreateEditForm';

const ISSUE_TYPES = ['Story', 'Subtask', 'Bug'] as const;
const ITEMS = ISSUE_TYPES.map((t) => ({ value: t, label: t }));

export const ISSUE_TYPE_CONTROL_ID = 'issue-type-select';

interface IssueTypeSelectorProps {
  selectedIssueType: IssueType;
  defaultIssueType?: IssueType;
  dispatch: React.Dispatch<FormAction>;
}

/**
 * First sidebar control of the Create modal. A locked type (opened from "Create Story"
 * etc.) renders read-only at the same height as the other sidebar controls.
 */
export function IssueTypeSelector({
  selectedIssueType,
  defaultIssueType,
  dispatch,
}: IssueTypeSelectorProps) {
  if (defaultIssueType) {
    return (
      <output
        id={ISSUE_TYPE_CONTROL_ID}
        className="flex h-8 w-full items-center gap-1.5 rounded-lg border bg-muted pl-2.5 pr-2 text-sm text-muted-foreground"
      >
        <IssueTypeIcon typeName={selectedIssueType} />
        {selectedIssueType}
      </output>
    );
  }

  return (
    <Select
      items={ITEMS}
      value={selectedIssueType}
      onValueChange={(v) => dispatch({ type: 'SET_ISSUE_TYPE', issueType: v as IssueType })}
    >
      <SelectTrigger id={ISSUE_TYPE_CONTROL_ID} className="w-full">
        <span className="flex items-center gap-1.5">
          <IssueTypeIcon typeName={selectedIssueType} />
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {ISSUE_TYPES.map((t) => (
          <SelectItem key={t} value={t}>
            <IssueTypeIcon typeName={t} />
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
