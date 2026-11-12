import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AttachmentUpload } from './AttachmentUpload';

vi.mock('@/services/stronghold', () => ({ readSecret: vi.fn() }));
vi.mock('@/services/jira/attachments', () => ({ uploadAttachment: vi.fn() }));

describe('AttachmentUpload', () => {
  it('renders Attach file as a ghost xs button with muted text and size-3 icon', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AttachmentUpload issueKey="X-1" jiraBaseUrl="https://jira.example" />
      </QueryClientProvider>,
    );
    const b = screen.getByRole('button', { name: 'Attach file' });
    expect(b.className).toContain('h-6');
    expect(b.className).toContain('text-muted-foreground');
    expect(b.className).toContain('hover:text-foreground');
    expect(b.className).not.toContain('border-border');
    expect(b.querySelector('svg')?.getAttribute('class')).toContain('size-3');
  });
});
