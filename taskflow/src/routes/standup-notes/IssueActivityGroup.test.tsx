/**
 * IssueActivityGroup tests — trailing status pill on issue and sub-task headers.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { statusPillClass } from '@/lib/statusStyles';
import IssueActivityGroup from './IssueActivityGroup';

const BASE = { issueKey: 'PROJ-1', summary: 'Checkout revamp', subItems: [] };

describe('IssueActivityGroup — status pill', () => {
  it('renders a pill with statusPillClass inside a flex shrink-0 wrapper', () => {
    render(
      <IssueActivityGroup {...BASE} statusName="Code Review" statusCategoryKey="indeterminate" />,
    );
    const pill = screen.getByText('Code Review');
    expect(pill.className).toBe(statusPillClass('indeterminate'));
    expect(pill.parentElement).toHaveClass('flex', 'shrink-0');
  });

  it('renders no pill when status is unknown', () => {
    render(<IssueActivityGroup {...BASE} />);
    expect(screen.queryByText('To Do')).not.toBeInTheDocument();
    expect(document.querySelector('div.pointer-events-none.shrink-0')).toBeNull();
  });

  it('renders a pill on a sub-task header with its own status', () => {
    render(
      <IssueActivityGroup
        {...BASE}
        statusName="In Progress"
        statusCategoryKey="indeterminate"
        subTaskGroups={[
          {
            issueKey: 'PROJ-2',
            summary: 'Wire up form',
            statusName: 'Done',
            statusCategoryKey: 'done',
            subItems: [],
          },
        ]}
      />,
    );
    expect(screen.getByText('In Progress').className).toBe(statusPillClass('indeterminate'));
    expect(screen.getByText('Done').className).toBe(statusPillClass('done'));
  });

  it('pill is click-through and the header body click does not fire the key handler', () => {
    const onClick = vi.fn();
    const onIssueKeyClick = vi.fn();
    render(
      <IssueActivityGroup
        {...BASE}
        statusName="Done"
        statusCategoryKey="done"
        onClick={onClick}
        onIssueKeyClick={onIssueKeyClick}
      />,
    );
    // pointer-events-none on the wrapper lets real clicks reach the overlay button.
    expect(screen.getByText('Done').parentElement).toHaveClass('pointer-events-none');
    fireEvent.click(screen.getByRole('button', { name: /Open PROJ-1/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onIssueKeyClick).not.toHaveBeenCalled();
  });
});
