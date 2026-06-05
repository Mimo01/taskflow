// SUBTPL-08: resolveRowPlaceholders — placeholder resolution tests

import { describe, expect, it } from 'vitest';
import type { JiraIssueDetail } from '@/services/jira';
import type { SubtaskTemplateRow } from '@/stores/subtask-templates.store';
import { resolveAssignee, resolveRowForCreate } from './resolveRowPlaceholders';
import type { PlaceholderContext } from './resolveRowPlaceholders';

function makeParentIssue(fields: Partial<JiraIssueDetail['fields']> = {}): JiraIssueDetail {
  return {
    id: 'issue-1',
    key: 'PROJ-1',
    fields: {
      summary: 'Parent issue',
      description: null,
      status: { id: '1', name: 'In Progress' },
      issuetype: { name: 'Story', subtask: false },
      priority: null,
      assignee: null,
      reporter: null,
      subtasks: [],
      issuelinks: [],
      comment: { comments: [] },
      labels: [],
      fixVersions: [],
      created: '2026-01-01',
      updated: '2026-01-01',
      duedate: null,
      ...fields,
    },
  } as JiraIssueDetail;
}

function makeCtx(overrides: Partial<PlaceholderContext> = {}): PlaceholderContext {
  return {
    jiraUsername: 'alice',
    jiraUserDisplayName: 'Alice Smith',
    parentIssue: makeParentIssue(),
    ...overrides,
  };
}

function makeRow(overrides: Partial<SubtaskTemplateRow> = {}): SubtaskTemplateRow {
  return {
    id: 'row-1',
    title: 'Test subtask',
    assignee: '@inherit',
    priority: null,
    labels: [],
    duedate: null,
    timeEstimate: '',
    storyPoints: null,
    components: [],
    customFieldValues: {},
    ...overrides,
  };
}

describe('resolveAssignee (SUBTPL-08)', () => {
  it('@unassigned → payloadName: null, displayHint: @unassigned', () => {
    const result = resolveAssignee('@unassigned', makeCtx());
    expect(result.payloadName).toBeNull();
    expect(result.displayHint).toBe('@unassigned');
  });

  it('@current → payloadName uses jiraUsername (DC name field)', () => {
    const ctx = makeCtx({ jiraUsername: 'bob', jiraUserDisplayName: 'Bob Jones' });
    const result = resolveAssignee('@current', ctx);
    expect(result.payloadName).toBe('bob'); // DC name, not displayName
    expect(result.displayHint).toContain('Bob Jones');
  });

  it('@current with null jiraUserDisplayName → displayHint falls back gracefully', () => {
    const ctx = makeCtx({ jiraUsername: 'bob', jiraUserDisplayName: null });
    const result = resolveAssignee('@current', ctx);
    expect(result.payloadName).toBe('bob');
    expect(result.displayHint).toBe('@current');
  });

  it('@current → payloadName is jiraUsername, NOT jiraUserDisplayName', () => {
    const ctx = makeCtx({ jiraUsername: 'alice_dc', jiraUserDisplayName: 'Alice Display' });
    const result = resolveAssignee('@current', ctx);
    expect(result.payloadName).toBe('alice_dc');
    expect(result.payloadName).not.toBe('Alice Display');
  });

  it('@inherit with parent assignee → payloadName is parent name', () => {
    const parentIssue = makeParentIssue({
      assignee: {
        displayName: 'Carol White',
        name: 'carol',
        avatarUrls: { '48x48': '' },
      },
    });
    const ctx = makeCtx({ parentIssue });
    const result = resolveAssignee('@inherit', ctx);
    expect(result.payloadName).toBe('carol');
    expect(result.displayHint).toContain('Carol White');
  });

  it('@inherit with parent assignee null → payloadName: null, displayHint contains (none)', () => {
    const parentIssue = makeParentIssue({ assignee: null });
    const ctx = makeCtx({ parentIssue });
    const result = resolveAssignee('@inherit', ctx);
    expect(result.payloadName).toBeNull();
    expect(result.displayHint).toContain('(none)');
  });

  it('concrete username → passed through as-is', () => {
    const result = resolveAssignee('dave', makeCtx());
    expect(result.payloadName).toBe('dave');
    expect(result.displayHint).toBe('dave');
  });
});

describe('resolveRowForCreate (SUBTPL-08)', () => {
  it('@inherit on priority with parent value → resolved priority', () => {
    const parentIssue = makeParentIssue({
      priority: { name: 'High' },
    });
    const ctx = makeCtx({ parentIssue });
    const row = makeRow({ assignee: '@unassigned', priority: '@inherit' });
    const { options } = resolveRowForCreate(row, ctx);
    expect(options.priority).toEqual({ name: 'High' });
  });

  it('@inherit on priority with parent priority null → empty (no error, D-12)', () => {
    const parentIssue = makeParentIssue({ priority: null });
    const ctx = makeCtx({ parentIssue });
    const row = makeRow({ assignee: '@unassigned', priority: '@inherit' });
    const { options } = resolveRowForCreate(row, ctx);
    expect(options.priority).toBeUndefined();
  });

  it('@inherit on labels with parent labels → resolved labels', () => {
    const parentIssue = makeParentIssue({ labels: ['frontend', 'urgent'] });
    const ctx = makeCtx({ parentIssue });
    const row = makeRow({ assignee: '@unassigned', labels: ['@inherit'] });
    const { options } = resolveRowForCreate(row, ctx);
    expect(options.labels).toEqual(['frontend', 'urgent']);
  });

  it('@inherit on labels with parent having no labels → empty array (no error, D-12)', () => {
    const parentIssue = makeParentIssue({ labels: [] });
    const ctx = makeCtx({ parentIssue });
    const row = makeRow({ assignee: '@unassigned', labels: ['@inherit'] });
    const { options } = resolveRowForCreate(row, ctx);
    expect(options.labels).toBeUndefined(); // empty array → not set in options
  });

  it('@inherit on duedate with parent value → resolved duedate', () => {
    const parentIssue = makeParentIssue({ duedate: '2026-12-31' });
    const ctx = makeCtx({ parentIssue });
    const row = makeRow({ assignee: '@unassigned', duedate: '@inherit' });
    const { options } = resolveRowForCreate(row, ctx);
    expect(options.duedate).toBe('2026-12-31');
  });

  it('@inherit on duedate with parent duedate null → empty (no error, D-12)', () => {
    const parentIssue = makeParentIssue({ duedate: null });
    const ctx = makeCtx({ parentIssue });
    const row = makeRow({ assignee: '@unassigned', duedate: '@inherit' });
    const { options } = resolveRowForCreate(row, ctx);
    expect(options.duedate).toBeUndefined();
  });

  it('title is passed through unchanged', () => {
    const row = makeRow({ title: 'My Task Title', assignee: '@unassigned' });
    const { title } = resolveRowForCreate(row, makeCtx());
    expect(title).toBe('My Task Title');
  });

  it('@unassigned assignee → options.assignee is not set', () => {
    const row = makeRow({ assignee: '@unassigned' });
    const { options } = resolveRowForCreate(row, makeCtx());
    expect(options.assignee).toBeUndefined();
  });

  it('@current assignee → options.assignee.name = jiraUsername', () => {
    const ctx = makeCtx({ jiraUsername: 'alice', jiraUserDisplayName: 'Alice' });
    const row = makeRow({ assignee: '@current' });
    const { options } = resolveRowForCreate(row, ctx);
    expect(options.assignee).toEqual({ name: 'alice' });
  });
});
