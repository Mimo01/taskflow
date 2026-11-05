import { ChevronDown, UserX } from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useEffect, useState } from 'react';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { JiraAssignableUser } from '@/services/jira/types';
import { useAuthStore } from '@/stores/auth.store';
import { useAssignableUserSearch } from './use-assignable-user-search';

export interface PersonValue {
  name: string;
  displayName: string;
  avatarUrl?: string | null;
}

export function toPersonValue(user: JiraAssignableUser): PersonValue {
  return {
    name: user.name,
    displayName: user.displayName,
    avatarUrl:
      user.avatarUrls?.['48x48'] ?? user.avatarUrls?.['24x24'] ?? user.avatarUrls?.['16x16'],
  };
}

export interface PersonExtraOption {
  id: string;
  label: ReactNode;
  avatar?: ReactNode;
}

export interface PersonPickerPanelProps {
  value: PersonValue | null;
  onChange: (user: JiraAssignableUser | null) => void;
  jiraBaseUrl: string;
  projectKey?: string;
  issueKey?: string;
  /** Gates the user query and resets the filter text when it turns false. */
  open: boolean;
  allowUnassign?: boolean;
  showAssignToMe?: boolean;
  extraOptions?: PersonExtraOption[];
  selectedOptionId?: string;
  onSelectOption?: (id: string) => void;
  placeholder?: string;
  footer?: ReactNode;
  testIdPrefix?: string;
}

/** Popover body shared by every person-selection site (avatar rows, filter, shortcuts). */
export function PersonPickerPanel({
  value,
  onChange,
  jiraBaseUrl,
  projectKey,
  issueKey,
  open,
  allowUnassign,
  showAssignToMe,
  extraOptions = [],
  selectedOptionId,
  onSelectOption,
  placeholder = 'Filter users...',
  footer,
  testIdPrefix = 'assignee',
}: PersonPickerPanelProps) {
  const jiraUsername = useAuthStore((s) => s.jiraUsername);
  const jiraUserDisplayName = useAuthStore((s) => s.jiraUserDisplayName);
  const jiraUserAvatarUrl = useAuthStore((s) => s.jiraUserAvatarUrl);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(-1);
    }
  }, [open]);

  const { users, isLoading } = useAssignableUserSearch({
    jiraBaseUrl,
    projectKey,
    issueKey,
    query,
    enabled: open,
  });

  const term = query.trim().toLowerCase();
  const total = extraOptions.length + users.length;

  function selectIndex(i: number) {
    if (i < 0 || i >= total) return;
    if (i < extraOptions.length) onSelectOption?.(extraOptions[i].id);
    else onChange(users[i - extraOptions.length]);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (total === 0 ? -1 : Math.min(i + 1, total - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectIndex(activeIndex);
    }
    // Escape is handled by the Popover (closes without calling onChange).
  }

  function assignToMe() {
    if (!jiraUsername) return;
    onChange({
      name: jiraUsername,
      displayName: jiraUserDisplayName ?? jiraUsername,
      avatarUrls: jiraUserAvatarUrl ? { '48x48': jiraUserAvatarUrl } : undefined,
    });
  }

  const rowBase =
    'w-full text-left px-2 py-1 text-xs hover:bg-accent rounded flex items-center gap-2';

  return (
    <>
      {showAssignToMe && jiraUsername && value?.name !== jiraUsername && (
        <>
          <button
            data-testid={`${testIdPrefix}-assign-to-me`}
            type="button"
            onClick={assignToMe}
            className="text-left px-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            Assign to me →
            {jiraUserDisplayName && (
              <span className="text-muted-foreground ml-1">({jiraUserDisplayName})</span>
            )}
          </button>
          <div className="border-b border-border/40 my-2" />
        </>
      )}
      <Input
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        autoFocus
        className="h-7 text-xs mb-2"
      />
      {isLoading && <p className="text-xs text-muted-foreground px-1">Loading users...</p>}
      {!isLoading && total === 0 && (
        <p className="text-xs text-muted-foreground px-1">
          {query.trim() ? 'No users match' : 'No assignable users found'}
        </p>
      )}
      {allowUnassign && value && 'unassigned'.includes(term) && (
        <>
          <button
            data-testid={`${testIdPrefix}-unassign`}
            type="button"
            onClick={() => onChange(null)}
            className="w-full text-left px-2 py-1.5 text-xs rounded-md flex items-center gap-2 border border-dashed border-border bg-muted/40 text-muted-foreground hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive transition-colors cursor-pointer"
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-dashed border-current">
              <UserX className="size-3" aria-hidden="true" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-medium">Unassign</span>
              <span className="text-[11px] opacity-70">Remove {value.displayName}</span>
            </span>
          </button>
          <div className="border-b border-border/40 my-2" />
        </>
      )}
      <div className="max-h-64 overflow-y-auto">
        {extraOptions.map((opt, i) => (
          <button
            key={`opt-${opt.id}`}
            type="button"
            data-testid={`${testIdPrefix}-option-${opt.id}`}
            onClick={() => onSelectOption?.(opt.id)}
            className={cn(
              rowBase,
              selectedOptionId === opt.id && 'bg-accent/40',
              activeIndex === i && 'bg-accent',
            )}
          >
            {opt.avatar}
            <span className="truncate flex-1">{opt.label}</span>
          </button>
        ))}
        {users.map((user, j) => {
          const i = extraOptions.length + j;
          return (
            <button
              key={user.name}
              type="button"
              onClick={() => onChange(user)}
              className={cn(
                rowBase,
                !selectedOptionId && value?.name === user.name && 'bg-accent/40',
                activeIndex === i && 'bg-accent',
              )}
            >
              <CachedAvatar url={user.avatarUrls?.['48x48']} name={user.displayName} size={20} />
              <span className="truncate">{user.displayName}</span>
              <span className="ml-auto truncate text-[11px] text-muted-foreground">
                {user.name}
              </span>
            </button>
          );
        })}
      </div>
      {footer}
    </>
  );
}

