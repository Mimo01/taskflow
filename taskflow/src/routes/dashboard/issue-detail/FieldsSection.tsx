import type { UseMutationResult } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/apiFetch';
import { epicColorToTailwind } from '@/lib/epicColors';
import type { JiraIssueDetail } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { MetaRow } from './MetaRow';
import { useDebounce } from './useFieldMutation';
import { extractSprintName } from './utils';

const PRIORITY_OPTIONS = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];

interface AssignableUser {
  displayName: string;
  name: string;
  avatarUrls?: { '48x48'?: string };
}

interface FieldsSectionProps {
  issue: JiraIssueDetail;
  issueKey: string;
  jiraBaseUrl: string;
  storyPointsFieldKey: string;
  epicLinkFieldKey: string;
  epicNameFieldKey: string;
  sprintFieldKey: string;
  epicColorFieldKey: string;
  mutation: UseMutationResult<unknown, Error, { fieldName: string; value: unknown }>;
  epicIssue: { fields: { summary: string; [k: string]: unknown } } | null | undefined;
  onOpenIssue?: (key: string) => void;
}

export function FieldsSection({
  issue,
  issueKey,
  jiraBaseUrl,
  storyPointsFieldKey,
  epicLinkFieldKey,
  sprintFieldKey,
  epicColorFieldKey,
  mutation,
  epicIssue,
  epicNameFieldKey,
  onOpenIssue,
}: FieldsSectionProps) {
  const f = issue.fields;
  const isEpic = f.issuetype.name === 'Epic';
  const isSubtask = f.issuetype.subtask;
  const isStory = !isEpic && !isSubtask;

  const storyPoints = f[storyPointsFieldKey] as number | null;
  const epicLink = isStory ? (f[epicLinkFieldKey] as string | null) : null;
  const rawSprint = f[sprintFieldKey] as unknown;
  const sprintName = extractSprintName(rawSprint);

  // Priority edit state
  const [priorityEditing, setPriorityEditing] = useState(false);

  // Story points edit state
  const [spEditing, setSpEditing] = useState(false);
  const [spInput, setSpInput] = useState('');
  const spOriginal = useRef<number | null>(null);

  // Assignee edit state
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [assigneeQuery, setAssigneeQuery] = useState('');
  const [assigneeResults, setAssigneeResults] = useState<AssignableUser[]>([]);
  const [assigneeLoading, setAssigneeLoading] = useState(false);

  // Labels add state
  const [labelInput, setLabelInput] = useState('');
  const [labelAdding, setLabelAdding] = useState(false);

  // Assignee search with debounce
  const doSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setAssigneeResults([]);
        return;
      }
      setAssigneeLoading(true);
      try {
        const token = await readSecret('jira-pat').catch(() => null);
        if (!token) return;
        const url = `${jiraBaseUrl.replace(/\/$/, '')}/rest/api/2/user/assignable/search?issueKey=${issueKey}&query=${encodeURIComponent(query)}`;
        const resp = await apiFetch('jira', url, {
          headers: { Authorization: `Bearer ${token}` },
        }, 'Load Fields');
        if (resp.ok) {
          const data = (await resp.json()) as AssignableUser[];
          setAssigneeResults(data);
        }
      } catch {
        // ignore
      } finally {
        setAssigneeLoading(false);
      }
    },
    [jiraBaseUrl, issueKey],
  );

  const debouncedSearch = useDebounce(doSearch, 300);

  function handlePriorityChange(value: string | null) {
    if (!value) return;
    setPriorityEditing(false);
    mutation.mutate({ fieldName: 'priority', value: { name: value } });
  }

  function startSpEdit() {
    spOriginal.current = storyPoints;
    setSpInput(storyPoints != null ? String(storyPoints) : '');
    setSpEditing(true);
  }

  function commitSpEdit() {
    setSpEditing(false);
    const num = Number(spInput);
    if (!Number.isNaN(num) && num !== spOriginal.current) {
      mutation.mutate({ fieldName: storyPointsFieldKey, value: num });
    }
  }

  function cancelSpEdit() {
    setSpEditing(false);
  }

  function handleAssigneeSelect(user: AssignableUser) {
    setAssigneeOpen(false);
    setAssigneeQuery('');
    setAssigneeResults([]);
    // DC format: { name: username } -- NOT { accountId }
    mutation.mutate({ fieldName: 'assignee', value: { name: user.name } });
  }

  function handleLabelAdd() {
    const trimmed = labelInput.trim();
    if (!trimmed) return;
    const currentLabels = f.labels ?? [];
    mutation.mutate({ fieldName: 'labels', value: [...currentLabels, trimmed] });
    setLabelInput('');
    setLabelAdding(false);
  }

  function handleLabelRemove(label: string) {
    const currentLabels = f.labels ?? [];
    mutation.mutate({ fieldName: 'labels', value: currentLabels.filter((l) => l !== label) });
  }

  const epicName = epicIssue
    ? ((epicIssue.fields[epicNameFieldKey] as string | null) ?? epicIssue.fields.summary)
    : null;

  return (
    <>
      <MetaRow label="Status">
        <Badge variant="outline">{f.status.name}</Badge>
      </MetaRow>

      {/* Priority -- click to edit with Select */}
      <MetaRow label="Priority">
        {priorityEditing ? (
          <div>
            <Select
              value={f.priority?.name ?? ''}
              onValueChange={handlePriorityChange}
              open
              onOpenChange={(open) => {
                if (!open) setPriorityEditing(false);
              }}
            >
              <SelectTrigger size="sm" className="h-6 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {mutation.isError && (
              <p className="text-xs text-destructive mt-1">Save failed — changes reverted</p>
            )}
          </div>
        ) : (
          <button
            data-testid="priority-edit"
            type="button"
            onClick={() => setPriorityEditing(true)}
            className="hover:bg-accent rounded px-1 -ml-1 cursor-pointer text-left"
            title="Click to edit priority"
          >
            {f.priority?.name ?? '—'}
          </button>
        )}
      </MetaRow>

      {/* Assignee -- click to open typeahead popover */}
      <MetaRow label="Assignee">
        <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
          <PopoverTrigger
            data-testid="assignee-edit"
            className="hover:bg-accent rounded px-1 -ml-1 cursor-pointer text-left text-sm"
            title="Click to change assignee"
          >
            {f.assignee?.displayName ?? 'Unassigned'}
          </PopoverTrigger>
          <PopoverContent className="w-60 p-2">
            <Input
              placeholder="Search users..."
              value={assigneeQuery}
              onChange={(e) => {
                setAssigneeQuery(e.target.value);
                debouncedSearch(e.target.value);
              }}
              autoFocus
              className="h-7 text-xs mb-2"
            />
            {assigneeLoading && <p className="text-xs text-muted-foreground px-1">Searching...</p>}
            {!assigneeLoading && assigneeResults.length === 0 && assigneeQuery.trim() && (
              <p className="text-xs text-muted-foreground px-1">No users found</p>
            )}
            {assigneeResults.map((user) => (
              <button
                key={user.name}
                type="button"
                onClick={() => handleAssigneeSelect(user)}
                className="w-full text-left px-2 py-1 text-xs hover:bg-accent rounded"
              >
                {user.displayName}
              </button>
            ))}
            {mutation.isError && (
              <p className="text-xs text-destructive mt-1">Save failed — changes reverted</p>
            )}
          </PopoverContent>
        </Popover>
      </MetaRow>

      <MetaRow label="Reporter">{f.reporter?.displayName ?? '—'}</MetaRow>

      {/* Story Points -- stories only */}
      {isStory && (
        <MetaRow label="Story Points">
          {spEditing ? (
            <div>
              <Input
                type="number"
                min={0}
                max={999}
                value={spInput}
                onChange={(e) => setSpInput(e.target.value)}
                onBlur={commitSpEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitSpEdit();
                  if (e.key === 'Escape') cancelSpEdit();
                }}
                autoFocus
                className="h-6 w-20 text-xs"
              />
              {mutation.isError && (
                <p className="text-xs text-destructive mt-1">Save failed — changes reverted</p>
              )}
            </div>
          ) : (
            <button
              data-testid="story-points-edit"
              type="button"
              onClick={startSpEdit}
              className="hover:bg-accent rounded px-1 -ml-1 cursor-pointer text-left"
              title="Click to edit story points"
            >
              {storyPoints != null ? String(storyPoints) : '—'}
            </button>
          )}
        </MetaRow>
      )}

      {/* Epic -- stories only: key + name with color, navigable */}
      {isStory && (
        <MetaRow label="Epic">
          {epicLink
            ? (() => {
                const epicColor = (epicIssue?.fields[epicColorFieldKey] as string | null) ?? null;
                const colorResult = epicColorToTailwind(epicColor, epicLink);
                return (
                  <button
                    type="button"
                    onClick={() => onOpenIssue?.(epicLink)}
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium hover:opacity-80 transition-opacity ${colorResult.className}`}
                    style={colorResult.style}
                  >
                    {epicName || epicLink}
                  </button>
                );
              })()
            : '—'}
        </MetaRow>
      )}

      {/* Color -- epics only: show color swatch */}
      {isEpic &&
        (() => {
          const epicColor = f[epicColorFieldKey] as string | null;
          const colorResult = epicColorToTailwind(epicColor, issue.key);
          return (
            <MetaRow label="Color">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colorResult.className}`}
                style={colorResult.style}
              >
                {epicColor ?? 'Default'}
              </span>
            </MetaRow>
          );
        })()}

      {/* Parent -- subtasks only, navigable */}
      {isSubtask && f.parent && (
        <MetaRow label="Parent">
          <button
            type="button"
            onClick={() => onOpenIssue?.(f.parent?.key ?? '')}
            className="text-left hover:underline cursor-pointer"
          >
            <span className="font-mono text-xs">{f.parent.key}</span>
            <span className="text-xs text-muted-foreground ml-1">— {f.parent.fields.summary}</span>
          </button>
        </MetaRow>
      )}

      {/* Sprint -- stories only (epics and subtasks don't have sprints) */}
      {isStory && <MetaRow label="Sprint">{sprintName ?? 'No sprint'}</MetaRow>}

      {/* Labels -- badge chips with remove + add */}
      <MetaRow label="Labels">
        <div className="flex flex-wrap gap-1">
          {(f.labels ?? []).map((l) => (
            <span key={l} className="inline-flex items-center gap-0.5">
              <Badge variant="secondary" className="text-xs">
                {l}
              </Badge>
              <button
                type="button"
                onClick={() => handleLabelRemove(l)}
                className="text-muted-foreground hover:text-destructive text-xs leading-none"
                title={`Remove label ${l}`}
                aria-label={`Remove label ${l}`}
              >
                ×
              </button>
            </span>
          ))}
          {labelAdding ? (
            <Input
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLabelAdd();
                if (e.key === 'Escape') {
                  setLabelAdding(false);
                  setLabelInput('');
                }
              }}
              onBlur={() => {
                if (!labelInput.trim()) setLabelAdding(false);
              }}
              autoFocus
              placeholder="Add label..."
              className="h-5 w-24 text-xs"
            />
          ) : (
            <button
              data-testid="label-add"
              type="button"
              onClick={() => setLabelAdding(true)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              + Add
            </button>
          )}
          {mutation.isError && (
            <p className="text-xs text-destructive mt-1 w-full">Save failed — changes reverted</p>
          )}
        </div>
      </MetaRow>

      {f.fixVersions.length > 0 && (
        <MetaRow label="Fix Versions">{f.fixVersions.map((v) => v.name).join(', ')}</MetaRow>
      )}
      <MetaRow label="Created">{new Date(f.created).toLocaleDateString()}</MetaRow>
      <MetaRow label="Updated">{new Date(f.updated).toLocaleDateString()}</MetaRow>
      {f.duedate && <MetaRow label="Due">{new Date(f.duedate).toLocaleDateString()}</MetaRow>}
    </>
  );
}
