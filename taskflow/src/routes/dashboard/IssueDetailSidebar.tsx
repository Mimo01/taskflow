import { useState, useRef, useCallback } from 'react'
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import type { JiraIssueDetail } from '@/services/jira'
import { updateIssueField } from '@/services/jira'
import { apiFetch } from '@/lib/apiFetch'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { readSecret } from '@/services/stronghold'
import { useAuthStore } from '@/stores/auth.store'

interface IssueDetailSidebarProps {
  issue: JiraIssueDetail
  issueKey: string
  jiraBaseUrl: string
  storyPointsFieldKey: string
  epicLinkFieldKey: string
  epicNameFieldKey: string
  sprintFieldKey: string
  onOpenIssue?: (key: string) => void
}

// Shared mutation hook implementing Pattern 4 from RESEARCH.md
function useFieldMutation(issueKey: string, jiraBaseUrl: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ fieldName, value }: { fieldName: string; value: unknown }) => {
      const token = await readSecret('jira-pat').catch(() => null)
      if (!token) throw new Error('No token')
      return updateIssueField(jiraBaseUrl, token, issueKey, fieldName, value)
    },
    onMutate: async ({ fieldName, value }) => {
      await queryClient.cancelQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] })
      const previous = queryClient.getQueryData<JiraIssueDetail>(['jira-issue-detail', issueKey, jiraBaseUrl])
      queryClient.setQueryData<JiraIssueDetail>(['jira-issue-detail', issueKey, jiraBaseUrl], (old) => {
        if (!old) return old
        return { ...old, fields: { ...old.fields, [fieldName]: value } }
      })
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['jira-issue-detail', issueKey, jiraBaseUrl], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] })
      queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] })
      queryClient.invalidateQueries({ queryKey: ['jira-issues', 'my-tasks'] })
    },
  })
}

const PRIORITY_OPTIONS = ['Highest', 'High', 'Medium', 'Low', 'Lowest']

// Debounce hook
function useDebounce<T extends unknown[]>(fn: (...args: T) => void, delay: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  return useCallback((...args: T) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fn(...args), delay)
  }, [fn, delay])
}

interface AssignableUser {
  displayName: string
  name: string
  avatarUrls?: { '48x48'?: string }
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
  const f = issue.fields
  const isEpic = f.issuetype.name === 'Epic'
  const isSubtask = f.issuetype.subtask
  const isStory = !isEpic && !isSubtask

  const storyPoints = f[storyPointsFieldKey] as number | null
  // For stories: epicLinkFieldKey holds the parent epic key string (e.g. "PROJ-42")
  const epicLink = isStory ? (f[epicLinkFieldKey] as string | null) : null
  const rawSprint = f[sprintFieldKey] as Array<{ name: string; state: string }> | string | null | undefined
  const sprintName = typeof rawSprint === 'string'
    ? rawSprint
    : Array.isArray(rawSprint)
      ? (rawSprint.find(s => s.state === 'active') ?? rawSprint[0])?.name ?? null
      : null

  const { jiraBaseUrl: storeJiraBaseUrl, jiraConnected } = useAuthStore()
  const effectiveJiraBaseUrl = jiraBaseUrl || storeJiraBaseUrl || ''

