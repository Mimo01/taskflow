/**
 * StatusPopover — Inline popover for Jira issue status transitions.
 *
 * Fetches available transitions lazily on first open (not on mount).
 * Calls onSelect(transitionId, toStatusName) when user picks a transition.
 * disabled prop prevents opening while a mutation is in-flight.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { fetchTransitions } from '@/services/jira'

interface StatusPopoverProps {
  issueKey: string
  currentStatus: string
  jiraBaseUrl: string
  token: string
  onSelect: (transitionId: string, toStatusName: string) => void
  disabled?: boolean
}

export default function StatusPopover({
  issueKey,
  currentStatus,
  jiraBaseUrl,
  token,
  onSelect,
  disabled = false,
}: StatusPopoverProps) {
  const [open, setOpen] = useState(false)

  const { data: transitions, isLoading, isError, refetch } = useQuery({
    queryKey: ['transitions', issueKey],
    queryFn: () => fetchTransitions(jiraBaseUrl, token, issueKey),
    enabled: false, // Lazy — only fetch when popover opens
  })

  function handleOpenChange(newOpen: boolean) {
    if (disabled) return
    setOpen(newOpen)
    if (newOpen) {
      refetch()
    }
  }

  function handleSelect(transitionId: string, toStatusName: string) {
    onSelect(transitionId, toStatusName)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        disabled={disabled}
        aria-label={currentStatus}
        className="cursor-pointer rounded-full border border-border px-2 py-0.5 text-xs text-foreground hover:bg-accent transition-colors whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60"
      >
        {currentStatus}
      </PopoverTrigger>
      <PopoverContent className="p-1 min-w-[160px]">
        {isLoading && (
          <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
        )}
        {isError && (
          <div className="px-3 py-2 text-sm text-destructive">Unable to load transitions</div>
        )}
        {!isLoading && !isError && transitions && transitions.map((transition) => (
          <button
            key={transition.id}
            type="button"
            onClick={() => handleSelect(transition.id, transition.to.name)}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent rounded"
          >
            → {transition.name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
