/**
 * QuickCreateInput — inline issue creation input for a kanban column.
 *
 * Shows a small "+ Add" button at the bottom of each column.
 * On click, expands to a text input. Enter submits, Escape cancels.
 *
 * Submission flow:
 * 1. createIssue → new issue created in Jira's default status
 * 2. fetchTransitions → get valid transitions for the new issue
 * 3. postTransition → move to target column status (if transition exists)
 * 4. onCreated() → invalidate sprint board query so the board re-fetches
 *
 * If postTransition has no valid transition, the issue lands in its default
 * status; the board re-fetch will show it in the correct column.
 */
import { useState } from 'react'
import { createIssue, fetchTransitions, postTransition } from '@/services/jira'

interface QuickCreateInputProps {
  statusId: string
  statusName: string
  projectKey: string
  jiraBaseUrl: string
  jiraToken: string
  onCreated: () => void
}

export default function QuickCreateInput({
  statusId,
  statusName,
  projectKey,
  jiraBaseUrl,
  jiraToken,
  onCreated,
}: QuickCreateInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [value, setValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!value.trim()) return

    setIsSubmitting(true)
    setError(null)

    try {
      const { key: newKey } = await createIssue(jiraBaseUrl, jiraToken, projectKey, value.trim())

      // Attempt to move the new issue to the target column
      const transitions = await fetchTransitions(jiraBaseUrl, jiraToken, newKey)
      const t = transitions.find(tr => tr.to.id === statusId)
      if (t) {
        await postTransition(jiraBaseUrl, jiraToken, newKey, t.id)
      }

      setValue('')
      setIsOpen(false)
      setIsSubmitting(false)
      onCreated()
    } catch (err) {
      setIsSubmitting(false)
      setError(err instanceof Error ? err.message : 'Failed to create issue')
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1 px-1"
      >
        + Add
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1 mt-1">
      <div className="flex items-center gap-1">
        <input
          type="text"
          className="flex-1 text-xs border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder={`Issue summary...`}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              void handleSubmit()
            } else if (e.key === 'Escape') {
              setIsOpen(false)
              setValue('')
              setError(null)
            }
          }}
          disabled={isSubmitting}
          aria-label={`Add issue to ${statusName}`}
        />
        {isSubmitting && (
          <span className="text-xs text-muted-foreground">Creating...</span>
        )}
      </div>
      {error && (
        <p className="text-xs text-destructive px-1">{error}</p>
      )}
    </div>
  )
}
