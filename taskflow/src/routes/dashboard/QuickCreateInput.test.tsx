/**
 * QuickCreateInput tests — Wave 0 RED stubs (now GREEN after plan 10-03)
 *
 * These tests describe the expected behavior of the QuickCreateInput component.
 * Props updated to match the final component interface (statusId, projectKey,
 * jiraBaseUrl, jiraToken, onCreated required alongside statusName).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/services/jira', () => ({
  createIssue: vi.fn().mockResolvedValue({ id: '10001', key: 'PROJ-42' }),
  fetchTransitions: vi.fn().mockResolvedValue([]),
  postTransition: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
  })),
}));

// Default props to satisfy the required interface
const DEFAULT_PROPS = {
  statusId: 'status-1',
  statusName: 'To Do',
  projectKey: 'PROJ',
  jiraBaseUrl: 'https://jira.example.com',
  jiraToken: 'test-jira-token',
  onCreated: vi.fn(),
};

describe('QuickCreateInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows text input when + Add button is clicked', async () => {
    const { default: QuickCreateInput } = await import('./QuickCreateInput');
    render(<QuickCreateInput {...DEFAULT_PROPS} />);

    // Input should not be visible before clicking
    expect(screen.queryByRole('textbox')).toBeNull();

    // Click the + Add button
    const addButton = screen.getByRole('button', { name: /\+ Add/i });
    fireEvent.click(addButton);

    // Text input should now be visible
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('calls createIssue with correct args and hides input after Enter', async () => {
    const { createIssue } = await import('@/services/jira');

    const { default: QuickCreateInput } = await import('./QuickCreateInput');
    render(<QuickCreateInput {...DEFAULT_PROPS} />);

    // Open the input
    const addButton = screen.getByRole('button', { name: /\+ Add/i });
    fireEvent.click(addButton);

    // Type into the input
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'My new story' } });

    // Press Enter to submit
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // createIssue should have been called
    expect(createIssue).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      'My new story',
    );

    // Input should be hidden after submission (async — wait for promises to resolve)
    await waitFor(() => {
      expect(screen.queryByRole('textbox')).toBeNull();
    });
  });

  it('hides input when Escape is pressed without creating', async () => {
    const { createIssue } = await import('@/services/jira');

    const { default: QuickCreateInput } = await import('./QuickCreateInput');
    render(<QuickCreateInput {...DEFAULT_PROPS} />);

    // Open the input
    const addButton = screen.getByRole('button', { name: /\+ Add/i });
    fireEvent.click(addButton);

    // Type some text
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Some text that will be discarded' } });

    // Press Escape to cancel
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });

    // Input should be hidden and createIssue should NOT have been called
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(createIssue).not.toHaveBeenCalled();
  });
});
