import type { JiraIssueDetail } from '@/services/jira'
import { Badge } from '@/components/ui/badge'

interface IssueDetailSidebarProps {
  issue: JiraIssueDetail
  storyPointsFieldKey: string
  epicLinkFieldKey: string
  epicNameFieldKey: string
  sprintFieldKey: string
}

export function IssueDetailSidebar({ issue, storyPointsFieldKey, epicNameFieldKey, sprintFieldKey }: IssueDetailSidebarProps) {
  const f = issue.fields
  const storyPoints = f[storyPointsFieldKey] as number | null
  const epicName = f[epicNameFieldKey] as string | null
  const rawSprint = f[sprintFieldKey] as Array<{ name: string; state: string }> | string | null | undefined
  const sprintName = typeof rawSprint === 'string'
    ? rawSprint
    : Array.isArray(rawSprint)
      ? (rawSprint.find(s => s.state === 'active') ?? rawSprint[0])?.name ?? null
      : null

  return (
    <div className="space-y-4 text-sm">
      <MetaRow label="Status"><Badge variant="outline">{f.status.name}</Badge></MetaRow>
      <MetaRow label="Priority">{f.priority?.name ?? '—'}</MetaRow>
      <MetaRow label="Assignee">{f.assignee?.displayName ?? 'Unassigned'}</MetaRow>
      <MetaRow label="Reporter">{f.reporter?.displayName ?? '—'}</MetaRow>
      <MetaRow label="Story Points">{storyPoints != null ? String(storyPoints) : '—'}</MetaRow>
      <MetaRow label="Epic">{epicName ?? '—'}</MetaRow>
      <MetaRow label="Sprint">{sprintName ?? 'No sprint'}</MetaRow>
      {f.labels.length > 0 && (
        <MetaRow label="Labels">
          <div className="flex flex-wrap gap-1">
            {f.labels.map(l => <Badge key={l} variant="secondary" className="text-xs">{l}</Badge>)}
          </div>
        </MetaRow>
      )}
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
      <span className="text-xs text-muted-foreground w-24 shrink-0 pt-0.5">{label}</span>
      <span className="flex-1">{children}</span>
    </div>
  )
}
