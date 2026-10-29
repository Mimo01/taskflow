import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { buildAgenda } from '@/lib/release-agenda';
import type { StatusBreakdown } from '@/lib/release-list';
import type { JiraFixVersion, VersionAssignee } from '@/services/jira';
import { ReleaseAgenda } from './ReleaseAgenda';

const TODAY = '2026-10-29';

const ver = (id: string, name: string, releaseDate?: string): JiraFixVersion => ({
  id,
  name,
  released: false,
  releaseDate,
});

const VERSIONS = [
  ver('O', 'Alpha overdue release', '2026-10-20'),
  ver('A', 'Beta next release', '2026-11-03'),
  ver('B', 'Gamma near release', '2026-11-05'),
  ver('C', 'Delta planned release', '2026-11-10'),
  ver('D', 'Epsilon started release', '2026-12-08'),
  ver('U', 'Zeta undated release'),
];
const IDS = VERSIONS.map((v) => v.id);

const BREAKDOWNS = new Map<string, StatusBreakdown>([
  ['O', { done: 2, indeterminate: 1, new: 1 }],
  ['A', { done: 15, indeterminate: 5, new: 4 }],
  ['B', { done: 0, indeterminate: 0, new: 0 }],
  ['C', { done: 0, indeterminate: 0, new: 8 }],
  ['D', { done: 18, indeterminate: 1, new: 1 }],
]);

const person = (n: number): VersionAssignee => ({
  key: `p${n}`,
  displayName: `Person ${n}`,
  count: 1,
});
const TEAMS = new Map<string, VersionAssignee[]>([
  ['O', [person(1), person(2), person(3), person(4), person(5)]],
  ['A', [person(1)]],
  ['C', [person(1)]],
]);

const { entries } = buildAgenda(VERSIONS, TODAY);

function setup(over: Partial<ComponentProps<typeof ReleaseAgenda>> = {}) {
  const onOpen = vi.fn();
  const props: ComponentProps<typeof ReleaseAgenda> = {
    entries,
    breakdowns: BREAKDOWNS,
    loadingIds: new Set(),
    teams: TEAMS,
    showPackage: false,
    pkgLoading: false,
    packageFor: () => null,
    onOpen,
    ...over,
  };
  const utils = render(<ReleaseAgenda {...props} />);
  return { ...utils, props, onOpen };
}

const rowFor = (name: string) =>
  screen
    .getByRole('button', { name: `Open release ${name}` })
    .closest('[data-testid="release-row"]') as HTMLElement;

