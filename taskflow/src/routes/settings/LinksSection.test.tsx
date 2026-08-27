import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LinksSection from './LinksSection';

// Radix Select's positioning is driven by floating-ui, which does not lay out
// reliably in jsdom — clicking an option never drives onValueChange. This
// native-<select> stand-in keeps the same prop API (value/onValueChange) so
// LinksSection's Select wiring is what gets exercised. (Mirrors
// FieldsSection.test.tsx / AioBlock.test.tsx / IntegrationsSection.test.tsx.)
vi.mock('@/components/ui/select', async () => {
  const React = await import('react');
  type SelectProps = {
    value?: string;
    onValueChange?: (v: string) => void;
    children?: React.ReactNode;
  };
  type ItemProps = { value: string; children?: React.ReactNode };
  type GenericProps = { children?: React.ReactNode; [key: string]: unknown };

  const SelectContext = React.createContext<{
    value: string;
    onValueChange: (v: string) => void;
  }>({ value: '', onValueChange: () => {} });

  function Select({ value = '', onValueChange = () => {}, children }: SelectProps) {
    return (
      <SelectContext.Provider value={{ value, onValueChange }}>{children}</SelectContext.Provider>
    );
  }
  function SelectTrigger({ children, ...rest }: GenericProps) {
    return (
      <button type="button" {...rest}>
        {children}
      </button>
    );
  }
  function SelectValue({
    children,
  }: {
    children?: React.ReactNode | ((value: string) => React.ReactNode);
  }) {
    const ctx = React.useContext(SelectContext);
    if (typeof children === 'function') return <>{children(ctx.value)}</>;
    return <>{children}</>;
  }
  function SelectContent({ children }: GenericProps) {
    const ctx = React.useContext(SelectContext);
    return (
      <select
        data-testid="select-native"
        value={ctx.value}
        onChange={(e) => ctx.onValueChange(e.target.value)}
      >
        {children}
      </select>
    );
  }
  function SelectItem({ value, children }: ItemProps) {
    return <option value={value}>{children}</option>;
  }
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

const mockSettingsStore = {
  externalBrowser: null as string | null,
  setExternalBrowser: vi.fn(),
};
vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: Object.assign(
    (selector?: (s: typeof mockSettingsStore) => unknown) =>
      selector ? selector(mockSettingsStore) : mockSettingsStore,
    { getState: () => mockSettingsStore },
  ),
}));

const mockInvoke = vi.fn();
vi.mock('@/services/tauri', () => ({
  tauriService: { invoke: (...args: unknown[]) => mockInvoke(...args) },
}));

const FAKE_BROWSERS = [
  { id: 'firefox', label: 'Firefox', path: '/Applications/Firefox.app' },
  { id: 'chrome', label: 'Google Chrome', path: '/Applications/Google Chrome.app' },
];

describe('LinksSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsStore.externalBrowser = null;
    mockInvoke.mockResolvedValue(FAKE_BROWSERS);
  });

  it('renders the section heading', async () => {
    render(<LinksSection />);
    expect(screen.getByRole('heading', { name: /^links$/i, level: 2 })).toBeInTheDocument();
  });

  it('shows the friendly "System Default" label in the trigger, not the raw sentinel value', async () => {
    render(<LinksSection />);

    await waitFor(() => {
      expect(screen.getByText('Firefox')).toBeInTheDocument();
    });

    const trigger = screen.getByRole('button');
    expect(trigger).toHaveTextContent('System Default');
    expect(trigger).not.toHaveTextContent('__default__');
  });

  it('shows the selected browser\'s friendly label in the trigger, not its raw path', async () => {
    mockSettingsStore.externalBrowser = '/Applications/Firefox.app';

    render(<LinksSection />);

    await waitFor(() => {
      const trigger = screen.getByRole('button');
      expect(trigger).toHaveTextContent('Firefox');
    });
    expect(screen.getByRole('button')).not.toHaveTextContent('/Applications/Firefox.app');
  });

  it('lists System Default plus every detected browser', async () => {
    render(<LinksSection />);

    await waitFor(() => {
      expect(screen.getByText('Firefox')).toBeInTheDocument();
    });
    expect(screen.getAllByText('System Default').length).toBeGreaterThan(0);
    expect(screen.getByText('Google Chrome')).toBeInTheDocument();
  });

  it('calls setExternalBrowser with the selected browser path', async () => {
    render(<LinksSection />);

    await waitFor(() => {
      expect(screen.getByText('Firefox')).toBeInTheDocument();
    });

    const select = screen.getByTestId('select-native');
    fireEvent.change(select, { target: { value: '/Applications/Firefox.app' } });

    expect(mockSettingsStore.setExternalBrowser).toHaveBeenCalledWith('/Applications/Firefox.app');
  });

  it('degrades to System Default only when list_browsers fails', async () => {
    mockInvoke.mockRejectedValue(new Error('no tauri runtime'));

    render(<LinksSection />);

    expect(screen.getAllByText('System Default').length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('list_browsers');
    });
    expect(screen.queryByText('Firefox')).not.toBeInTheDocument();
  });
});
