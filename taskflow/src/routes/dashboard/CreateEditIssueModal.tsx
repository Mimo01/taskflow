import { useState, useEffect, useRef, useCallback } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { readSecret } from '@/services/stronghold'
import { useAuthStore } from '@/stores/auth.store'
import { useSettingsStore } from '@/stores/settings.store'
import { apiFetch } from '@/lib/apiFetch'
import {
  fetchCreatemeta,
  fetchIssueLinkTypes,
  createIssue,
  createIssueLink,
  bulkUpdateIssue,
  type CreatemetaField,
  type IssueLinkType,
  type JiraIssue,
  type JiraUser,
} from '@/services/jira'
import { DescriptionEditor } from './DescriptionEditor'
import { IssueLinkRow, type IssueLinkRowValue } from './IssueLinkRow'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EditInitialValues {
  issueKey: string
  summary: string
  description: string
  assigneeName: string | null
  priority: string | null
  storyPoints: number | null
  epicLinkKey: string | null
}

export interface CreateEditIssueModalProps {
  open: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  initialValues?: EditInitialValues
  // Pre-sets for "+ Add subtask" entry point:
  defaultIssueType?: 'Story' | 'Subtask' | 'Bug'
  defaultParentKey?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useDebounce<T extends unknown[]>(fn: (...args: T) => void, delay: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  return useCallback(
    (...args: T) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => fn(...args), delay)
    },
    [fn, delay],
  )
}

// Core field IDs to exclude from custom field rendering (already shown as core fields)
const CORE_FIELD_IDS = new Set([
  'summary',
  'description',
  'assignee',
  'priority',
  'issuetype',
  'project',
  'reporter',
])

const PRIORITY_OPTIONS = ['Highest', 'High', 'Medium', 'Low', 'Lowest']
const ISSUE_TYPES = ['Story', 'Subtask', 'Bug'] as const
type IssueType = (typeof ISSUE_TYPES)[number]

// ─── Createmeta issue types query ─────────────────────────────────────────────