describe('ReleaseAgenda', () => {
  it('renders one row per release with kind and quiet flags', () => {
    setup();
    const rows = screen.getAllByTestId('release-row');
    expect(rows).toHaveLength(6);
    const flags = Object.fromEntries(
      rows.map((r) => [r.getAttribute('data-kind'), r.getAttribute('data-quiet')]),
    );
    expect(flags.overdue).toBe('false');
    expect(flags.next).toBe('false');
    expect(flags.near).toBe('false');
    expect(flags.undated).toBe('false');
    expect(flags.planned).toBe('true');
    expect(rows.filter((r) => r.getAttribute('data-quiet') === 'true')).toHaveLength(2);
  });

  it('opens a release from its overlay button, card included', () => {
    const { onOpen } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Open release Alpha overdue release' }));
    expect(onOpen).toHaveBeenLastCalledWith('O');
    fireEvent.click(screen.getByRole('button', { name: 'Open release Beta next release' }));
    expect(onOpen).toHaveBeenLastCalledWith('A');
  });

  it('renders the next release as a card with rocket, name, pill and one figure', () => {
    setup();
    const card = screen.getByTestId('next-release-card');
    expect(screen.getAllByTestId('next-release-card')).toHaveLength(1);
    expect(within(card).getByText(/next release/i, { selector: 'div' })).toBeInTheDocument();
    expect(within(card).getByTestId('next-release-rocket')).toBeInTheDocument();
    expect(within(card).getByText('Beta next release')).toBeInTheDocument();
    expect(within(card).getByTestId('release-status-pill')).toBeInTheDocument();
    expect(within(card).getAllByText('15/24 done')).toHaveLength(1);
    expect(screen.getAllByText('15/24 done')).toHaveLength(1);
  });

  it('shows pills only on overdue, next, near and undated rows', () => {
    setup();
    expect(screen.getAllByTestId('release-status-pill')).toHaveLength(4);
    for (const name of ['Delta planned release', 'Epsilon started release']) {
      const row = rowFor(name);
      expect(within(row).queryByTestId('release-status-pill')).toBeNull();
      expect(within(row).getByTestId('release-timing-text').textContent).toMatch(/^In \d+ /);
    }
  });

  it('renders the issues slot per state', () => {
    setup({
      loadingIds: new Set(['Z']),
      entries: buildAgenda([...VERSIONS, ver('E', 'Eta empty release', '2027-02-01')], TODAY)
        .entries,
    });
    const started = within(rowFor('Epsilon started release'));
    expect(started.getByTestId('release-issues-bar')).toBeInTheDocument();
    expect(started.getByText('18/20')).toBeInTheDocument();
    const todo = within(rowFor('Delta planned release'));
    expect(todo.getByText('8').className).toContain('font-medium');
    expect(todo.getByText(/to do/)).toBeInTheDocument();
    expect(within(rowFor('Gamma near release')).getByText('No issues yet')).toBeInTheDocument();
    expect(within(rowFor('Eta empty release')).getByText('–')).toBeInTheDocument();
  });

  it('shows a skeleton while a breakdown is loading', () => {
    const { container } = setup({ breakdowns: new Map(), loadingIds: new Set(IDS) });
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThanOrEqual(5);
  });

  it('keeps row metrics identical before and after breakdowns arrive (D-09)', () => {
    const snapshot = (container: HTMLElement) =>
      Array.from(container.querySelectorAll('[data-testid="release-row"]')).map((r) => ({
        kind: r.getAttribute('data-kind'),
        quiet: r.getAttribute('data-quiet'),
        body: r.querySelector('[data-testid="release-body"]')?.className,
        dot: r.querySelector('[data-testid="agenda-dot"]')?.className,
        stamp: r.firstElementChild?.textContent,
        slot: r.querySelector('[data-testid="release-issues"]')?.className,
        pkg: !!r.querySelector('[data-testid="row-deployment-package"]'),
        team: !!r.querySelector('[data-testid="release-team"]'),
      }));
    const props = {
      entries,
      teams: TEAMS,
      showPackage: true,
      pkgLoading: false,
      packageFor: () => null,
      onOpen: () => {},
    };
    const { container, rerender } = render(
      <ReleaseAgenda {...props} breakdowns={new Map()} loadingIds={new Set(IDS)} />,
    );
    const before = snapshot(container);
    rerender(<ReleaseAgenda {...props} breakdowns={BREAKDOWNS} loadingIds={new Set()} />);
    expect(snapshot(container)).toEqual(before);
  });

  it('draws hollow ring dots by kind and size', () => {
    setup();
    const dot = (name: string) => within(rowFor(name)).getByTestId('agenda-dot').className;
    expect(dot('Beta next release')).toContain('border-foreground');
    expect(dot('Alpha overdue release')).toContain('border-red-500');
    expect(dot('Zeta undated release')).toContain('border-dashed');
    expect(dot('Zeta undated release')).toContain('border-amber-500');
    expect(dot('Delta planned release')).toContain('size-2.5');
    expect(dot('Gamma near release')).toContain('size-3');
    for (const d of screen.getAllByTestId('agenda-dot')) {
      expect(d.className).not.toMatch(/bg-orange|bg-foreground|bg-red/);
    }
  });

  it('renders the TODAY line, month dividers and the No date section', () => {
    setup();
    const today = screen.getByTestId('agenda-today');
    expect(today.textContent).toContain('Today');
    expect(today.textContent).toContain('Thu 29 Oct');
    expect(screen.getAllByTestId('agenda-month')[0].textContent).toBe('November');
    expect(screen.getByTestId('agenda-section').textContent).toBe('No date1');
  });

  it('shows at most 3 avatars with a +N chip on full rows, nothing on quiet rows', () => {
    setup();
    const team = within(rowFor('Alpha overdue release')).getByTestId('release-team');
    expect(within(team).getAllByRole('img')).toHaveLength(3);
    expect(team.textContent).toContain('+2');
    expect(within(rowFor('Delta planned release')).queryByTestId('release-team')).toBeNull();
  });

  it('renders the package line only on full rows when showPackage is true', () => {
    const { unmount } = setup({ showPackage: true, pkgLoading: true });
    expect(
      within(rowFor('Alpha overdue release')).getByTestId('row-deployment-package'),
    ).toBeInTheDocument();
    expect(
      within(rowFor('Delta planned release')).queryByTestId('row-deployment-package'),
    ).toBeNull();
    unmount();
    setup({ showPackage: false });
    expect(screen.queryByTestId('row-deployment-package')).toBeNull();
  });

  it('renders stamps per row weight', () => {
    setup();
    expect(rowFor('Delta planned release').textContent).toContain('Tue 10 Nov');
    const full = rowFor('Alpha overdue release');
    expect(full.firstElementChild?.textContent).toBe('20 OctTue');
    expect(rowFor('Zeta undated release').firstElementChild?.textContent).toBe('No date');
    expect(rowFor('Epsilon started release').textContent).toContain('18/20');
  });

  it('uses the shared column system and no orange', () => {
    const { container } = setup();
    expect(container.innerHTML).not.toMatch(/orange/);
    expect(container.innerHTML).toContain('w-[150px]');
    expect(container.innerHTML).toContain('w-[70px]');
    expect(container.innerHTML).toContain('w-[100px]');
  });
});