export interface PersonPickerProps extends Omit<PersonPickerPanelProps, 'open'> {
  variant: 'inline' | 'field';
  /** Field variant height: matches SelectTrigger's `sm` / `default`. */
  size?: 'sm' | 'default';
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  triggerTestId?: string;
  triggerContent?: ReactNode;
  emptyLabel?: string;
  contentClassName?: string;
  title?: string;
}

export function PersonPicker({
  variant,
  size = 'default',
  disabled,
  id,
  'aria-label': ariaLabel,
  triggerTestId,
  triggerContent,
  emptyLabel = 'Unassigned',
  contentClassName,
  title,
  onChange,
  onSelectOption,
  ...panel
}: PersonPickerProps) {
  const [open, setOpen] = useState(false);
  const { value } = panel;

  const trigger =
    triggerContent ??
    (value ? (
      <>
        <CachedAvatar url={value.avatarUrl} name={value.displayName} size={20} />
        <span className={variant === 'field' ? 'truncate' : undefined}>{value.displayName}</span>
      </>
    ) : variant === 'inline' ? (
      <>
        <CachedAvatar url={null} name="Unassigned" size={20} />
        {emptyLabel}
      </>
    ) : (
      <span className="truncate text-muted-foreground">{emptyLabel}</span>
    ));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        aria-label={ariaLabel}
        data-testid={triggerTestId}
        title={title}
        disabled={disabled}
        className={
          variant === 'inline'
            ? 'hover:bg-accent rounded px-1 -ml-1 cursor-pointer text-left text-sm inline-flex items-center gap-1.5'
            : cn(
                'flex w-full items-center gap-1.5 rounded-lg border border-input bg-transparent pr-2 pl-2.5 text-left whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50',
                size === 'sm' ? 'h-7 text-xs' : 'h-8 text-sm',
              )
        }
      >
        {variant === 'field' ? (
          <span className="flex min-w-0 flex-1 items-center gap-1.5">{trigger}</span>
        ) : (
          trigger
        )}
        {variant === 'field' && <ChevronDown className="size-4 shrink-0 opacity-50" />}
      </PopoverTrigger>
      <PopoverContent align="start" className={cn('w-80 p-2', contentClassName)}>
        <PersonPickerPanel
          {...panel}
          open={open}
          onChange={(u) => {
            setOpen(false);
            onChange(u);
          }}
          onSelectOption={
            onSelectOption
              ? (optId) => {
                  setOpen(false);
                  onSelectOption(optId);
                }
              : undefined
          }
        />
      </PopoverContent>
    </Popover>
  );
}
