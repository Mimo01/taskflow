import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock lucide-react icons — includes FlaskConical for cycle tab rendering (added in Wave 1)
vi.mock('lucide-react', () => ({
  FlaskConical: () => <span data-testid="flask-icon" />,
  ArrowLeftToLine: () => <span />,
  ArrowRightToLine: () => <span />,
  BookOpen: () => <span />,
  Bug: () => <span />,
  CheckSquare: () => <span />,
  CornerDownRight: () => <span />,
  Loader2: () => <span />,
  PinOff: () => <span />,
}));

// Live import — will have TypeScript errors until Wave 1 renames resolvedIssues → resolvedTabs
// and adds CycleTab to the discriminated union. This is acceptable RED state.
import PinnedTabStrip from './PinnedTabStrip';

describe('PinnedTabStrip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders issue tab with IssueTypeIcon + key + summary when resolvedTabs has type="issue" entry', () => {
    const resolvedTabs = new Map([
      ['PROJ-1', { type: 'issue' as const, summary: 'Fix login bug', issueTypeName: 'Bug' }],
    ]);
    render(
      <MemoryRouter>
        <PinnedTabStrip
          pinnedKeys={['PROJ-1']}
          resolvedTabs={resolvedTabs}
          activeKey={null}
          onTabClick={vi.fn()}
          onTabClose={vi.fn()}
          onReorder={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('PROJ-1')).toBeDefined();
    expect(screen.getByText('Fix login bug')).toBeDefined();
  });

  describe('cycle tab rendering', () => {
    it('renders cycle tab with FlaskConical icon when resolvedTabs has type="cycle" entry', () => {
      const resolvedTabs = new Map([
        ['PROJ-CY-2', { type: 'cycle' as const, name: 'Sprint 2', projectKey: 'PROJ' }],
      ]);
      render(
        <MemoryRouter>
          <PinnedTabStrip
            pinnedKeys={['PROJ-CY-2']}
            resolvedTabs={resolvedTabs}
            activeKey={null}
            onTabClick={vi.fn()}
            onTabClose={vi.fn()}
            onReorder={vi.fn()}
          />
        </MemoryRouter>,
      );
      expect(screen.getByTestId('flask-icon')).toBeDefined();
    });

    it('renders cycle key in font-mono and cycle name as display text for cycle tab', () => {
      const resolvedTabs = new Map([
        ['PROJ-CY-2', { type: 'cycle' as const, name: 'Sprint 2', projectKey: 'PROJ' }],
      ]);
      render(
        <MemoryRouter>
          <PinnedTabStrip
            pinnedKeys={['PROJ-CY-2']}
            resolvedTabs={resolvedTabs}
            activeKey={null}
            onTabClick={vi.fn()}
            onTabClose={vi.fn()}
            onReorder={vi.fn()}
          />
        </MemoryRouter>,
      );
      expect(screen.getByText('PROJ-CY-2')).toBeDefined();
      expect(screen.getByText('Sprint 2')).toBeDefined();
    });

    it('active cycle tab has border-primary class applied', () => {
      const resolvedTabs = new Map([
        ['PROJ-CY-2', { type: 'cycle' as const, name: 'Sprint 2', projectKey: 'PROJ' }],
      ]);
      render(
        <MemoryRouter>
          <PinnedTabStrip
            pinnedKeys={['PROJ-CY-2']}
            resolvedTabs={resolvedTabs}
            activeKey="PROJ-CY-2"
            onTabClick={vi.fn()}
            onTabClose={vi.fn()}
            onReorder={vi.fn()}
          />
        </MemoryRouter>,
      );
      const tab = screen.getByRole('tab');
      expect(tab.className).toContain('border-primary');
    });
  });

  it('clicking a tab calls onTabClick with the tab key', async () => {
    const user = userEvent.setup();
    const onTabClick = vi.fn();
    const resolvedTabs = new Map([
      ['PROJ-CY-2', { type: 'cycle' as const, name: 'Sprint 2', projectKey: 'PROJ' }],
    ]);
    render(
      <MemoryRouter>
        <PinnedTabStrip
          pinnedKeys={['PROJ-CY-2']}
          resolvedTabs={resolvedTabs}
          activeKey={null}
          onTabClick={onTabClick}
          onTabClose={vi.fn()}
          onReorder={vi.fn()}
        />
      </MemoryRouter>,
    );
    const tab = screen.getByRole('tab');
    await user.click(tab);
    expect(onTabClick).toHaveBeenCalledWith('PROJ-CY-2');
  });

  it('aria-label on the strip element equals "Pinned tabs"', () => {
    const resolvedTabs = new Map([
      ['PROJ-CY-2', { type: 'cycle' as const, name: 'Sprint 2', projectKey: 'PROJ' }],
    ]);
    render(
      <MemoryRouter>
        <PinnedTabStrip
          pinnedKeys={['PROJ-CY-2']}
          resolvedTabs={resolvedTabs}
          activeKey={null}
          onTabClick={vi.fn()}
          onTabClose={vi.fn()}
          onReorder={vi.fn()}
        />
      </MemoryRouter>,
    );
    const strip = screen.getByRole('tablist');
    expect(strip.getAttribute('aria-label')).toBe('Pinned tabs');
  });
});

// Suppress unused import warning — import is intentional to establish the test surface
void render;
void MemoryRouter;
void PinnedTabStrip;
