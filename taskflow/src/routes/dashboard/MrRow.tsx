/**
 * MrRow — A single GitLab MR row in the MR Attention list.
 *
 * Shows: MR title (external link), author, stale badge (if stale),
 * review health dot (colored), and linked Jira task badge (if linked via Plan 03).
 *
 * Uses @tauri-apps/plugin-opener to open web_url in the system browser.
 */
import { cn } from '@/lib/utils'
import { isStale } from '@/services/linkEngine'
import type { GitLabMR } from '@/services/gitlab'
import type { JiraIssue } from '@/services/jira'
import type { ReviewHealth } from '@/services/linkEngine'
import { openUrl } from '@tauri-apps/plugin-opener'

const HEALTH_DOT_COLORS: Record<ReviewHealth, string> = {
  approved: 'bg-green-500',
  changes_requested: 'bg-red-500',
  waiting_for_review: 'bg-yellow-400',
}

interface MrRowProps {
  mr: GitLabMR
  linkedTask: JiraIssue | null
  staleMrThresholdDays: number
  reviewHealth?: ReviewHealth
  viaSubtaskKey?: string
}

export default function MrRow({ mr, linkedTask, staleMrThresholdDays, reviewHealth, viaSubtaskKey }: MrRowProps) {
  const stale = isStale(mr, staleMrThresholdDays)
  const staleDays = Math.floor(
    (Date.now() - new Date(mr.updated_at).getTime()) / 86_400_000,
  )

  const handleOpen = async (e: React.MouseEvent) => {
    e.preventDefault()
    try {
      await openUrl(mr.web_url)
    } catch {
      // Fallback if Tauri is not available (e.g., in tests)
      window.open(mr.web_url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="flex items-center gap-2 border-b border-border last:border-b-0 py-2 density-compact:py-1 density-comfortable:py-3 px-3">
      {/* MR title — opens in browser */}
      <a
        href={mr.web_url}
        onClick={handleOpen}
        className="flex-1 truncate text-sm hover:underline cursor-pointer"
        title={mr.title}
      >
        !{mr.iid} {mr.title}
      </a>

      {/* Author */}
      <span className="w-28 truncate text-sm text-muted-foreground">
        {mr.author.name}
      </span>

      {/* Review health dot */}
      {reviewHealth && (
        <span
          className={cn('inline-block size-2 rounded-full flex-shrink-0', HEALTH_DOT_COLORS[reviewHealth])}
          title={reviewHealth.replace(/_/g, ' ')}
        />
      )}

      {/* Stale badge */}
      {stale && (
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-800',
            'dark:bg-amber-900 dark:text-amber-200',
            'whitespace-nowrap',
          )}
        >
          Stale &bull; {staleDays}d
        </span>
      )}

      {/* Linked task badge */}
      {linkedTask && (
        <span className="rounded border border-border px-1.5 py-0.5 text-xs font-mono whitespace-nowrap">
          {linkedTask.key}{' '}
          <span className="text-muted-foreground">{linkedTask.fields.status.name}</span>
        </span>
      )}

      {/* Via subtask label — muted, only shown for subtask-path-only MRs */}
      {viaSubtaskKey && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          via {viaSubtaskKey}
        </span>
      )}
    </div>
  )
}
