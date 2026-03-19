import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GitBranch } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import type { GitLabMR } from '@/services/gitlab';
import type { JiraIssueDetail } from '@/services/jira';
import { updateIssueField } from '@/services/jira';
import { extractTicketKeys } from '@/services/linkEngine';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';

interface IssueDetailSidebarProps {
  issue: JiraIssueDetail;
  issueKey: string;
  jiraBaseUrl: string;
  storyPointsFieldKey: string;
  epicLinkFieldKey: string;
  epicNameFieldKey: string;
  sprintFieldKey: string;
  onOpenIssue?: (key: string) => void;
}

// Shared mutation hook implementing Pattern 4 from RESEARCH.md
function useFieldMutation(issueKey: string, jiraBaseUrl: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fieldName, value }: { fieldName: string; value: unknown }) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No token');
      return updateIssueField(jiraBaseUrl, token, issueKey, fieldName, value);
    },
    onMutate: async ({ fieldName, value }) => {
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
          return { ...old, fields: { ...old.fields, [fieldName]: value } };
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
      queryClient.invalidateQueries({ queryKey: ['jira-issues', 'my-tasks'] });
    },
  });
}

const PRIORITY_OPTIONS = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];

/**
 * Extract sprint name from various Jira API response formats.
 *
 * Jira returns the sprint custom field differently depending on version/platform:
 *  1. Array of objects: [{id, name, state, ...}]  (Jira Cloud, newer DC)
 *  2. Array of strings: ["com.atlassian...Sprint@...[...,name=Sprint 1,...]"]  (older Jira DC toString format)
 *  3. Single object: {id, name, state, ...}  (Agile API / some DC versions)
 *  4. Plain string: "Sprint 1"  (rare edge case)
 *  5. null / undefined  (no sprint assigned)
 */
export function extractSprintName(raw: unknown): string | null {
  if (raw == null) return null;

  // Case 4: plain string
  if (typeof raw === 'string') {
    // Could be a Java toString representation or a plain name
    return parseSprintToStringName(raw) ?? raw;
  }

  // Case 3: single object with .name
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.name === 'string') return obj.name;
    return null;
  }

  // Case 1 & 2: array
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null;

    const first = raw[0];

    // Case 1: array of objects — prefer active sprint
    if (typeof first === 'object' && first !== null) {
      const items = raw as Array<Record<string, unknown>>;
      const active = items.find((s) => {
        const state = typeof s.state === 'string' ? s.state.toLowerCase() : '';
        return state === 'active';
      });
      const chosen = active ?? items[0];
      return typeof chosen.name === 'string' ? chosen.name : null;
    }

    // Case 2: array of Java toString strings — prefer active sprint
    if (typeof first === 'string') {
      const strings = raw as string[];
      const active = strings.find((s) => /state=ACTIVE/i.test(s));
      const chosen = active ?? strings[0];
      return parseSprintToStringName(chosen);
    }
  }

  return null;
}

/**
 * Parse sprint name from the Jira DC Java toString format:
 * "com.atlassian.greenhopper.service.sprint.Sprint@abc[id=1,...,name=Sprint 1,...,state=ACTIVE,...]"
 * Returns the name value, or null if the string isn't in this format.
 */
function parseSprintToStringName(str: string): string | null {
  const match = str.match(/name=([^,\]]+)/);
  return match ? match[1] : null;
}

// Debounce hook
function useDebounce<T extends unknown[]>(fn: (...args: T) => void, delay: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback(
    (...args: T) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => fn(...args), delay);
    },
    [fn, delay],
  );
}

// Status color helpers for linked issues
function statusDot(statusName: string): string {
  if (/done|closed|resolved/i.test(statusName)) return 'bg-green-500';
  if (/in progress|in review|in development/i.test(statusName)) return 'bg-blue-500';
  if (/to do|open|backlog|new/i.test(statusName)) return 'bg-gray-400';
  return 'bg-gray-400';
}

function statusBadgeClasses(statusName: string): string {
  if (/done|closed|resolved/i.test(statusName))
    return 'bg-green-500/10 text-green-700 dark:text-green-400';
  if (/in progress|in review|in development/i.test(statusName))
    return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
  return 'bg-muted text-muted-foreground';
}

// MR state color helpers
function mrStateClasses(state: GitLabMR['state']): string {
  if (state === 'opened') return 'bg-green-500/10 text-green-700 dark:text-green-400';
  if (state === 'merged') return 'bg-purple-500/10 text-purple-700 dark:text-purple-400';
  return 'bg-muted text-muted-foreground';
}

