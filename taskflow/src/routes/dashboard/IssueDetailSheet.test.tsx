import { describe, it } from 'vitest'

// Wave 0 scaffold — implementation in plans 04-08.
// These stubs exist so `vitest run` passes on every wave before the component ships.

describe('IssueDetailSheet', () => {
  describe('ISSUE-01: open/close', () => {
    it.todo('renders sheet open when issueKey is a non-null string')
    it.todo('renders sheet closed when issueKey is null')
    it.todo('calls onClose when Sheet onOpenChange fires with false')
  })

  describe('ISSUE-04: optimistic field update', () => {
    it.todo('applies optimistic update to assignee field immediately')
    it.todo('rolls back assignee to previous value when mutation errors')
    it.todo('applies optimistic update to priority field immediately')
    it.todo('applies optimistic update to story points field immediately')
    it.todo('applies optimistic update to labels field immediately')
  })

  describe('ISSUE-05: subtask list', () => {
    it.todo('renders each subtask with key, summary, and status badge')
    it.todo('clicking a subtask calls onOpenIssue with the subtask key')
  })

  describe('ISSUE-06: linked issues', () => {
    it.todo('renders inward linked issues with type.inward label')
    it.todo('renders outward linked issues with type.outward label')
  })

  describe('ISSUE-07: comment thread', () => {
    it.todo('renders comments ordered newest-first')
    it.todo('each comment shows author displayName and relative timestamp')
    it.todo('renders comment body through WikiRenderer (wiki markup converted)')
  })

  describe('ISSUE-08: post comment', () => {
    it.todo('calls postComment with issueKey and compose box text on submit')
    it.todo('clears compose box after successful submission')
  })

  describe('ISSUE-09: open in Jira deep link', () => {
    it.todo('calls openUrl with ${jiraBaseUrl}/browse/${issueKey} when button clicked')
  })
})
