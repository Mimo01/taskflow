import { describe, it, expect } from 'vitest'
import { extractSprintName } from './IssueDetailSidebar'

describe('extractSprintName', () => {
  it('returns null for null/undefined', () => {
    expect(extractSprintName(null)).toBeNull()
    expect(extractSprintName(undefined)).toBeNull()
  })

  it('returns null for empty array', () => {
    expect(extractSprintName([])).toBeNull()
  })

  // Case 1: Array of objects (Jira Cloud / newer DC)
  it('extracts name from array of sprint objects — prefers active', () => {
    const sprints = [
      { id: 1, name: 'Sprint 3', state: 'closed' },
      { id: 2, name: 'Sprint 4', state: 'active' },
    ]
    expect(extractSprintName(sprints)).toBe('Sprint 4')
  })

  it('extracts name from array of sprint objects — falls back to first if no active', () => {
    const sprints = [
      { id: 1, name: 'Sprint 3', state: 'closed' },
      { id: 2, name: 'Sprint 4', state: 'future' },
    ]
    expect(extractSprintName(sprints)).toBe('Sprint 3')
  })

  it('handles state in uppercase (ACTIVE) for sprint objects', () => {
    const sprints = [{ id: 1, name: 'Sprint 5', state: 'ACTIVE' }]
    expect(extractSprintName(sprints)).toBe('Sprint 5')
  })

  it('handles single-element array of objects', () => {
    expect(extractSprintName([{ id: 1, name: 'Sprint 5', state: 'active' }])).toBe('Sprint 5')
  })

  // Case 2: Array of Java toString strings (older Jira DC)
  it('parses sprint name from Jira DC toString format in array', () => {
    const raw = [
      'com.atlassian.greenhopper.service.sprint.Sprint@2d38e7ba[id=1,rapidViewId=5,state=ACTIVE,name=Sprint 42,startDate=2026-03-01,endDate=2026-03-15]',
    ]
    expect(extractSprintName(raw)).toBe('Sprint 42')
  })

  it('prefers active sprint in toString array', () => {
    const raw = [
      'com.atlassian.greenhopper.service.sprint.Sprint@aaa[id=1,state=CLOSED,name=Sprint 1]',
      'com.atlassian.greenhopper.service.sprint.Sprint@bbb[id=2,state=ACTIVE,name=Sprint 2]',
    ]
    expect(extractSprintName(raw)).toBe('Sprint 2')
  })

  it('falls back to first toString string if no active', () => {
    const raw = [
      'com.atlassian.greenhopper.service.sprint.Sprint@aaa[id=1,state=CLOSED,name=Sprint 1]',
    ]
    expect(extractSprintName(raw)).toBe('Sprint 1')
  })

  // Case 3: Single object (Agile API format)
  it('extracts name from single sprint object (not wrapped in array)', () => {
    expect(extractSprintName({ id: 1, name: 'Sprint 10', state: 'active' })).toBe('Sprint 10')
  })

  // Case 4: Plain string
  it('returns plain string as-is', () => {
    expect(extractSprintName('Sprint 7')).toBe('Sprint 7')
  })

  it('parses name from toString-format single string', () => {
    const raw = 'com.atlassian.greenhopper.service.sprint.Sprint@abc[id=99,name=My Sprint,state=ACTIVE]'
    expect(extractSprintName(raw)).toBe('My Sprint')
  })

  // Edge cases
  it('returns null for object without name property', () => {
    expect(extractSprintName({ id: 1, state: 'active' })).toBeNull()
  })

  it('returns null for array of objects without name', () => {
    expect(extractSprintName([{ id: 1, state: 'active' }])).toBeNull()
  })
})
