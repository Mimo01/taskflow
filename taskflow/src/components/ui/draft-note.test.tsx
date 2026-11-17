import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DraftNote } from './draft-note';

describe('DraftNote', () => {
  it('draft state shows note and Discard', async () => {
    const onDiscard = vi.fn();
    render(<DraftNote state="draft" onDiscard={onDiscard} onUseJira={vi.fn()} />);
    expect(screen.getByText('Draft saved')).toBeTruthy();
    expect(screen.getByText('·')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it('stale state shows Use Jira version and no draft text', async () => {
    const onUseJira = vi.fn();
    render(<DraftNote state="stale" onDiscard={vi.fn()} onUseJira={onUseJira} />);
    expect(screen.getByText('Changed in Jira since your draft')).toBeTruthy();
    expect(screen.queryByText('Draft saved')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Use Jira version' }));
    expect(onUseJira).toHaveBeenCalledOnce();
  });

  it('null state reserves the line with no buttons', () => {
    const { container } = render(
      <DraftNote state={null} onDiscard={vi.fn()} onUseJira={vi.fn()} />,
    );
    expect(container.firstElementChild?.className).toContain('min-h-6');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
