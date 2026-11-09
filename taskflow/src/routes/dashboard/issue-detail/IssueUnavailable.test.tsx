import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-error';
import { openExternal } from '@/lib/openExternal';
import { IssueUnavailable } from './IssueUnavailable';
import { getIssueUnavailableInfo } from './unavailable-info';

vi.mock('@/lib/openExternal', () => ({ openExternal: vi.fn() }));

const MSG = 'You do not have the permission to see the specified issue.';

describe('getIssueUnavailableInfo', () => {
  it('classifies 401/403/404 as unavailable', () => {
    for (const s of [401, 403, 404]) {
      expect(getIssueUnavailableInfo(new ApiError('x', s, 'jira')).kind).toBe('unavailable');
    }
  });
  it('classifies 500, plain Error and undefined as error', () => {
    expect(getIssueUnavailableInfo(new ApiError('x', 500, 'jira')).kind).toBe('error');
    expect(getIssueUnavailableInfo(new Error('boom')).kind).toBe('error');
    expect(getIssueUnavailableInfo(undefined).kind).toBe('error');
  });
  it('extracts jiraMessages from ApiError only', () => {
    expect(getIssueUnavailableInfo(new ApiError('x', 403, 'jira', [MSG])).jiraMessages).toEqual([
      MSG,
    ]);
    expect(getIssueUnavailableInfo(new Error('x')).jiraMessages).toEqual([]);
  });
});

describe('IssueUnavailable', () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
  });

  it('renders the permission case with working actions', async () => {
    const onRetry = vi.fn();
    render(
      <IssueUnavailable
        issueKey="ABC-123"
        jiraBaseUrl="https://jira.example.com/"
        error={new ApiError('Failed to fetch issue ABC-123: 403', 403, 'jira', [MSG])}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole('heading', { name: "You can't view ABC-123" })).toBeInTheDocument();
    expect(screen.getByText(/permission to see it/)).toBeInTheDocument();
    expect(screen.getByText(MSG)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Open in Jira/ }));
    expect(openExternal).toHaveBeenCalledWith('https://jira.example.com/browse/ABC-123');

    fireEvent.click(screen.getByRole('button', { name: /Copy key/ }));
    expect(writeText).toHaveBeenCalledWith('ABC-123');
    await waitFor(() => expect(screen.getByText('Copied')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it.each([401, 404])('renders the unavailable title for %i', (status) => {
    render(
      <IssueUnavailable
        issueKey="ABC-123"
        jiraBaseUrl="https://jira.example.com"
        error={new ApiError('x', status, 'jira')}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: "You can't view ABC-123" })).toBeInTheDocument();
  });

  it('renders the generic case with Try again', () => {
    const onRetry = vi.fn();
    render(
      <IssueUnavailable
        issueKey="ABC-123"
        jiraBaseUrl="https://jira.example.com"
        error={new Error('Cannot reach host')}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole('heading', { name: "Couldn't load ABC-123" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Open in Jira/ })).toBeInTheDocument();
  });

  it('hides Open in Jira without a base url', () => {
    render(
      <IssueUnavailable
        issueKey="ABC-123"
        jiraBaseUrl=""
        error={new Error('x')}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /Open in Jira/ })).toBeNull();
  });
});
