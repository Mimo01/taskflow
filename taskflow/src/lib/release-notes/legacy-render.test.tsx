// Proof that OLD clients (ReactMarkdown + remarkGfm, as the pre-redesign
// UpdateDialog / WhatsNewDialog rendered notes) show the new short format fine.
import { render, screen } from '@testing-library/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { describe, expect, it } from 'vitest';
import { APPROVED_EXAMPLE, SECOND_NEW_FORMAT } from './__fixtures__/samples';

function legacy(notes: string) {
  return render(<ReactMarkdown remarkPlugins={[remarkGfm]}>{notes}</ReactMarkdown>);
}

describe('legacy ReactMarkdown rendering of the new format', () => {
  it('renders the approved example', () => {
    const { container } = legacy(APPROVED_EXAMPLE);
    expect(screen.getByText('Notifications got a full redesign.').tagName).toBe('P');
    for (const name of ['New', 'Improved', 'Fixed']) {
      expect(screen.getByRole('heading', { level: 3, name })).toBeTruthy();
    }
    expect(screen.getByText('Notification panel').tagName).toBe('STRONG');
    expect(screen.getByText('Notification panel').closest('li')).toBeTruthy();
    expect(screen.getByText('Epic picker on stories').tagName).toBe('STRONG');
    expect(
      screen
        .getByText('Duplicate notifications, package mismatches, peek over-scroll')
        .closest('li'),
    ).toBeTruthy();
    expect(container.textContent).not.toContain('**');
    expect(container.textContent).not.toContain('###');
  });

  it('renders a second new-format fixture', () => {
    const { container } = legacy(SECOND_NEW_FORMAT);
    expect(screen.getByText('Search got faster and calmer.').tagName).toBe('P');
    for (const name of ['New', 'Removed', 'Fixed']) {
      expect(screen.getByRole('heading', { level: 3, name })).toBeTruthy();
    }
    expect(screen.getByText('Saved searches').tagName).toBe('STRONG');
    expect(screen.getByText('Result flicker, wrong highlight').closest('li')).toBeTruthy();
    expect(container.textContent).not.toContain('**');
    expect(container.textContent).not.toContain('###');
  });
});
