import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FormAction, IssueType } from './useCreateEditForm';

const ISSUE_TYPES = ['Story', 'Subtask', 'Bug'] as const;

interface IssueTypeSelectorProps {
  selectedIssueType: IssueType;
  defaultIssueType?: IssueType;
  dispatch: React.Dispatch<FormAction>;
}

export function IssueTypeSelector({
  selectedIssueType,
  defaultIssueType,
  dispatch,
}: IssueTypeSelectorProps) {
  if (defaultIssueType) {
    return (
      <div className="flex flex-col gap-1">
        {/* biome-ignore lint/a11y/noLabelWithoutControl: read-only display div, not a form control */}
        <label className="text-sm font-medium">Issue Type</label>
        <div className="flex h-9 w-full items-center rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
          {selectedIssueType}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="issue-type-select" className="text-sm font-medium">
        Issue Type
      </label>
      <Select
        value={selectedIssueType}
        onValueChange={(v) => dispatch({ type: 'SET_ISSUE_TYPE', issueType: v as IssueType })}
      >
        <SelectTrigger id="issue-type-select" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ISSUE_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
