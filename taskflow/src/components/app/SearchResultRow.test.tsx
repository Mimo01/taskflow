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
    expect(pill?.className).toContain('min-w-[4.5rem]');
    expect(pill?.getAttribute('title')).toBe('In Progress');
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
    expect(screen.getByText('Fix the cart bug').className).toContain('text-sm');
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByTitle('Jane Doe')).toBeInTheDocument();
  });

  it('subtask rows indent one fixed step (no extra arrow glyph)', () => {
    const { container } = render(<SearchResultRow {...props({ indent: true })} />);
    expect(screen.queryByText('↳')).toBeNull();
    expect(container.querySelector('[data-indent]')).not.toBeNull();
    expect((container.firstChild as HTMLElement).className).toContain('pl-3');
  });

  it('is not indented or dimmed by default', () => {
    const { container } = render(<SearchResultRow {...props()} />);
    expect(container.querySelector('[data-indent]')).toBeNull();
    expect((container.firstChild as HTMLElement).className).not.toContain('pl-3');
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
  it('renders the match on a second line (icon + highlighted snippet) under a full title', () => {
    const { container } = render(
      <SearchResultRow
        {...props({ matchTag: 'desc', snippet: { text: '…the cart is empty', ranges: [[5, 9]] } })}
      />,
    );
    const line = container.querySelector('[data-match-line]');
    expect(line).not.toBeNull();
    expect(line?.querySelector('[aria-label="Matched in description"]')).not.toBeNull();
    expect(line?.textContent).toContain('the cart is empty');
    expect(line?.querySelector('mark')?.textContent).toBe('cart');
    // Exactly one line: the excerpt truncates instead of wrapping.
    expect(line?.querySelector('mark')?.parentElement?.className).toContain('truncate');
    // The title line is untouched by the snippet: full truncating title, epic still shown.
    expect(screen.getByText('Fix the cart bug').closest('[data-match-line]')).toBeNull();
    expect(screen.getByText('Checkout')).toBeInTheDocument();
  });

  it('shows a label when a comment matched but no snippet is available', () => {
    const { container } = render(<SearchResultRow {...props({ matchTag: 'comment' })} />);
    expect(container.querySelector('[data-match-line]')?.textContent).toContain(
      'Matched in a comment',
    );
  });

  it('labels a hit in another field', () => {
    const { container } = render(<SearchResultRow {...props({ matchTag: 'other' })} />);
    const line = container.querySelector('[data-match-line]');
    expect(line?.querySelector('[aria-label="Matched in another field"]')).not.toBeNull();
    expect(line?.textContent).toContain('Matched in another field');
  });

  it('has no second line for title-only matches', () => {
    const { container } = render(<SearchResultRow {...props()} />);
    expect(container.querySelector('[data-match-line]')).toBeNull();
  });
});

describe('done key', () => {
  it('strikes through the key of a done issue (button and plain variants)', () => {
    const { unmount } = render(
      <SearchResultRow {...props({ statusName: 'Done', statusCategoryKey: 'done' })} />,
    );
    expect(screen.getByRole('button', { name: 'PROJ-12' }).className).toContain('line-through');
    unmount();
    render(
      <SearchResultRow
        {...props({ statusName: 'Done', statusCategoryKey: 'done', onKeyClick: undefined })}
      />,
    );
    expect(screen.getByText('PROJ-12').className).toContain('line-through');
  });

  it('does not strike through open issues', () => {
    render(<SearchResultRow {...props()} />);
    expect(screen.getByRole('button', { name: 'PROJ-12' }).className).not.toContain('line-through');
  });
});
