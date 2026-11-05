import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Loader2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { PersonPicker, toPersonValue } from '@/components/ui/person-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CreatemetaField } from '@/services/jira';
import { fetchJiraUserByName } from '@/services/jira/users';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import type { SubtaskTemplateRow as SubtaskTemplateRowType } from '@/stores/subtask-templates.store';
import type { PlaceholderContext } from '../resolveRowPlaceholders';
import { resolveAssignee } from '../resolveRowPlaceholders';

// ── Types ────────────────────────────────────────────────────────────────────

export type RowStatus = 'pending' | 'creating' | 'created' | 'failed';

export interface RowState {
  status: RowStatus;
  createdKey?: string;
  error?: string;
}

interface SubtaskTemplateRowProps {
  row: SubtaskTemplateRowType;
  mode: 'settings' | 'preview';
  onChange: (patch: Partial<SubtaskTemplateRowType>) => void;
  onRemove: () => void;
  creatmetaFields?: CreatemetaField[];
  placeholderCtx?: PlaceholderContext;
  rowState?: RowState;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}

// ── Placeholder chip ─────────────────────────────────────────────────────────

function PlaceholderChip({
  value,
  hint,
}: {
  value: '@inherit' | '@current' | '@unassigned';
  hint: string;
}) {
  const chipBase =
    'inline-flex h-8 items-center gap-1 rounded-lg border border-transparent px-2.5 text-sm font-normal max-w-full min-w-0';

  if (value === '@inherit') {
    return (
      <span
        role="img"
        className={`${chipBase} bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300`}
        aria-label={`@inherit placeholder, resolved to ${hint.replace('@inherit → ', '')}`}
      >
        <span className="shrink-0">@inherit</span>
        {hint !== '@inherit' && (
          <span className="truncate text-muted-foreground">{hint.replace('@inherit', '')}</span>
        )}
      </span>
    );
  }

  if (value === '@current') {
    return (
      <span
        role="img"
        className={`${chipBase} bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300`}
        aria-label={`@current placeholder, resolved to ${hint.replace('@current → ', '')}`}
      >
        <span className="shrink-0">@current</span>
        {hint !== '@current' && (
          <span className="truncate text-muted-foreground">{hint.replace('@current', '')}</span>
        )}
      </span>
    );
  }

  // @unassigned
  return (
    <span
      role="img"
      className={`${chipBase} bg-muted text-muted-foreground`}
      aria-label="@unassigned placeholder"
    >
      @unassigned
    </span>
  );
}

// ── Advanced custom field item ────────────────────────────────────────────────

