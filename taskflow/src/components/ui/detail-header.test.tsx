import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement, ReactNode } from 'react';
import { Pencil, RefreshCw } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DetailHeader, HeaderMenuItem, HeaderTool } from './detail-header';

// The shared ResizeObserver mock reports 600px (< 720 = tiny); pin the width under test.
function stubWidth(width: number) {
  class RO {
    constructor(private cb: ResizeObserverCallback) {}
    observe() {
      this.cb([{ contentRect: { width } } as ResizeObserverEntry], this as never);
    }
    disconnect() {}
    unobserve() {}
  }
  vi.stubGlobal('ResizeObserver', RO);
}

// LinkContextMenu (primary pair) reads a react-query hook.
function renderHeader(ui: ReactElement) {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const result = render(ui, { wrapper });
  return {
    ...result,
    rerender: (next: ReactElement) => result.rerender(next),
  };
}

const primary = {
  href: 'https://example.com/x',
  openLabel: 'Open in X',
  copyLabel: 'Copy X link',
  copiedLabel: 'Copied X link',
};

function tools() {
  return (
    <>
      <HeaderTool tier="secondary" icon={RefreshCw} label="Refresh" aria-label="Refresh x" />
      <HeaderTool tier="primary" icon={Pencil} label="Edit" aria-label="Edit x" />
      <HeaderTool tier="fixed" icon={Pencil} aria-label="Fixed x" />
    </>
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('DetailHeader tools', () => {
  it('wide: primary tools show a not-sr-only label, secondary carry the hidden class', () => {
    stubWidth(1100);
    renderHeader(<DetailHeader identity={<span>KEY-1</span>} title="Title" tools={tools()} />);
    const edit = screen.getByRole('button', { name: 'Edit x' });
    expect(within(edit).getByText('Edit')).toHaveClass('@[860px]:not-sr-only');
    expect(screen.getByRole('button', { name: 'Refresh x' })).toHaveClass(
      'hidden',
      '@[860px]:inline-flex',
    );
    expect(screen.getByRole('button', { name: 'Fixed x' }).className).not.toContain('hidden');
  });

  it('tiny: primary tools are not rendered, secondary and fixed are', () => {
    stubWidth(600);
    renderHeader(<DetailHeader identity={<span>KEY-1</span>} title="Title" tools={tools()} />);
    expect(screen.queryByRole('button', { name: 'Edit x' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Refresh x' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fixed x' })).toBeInTheDocument();
  });
});

describe('DetailHeader primary pair + menu', () => {
  beforeEach(() => stubWidth(1100));

  it('renders the filled pair outside the toolbar when wide', () => {
    renderHeader(
      <DetailHeader identity={<span>KEY-1</span>} title="T" tools={tools()} primary={primary} />,
    );
    const open = screen.getByRole('button', { name: 'Open in X' });
    expect(
      within(screen.getByRole('toolbar')).queryByRole('button', { name: 'Open in X' }),
    ).toBeNull();
    expect(open).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy X link' })).toBeInTheDocument();
  });

  it('tiny: the pair moves to the start of the menu, before the host content', async () => {
    stubWidth(600);
    renderHeader(
      <DetailHeader
        identity={<span>KEY-1</span>}
        title="T"
        primary={primary}
        menu={<HeaderMenuItem icon={RefreshCw} label="Refresh it" />}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Open in X' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'More actions' }));
    const items = await screen.findAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual(['Open in X', 'Copy X link', 'Refresh it']);
  });

  it('passes {tiny} to a menu function', async () => {
    stubWidth(600);
    renderHeader(
      <DetailHeader
        identity={<span>KEY-1</span>}
        title="T"
        menu={({ tiny }) => <HeaderMenuItem icon={RefreshCw} label={tiny ? 'tiny' : 'wide'} />}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(await screen.findByRole('menuitem', { name: 'tiny' })).toBeInTheDocument();
  });

  it('has no ⋯ trigger without a menu or primary pair', () => {
    renderHeader(<DetailHeader identity={<span>KEY-1</span>} title="T" tools={tools()} />);
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull();
  });
});

describe('DetailHeader title + extra + crumbs', () => {
  beforeEach(() => stubWidth(1100));

  it('collapses the title and the extra slot together when compact', () => {
    renderHeader(
      <DetailHeader
        compact
        identity={<span>KEY-1</span>}
        title="Big title"
        extra={<p>meta line</p>}
      />,
    );
    const grid = screen.getByRole('heading', { name: 'Big title' }).parentElement?.parentElement;
    expect(grid).toHaveClass('grid-rows-[0fr]', 'opacity-0');
    expect(grid).toContainElement(screen.getByText('meta line'));
  });

  it('titleAs h1 renders a level-1 heading, default is level 2; placeholder fills in', () => {
    const { rerender } = renderHeader(
      <DetailHeader identity={<span>K</span>} title="A" titleAs="h1" />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'A' })).toBeInTheDocument();
    rerender(<DetailHeader identity={<span>K</span>} title="A" />);
    expect(screen.getByRole('heading', { level: 2, name: 'A' })).toBeInTheDocument();
    rerender(<DetailHeader identity={<span>K</span>} titlePlaceholder={<i>loading-title</i>} />);
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByText('loading-title')).toBeInTheDocument();
  });

  it('renders crumbTail once and no back/crumbs for an empty trail', () => {
    renderHeader(
      <DetailHeader
        identity={<span>KEY-1</span>}
        title="T"
        crumbTail={<button type="button">tail</button>}
        nav={{ trail: [], onBack: vi.fn(), onNavigate: vi.fn() }}
      />,
    );
    expect(screen.getAllByRole('button', { name: 'tail' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Go back' })).toBeNull();
  });

  it('shows back when the trail has entries, even if all are trimmed into crumbTail', async () => {
    const onBack = vi.fn();
    renderHeader(
      <DetailHeader
        identity={<span>KEY-1</span>}
        title="T"
        trimTrail={1}
        crumbTail={<button type="button">tail</button>}
        nav={{ trail: [{ path: '/p', label: 'PROJ-1' }], onBack, onNavigate: vi.fn() }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(onBack).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'PROJ-1' })).toBeNull();
  });
});
