/**
 * EpicsPage — Full-page /epics route component.
 *
 * Renders a table of epics with: name (clickable), status badge,
 * story count, story points, progress bar, and assignee avatar.
 * "+ Create Epic" button opens CreateEpicDialog (local state).
 * Clicking an epic name calls onEpicClick from Outlet context (wired in 13-04).
 */
import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { EpicEnriched } from '@/services/jira'
import { fetchEpicsWithEnrichment } from '@/services/jira'
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
  const pct =
    epic.totalStories > 0
      ? Math.round((epic.doneStories / epic.totalStories) * 100)
      : 0

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

      {/* Status badge */}
      <td className="px-3 py-3">
        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground border-border">
          {epic.status.name}
        </span>
      </td>

      {/* Story count */}
      <td className="px-3 py-3 text-sm text-center">
        {epic.totalStories}
      </td>

      {/* Story points */}
      <td className="px-3 py-3 text-sm text-center">
        {epic.totalPoints}
      </td>

      {/* Progress bar */}
      <td className="px-3 py-3">
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="w-20 h-1.5 rounded-full bg-muted"
        >
          <div
            className="h-1.5 rounded-full bg-green-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </td>

      {/* Assignee */}
      <td className="px-3 py-3">
        {epic.assignee ? (
          <div
            className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium"
            title={epic.assignee.displayName}
          >
            {getInitials(epic.assignee.displayName)}
          </div>
        ) : null}
      </td>
    </tr>
  )
}

// ── EpicsPage ─────────────────────────────────────────────────────────────────

export default function EpicsPage() {
  // Read Outlet context — onEpicClick may not be present until plan 13-04
  const ctx = useOutletContext<{ onEpicClick?: (key: string) => void; [key: string]: unknown }>() ?? {}
  const onEpicClick = ctx.onEpicClick

  // Auth (base URL and project from auth store, same as BacklogPage)
  const { jiraBaseUrl, activeJiraProject } = useAuthStore()

  // Settings (discovered custom field keys)
  const { storyPointsFieldKey, epicLinkFieldKey, epicNameFieldKey } = useSettingsStore()

  // PAT (same pattern as BacklogPage)
  const [token, setToken] = useState<string | null>(null)
  useEffect(() => {
    readSecret('jira-pat').then(setToken).catch(() => setToken(null))
  }, [])

  // CreateEpicDialog open state
  const [createOpen, setCreateOpen] = useState(false)

  // Epics query
  const { data: epicsData, isLoading } = useQuery<EpicEnriched[]>({
    queryKey: ['jira-epics', activeJiraProject, jiraBaseUrl],
    queryFn: () =>
      fetchEpicsWithEnrichment(
        jiraBaseUrl!,
        token!,
        activeJiraProject!,
        storyPointsFieldKey ?? undefined,
        epicLinkFieldKey ?? undefined,
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
                    <th className="w-32 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="w-20 px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                      Stories
                    </th>
                    <th className="w-20 px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                      Points
                    </th>
                    <th className="w-28 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Progress
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
