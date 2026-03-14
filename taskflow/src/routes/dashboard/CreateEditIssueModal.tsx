import { useState, useRef, useCallback } from 'react'
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
  createIssue,
  bulkUpdateIssue,
  type CreatemetaField,
  type JiraIssue,
  type JiraUser,
} from '@/services/jira'
import { DescriptionEditor } from './DescriptionEditor'

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
}: CreateEditIssueModalProps) {
  const queryClient = useQueryClient()
  const { jiraBaseUrl, activeJiraProject } = useAuthStore()
  const { epicLinkFieldKey, storyPointsFieldKey, accountFieldKey } = useSettingsStore()

  const projectKey = activeJiraProject ?? ''

  // ── Form state ──────────────────────────────────────────────────────────────
  const [selectedIssueType, setSelectedIssueType] = useState<IssueType>('Story')
  const [summary, setSummary] = useState(initialValues?.summary ?? '')
  const [description, setDescription] = useState(initialValues?.description ?? '')
  const [assigneeQuery, setAssigneeQuery] = useState('')
  const [selectedAssigneeName, setSelectedAssigneeName] = useState<string | null>(
    initialValues?.assigneeName ?? null,
  )
  const [priority, setPriority] = useState<string | null>(initialValues?.priority ?? null)
  const [storyPoints, setStoryPoints] = useState<string>(
    initialValues?.storyPoints != null ? String(initialValues.storyPoints) : '',
  )
  const [epicLinkKey, setEpicLinkKey] = useState<string | null>(
    initialValues?.epicLinkKey ?? null,
  )
  const [parentKey, setParentKey] = useState<string | null>(null)
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({})
  const [assigneeResults, setAssigneeResults] = useState<JiraUser[]>([])
  const [assigneeLoading, setAssigneeLoading] = useState(false)
  const [showAssigneeResults, setShowAssigneeResults] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

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
      if (storyPoints !== '' && storyPointsFieldKey)
        options[storyPointsFieldKey] = Number(storyPoints)

      if (isSubtask) {
        if (parentKey) options.parent = { key: parentKey }
        // CRITICAL: never include epicLinkFieldKey on Subtasks
      } else {
        if (epicLinkKey && epicLinkFieldKey) options[epicLinkFieldKey] = epicLinkKey
      }

      // Add custom field values
      for (const [k, v] of Object.entries(customFieldValues)) {
        if (v.trim() !== '') options[k] = v
      }

      return createIssue(jiraBaseUrl, token, projectKey, summary.trim(), {
        issuetype: selectedIssueType,
        ...options,
      })
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

      return bulkUpdateIssue(jiraBaseUrl, token, initialValues.issueKey, fields)
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
                <Input
                  value={parentKey ?? ''}
                  onChange={(e) => setParentKey(e.target.value || null)}
                  placeholder="Parent issue key (e.g. PROJ-123)"
                  disabled={isPending}
                />
              </div>
            )}

            {/* Epic Link — Story and Bug only */}
            {selectedIssueType !== 'Subtask' && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Epic Link</label>
                <Select
                  value={epicLinkKey ?? ''}
                  onValueChange={(v) => setEpicLinkKey(v || null)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select epic (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {(epics ?? []).map((epic) => (
                      <SelectItem key={epic.key} value={epic.key}>
                        {epic.key}: {epic.fields.summary}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Assignee */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Assignee</label>
              <div className="relative">
                <Input
                  value={selectedAssigneeName ? selectedAssigneeName : assigneeQuery}
                  onChange={(e) => {
                    if (selectedAssigneeName) {
                      setSelectedAssigneeName(null)
                      setAssigneeQuery(e.target.value)
                    } else {
                      setAssigneeQuery(e.target.value)
                    }
                    setShowAssigneeResults(true)
                    debouncedSearch(e.target.value)
                  }}
                  onFocus={() => setShowAssigneeResults(true)}
                  onBlur={() => setTimeout(() => setShowAssigneeResults(false), 150)}
                  placeholder="Search assignee..."
                  disabled={isPending}
                />
                {showAssigneeResults && (assigneeLoading || assigneeResults.length > 0) && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border bg-popover shadow-md">
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
                          setAssigneeQuery('')
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

            {/* Story Points */}
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

            {/* Issue Links placeholder (plan 11-03 will add IssueLinkRow here) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Issue Links</label>
                <button
                  type="button"
                  disabled={isPending}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                  // Link rows will be managed by plan 11-03
                >
                  <Plus className="h-3 w-3" />
                  Add link
                </button>
              </div>
              {/* IssueLinkRow components will be inserted here in plan 11-03 */}
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