  // Fetch epic name for stories — lightweight single-issue fetch
  const { data: epicIssue } = useQuery({
    queryKey: ['jira-issue-name', epicLink, effectiveJiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null)
      if (!token) return null
      const url = `${effectiveJiraBaseUrl.replace(/\/$/, '')}/rest/api/2/issue/${epicLink}?fields=summary,${epicNameFieldKey}`
      const resp = await apiFetch('jira', url, { headers: { Authorization: `Bearer ${token}` } })
      if (!resp.ok) return null
      return resp.json() as Promise<{ fields: { summary: string; [k: string]: unknown } }>
    },
    enabled: isStory && !!epicLink && !!effectiveJiraBaseUrl && !!jiraConnected,
    staleTime: 60_000,
  })
  const epicName = epicIssue
    ? ((epicIssue.fields[epicNameFieldKey] as string | null) ?? epicIssue.fields.summary)
    : null

  const mutation = useFieldMutation(issueKey, effectiveJiraBaseUrl)

  // Priority edit state
  const [priorityEditing, setPriorityEditing] = useState(false)

  // Story points edit state
  const [spEditing, setSpEditing] = useState(false)
  const [spInput, setSpInput] = useState('')
  const spOriginal = useRef<number | null>(null)

  // Assignee edit state
  const [assigneeOpen, setAssigneeOpen] = useState(false)
  const [assigneeQuery, setAssigneeQuery] = useState('')
  const [assigneeResults, setAssigneeResults] = useState<AssignableUser[]>([])
  const [assigneeLoading, setAssigneeLoading] = useState(false)

  // Labels add state
  const [labelInput, setLabelInput] = useState('')
  const [labelAdding, setLabelAdding] = useState(false)

  // Assignee search with debounce
  const doSearch = useCallback(async (query: string) => {
    if (!query.trim()) { setAssigneeResults([]); return }
    setAssigneeLoading(true)
    try {
      const token = await readSecret('jira-pat').catch(() => null)
      if (!token) return
      const url = `${effectiveJiraBaseUrl.replace(/\/$/, '')}/rest/api/2/user/assignable/search?issueKey=${issueKey}&query=${encodeURIComponent(query)}`
      const resp = await apiFetch('jira', url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (resp.ok) {
        const data = await resp.json() as AssignableUser[]
        setAssigneeResults(data)
      }
    } catch {
      // ignore
    } finally {
      setAssigneeLoading(false)
    }
  }, [effectiveJiraBaseUrl, issueKey])

  const debouncedSearch = useDebounce(doSearch, 300)

  function handlePriorityChange(value: string | null) {
    if (!value) return
    setPriorityEditing(false)
    mutation.mutate({ fieldName: 'priority', value: { name: value } })
  }

  function startSpEdit() {
    spOriginal.current = storyPoints
    setSpInput(storyPoints != null ? String(storyPoints) : '')
    setSpEditing(true)
  }

  function commitSpEdit() {
    setSpEditing(false)
    const num = Number(spInput)
    if (!isNaN(num) && num !== spOriginal.current) {
      mutation.mutate({ fieldName: storyPointsFieldKey, value: num })
    }
  }

  function cancelSpEdit() {
    setSpEditing(false)
  }

  function handleAssigneeSelect(user: AssignableUser) {
    setAssigneeOpen(false)
    setAssigneeQuery('')
    setAssigneeResults([])
    // DC format: { name: username } — NOT { accountId }
    mutation.mutate({ fieldName: 'assignee', value: { name: user.name } })
  }

  function handleLabelAdd() {
    const trimmed = labelInput.trim()
    if (!trimmed) return
    const currentLabels = f.labels ?? []
    mutation.mutate({ fieldName: 'labels', value: [...currentLabels, trimmed] })
    setLabelInput('')
    setLabelAdding(false)
  }

  function handleLabelRemove(label: string) {
    const currentLabels = f.labels ?? []
    mutation.mutate({ fieldName: 'labels', value: currentLabels.filter(l => l !== label) })
  }

  return (
    <div className="space-y-4 text-sm">
      <MetaRow label="Status"><Badge variant="outline">{f.status.name}</Badge></MetaRow>

      {/* Priority — click to edit with Select */}
      <MetaRow label="Priority">
        {priorityEditing ? (
          <div>
            <Select
              value={f.priority?.name ?? ''}
              onValueChange={handlePriorityChange}
              open
              onOpenChange={(open) => { if (!open) setPriorityEditing(false) }}
            >
              <SelectTrigger size="sm" className="h-6 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
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
              onChange={e => {
                setAssigneeQuery(e.target.value)
                debouncedSearch(e.target.value)
              }}
              autoFocus
              className="h-7 text-xs mb-2"
            />
            {assigneeLoading && (
              <p className="text-xs text-muted-foreground px-1">Searching...</p>
            )}
            {!assigneeLoading && assigneeResults.length === 0 && assigneeQuery.trim() && (
              <p className="text-xs text-muted-foreground px-1">No users found</p>
            )}
            {assigneeResults.map(user => (
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
                onChange={e => setSpInput(e.target.value)}
                onBlur={commitSpEdit}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitSpEdit()
                  if (e.key === 'Escape') cancelSpEdit()
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

      {/* Epic — stories only: key + name, navigable */}
      {isStory && (
        <MetaRow label="Epic">
          {epicLink ? (
            <button
              type="button"
              onClick={() => onOpenIssue?.(epicLink)}
              className="text-left hover:underline cursor-pointer"
            >
              <span className="font-mono text-xs">{epicLink}</span>
              {epicName && <span className="text-xs text-muted-foreground ml-1">— {epicName}</span>}
            </button>
          ) : '—'}
        </MetaRow>
      )}

      {/* Parent — subtasks only, navigable */}
      {isSubtask && f.parent && (
        <MetaRow label="Parent">
          <button
            type="button"
            onClick={() => onOpenIssue?.(f.parent!.key)}
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
          {(f.labels ?? []).map(l => (
            <span key={l} className="inline-flex items-center gap-0.5">
              <Badge variant="secondary" className="text-xs">{l}</Badge>
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
              onChange={e => setLabelInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleLabelAdd()
                if (e.key === 'Escape') { setLabelAdding(false); setLabelInput('') }
              }}
              onBlur={() => { if (!labelInput.trim()) setLabelAdding(false) }}
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
        <MetaRow label="Fix Versions">
          {f.fixVersions.map(v => v.name).join(', ')}
        </MetaRow>
      )}
      <MetaRow label="Created">{new Date(f.created).toLocaleDateString()}</MetaRow>
      <MetaRow label="Updated">{new Date(f.updated).toLocaleDateString()}</MetaRow>
      {f.duedate && <MetaRow label="Due">{new Date(f.duedate).toLocaleDateString()}</MetaRow>}

      {/* Linked issues */}
      {f.issuelinks.length > 0 && (
        <section>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Linked Issues</p>
          <ul className="space-y-1">
            {f.issuelinks.map(link => {
              const target = link.inwardIssue ?? link.outwardIssue
              const label = link.inwardIssue ? link.type.inward : link.type.outward
              if (!target) return null
              return (
                <li key={link.id} className="text-xs">
                  <span className="text-muted-foreground">{label}: </span>
                  <span className="font-mono">{target.key}</span>
                  <span className="text-muted-foreground"> — {target.fields.summary}</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">{label}</span>
      <span className="flex-1">{children}</span>
    </div>
  )
}