interface CreatemtaIssueType {
  id: string
  name: string
  subtask: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CreateEditIssueModal({
  open,
  onClose,
  mode,
  initialValues,
  defaultIssueType,
  defaultParentKey,
}: CreateEditIssueModalProps) {
  const queryClient = useQueryClient()
  const { jiraBaseUrl, activeJiraProject } = useAuthStore()
  const { epicLinkFieldKey, storyPointsFieldKey, accountFieldKey } = useSettingsStore()

  const projectKey = activeJiraProject ?? ''

  // ── Form state ──────────────────────────────────────────────────────────────
  const [selectedIssueType, setSelectedIssueType] = useState<IssueType>(defaultIssueType ?? 'Story')
  const [summary, setSummary] = useState(initialValues?.summary ?? '')
  const [description, setDescription] = useState(initialValues?.description ?? '')
  const [assigneeInputValue, setAssigneeInputValue] = useState(initialValues?.assigneeName ?? '')
  const [selectedAssigneeName, setSelectedAssigneeName] = useState<string | null>(
    initialValues?.assigneeName ?? null,
  )
  const [timeEstimate, setTimeEstimate] = useState('')
  const [priority, setPriority] = useState<string | null>(initialValues?.priority ?? null)
  const [storyPoints, setStoryPoints] = useState<string>(
    initialValues?.storyPoints != null ? String(initialValues.storyPoints) : '',
  )
  const [epicLinkKey, setEpicLinkKey] = useState<string | null>(
    initialValues?.epicLinkKey ?? null,
  )
  const [epicOpen, setEpicOpen] = useState(false)
  const [epicFilter, setEpicFilter] = useState('')
  const [parentKey, setParentKey] = useState<string | null>(defaultParentKey ?? null)
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({})
  const [assigneeResults, setAssigneeResults] = useState<JiraUser[]>([])
  const [assigneeLoading, setAssigneeLoading] = useState(false)
  const [showAssigneeResults, setShowAssigneeResults] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [linkRows, setLinkRows] = useState<IssueLinkRowValue[]>([])

  // ── Reset form state on each open ────────────────────────────────────────────
  // The component stays mounted in AppLayout between opens; useState initializers
  // only run once, so we must re-sync from props whenever the modal opens.
  useEffect(() => {
    if (!open) return
    setSelectedIssueType(defaultIssueType ?? 'Story')
    setSummary(initialValues?.summary ?? '')
    setDescription(initialValues?.description ?? '')
    setAssigneeInputValue(initialValues?.assigneeName ?? '')
    setSelectedAssigneeName(initialValues?.assigneeName ?? null)
    setTimeEstimate('')
    setPriority(initialValues?.priority ?? null)
    setStoryPoints(initialValues?.storyPoints != null ? String(initialValues.storyPoints) : '')
    setEpicLinkKey(initialValues?.epicLinkKey ?? null)
    setEpicOpen(false)
    setEpicFilter('')
    setParentKey(defaultParentKey ?? null)
    setCustomFieldValues({})
    setAssigneeResults([])
    setShowAssigneeResults(false)
    setApiError(null)
    setLinkRows([])
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Issue type ID resolution for createmeta ──────────────────────────────────
  const { data: issueTypes } = useQuery<CreatemtaIssueType[]>({
    queryKey: ['createmeta-issuetypes', projectKey],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null)
      if (!token || !jiraBaseUrl || !projectKey) return []
      const base = jiraBaseUrl.replace(/\/$/, '')
      const resp = await apiFetch(
        'jira',
        `${base}/rest/api/2/issue/createmeta/${projectKey}/issuetypes`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!resp.ok) return []
      const data = await resp.json()
      return (data.values ?? []) as CreatemtaIssueType[]
    },
    enabled: open && !!projectKey && !!jiraBaseUrl,
    staleTime: 5 * 60 * 1000,
  })

  const selectedIssueTypeId =
    issueTypes?.find((t) => t.name === selectedIssueType)?.id ?? ''

  // ── Createmeta fields for selected issue type ────────────────────────────────
  const { data: creatметаFields, isLoading: creatметаLoading } = useQuery<CreatemetaField[]>({
    queryKey: ['createmeta', projectKey, selectedIssueTypeId, selectedIssueType],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null)
      if (!token || !jiraBaseUrl || !projectKey) return []
      return fetchCreatemeta(jiraBaseUrl, token, projectKey, selectedIssueTypeId, selectedIssueType)
    },
    enabled: open && !!projectKey && !!jiraBaseUrl && !!selectedIssueTypeId,
    staleTime: 5 * 60 * 1000,
  })

  // Filter createmeta to only required custom fields not covered by core UI
  const customRequiredFields = (creatметаFields ?? []).filter((f) => {
    if (!f.required) return false
    if (CORE_FIELD_IDS.has(f.fieldId)) return false
    // Exclude epicLinkFieldKey, storyPointsFieldKey, accountFieldKey (handled as core)
    if (epicLinkFieldKey && f.fieldId === epicLinkFieldKey) return false
    if (storyPointsFieldKey && f.fieldId === storyPointsFieldKey) return false
    if (accountFieldKey && f.fieldId === accountFieldKey) return false
    return true
  })

  // ── Epics for Epic Link dropdown ─────────────────────────────────────────────
  const { data: epics } = useQuery<JiraIssue[]>({
    queryKey: ['epics', projectKey],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null)
      if (!token || !jiraBaseUrl || !projectKey) return []
      const base = jiraBaseUrl.replace(/\/$/, '')
      const jql = `project = ${projectKey} AND issuetype = Epic AND statusCategory != Done ORDER BY updated DESC`
      const resp = await apiFetch(
        'jira',
        `${base}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=summary,status&maxResults=50`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!resp.ok) return []
      const data = await resp.json()
      return (data.issues ?? []) as JiraIssue[]
    },
    enabled: open && !!projectKey && !!jiraBaseUrl && selectedIssueType !== 'Subtask',
    staleTime: 5 * 60 * 1000,
  })

  // ── Issue link types ─────────────────────────────────────────────────────────
  const { data: linkTypes = [], isLoading: linkTypesLoading } = useQuery<IssueLinkType[]>({
    queryKey: ['jira-link-types', jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null)
      if (!token || !jiraBaseUrl) return []
      return fetchIssueLinkTypes(jiraBaseUrl, token)
    },
    enabled: open && !!jiraBaseUrl,
    staleTime: 5 * 60 * 1000,
  })

  // ── Assignee search ──────────────────────────────────────────────────────────
  const doSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setAssigneeResults([])
        return
      }
      setAssigneeLoading(true)
      try {
        const token = await readSecret('jira-pat').catch(() => null)
        if (!token || !jiraBaseUrl) return
        const base = jiraBaseUrl.replace(/\/$/, '')
        const resp = await apiFetch(
          'jira',
          `${base}/rest/api/2/user/assignable/search?project=${projectKey}&query=${encodeURIComponent(query)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        if (resp.ok) {
          const data = (await resp.json()) as JiraUser[]
          setAssigneeResults(data)
        }
      } catch {
        // ignore
      } finally {
        setAssigneeLoading(false)
      }
    },
    [jiraBaseUrl, projectKey],
  )

  const debouncedSearch = useDebounce(doSearch, 300)

  // ── Submit validation ────────────────────────────────────────────────────────
  const requiredCustomFieldsFilled = customRequiredFields.every(
    (f) => (customFieldValues[f.fieldId] ?? '').trim() !== '',
  )
  const isSubtask = selectedIssueType === 'Subtask'

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null)
      if (!token || !jiraBaseUrl || !projectKey) throw new Error('No credentials')

      const options: Record<string, unknown> = {}

      if (description.trim()) options.description = description
      if (selectedAssigneeName) options.assignee = { name: selectedAssigneeName }
      if (priority) options.priority = { name: priority }
      if (!isSubtask && storyPoints !== '' && storyPointsFieldKey)
        options[storyPointsFieldKey] = Number(storyPoints)

      if (isSubtask) {
        if (parentKey) options.parent = { key: parentKey }
        if (timeEstimate.trim()) options.timetracking = { originalEstimate: timeEstimate.trim() }
        // CRITICAL: never include epicLinkFieldKey or storyPointsFieldKey on Subtasks
      } else {
        if (epicLinkKey && epicLinkFieldKey) options[epicLinkFieldKey] = epicLinkKey
      }

      // Add custom field values
      for (const [k, v] of Object.entries(customFieldValues)) {
        if (v.trim() !== '') options[k] = v
      }

      const newIssue = await createIssue(jiraBaseUrl, token, projectKey, summary.trim(), {
        issuetype: selectedIssueType,
        ...options,
      })

      // Post-create: create issue links (Jira DC constraint — cannot be in create body)
      for (const row of linkRows) {
        if (!row.linkTypeId || !row.issueKey) continue
        try {
          await createIssueLink(jiraBaseUrl, token, row.linkTypeId, newIssue.key, row.issueKey)
        } catch (e) {
          console.error('Failed to create issue link:', e)
          // Individual link failures are silent — do not fail the overall submit
        }
      }

      return newIssue
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] })
      queryClient.invalidateQueries({ queryKey: ['jira-issues', 'my-tasks'] })
      setApiError(null)
      onClose()
    },
    onError: (err: Error) => {
      setApiError(err.message)
    },
  })

  const editMutation = useMutation({
    mutationFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null)
      if (!token || !jiraBaseUrl || !initialValues?.issueKey)
        throw new Error('No credentials or issue key')

      const fields: Record<string, unknown> = {
        summary: summary.trim(),
      }

      if (description.trim() !== (initialValues.description ?? '')) {
        fields.description = description
      }
      if (selectedAssigneeName !== initialValues.assigneeName) {
        fields.assignee = selectedAssigneeName ? { name: selectedAssigneeName } : null
      }
      if (priority !== initialValues.priority) {
        fields.priority = priority ? { name: priority } : null
      }
      if (storyPoints !== '' && storyPointsFieldKey) {
        const sp = Number(storyPoints)
        if (!isNaN(sp)) fields[storyPointsFieldKey] = sp
      }
      if (epicLinkKey !== initialValues.epicLinkKey && epicLinkFieldKey) {
        fields[epicLinkFieldKey] = epicLinkKey
      }

      // Add custom field values
      for (const [k, v] of Object.entries(customFieldValues)) {
        if (v.trim() !== '') fields[k] = v
      }

      await bulkUpdateIssue(jiraBaseUrl, token, initialValues.issueKey, fields)

      // Post-update: create new issue links
      for (const row of linkRows) {
        if (!row.linkTypeId || !row.issueKey) continue
        try {
          await createIssueLink(jiraBaseUrl, token, row.linkTypeId, initialValues.issueKey, row.issueKey)
        } catch (e) {
          console.error('Failed to create issue link:', e)
          // Individual link failures are silent — do not fail the overall submit
        }
      }
    },
    onSuccess: () => {
      if (initialValues?.issueKey && jiraBaseUrl) {
        queryClient.invalidateQueries({
          queryKey: ['jira-issue-detail', initialValues.issueKey, jiraBaseUrl],
        })
      }
      queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] })
      setApiError(null)
      onClose()
    },
    onError: (err: Error) => {
      setApiError(err.message)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setApiError(null)
    if (mode === 'create') {
      createMutation.mutate()
    } else {
      editMutation.mutate()
    }
  }

  const isPending = createMutation.isPending || editMutation.isPending

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[680px] max-h-[85vh] overflow-y-auto bg-background border rounded-lg shadow-xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-lg font-semibold">
              {mode === 'create' ? 'Create Issue' : 'Edit Issue'}
            </h2>
            <Dialog.Close
              render={
                <button
                  type="button"
                  className="rounded p-1 hover:bg-accent"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              }
            />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-4">
            {/* Issue Type Switcher — create mode only */}
            {mode === 'create' && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Issue Type</label>
                {defaultIssueType ? (
                  <div className="flex h-9 w-full items-center rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
                    {selectedIssueType}
                  </div>
                ) : (
                  <Select
                    value={selectedIssueType}
                    onValueChange={(v) => {
                      setSelectedIssueType(v as IssueType)
                      // Reset parent/epic when switching types
                      setParentKey(null)
                      setEpicLinkKey(null)
                    }}
                  >
                    <SelectTrigger className="w-full">
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
                )}
              </div>
            )}

            {/* Summary (required) */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">
                Summary <span className="text-destructive">*</span>
              </label>
              <Input
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Issue summary"
                required
                disabled={isPending}
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Description</label>
              <DescriptionEditor
                value={description}
                onChange={setDescription}
                disabled={isPending}
              />
            </div>

            {/* Parent — Subtask only */}
            {selectedIssueType === 'Subtask' && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">
                  Parent <span className="text-destructive">*</span>
                </label>
                {defaultParentKey ? (
                  <div className="flex h-9 w-full items-center rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground font-mono">
                    {parentKey}
                  </div>
                ) : (
                  <Input
                    value={parentKey ?? ''}
                    onChange={(e) => setParentKey(e.target.value || null)}
                    placeholder="Parent issue key (e.g. PROJ-123)"
                    disabled={isPending}
                  />
                )}
              </div>
            )}

            {/* Epic Link — Story and Bug only */}
            {selectedIssueType !== 'Subtask' && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Epic Link</label>
                {epicOpen ? (
                  <div className="rounded-md border shadow-sm">
                    <input
                      autoFocus
                      value={epicFilter}
                      onChange={(e) => setEpicFilter(e.target.value)}
                      placeholder="Filter epics..."
                      className="w-full rounded-t-md px-3 py-2 text-sm outline-none border-b bg-background"
                      onBlur={() => setTimeout(() => setEpicOpen(false), 150)}
                    />
                    <div className="max-h-48 overflow-y-auto">
                      <button
                        type="button"
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent text-muted-foreground"
                        onMouseDown={() => { setEpicLinkKey(null); setEpicFilter(''); setEpicOpen(false) }}
                      >
                        None
                      </button>
                      {(epics ?? [])
                        .filter((e) =>
                          epicFilter === '' ||
                          e.key.toLowerCase().includes(epicFilter.toLowerCase()) ||
                          e.fields.summary.toLowerCase().includes(epicFilter.toLowerCase()),
                        )
                        .map((epic) => (
                          <button
                            key={epic.key}
                            type="button"
                            className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
                            onMouseDown={() => { setEpicLinkKey(epic.key); setEpicFilter(''); setEpicOpen(false) }}
                          >
                            <span className="font-mono text-xs text-muted-foreground">{epic.key}</span>
                            {' '}{epic.fields.summary}
                          </button>
                        ))}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setEpicOpen(true); setEpicFilter('') }}
                    disabled={isPending}
                    className="flex h-9 w-full items-center rounded-md border bg-background px-3 py-2 text-sm text-left shadow-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {epicLinkKey
                      ? epics?.find((e) => e.key === epicLinkKey)
                        ? `${epicLinkKey}: ${epics!.find((e) => e.key === epicLinkKey)!.fields.summary}`
                        : epicLinkKey
                      : <span className="text-muted-foreground">Select epic (optional)</span>}
                  </button>
                )}
              </div>
            )}

            {/* Assignee */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Assignee</label>
              <Input
                value={assigneeInputValue}
                onChange={(e) => {
                  setAssigneeInputValue(e.target.value)
                  setSelectedAssigneeName(null)
                  setShowAssigneeResults(true)
                  debouncedSearch(e.target.value)
                }}
                onFocus={() => {
                  if (selectedAssigneeName) {
                    // Clear so the user can type a fresh search immediately
                    setAssigneeInputValue('')
                    setSelectedAssigneeName(null)
                    setAssigneeResults([])
                  }
                  setShowAssigneeResults(true)
                }}
                onBlur={() => setTimeout(() => setShowAssigneeResults(false), 150)}
                placeholder="Search assignee..."
                disabled={isPending}
              />
              {showAssigneeResults && (assigneeLoading || assigneeResults.length > 0) && (
                <div className="mt-1 rounded-lg border bg-popover shadow-md">
                  {assigneeLoading && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Searching...
                    </div>
                  )}
                  {assigneeResults.map((user) => (
                    <button
                      key={user.name}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                      onMouseDown={() => {
                        setSelectedAssigneeName(user.name)
                        setAssigneeInputValue(user.displayName)
                        setAssigneeResults([])
                        setShowAssigneeResults(false)
                      }}
                    >
                      {user.displayName} ({user.name})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Priority */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Priority</label>
              <Select value={priority ?? ''} onValueChange={(v) => setPriority(v || null)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select priority (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Story Points — non-subtask only */}
            {!isSubtask && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Story Points</label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={storyPoints}
                  onChange={(e) => setStoryPoints(e.target.value)}
                  placeholder="Optional"
                  disabled={isPending}
                />
              </div>
            )}

            {/* Time Estimate — subtask only */}
            {isSubtask && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Time Estimate</label>
                <Input
                  value={timeEstimate}
                  onChange={(e) => setTimeEstimate(e.target.value)}
                  placeholder="e.g. 2h, 1d 3h, 30m"
                  disabled={isPending}
                />
              </div>
            )}

            {/* Custom Required Fields — from createmeta */}
            {creatметаLoading && !creatметаFields && (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-full" />
              </div>
            )}
            {customRequiredFields.map((field) => (
              <div key={field.fieldId} className="flex flex-col gap-1">
                <label className="text-sm font-medium">
                  {field.name} <span className="text-destructive">*</span>
                </label>
                {field.schema.allowedValues && field.schema.allowedValues.length > 0 ? (
                  <Select
                    value={customFieldValues[field.fieldId] ?? ''}
                    onValueChange={(v) =>
                      setCustomFieldValues((prev) => ({ ...prev, [field.fieldId]: v ?? '' }))
                    }
                  >
                    <SelectTrigger className="w-full">
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
                    value={customFieldValues[field.fieldId] ?? ''}
                    onChange={(e) =>
                      setCustomFieldValues((prev) => ({
                        ...prev,
                        [field.fieldId]: e.target.value,
                      }))
                    }
                    placeholder={field.name}
                    disabled={isPending}
                  />
                )}
              </div>
            ))}

            {/* Issue Links */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Issue Links</label>
                <button
                  type="button"
                  disabled={isPending || linkTypesLoading}
                  aria-label="Add link"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                  onClick={() =>
                    setLinkRows((prev) => [
                      ...prev,
                      { id: (crypto.randomUUID?.() ?? `link-${Date.now()}-${Math.random()}`), linkTypeId: '', issueKey: '' },
                    ])
                  }
                >
                  <Plus className="h-3 w-3" />
                  Add link
                </button>
              </div>
              {linkRows.map((row) => (
                <IssueLinkRow
                  key={row.id}
                  linkTypes={linkTypes}
                  value={row}
                  onChange={(updated) =>
                    setLinkRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
                  }
                  onRemove={() => setLinkRows((prev) => prev.filter((r) => r.id !== row.id))}
                />
              ))}
            </div>

            {/* API Error */}
            {apiError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {apiError}
              </p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!summary.trim() || !requiredCustomFieldsFilled || isPending}
              >
                {isPending
                  ? mode === 'create'
                    ? 'Creating...'
                    : 'Saving...'
                  : mode === 'create'
                    ? 'Create'
                    : 'Save'}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
