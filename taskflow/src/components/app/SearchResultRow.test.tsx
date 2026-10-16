import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/avatarCache', () => ({
  getCachedBlobUrl: () => null,
  fetchAndCacheAvatar: () => Promise.resolve(null),
  evictAvatar: vi.fn(),
}));

import {
  GROUP_DIVIDER_CLASS,
  SearchResultRow,
  startsGroup,
  type SearchResultRowProps,
} from './SearchResultRow';

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
    // Compact fixed-width pill: inline-flex wrapper (geometry lives on it), truncating label.
    const pill = screen.getByText('In Progress').parentElement;
    expect(pill?.className).toContain('inline-flex');
    expect(pill?.className).toContain('min-w-[4.25rem]');
    expect(pill?.getAttribute('title')).toBe('In Progress');
    expect(container.querySelector('.flex-none.w-\\[18px\\]')).not.toBeNull();
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
    expect(screen.getByRole('img', { name: 'Matched in description' })).toBeInTheDocument();
    expect(container.querySelector('.italic')).toBeNull();
  });

  it('renders only the comment tag when snippet is null', () => {
    render(<SearchResultRow {...props({ snippet: null, matchTag: 'comment' })} />);
    expect(screen.getByRole('img', { name: 'Matched in a comment' })).toBeInTheDocument();
  });

  it('renders no tag or snippet region without a match', () => {
    render(<SearchResultRow {...props()} />);
    expect(screen.queryByRole('img', { name: /Matched in/ })).toBeNull();
  });
});

describe('context header', () => {
  it('dimmed fades the whole row (same size) and ignores title ranges', () => {
    const { container } = render(
      <SearchResultRow {...props({ dimmed: true, titleRanges: [[0, 3]] })} />,
    );
    expect(container.querySelector('.opacity-40')).not.toBeNull();
    expect(container.querySelectorAll('mark')).toHaveLength(0);
    // Same size as any row: text-sm title, status pill and avatar still rendered.
    expect(screen.getByText('Fix the cart bug').className).toContain('text-[0.8125rem]');
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByTitle('Jane Doe')).toBeInTheDocument();
  });

  it('subtask rows keep the strict column grid (no row shift, no extra arrow glyph)', () => {
    const { container } = render(<SearchResultRow {...props({ indent: true })} />);
    expect(screen.queryByText('↳')).toBeNull();
    const row = container.querySelector('[data-indent]');
    expect(row).not.toBeNull();
    expect(row?.className).not.toMatch(/\bpl-/);
  });

  it('is not indented or dimmed by default', () => {
    const { container } = render(<SearchResultRow {...props()} />);
    expect(container.querySelector('[data-indent]')).toBeNull();
    expect(container.querySelector('.opacity-40')).toBeNull();
  });
});

describe('group divider', () => {
  it('starts a group at each non-indented row after the first', () => {
    const rows = [{ indent: false }, { indent: true }, { indent: true }, { indent: false }];
    expect(rows.map((_, i) => startsGroup(rows, i))).toEqual([false, false, false, true]);
  });

  it('is a non-layout hairline (pseudo-element)', () => {
    expect(GROUP_DIVIDER_CLASS).toContain('before:h-px');
    expect(GROUP_DIVIDER_CLASS).toContain('before:absolute');
  });
});

describe('body match', () => {
  it('labels the match with a tag whose tooltip carries the snippet', () => {
    render(
      <SearchResultRow
        {...props({ matchTag: 'desc', snippet: { text: '…the cart is empty', ranges: [[5, 9]] } })}
      />,
    );
    expect(screen.getByRole('img', { name: 'Matched in description' }).getAttribute('title')).toBe(
      'Matched in description: …the cart is empty',
    );
  });

  it('gives the title shrink priority over the snippet (snippet fills leftover space)', () => {
    render(
      <SearchResultRow
        {...props({ matchTag: 'comment', snippet: { text: 'snippet text', ranges: [] } })}
      />,
    );
    expect(screen.getByText('Fix the cart bug').className).toContain('flex-[0_1_auto]');
    expect(screen.getByText('snippet text').className).toContain('flex-[1_1_0%]');
  });
});