function AdvancedFieldItem({
  field,
  value,
  onChange,
  disabled,
}: {
  field: CreatemetaField;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const fid = field.fieldId;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={`adv-${fid}`} className="text-xs text-muted-foreground">
        {field.name}
      </label>
      {field.schema.allowedValues && field.schema.allowedValues.length > 0 ? (
        <Select value={value} onValueChange={(v) => onChange(v ?? '')}>
          <SelectTrigger id={`adv-${fid}`} className="h-7 w-full text-xs" disabled={disabled}>
            <SelectValue placeholder={`Select ${field.name}`} />
          </SelectTrigger>
          <SelectContent>
            {field.schema.allowedValues.map((av) => (
              <SelectItem key={av.id} value={av.id}>
                {av.value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={`adv-${fid}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.name}
          disabled={disabled}
          className="h-8 text-sm"
        />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SubtaskTemplateRow({
  row,
  mode,
  onChange,
  onRemove,
  creatmetaFields,
  placeholderCtx,
  rowState,
  dragHandleProps,
}: SubtaskTemplateRowProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const isDisabled = rowState?.status === 'creating' || rowState?.status === 'created';

  const isFailed = rowState?.status === 'failed';
  const isCreating = rowState?.status === 'creating';
  const isCreated = rowState?.status === 'created';

  // Assignee display
  const isPlaceholder =
    row.assignee === '@inherit' || row.assignee === '@current' || row.assignee === '@unassigned';

  const assigneeHint = placeholderCtx
    ? resolveAssignee(row.assignee, placeholderCtx).displayHint
    : row.assignee;

  const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl) ?? '';
  const activeJiraProject = useAuthStore((s) => s.activeJiraProject) ?? '';

  // Resolve a concrete username to display name + avatar for the trigger (cached forever).
  const concreteName = isPlaceholder || !row.assignee ? null : row.assignee;
  const userQuery = useQuery({
    queryKey: ['jira-user-by-name', jiraBaseUrl, concreteName],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !concreteName) return null;
      return fetchJiraUserByName(jiraBaseUrl, token, concreteName);
    },
    enabled: !!concreteName && !!jiraBaseUrl,
    staleTime: Infinity,
  });
  const resolvedUser = userQuery.data ? toPersonValue(userQuery.data) : null;

  const placeholderIds = ['@inherit', '@current', '@unassigned'] as const;
  const placeholderLabel = (id: (typeof placeholderIds)[number]) =>
    mode === 'preview' && placeholderCtx ? (
      <PlaceholderChip value={id} hint={resolveAssignee(id, placeholderCtx).displayHint} />
    ) : (
      id
    );

  const titleInvalid = row.title.trim() === '';

  return (
    <div className="flex flex-col">
      {/* Row container — Title on the first line, fields on the second */}
      <div
        className={[
          'flex flex-col gap-2 px-2.5 py-2.5 rounded-lg border border-transparent hover:border-border hover:bg-muted/40',
          isFailed ? 'bg-destructive/5' : '',
          isCreating ? 'opacity-70' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/* Title line */}
        <div className="flex items-center gap-2">
          {/* Drag handle — settings mode only */}
          {mode === 'settings' && (
            <button
              type="button"
              {...dragHandleProps}
              className="text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
              aria-label="Drag to reorder"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}

          {/* Title — required */}
          <Input
            className={[
              'flex-1 min-w-0',
              titleInvalid
                ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            placeholder="Subtask title"
            value={row.title}
            onChange={(e) => onChange({ title: e.target.value })}
            disabled={isDisabled}
            aria-required="true"
            aria-invalid={titleInvalid}
          />
        </div>

        {/* Fields line — aligned under the title; fields grow to fill the row */}
        <div className="flex flex-wrap items-end gap-3 pl-6">
          {/* Assignee selector */}
          <div className="flex flex-1 min-w-[8rem] flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Assignee</span>
            <PersonPicker
              variant="field"
              aria-label="Assignee"
              projectKey={activeJiraProject}
              jiraBaseUrl={jiraBaseUrl}
              value={
                concreteName
                  ? (resolvedUser ?? { name: concreteName, displayName: concreteName })
                  : null
              }
              extraOptions={placeholderIds.map((id) => ({ id, label: placeholderLabel(id) }))}
              selectedOptionId={isPlaceholder ? row.assignee : undefined}
              onSelectOption={(id) => onChange({ assignee: id })}
              onChange={(user) => user && onChange({ assignee: user.name })}
              triggerContent={
                isPlaceholder ? (
                  mode === 'preview' && placeholderCtx ? (
                    <PlaceholderChip
                      value={row.assignee as '@inherit' | '@current' | '@unassigned'}
                      hint={assigneeHint}
                    />
                  ) : (
                    <span className="truncate">{row.assignee}</span>
                  )
                ) : undefined
              }
              emptyLabel="Assignee"
              disabled={isDisabled}
            />
          </div>

          {/* Priority select */}
          <div className="flex flex-1 min-w-[8rem] flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Priority</span>
            <Select
              value={row.priority ?? ''}
              onValueChange={(v) => onChange({ priority: v || null })}
              disabled={isDisabled}
            >
              <SelectTrigger className="w-full h-8 text-sm">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                <SelectItem value="Blocker">Blocker</SelectItem>
                <SelectItem value="Critical">Critical</SelectItem>
                <SelectItem value="Major">Major</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Minor">Minor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Labels — multi-value comma-separated */}
          <div className="flex flex-1 min-w-[8rem] flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Labels</span>
            <Input
              className="w-full h-8 text-sm"
              value={row.labels.join(', ')}
              onChange={(e) =>
                onChange({
                  labels: e.target.value
                    .split(',')
                    .map((l) => l.trim())
                    .filter(Boolean),
                })
              }
              placeholder="comma,separated"
              disabled={isDisabled}
            />
          </div>

          {/* Estimate — compact; Due date & Story points live in Advanced */}
          <div className="flex w-24 shrink-0 flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Estimate</span>
            <Input
              className="w-full h-8 text-sm"
              value={row.timeEstimate}
              onChange={(e) => onChange({ timeEstimate: e.target.value })}
              placeholder="e.g. 2h"
              disabled={isDisabled}
            />
          </div>

          {/* Controls — aligned with the field inputs */}
          <div className="flex items-center gap-1 self-end">
            {/* Advanced toggle */}
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              className="shrink-0"
              aria-expanded={advancedOpen}
              aria-controls={`${row.id}-advanced`}
              onClick={() => setAdvancedOpen((o) => !o)}
            >
              {advancedOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>

            {/* Far-right control — mode-dependent */}
            {mode === 'settings' ? (
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                className="text-muted-foreground hover:text-destructive shrink-0"
                onClick={onRemove}
                aria-label="Remove row"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : (
              <div className="flex items-center justify-center gap-1 shrink-0">
                {isCreating && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                {isCreated && (
                  <CheckCircle2
                    className="size-4 text-green-600 dark:text-green-400"
                    role="img"
                    aria-label="Created"
                  />
                )}
                {isFailed && (
                  <AlertCircle className="size-4 text-destructive" role="img" aria-label="Failed" />
                )}
                {/* Pending/failed rows can be dropped; creating/created rows are locked */}
                {!isDisabled && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    type="button"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    onClick={onRemove}
                    aria-label="Remove row"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Advanced expand */}
      {advancedOpen && (
        <div
          id={`${row.id}-advanced`}
          className="flex flex-col gap-3 pl-4 pt-2 pb-3 rounded-b-md bg-muted/30 border-l-2 border-border"
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Advanced fields
          </p>

          {/* Due date — uncommon on subtasks, lives here */}
          <div className="flex flex-col gap-1">
            <label htmlFor={`${row.id}-duedate`} className="text-xs text-muted-foreground">
              Due date
            </label>
            <DatePicker
              id={`${row.id}-duedate`}
              className="text-sm"
              size="sm"
              value={row.duedate ?? ''}
              onChange={(v) => onChange({ duedate: v || null })}
              disabled={isDisabled}
              clearable
            />
          </div>

          {/* Story points — uncommon on subtasks, lives here */}
          <div className="flex flex-col gap-1">
            <label htmlFor={`${row.id}-storypoints`} className="text-xs text-muted-foreground">
              Story points
            </label>
            <Input
              id={`${row.id}-storypoints`}
              className="h-8 w-20 text-sm"
              type="number"
              min={0}
              value={row.storyPoints ?? ''}
              onChange={(e) =>
                onChange({
                  storyPoints: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              placeholder="SP"
              disabled={isDisabled}
            />
          </div>

          {/* Components multi-select (comma-separated IDs) */}
          <div className="flex flex-col gap-1">
            <label htmlFor={`${row.id}-components`} className="text-xs text-muted-foreground">
              Components
            </label>
            <Input
              id={`${row.id}-components`}
              className="h-8 text-sm"
              value={row.components.join(', ')}
              onChange={(e) =>
                onChange({
                  components: e.target.value
                    .split(',')
                    .map((c) => c.trim())
                    .filter(Boolean),
                })
              }
              placeholder="Component IDs (comma-separated)"
              disabled={isDisabled}
            />
          </div>

          {/* Createmeta-derived custom fields */}
          {creatmetaFields?.map((field) => (
            <AdvancedFieldItem
              key={field.fieldId}
              field={field}
              value={row.customFieldValues[field.fieldId] ?? ''}
              onChange={(v) =>
                onChange({
                  customFieldValues: {
                    ...row.customFieldValues,
                    [field.fieldId]: v,
                  },
                })
              }
              disabled={isDisabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}
