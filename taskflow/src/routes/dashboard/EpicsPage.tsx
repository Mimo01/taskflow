/**
 * EpicsPage — Full-page /epics route component.
 *
 * Loads only basic epic data (name, status, assignee). Story counts and
 * progress are deferred to EpicDetailSheet — no expensive bulk story query here.
 */
import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { EpicEnriched } from '@/services/jira'
import { fetchEpicsBasic } from '@/services/jira'
import { useSettingsStore } from '@/stores/settings.store'
import { useAuthStore } from '@/stores/auth.store'
import { readSecret } from '@/services/stronghold'
import { CreateEpicDialog } from './CreateEpicDialog'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(displayName: string): string {
  return displayName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

// ── EpicRow ───────────────────────────────────────────────────────────────────

interface EpicRowProps {
  epic: EpicEnriched
  onEpicClick?: (key: string) => void
}

function EpicRow({ epic, onEpicClick }: EpicRowProps) {
  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      {/* Epic name */}
      <td className="px-4 py-3">
        <button
          type="button"
          className="text-sm font-medium text-left hover:underline"
          onClick={() => onEpicClick?.(epic.key)}
        >
          {epic.epicName}
        </button>
      </td>

      {/* Epic key */}
      <td className="px-3 py-3 text-xs text-muted-foreground font-mono">
        {epic.key}
      </td>

      {/* Status badge */}
      <td className="px-3 py-3">
        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground border-border">
          {epic.status.name}
        </span>
      </td>

      {/* Assignee */}
      <td className="px-3 py-3">
        {epic.assignee ? (
          <div className="relative h-6 w-6" title={epic.assignee.displayName}>
            {epic.assignee.avatarUrls?.['48x48'] && (
              <img
                src={epic.assignee.avatarUrls['48x48']}
                alt={epic.assignee.displayName}
                className="h-6 w-6 rounded-full"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const sib = e.currentTarget.nextElementSibling as HTMLElement | null
                  if (sib) sib.style.display = 'flex'
                }}
              />
            )}
            <div
              className="h-6 w-6 rounded-full bg-primary text-primary-foreground items-center justify-center text-xs font-medium"
              style={{ display: epic.assignee.avatarUrls?.['48x48'] ? 'none' : 'flex' }}
            >
              {getInitials(epic.assignee.displayName)}
            </div>
          </div>
        ) : null}
      </td>
    </tr>
  )
}

// ── EpicsPage ─────────────────────────────────────────────────────────────────

export default function EpicsPage() {
  const ctx = useOutletContext<{ onEpicClick?: (key: string) => void; [key: string]: unknown }>() ?? {}
  const onEpicClick = ctx.onEpicClick

  const { jiraBaseUrl, activeJiraProject } = useAuthStore()
  const { epicNameFieldKey } = useSettingsStore()

  const [token, setToken] = useState<string | null>(null)
  useEffect(() => {
    readSecret('jira-pat').then(setToken).catch(() => setToken(null))
  }, [])

  const [createOpen, setCreateOpen] = useState(false)

  const { data: epicsData, isLoading } = useQuery<EpicEnriched[]>({
    queryKey: ['jira-epics-basic', activeJiraProject, jiraBaseUrl],
    queryFn: () =>
      fetchEpicsBasic(
        jiraBaseUrl!,
        token!,
        activeJiraProject!,
        epicNameFieldKey ?? undefined,
      ),
    enabled: !!jiraBaseUrl && !!token && !!activeJiraProject,
  })
  const epics = epicsData ?? []

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
        <h1 className="text-xl font-semibold">Epics</h1>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent transition-colors"
        >
          + Create Epic
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : (
          <>
            {epics.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/10">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                      Name
                    </th>
                    <th className="w-28 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Key
                    </th>
                    <th className="w-32 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="w-12 px-3 py-2 text-xs font-medium text-muted-foreground">
                      Assignee
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {epics.map((epic) => (
                    <EpicRow key={epic.key} epic={epic} onEpicClick={onEpicClick} />
                  ))}
                </tbody>
              </table>
            ) : null}

            {epicsData !== undefined && epics.length === 0 && (
              <p className="text-center text-muted-foreground py-12">
                No epics found for this project.
              </p>
            )}
          </>
        )}
      </div>

      <CreateEpicDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
