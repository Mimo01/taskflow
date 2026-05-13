import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, it, vi } from 'vitest';

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

  it.todo('renders issue tab with IssueTypeIcon + key + summary when resolvedTabs has type="issue" entry');

  describe('cycle tab rendering', () => {
    it.todo('renders cycle tab with FlaskConical icon when resolvedTabs has type="cycle" entry');
    it.todo('renders cycle key in font-mono and cycle name as display text for cycle tab');
    it.todo('active cycle tab has border-primary class applied');
  });

  it.todo('clicking a tab calls onTabClick with the tab key');
  it.todo('aria-label on the strip element equals "Pinned tabs"');
});

// Suppress unused import warning — import is intentional to establish the test surface
void render;
void MemoryRouter;
void PinnedTabStrip;
