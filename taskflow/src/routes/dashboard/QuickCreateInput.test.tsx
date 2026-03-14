/**
 * QuickCreateInput tests — Wave 0 RED stubs
 *
 * These tests describe the expected behavior of the QuickCreateInput component
 * which does not exist yet. All tests in this file are intentionally RED.
 * They will pass after the QuickCreateInput component is implemented in a later plan.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('@/services/jira', () => ({
  createIssue: vi.fn().mockResolvedValue({ id: '10001', key: 'PROJ-42' }),
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

describe('QuickCreateInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows text input when + Add button is clicked', async () => {
    // RED: QuickCreateInput component does not exist yet
    const { default: QuickCreateInput } = await import('./QuickCreateInput');
    render(<QuickCreateInput statusName="To Do" />);

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

    // RED: QuickCreateInput component does not exist yet
    const { default: QuickCreateInput } = await import('./QuickCreateInput');
    render(<QuickCreateInput statusName="To Do" />);

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

    // Input should be hidden after submission
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('hides input when Escape is pressed without creating', async () => {
    const { createIssue } = await import('@/services/jira');

    // RED: QuickCreateInput component does not exist yet
    const { default: QuickCreateInput } = await import('./QuickCreateInput');
    render(<QuickCreateInput statusName="To Do" />);

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
