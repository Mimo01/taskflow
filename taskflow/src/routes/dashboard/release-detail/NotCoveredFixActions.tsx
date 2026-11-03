import { ChevronDown, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { JiraIssue } from '@/services/jira';
import { CALLOUT_APPLY_CLASS } from './calloutSection';

/**
 * "Apply" for a Not-in-version row: adds the release fix version to the linked
 * task. One key renders a plain button; several render a per-key dropdown
 * (task keys can include stale/false-positive source-branch keys).
 */
export function ApplyFixVersionAction({
  keys,
  versionName,
  pendingKey,
  onApply,
}: {
  keys: string[];
  versionName: string;
  /** The key currently being applied for this row, if any. */
  pendingKey: string | undefined;
  onApply: (key: string) => void;
}) {
  if (keys.length === 0) return null;
  const isPending = pendingKey !== undefined;
  const spinner = isPending ? <Loader2 aria-hidden className="size-3 animate-spin" /> : null;

  if (keys.length === 1) {
    const label = `Add ${keys[0]} to ${versionName}`;
    return (
      <Button
        type="button"
        variant="outline"
        size="xs"
        className={CALLOUT_APPLY_CLASS}
        disabled={isPending}
        aria-label={label}
        title={label}
        onClick={() => onApply(keys[0])}
      >
        {spinner}
        Apply
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="xs"
            className={CALLOUT_APPLY_CLASS}
            disabled={isPending}
            aria-label="Choose a task"
            title="Choose a task"
          />
        }
      >
        {spinner}
        Apply
        <ChevronDown aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {keys.map((key) => (
          <DropdownMenuItem
            key={key}
            className="cursor-pointer text-xs"
            onClick={() => onApply(key)}
          >
            Add {key} to {versionName}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * "Link task" for a No-task row: a searchable picker over THIS release's
 * issues. The pick is reported to the caller, which prepends the key to the MR
 * title.
 */
export function LinkTaskAction({
  issues,
  pending,
  onPick,
}: {
  issues: JiraIssue[];
  pending: boolean;
  onPick: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="xs"
            className={CALLOUT_APPLY_CLASS}
            disabled={pending}
            title="Link a task from this release"
          />
        }
      >
        {pending ? <Loader2 aria-hidden className="size-3 animate-spin" /> : null}
        Link task
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <Command>
          <CommandInput placeholder="Search release issues…" />
          <CommandList>
            <CommandEmpty>No matching issue.</CommandEmpty>
            {issues.map((issue) => (
              <CommandItem
                key={issue.key}
                value={`${issue.key} ${issue.fields.summary}`}
                onSelect={() => {
                  setOpen(false);
                  onPick(issue.key);
                }}
              >
                <IssueTypeIcon
                  typeName={issue.fields.issuetype?.name ?? 'Story'}
                  className="size-3.5 flex-none"
                />
                <span className="flex-none font-mono text-xs">{issue.key}</span>
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {issue.fields.summary}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
