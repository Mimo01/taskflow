import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { JiraIssue } from '@/services/jira';
import { RelatedIssueRow } from './RelatedIssueRow';

const bar = [
  { key: 'A-1', fields: { aggregatetimeoriginalestimate: 3600 } },
] as unknown as JiraIssue[];

function setup(props: Partial<React.ComponentProps<typeof RelatedIssueRow>> = {}) {
  const onClick = vi.fn();
  const utils = render(
    <RelatedIssueRow
      issueKey="A-1"
      summary="Do the thing"
      statusName="In Progress"
      statusCategoryKey="indeterminate"
      onClick={onClick}
      {...props}
    />,
  );
  return { onClick, ...utils };
}

describe('RelatedIssueRow', () => {
  it('puts @container on the wrapper, not the button', () => {
    setup();
    const button = screen.getByRole('button');
    expect(button.className).not.toContain('@container');
    expect(button.parentElement?.className).toContain('@container');
  });

  it('renders the time bar in a staged wrapper only when given', () => {
    const { unmount } = setup({ timeBarIssues: bar });
    const wrap = screen.getByTestId('story-time-bar').closest('span.hidden');
    expect(wrap?.className).toContain('hidden');
    expect(wrap?.className).toContain('@[42rem]:flex');
    unmount();
    setup();
    expect(screen.queryByTestId('story-time-bar')).toBeNull();
  });

  it('keeps the avatar always visible and hides only the name below 36rem', () => {
    setup({ assignee: { displayName: 'Ada Lovelace' } });
    const avatar = screen.getByRole('img', { name: 'Ada Lovelace' });
    const button = screen.getByRole('button');
    for (let el: HTMLElement | null = avatar; el && el !== button; el = el.parentElement) {
      expect(el.className).not.toMatch(/(^|\s)hidden(\s|$)/);
    }
    const name = screen.getByText('Ada Lovelace');
    expect(name.className).toContain('hidden');
    expect(name.className).toContain('@[36rem]:block');
    expect(avatar.closest('[title]')?.getAttribute('title')).toBe('Ada Lovelace');
  });

  it('renders no assignee when null', () => {
    setup({ assignee: null });
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('keeps summary shrinkable and key fixed', () => {
    setup();
    const summary = screen.getByText('Do the thing');
    expect(summary.className).toContain('flex-1');
    expect(summary.className).toContain('min-w-0');
    expect(summary.className).toContain('truncate');
    expect(screen.getByText('A-1').className).toContain('shrink-0');
  });

  it('renders the status pill only with a status name', () => {
    const { unmount } = setup();
    expect(screen.getByText('In Progress')).toBeTruthy();
    unmount();
    setup({ statusName: undefined });
    expect(screen.queryByText('In Progress')).toBeNull();
  });

  it('forwards click, aria-label and merges buttonClassName', () => {
    const { onClick } = setup({ ariaLabel: 'Open parent', buttonClassName: 'py-2' });
    const button = screen.getByRole('button', { name: 'Open parent' });
    expect(button.className).toContain('py-2');
    expect(button.className).not.toContain('py-1.5');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
