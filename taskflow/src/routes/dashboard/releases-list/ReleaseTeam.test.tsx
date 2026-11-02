import { render, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { VersionAssignee } from '@/services/jira';
import { ReleaseTeam } from './ReleaseAgendaParts';

const people = (n: number): VersionAssignee[] =>
  Array.from({ length: n }, (_, i) => ({
    key: `u${i}`,
    displayName: `User ${i}`,
    avatarUrl: '',
    count: n - i,
  })) as VersionAssignee[];

describe('ReleaseTeam overflow chip', () => {
  it('shows the avatar instead of a lone +1 chip', () => {
    const { getByTestId } = render(<ReleaseTeam assignees={people(6)} max={5} />);
    const team = getByTestId('release-team');
    expect(within(team).getAllByRole('img')).toHaveLength(6);
    expect(team.textContent).not.toContain('+');
  });

  it('shows the +N chip from +2', () => {
    const { getByTestId } = render(<ReleaseTeam assignees={people(7)} max={5} />);
    const team = getByTestId('release-team');
    expect(within(team).getAllByRole('img')).toHaveLength(5);
    expect(team.textContent).toContain('+2');
  });
});
