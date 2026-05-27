import type { UseMutationResult } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag } from 'lucide-react';
import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { ConfirmSprintMoveDialog } from '@/components/ui/confirm-sprint-move-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SprintMoveMenuItems } from '@/components/ui/sprint-move-menu-items';
import { useBoardId } from '@/hooks/useBoardId';
import { apiFetch } from '@/lib/apiFetch';
import { epicColorToTailwind } from '@/lib/epicColors';
import type { JiraIssue, JiraIssueDetail } from '@/services/jira';
import { isIssueFlagged } from '@/services/jira';
import { fetchSprintList } from '@/services/jira/backlog';
import { addIssuesToSprint, moveIssuesToBacklog } from '@/services/jira/sprints';
import { postTransition } from '@/services/jira/transitions';
import { fetchFixVersions } from '@/services/jira/versions';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import StatusPopover from '../StatusPopover';
import { MetaRow } from './MetaRow';
import { OverdueBadge } from './OverdueBadge';
import { TimeTrackingSummary } from './TimeTrackingSummary';
import { extractSprintId, extractSprintName } from './utils';
import { WatcherToggle } from './WatcherToggle';

const PRIORITY_OPTIONS = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];

/**
 * Extract the severity display string from customfield_13415.
 * Returns null when the field is absent, null, or has no usable value.
 * Exported for unit testing.
 */
