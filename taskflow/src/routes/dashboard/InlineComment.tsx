/**
 * InlineComment — Expandable inline textarea for adding Jira comments.
 *
 * When isOpen=false: renders nothing.
 * When isOpen=true: shows existing comments list (if any) above textarea with Submit/Cancel buttons.
 * Submit is disabled when textarea is empty or isSubmitting is true.
 * Error prop shows inline error text below textarea.
 */
import { useState, useRef, useEffect } from 'react'
import type { JiraComment } from '@/services/jira'

interface InlineCommentProps {
  issueKey: string
  isOpen: boolean
  onCancel: () => void
  onSubmit: (comment: string) => void
  isSubmitting: boolean
  error?: string
  existingComments?: JiraComment[]
  isLoadingComments?: boolean
}

export default function InlineComment({
  issueKey: _issueKey,
  isOpen,
  onCancel,
  onSubmit,
  isSubmitting,
  error,
  existingComments,
  isLoadingComments,
}: InlineCommentProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen) {
      textareaRef.current?.focus()
    } else {
      setText('')
    }
  }, [isOpen])

  if (!isOpen) return null

  function handleCancel() {
    setText('')
    onCancel()
  }

  function handleSubmit() {
    if (text.trim()) {
      onSubmit(text.trim())
    }
  }

  return (
    <div className="px-3 pb-2 flex flex-col gap-1.5">
      {isLoadingComments && (
        <p className="text-xs text-muted-foreground py-1">Loading comments...</p>
      )}
      {!isLoadingComments && existingComments && existingComments.length > 0 && (
        <div className="flex flex-col gap-2 mb-2 max-h-48 overflow-y-auto">
          {existingComments.map((c) => (
            <div key={c.id} className="rounded border border-border bg-muted/30 px-2 py-1.5 text-xs">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-medium text-foreground">{c.author.displayName}</span>
                <span className="text-muted-foreground">{new Date(c.created).toLocaleString()}</span>
              </div>
              <p className="text-foreground whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
        </div>
      )}
      <textarea
        ref={textareaRef}
        rows={3}
        placeholder="Add a comment..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {error && (
        <p className="text-xs text-destructive">Failed to add comment — try again</p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || text.trim().length === 0}
          className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
        >
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="rounded px-3 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
