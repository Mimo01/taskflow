import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/avatarCache', () => ({
  getCachedBlobUrl: () => null,
  fetchAndCacheAvatar: () => Promise.resolve(null),
  evictAvatar: vi.fn(),
}));

import { SearchResultRow, type SearchResultRowProps } from './SearchResultRow';

function props(over: Partial<SearchResultRowProps> = {}): SearchResultRowProps {
  return {
    issueKey: 'PROJ-12',
    title: 'Fix the cart bug',
    typeName: 'Story',
    statusName: 'In Progress',
    statusCategoryKey: 'indeterminate',
    showEpic: true,
    epic: { key: 'PROJ-1', name: 'Checkout', color: 'ghx-label-5' },
    assigneeName: 'Jane Doe',
    avatarUrl: null,
    onKeyClick: vi.fn(),
    ...over,
  };
}

describe('row', () => {
  it('renders key button, title, status pill, and avatar wrapper', () => {
    const { container } = render(<SearchResultRow {...props()} />);
    expect(screen.getByRole('button', { name: 'PROJ-12' })).toBeInTheDocument();
    expect(screen.getByText('Fix the cart bug')).toBeInTheDocument();
    const pill = screen.getByText('In Progress');
    expect(pill.parentElement?.classList.contains('flex')).toBe(true);
    expect(container.querySelector('.flex-none.w-5')).not.toBeNull();
  });

  it('calls onKeyClick with the event and key', () => {
    const onKeyClick = vi.fn();
    render(<SearchResultRow {...props({ onKeyClick })} />);
    fireEvent.click(screen.getByRole('button', { name: 'PROJ-12' }));
    expect(onKeyClick).toHaveBeenCalledTimes(1);
    expect(onKeyClick.mock.calls[0][1]).toBe('PROJ-12');
  });

  it('shows the epic badge only when showEpic and epic are set', () => {
    const { rerender } = render(<SearchResultRow {...props()} />);
    expect(screen.getByTitle('PROJ-1: Checkout')).toBeInTheDocument();
    rerender(<SearchResultRow {...props({ showEpic: false })} />);
    expect(screen.queryByTitle('PROJ-1: Checkout')).toBeNull();
  });

  it('stays on one line (no wrapping, title truncates)', () => {
    const { container } = render(<SearchResultRow {...props()} />);
    const content = container.querySelector('.whitespace-nowrap');
    expect(content).not.toBeNull();
    expect(screen.getByText('Fix the cart bug').classList.contains('truncate')).toBe(true);
  });

  it('highlights title ranges', () => {
    const { container } = render(<SearchResultRow {...props({ titleRanges: [[8, 12]] })} />);
    expect(container.querySelector('mark')?.textContent).toBe('cart');
  });
});

describe('snippet', () => {
  it('renders snippet text, mark, and desc tag, not italic', () => {
    const { container } = render(
      <SearchResultRow
        {...props({
          snippet: { text: 'broken cart total', ranges: [[7, 11]] },
          matchTag: 'desc',
        })}
      />,
    );
    expect(container.textContent).toContain('broken cart total');
    expect(container.querySelector('mark')?.textContent).toBe('cart');
    expect(screen.getByText('desc')).toBeInTheDocument();
    expect(container.querySelector('.italic')).toBeNull();
  });

  it('renders only the comment tag when snippet is null', () => {
    render(<SearchResultRow {...props({ snippet: null, matchTag: 'comment' })} />);
    expect(screen.getByText('comment')).toBeInTheDocument();
  });

  it('renders no tag or snippet region without a match', () => {
    render(<SearchResultRow {...props()} />);
    expect(screen.queryByText('desc')).toBeNull();
    expect(screen.queryByText('comment')).toBeNull();
  });
});

describe('context header', () => {
  it('dimmed renders a muted context line and ignores title ranges', () => {
    const { container } = render(
      <SearchResultRow {...props({ dimmed: true, titleRanges: [[0, 3]] })} />,
    );
    // Muted text only — no extra opacity, which made the parent unreadable (UAT).
    expect(container.querySelector('.opacity-50')).toBeNull();
    expect(container.querySelectorAll('mark')).toHaveLength(0);
    expect(screen.getByText('Fix the cart bug').className).toContain('text-muted-foreground');
  });

  it('dimmed omits status pill, epic badge and avatar', () => {
    render(<SearchResultRow {...props({ dimmed: true })} />);
    expect(screen.queryByText('In Progress')).toBeNull();
    expect(screen.queryByText('Checkout')).toBeNull();
    expect(screen.queryByTitle('Jane Doe')).toBeNull();
  });

  it('indent renders pl-6 without an extra arrow glyph (the subtask type icon is the arrow)', () => {
    const { container } = render(<SearchResultRow {...props({ indent: true })} />);
    expect(screen.queryByText('↳')).toBeNull();
    expect(container.querySelector('.pl-6')).not.toBeNull();
  });

  it('is not indented or dimmed by default', () => {
    const { container } = render(<SearchResultRow {...props()} />);
    expect(container.querySelector('.pl-6')).toBeNull();
    expect(container.querySelector('.opacity-60')).toBeNull();
  });
});