export function extractSeverity(
  field: { value?: string; name?: string } | null | undefined,
): string | null {
  return field?.value ?? field?.name ?? null;
}

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
  flaggedFieldKey?: string;
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
  flaggedFieldKey = 'customfield_10021',
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
  const currentSprintId = extractSprintId(rawSprint);

  // Priority edit state
  const [priorityEditing, setPriorityEditing] = useState(false);

  // Story points edit state
  const [spEditing, setSpEditing] = useState(false);
  const [spInput, setSpInput] = useState('');
  const spOriginal = useRef<number | null>(null);

  // Assignee edit state
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [assigneeQuery, setAssigneeQuery] = useState('');

  // Labels add state
  const [labelInput, setLabelInput] = useState('');
  const [labelAdding, setLabelAdding] = useState(false);

  // Sprint picker state
  const [sprintPickerOpen, setSprintPickerOpen] = useState(false);
  const [pendingSprintMove, setPendingSprintMove] = useState<{
    sprintId: number | null; // null = move to backlog
    sprintName: string;
  } | null>(null);

  // Fix version edit state
  const [fixVersionOpen, setFixVersionOpen] = useState(false);
  const activeJiraProject = useAuthStore((s) => s.activeJiraProject);
  const jiraUsername = useAuthStore((s) => s.jiraUsername);
  const jiraUserDisplayName = useAuthStore((s) => s.jiraUserDisplayName);
  const versionsQuery = useQuery({
    queryKey: ['jira-fix-versions', activeJiraProject, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !activeJiraProject) return [];
      return fetchFixVersions(jiraBaseUrl, token, activeJiraProject);
    },
    enabled: fixVersionOpen && !!activeJiraProject,
  });

  // Token query for sprint picker (same pattern as fix versions)
  const { data: jiraToken } = useQuery({
    queryKey: ['jira-pat'],
    queryFn: () => readSecret('jira-pat'),
    staleTime: Infinity,
  });

  const { boardId } = useBoardId(jiraBaseUrl, jiraToken ?? null, activeJiraProject);

  const sprintsQuery = useQuery({
    queryKey: ['jira-sprint-list', boardId, jiraBaseUrl],
    queryFn: () => fetchSprintList(jiraBaseUrl, jiraToken!, boardId!),
    enabled: sprintPickerOpen && !!boardId && !!jiraToken,
  });

  // Assignee typeahead: load all assignable users when the popup opens, filter locally
  const assigneeUsersQuery = useQuery({
    queryKey: ['jira-assignable-users', issueKey, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) return [];
      const url = `${jiraBaseUrl.replace(/\/$/, '')}/rest/api/2/user/assignable/search?issueKey=${issueKey}&maxResults=50`;
      const resp = await apiFetch('jira', url, { headers: { Authorization: `Bearer ${token}` } }, 'Load Assignees');
      if (!resp.ok) return [];
      return (await resp.json()) as AssignableUser[];
    },
    enabled: assigneeOpen,
    staleTime: 60_000,
  });

  const filteredAssignees = (() => {
    const all = assigneeUsersQuery.data ?? [];
    const q = assigneeQuery.trim().toLowerCase();
    const filtered = q
      ? all.filter(
          (u) => u.displayName.toLowerCase().includes(q) || u.name.toLowerCase().includes(q),
        )
      : all;
    return filtered.slice(0, 10);
  })();

  const filteredVersions = (() => {
    const all = versionsQuery.data;
    if (!all || all.length === 0) return [];

    const unreleased = all.filter((v) => !v.released);
    const released = all
      .filter((v) => v.released)
      .sort((a, b) => {
        if (!a.releaseDate && !b.releaseDate) return a.name.localeCompare(b.name);
        if (!a.releaseDate) return 1;
        if (!b.releaseDate) return -1;
        return b.releaseDate.localeCompare(a.releaseDate);
      });

    const recentReleased = released.slice(0, 10);
    const recentIds = new Set(recentReleased.map((v) => v.id));

    // Ensure currently-selected released versions remain visible
    const selectedOlder = released.filter(
      (v) => !recentIds.has(v.id) && f.fixVersions.some((fv) => fv.id === v.id),
    );

    // Display order: unreleased (by name), then released (most recent first)
    const sortedUnreleased = [...unreleased].sort((a, b) => a.name.localeCompare(b.name));
    const sortedReleased = [...recentReleased, ...selectedOlder].sort((a, b) => {
      if (!a.releaseDate && !b.releaseDate) return a.name.localeCompare(b.name);
      if (!a.releaseDate) return 1;
      if (!b.releaseDate) return -1;
      return b.releaseDate.localeCompare(a.releaseDate);
    });

    return [...sortedUnreleased, ...sortedReleased];
  })();

  // Status transition state
  const queryClient = useQueryClient();

  const transitionMutation = useMutation({
    mutationFn: async ({ transitionId }: { transitionId: string; toName: string }) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No token');
      return postTransition(jiraBaseUrl, token, issueKey, transitionId);
    },
    onMutate: async ({ toName }) => {
      await queryClient.cancelQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
      const previous = queryClient.getQueryData<JiraIssueDetail>([
        'jira-issue-detail',
        issueKey,
        jiraBaseUrl,
      ]);
      queryClient.setQueryData<JiraIssueDetail>(
        ['jira-issue-detail', issueKey, jiraBaseUrl],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            fields: { ...old.fields, status: { ...old.fields.status, name: toName } },
          };
        },
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['jira-issue-detail', issueKey, jiraBaseUrl], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
      queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] });
      queryClient.invalidateQueries({ queryKey: ['jira-sprint-stories'] });
      queryClient.invalidateQueries({ queryKey: ['jira-backlog-sprint-stories'] });
      queryClient.invalidateQueries({ queryKey: ['jira-backlog-issues'] });
      queryClient.invalidateQueries({ queryKey: ['jira-epics-basic'] });
      queryClient.invalidateQueries({ queryKey: ['jira-fixversion-issues'] });
      queryClient.invalidateQueries({ queryKey: ['jira-version-counts'] });
      queryClient.invalidateQueries({ queryKey: ['jira-transitions', issueKey] });
    },
  });

  function handleTransition(transitionId: string, toStatusName: string) {
    transitionMutation.mutate({ transitionId, toName: toStatusName });
  }

  const sprintMoveMutation = useMutation({
    mutationFn: async ({ sprintId }: { sprintId: number | null }) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No token');
      if (sprintId === null) {
        return moveIssuesToBacklog(jiraBaseUrl, token, [issueKey]);
      }
      return addIssuesToSprint(jiraBaseUrl, token, sprintId, [issueKey]);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
      queryClient.invalidateQueries({ queryKey: ['jira-sprint-stories'] });
      queryClient.invalidateQueries({ queryKey: ['jira-backlog-sprint-stories'] });
      queryClient.invalidateQueries({ queryKey: ['jira-backlog-issues'] });
      queryClient.invalidateQueries({ queryKey: ['jira-sprint-list'] });
    },
  });

  function handleSprintMoveConfirm() {
    if (!pendingSprintMove) return;
    sprintMoveMutation.mutate({ sprintId: pendingSprintMove.sprintId });
    setPendingSprintMove(null);
  }

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
    if (spInput.trim() === '') {
      // Empty input = clear story points (send null)
      if (spOriginal.current !== null) {
        mutation.mutate({ fieldName: storyPointsFieldKey, value: null });
      }
      return;
    }
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
    // DC format: { name: username } -- NOT { accountId }
    mutation.mutate({ fieldName: 'assignee', value: { name: user.name } });
  }

  function handleAssignToMe() {
    if (!jiraUsername) return;
    setAssigneeOpen(false);
    setAssigneeQuery('');
    mutation.mutate({ fieldName: 'assignee', value: { name: jiraUsername } });
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

  function handleFixVersionToggle(versionId: string) {
    const current = f.fixVersions ?? [];
    const isSelected = current.some((v) => v.id === versionId);
    const newVersions = isSelected
      ? current.filter((v) => v.id !== versionId)
      : [...current, { id: versionId }];
    mutation.mutate({ fieldName: 'fixVersions', value: newVersions.map((v) => ({ id: v.id })) });
  }

  const epicName = epicIssue
    ? ((epicIssue.fields[epicNameFieldKey] as string | null) ?? epicIssue.fields.summary)
    : null;

  return (
    <>
      <MetaRow label="Status">
        <StatusPopover
          issueKey={issueKey}
          currentStatus={f.status.name}
          jiraBaseUrl={jiraBaseUrl}
          onSelect={handleTransition}
          disabled={transitionMutation.isPending}
          statusCategoryKey={f.status.statusCategory?.key}
        />
        {transitionMutation.isError && (
          <span className="text-xs text-destructive">Transition failed</span>
        )}
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
            <div className="flex items-center gap-1.5">
              {f.priority?.iconUrl && (
                <img
                  data-testid="priority-icon"
                  src={f.priority.iconUrl}
                  alt=""
                  className="w-3.5 h-3.5 shrink-0"
                />
              )}
              <span>{f.priority?.name ?? '—'}</span>
            </div>
          </button>
        )}
      </MetaRow>

      {/* Severity -- shown only when customfield_13415 has a value */}
      {(() => {
        const severityField = f.customfield_13415 as
          | { value?: string; name?: string }
          | null
          | undefined;
        const severityValue = extractSeverity(severityField);
        return severityValue ? <MetaRow label="Severity">{severityValue}</MetaRow> : null;
      })()}

      {/* Assignee -- click to open typeahead popover */}
      <MetaRow label="Assignee">
        <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
          <PopoverTrigger
            data-testid="assignee-edit"
            className="hover:bg-accent rounded px-1 -ml-1 cursor-pointer text-left text-sm inline-flex items-center gap-1.5"
            title="Click to change assignee"
          >
            {f.assignee ? (
              <>
                <CachedAvatar
                  url={f.assignee.avatarUrls?.['48x48']}
                  name={f.assignee.displayName}
                  size={20}
                />
                {f.assignee.displayName}
              </>
            ) : (
              <>
                <CachedAvatar url={null} name="Unassigned" size={20} />
                Unassigned
              </>
            )}
          </PopoverTrigger>
          <PopoverContent className="w-80 p-2">
            {jiraUsername && f.assignee?.name !== jiraUsername && (
              <>
                <button
                  data-testid="assignee-assign-to-me"
                  type="button"
                  onClick={handleAssignToMe}
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
              placeholder="Filter users..."
              value={assigneeQuery}
              onChange={(e) => setAssigneeQuery(e.target.value)}
              autoFocus
              className="h-7 text-xs mb-2"
            />
            {assigneeUsersQuery.isLoading && (
              <p className="text-xs text-muted-foreground px-1">Loading users...</p>
            )}
            {!assigneeUsersQuery.isLoading && filteredAssignees.length === 0 && (
              <p className="text-xs text-muted-foreground px-1">
                {assigneeQuery.trim() ? 'No users match' : 'No assignable users found'}
              </p>
            )}
            {filteredAssignees.map((user) => (
              <button
                key={user.name}
                type="button"
                onClick={() => handleAssigneeSelect(user)}
                className="w-full text-left px-2 py-1 text-xs hover:bg-accent rounded flex items-center gap-2"
              >
                <CachedAvatar url={user.avatarUrls?.['48x48']} name={user.displayName} size={20} />
                {user.displayName}
              </button>
            ))}
            {mutation.isError && (
              <p className="text-xs text-destructive mt-1">Save failed — changes reverted</p>
            )}
          </PopoverContent>
        </Popover>
      </MetaRow>

      <MetaRow label="Reporter">
        {f.reporter ? (
          <span className="inline-flex items-center gap-1.5">
            <CachedAvatar
              url={f.reporter.avatarUrls?.['48x48']}
              name={f.reporter.displayName}
              size={20}
            />
            {f.reporter.displayName}
          </span>
        ) : (
          '—'
        )}
      </MetaRow>

      {/* Story Points -- stories only */}
      {isStory && (
        <MetaRow label="Story Points">
          {spEditing ? (
            <div className="flex items-center gap-1">
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
              {storyPoints != null && (
                <button
                  data-testid="story-points-clear"
                  type="button"
                  onMouseDown={(e) => {
                    // Prevent onBlur on Input from firing commitSpEdit before this click registers
                    e.preventDefault();
                  }}
                  onClick={() => {
                    setSpEditing(false);
                    mutation.mutate({ fieldName: storyPointsFieldKey, value: null });
                  }}
                  className="text-muted-foreground hover:text-destructive text-xs leading-none"
                  title="Clear story points"
                  aria-label="Clear story points"
                >
                  ×
                </button>
              )}
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
                    className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium hover:opacity-80 transition-opacity ${colorResult.className}`}
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
                className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${colorResult.className}`}
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

      {/* Sprint -- stories only (dropdown menu, same component as backlog context menu) */}
      {isStory && (
        <MetaRow label="Sprint">
          <DropdownMenu open={sprintPickerOpen} onOpenChange={setSprintPickerOpen}>
            <DropdownMenuTrigger
              data-testid="sprint-edit"
              className="hover:bg-accent rounded px-1 -ml-1 cursor-pointer text-left text-sm"
              title="Click to change sprint"
            >
              {sprintName ?? 'No sprint'}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="bottom" sideOffset={4}>
              <DropdownMenuGroup>
                {sprintsQuery.isLoading && (
                  <DropdownMenuLabel>Loading sprints...</DropdownMenuLabel>
                )}
                {sprintsQuery.isError && (
                  <DropdownMenuLabel className="text-destructive">
                    Failed to load sprints
                  </DropdownMenuLabel>
                )}
                {sprintsQuery.data && (
                  <>
                    <DropdownMenuLabel>Move to...</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <SprintMoveMenuItems
                      sprints={sprintsQuery.data}
                      currentSprintId={currentSprintId}
                      showBacklog={currentSprintId !== null}
                      onSelectSprint={(sprintId, name) => {
                        setSprintPickerOpen(false);
                        setPendingSprintMove({ sprintId, sprintName: name });
                      }}
                      onSelectBacklog={() => {
                        setSprintPickerOpen(false);
                        setPendingSprintMove({ sprintId: null, sprintName: 'Backlog' });
                      }}
                      Item={DropdownMenuItem}
                      Separator={DropdownMenuSeparator}
                      Label={DropdownMenuLabel}
                    />
                  </>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </MetaRow>
      )}

      <ConfirmSprintMoveDialog
        open={!!pendingSprintMove}
        onOpenChange={(open) => {
          if (!open) setPendingSprintMove(null);
        }}
        issueKey={issueKey}
        fromSprintName={sprintName}
        toSprintName={pendingSprintMove?.sprintName ?? ''}
        onConfirm={handleSprintMoveConfirm}
        isPending={sprintMoveMutation.isPending}
      />

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

      {/* Fix Versions -- editable popover */}
      <MetaRow label="Fix Versions">
        <Popover open={fixVersionOpen} onOpenChange={setFixVersionOpen}>
          <PopoverTrigger
            data-testid="fix-version-edit"
            className="hover:bg-accent rounded px-1 -ml-1 cursor-pointer text-left text-sm"
            title="Click to edit fix versions"
          >
            {f.fixVersions.length > 0 ? f.fixVersions.map((v) => v.name).join(', ') : 'None'}
          </PopoverTrigger>
          <PopoverContent className="w-60 p-2">
            {versionsQuery.isLoading && (
              <p className="text-xs text-muted-foreground px-1">Loading versions...</p>
            )}
            {versionsQuery.isError && (
              <p className="text-xs text-destructive px-1">Failed to load versions</p>
            )}
            {versionsQuery.data && versionsQuery.data.length === 0 && (
              <p className="text-xs text-muted-foreground px-1">No versions found</p>
            )}
            {filteredVersions.length > 0 &&
              filteredVersions.map((version) => {
                const isSelected = f.fixVersions.some((v) => v.id === version.id);
                return (
                  <button
                    key={version.id}
                    type="button"
                    onClick={() => handleFixVersionToggle(version.id)}
                    className="w-full text-left px-2 py-1 text-xs hover:bg-accent rounded flex items-center gap-2"
                  >
                    <span className="w-4 text-center">{isSelected ? '\u2713' : ''}</span>
                    <span className="flex-1 truncate">{version.name}</span>
                    {version.released && (
                      <Badge
                        variant="outline"
                        className="bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700 text-[9px] leading-none px-1 py-0 h-3.5"
                      >
                        released
                      </Badge>
                    )}
                  </button>
                );
              })}
            {mutation.isError && (
              <p className="text-xs text-destructive mt-1">Save failed -- changes reverted</p>
            )}
          </PopoverContent>
        </Popover>
      </MetaRow>
      {/* Flagged -- toggle impediment flag */}
      {(() => {
        const isFlagged = isIssueFlagged(issue as unknown as JiraIssue, flaggedFieldKey);
        return (
          <MetaRow label="Flagged">
            <button
              type="button"
              onClick={() =>
                mutation.mutate({
                  fieldName: flaggedFieldKey,
                  value: isFlagged ? null : [{ value: 'Impediment' }],
                })
              }
              className="inline-flex items-center gap-1 rounded px-1 -ml-1 hover:bg-accent cursor-pointer text-left"
              title={isFlagged ? 'Unflag this issue' : 'Flag this issue as an impediment'}
            >
              {isFlagged ? (
                <>
                  <Flag className="size-3.5 text-yellow-700 dark:text-yellow-300" />
                  <span>Flagged (Impediment)</span>
                </>
              ) : (
                <span className="text-muted-foreground">— Add flag</span>
              )}
            </button>
            {mutation.isError && mutation.variables?.fieldName === flaggedFieldKey && (
              <p className="text-xs text-destructive mt-1">Save failed — changes reverted</p>
            )}
          </MetaRow>
        );
      })()}
      <MetaRow label="Created">{new Date(f.created).toLocaleDateString()}</MetaRow>
      <MetaRow label="Updated">{new Date(f.updated).toLocaleDateString()}</MetaRow>
      {f.duedate && (
        <MetaRow label="Due">
          <span className="inline-flex items-center gap-1.5">
            {new Date(f.duedate).toLocaleDateString()}
            <OverdueBadge duedate={f.duedate} statusCategoryKey={f.status.statusCategory?.key} />
          </span>
        </MetaRow>
      )}

      <WatcherToggle issueKey={issueKey} jiraBaseUrl={jiraBaseUrl} />

      <TimeTrackingSummary timetracking={f.timetracking} />
    </>
  );
}
