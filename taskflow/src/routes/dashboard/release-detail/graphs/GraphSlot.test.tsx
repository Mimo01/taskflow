import { render, screen } from '@testing-library/react';
import { Flame } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { GRAPH_ERROR_TEXT, GraphSlot } from './GraphSlot';

function slot(props: Partial<React.ComponentProps<typeof GraphSlot>> = {}) {
  return render(
    <GraphSlot
      title="Burnup"
      icon={Flame}
      state="ready"
      height={196}
      emptyLabel="Nothing yet"
      testId="gs"
      {...props}
    >
      <div data-testid="body">content</div>
    </GraphSlot>,
  );
}

describe('GraphSlot', () => {
  it('renders the heading, icon and aside', () => {
    const { container } = slot({ aside: <span>right</span> });
    expect(screen.getByRole('heading', { level: 3, name: 'Burnup' })).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('right').parentElement?.className).toContain('ml-auto');
  });

  it('loading shows the default skeleton at the slot height', () => {
    slot({ state: 'loading' });
    const sk = screen.getByTestId('gs-skeleton');
    expect((sk.firstElementChild as HTMLElement).style.height).toBe('196px');
    expect(screen.queryByTestId('body')).toBeNull();
  });

  it('loading uses a custom skeleton when given', () => {
    slot({ state: 'loading', skeleton: <i data-testid="custom" /> });
    expect(screen.getByTestId('custom')).toBeInTheDocument();
  });

  it('empty shows a dashed box with label and min-height', () => {
    slot({ state: 'empty' });
    const el = screen.getByTestId('gs-empty');
    expect(el).toHaveTextContent('Nothing yet');
    expect(el.className).toContain('border-dashed');
    expect(el.style.minHeight).toBe('196px');
  });

  it('error shows the default text with min-height', () => {
    slot({ state: 'error' });
    const el = screen.getByTestId('gs-error');
    expect(el).toHaveTextContent(GRAPH_ERROR_TEXT);
    expect(el.style.minHeight).toBe('196px');
  });

  it('ready renders children only, and the root keeps its testid in every state', () => {
    const { unmount } = slot();
    expect(screen.getByTestId('body')).toBeInTheDocument();
    expect(screen.queryByTestId('gs-skeleton')).toBeNull();
    expect(screen.queryByTestId('gs-empty')).toBeNull();
    expect(screen.queryByTestId('gs-error')).toBeNull();
    unmount();
    for (const state of ['loading', 'empty', 'error', 'ready'] as const) {
      const r = slot({ state });
      expect(screen.getByTestId('gs')).toBeInTheDocument();
      r.unmount();
    }
  });
});