function mrDot(state: GitLabMR['state']): string {
  if (state === 'opened') return 'bg-green-500';
  if (state === 'merged') return 'bg-purple-500';
  return 'bg-gray-400';
}

interface AssignableUser {
  displayName: string;
  name: string;
  avatarUrls?: { '48x48'?: string };
}

export function IssueDetailSidebar({
  issue,
  issueKey,
  jiraBaseUrl,
  storyPointsFieldKey,
  epicLinkFieldKey,
  epicNameFieldKey,
  sprintFieldKey,
  onOpenIssue,
}: IssueDetailSidebarProps) {
  const navigate = useNavigate();
  const f = issue.fields;
  const isEpic = f.issuetype.name === 'Epic';
  const isSubtask = f.issuetype.subtask;
  const isStory = !isEpic && !isSubtask;

  const storyPoints = f[storyPointsFieldKey] as number | null;
  // For stories: epicLinkFieldKey holds the parent epic key string (e.g. "PROJ-42")
  const epicLink = isStory ? (f[epicLinkFieldKey] as string | null) : null;
  // Sprint field varies by Jira version/platform:
  //   - Jira Cloud / newer DC: Array of objects [{id, name, state, ...}]
  //   - Older Jira DC: Array of Java toString strings ["com.atlassian...Sprint@...[id=1,...,name=Sprint 1,...]"]
  //   - Agile API seeded cache: Single object {id, name, state, ...}
  //   - Raw string (rare): Plain sprint name string
  const rawSprint = f[sprintFieldKey] as unknown;
  const sprintName = extractSprintName(rawSprint);

  const {
    jiraBaseUrl: storeJiraBaseUrl,
    jiraConnected,
    gitlabBaseUrl,
    gitlabConnected,
    activeGitlabProject,
  } = useAuthStore();
  const { epicColorFieldKey } = useSettingsStore();
  const effectiveJiraBaseUrl = jiraBaseUrl || storeJiraBaseUrl || '';

  // Fetch epic name for stories — lightweight single-issue fetch
  const { data: epicIssue } = useQuery({
    queryKey: ['jira-issue-name', epicLink, effectiveJiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) return null;
      const url = `${effectiveJiraBaseUrl.replace(/\/$/, '')}/rest/api/2/issue/${epicLink}?fields=summary,${epicNameFieldKey},${epicColorFieldKey}`;
      const resp = await apiFetch('jira', url, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) return null;
      return resp.json() as Promise<{ fields: { summary: string; [k: string]: unknown } }>;
    },
    enabled: isStory && !!epicLink && !!effectiveJiraBaseUrl && !!jiraConnected,
    staleTime: 60_000,
  });
  const epicName = epicIssue
    ? ((epicIssue.fields[epicNameFieldKey] as string | null) ?? epicIssue.fields.summary)
    : null;

  // Fetch GitLab MRs for the active project (all states, recent 20)
  const { data: projectMRs, isLoading: mrsLoading } = useQuery({
    queryKey: ['gitlab-project-mrs', gitlabBaseUrl, activeGitlabProject],
    queryFn: async () => {
      const token = await readSecret('gitlab-pat').catch(() => null);
      if (!token || !gitlabBaseUrl || !activeGitlabProject) return [] as GitLabMR[];
      const base = gitlabBaseUrl.replace(/\/$/, '');
      const url = `${base}/api/v4/projects/${activeGitlabProject}/merge_requests?per_page=20&order_by=updated_at&sort=desc`;
      try {
        const resp = await apiFetch('gitlab', url, {
          headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
        });
        if (!resp.ok) return [] as GitLabMR[];
        return (await resp.json()) as GitLabMR[];
      } catch {
        return [] as GitLabMR[];
      }
    },
    staleTime: 60_000,
    enabled: !!gitlabBaseUrl && !!gitlabConnected && !!activeGitlabProject,
  });

  // Filter MRs linked to the current issue key
  const linkedMRs = useMemo(() => {
    if (!projectMRs) return [];
    return projectMRs.filter((mr) => {
      const titleKeys = extractTicketKeys(mr.title);
      const branchKeys = extractTicketKeys(mr.source_branch);
      return titleKeys.includes(issueKey) || branchKeys.includes(issueKey);
    });
  }, [projectMRs, issueKey]);

  const mutation = useFieldMutation(issueKey, effectiveJiraBaseUrl);

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

  // Group linked issues by link type label
  const groupedLinks = useMemo(() => {
    const groups = new Map<
      string,
      Array<{
        link: (typeof f.issuelinks)[number];
        target: NonNullable<(typeof f.issuelinks)[number]['inwardIssue']>;
        label: string;
      }>
    >();
    for (const link of f.issuelinks) {
      const target = link.inwardIssue ?? link.outwardIssue;
      if (!target) continue;
      const label = link.inwardIssue ? link.type.inward : link.type.outward;
      const existing = groups.get(label) ?? [];
      existing.push({ link, target, label });
      groups.set(label, existing);
    }
    return groups;
  }, [f.issuelinks]);

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
        const url = `${effectiveJiraBaseUrl.replace(/\/$/, '')}/rest/api/2/user/assignable/search?issueKey=${issueKey}&query=${encodeURIComponent(query)}`;
        const resp = await apiFetch('jira', url, {
          headers: { Authorization: `Bearer ${token}` },
        });
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
    [effectiveJiraBaseUrl, issueKey],
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
    // DC format: { name: username } — NOT { accountId }
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

  return (
    <div className="space-y-4 text-sm">
      <MetaRow label="Status">
        <Badge variant="outline">{f.status.name}</Badge>
      </MetaRow>

      {/* Priority — click to edit with Select */}
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

      {/* Assignee — click to open typeahead popover */}
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

      {/* Story Points — stories only */}
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

      {/* Epic — stories only: key + name with color, navigable */}
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

      {/* Color — epics only: show color swatch */}
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

      {/* Parent — subtasks only, navigable */}
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

      {/* Sprint — stories only (epics and subtasks don't have sprints) */}
      {isStory && <MetaRow label="Sprint">{sprintName ?? 'No sprint'}</MetaRow>}

      {/* Labels — badge chips with remove + add */}
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

      {/* Linked issues — grouped by link type */}
      {f.issuelinks.length > 0 && (
        <section>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Linked Issues
          </p>
          <div className="space-y-2">
            {Array.from(groupedLinks.entries()).map(([label, items]) => (
              <div key={label}>
                <p className="text-[10px] text-muted-foreground capitalize mb-0.5 pl-1">{label}</p>
                {items.map(({ link, target }) => (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => onOpenIssue?.(target.key)}
                    className="w-full text-left rounded px-1 py-1 hover:bg-accent transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`size-1.5 rounded-full shrink-0 ${statusDot(target.fields.status.name)}`}
                      />
                      <span className="font-mono text-xs">{target.key}</span>
                      <Badge
                        className={`text-[10px] h-4 px-1.5 border-0 font-normal ${statusBadgeClasses(target.fields.status.name)}`}
                      >
                        {target.fields.status.name}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate pl-[18px]">
                      {target.fields.summary}
                    </p>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Merge Requests — GitLab MRs linked to this issue */}
      {gitlabConnected && gitlabBaseUrl && (
        <section>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Merge Requests
          </p>
          {mrsLoading && <div className="h-5 rounded bg-muted animate-pulse" />}
          {!mrsLoading &&
            linkedMRs.length > 0 &&
            linkedMRs.map((mr) => (
              <button
                key={mr.iid}
                type="button"
                onClick={() => navigate(`/mr/${mr.project_id}/${mr.iid}`)}
                className="w-full text-left rounded px-1 py-1 hover:bg-accent transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <span className={`size-1.5 rounded-full shrink-0 ${mrDot(mr.state)}`} />
                  <span className="text-xs font-mono">!{mr.iid}</span>
                  <Badge
                    className={`text-[10px] h-4 px-1.5 border-0 font-normal ${mrStateClasses(mr.state)}`}
                  >
                    {mr.state === 'merged' ? 'Merged' : mr.state === 'opened' ? 'Open' : mr.state}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate pl-[18px]">{mr.title}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pl-[18px] mt-0.5">
                  <img src={mr.author.avatar_url} alt="" className="size-3 rounded-full shrink-0" />
                  <span className="truncate">{mr.author.name}</span>
                  <GitBranch className="size-2.5 shrink-0 opacity-50" />
                  <span className="font-mono truncate">{mr.source_branch}</span>
                </div>
              </button>
            ))}
          {!mrsLoading && linkedMRs.length === 0 && (
            <p className="text-xs text-muted-foreground">None</p>
          )}
        </section>
      )}
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">{label}</span>
      <span className="flex-1">{children}</span>
    </div>
  );
}
