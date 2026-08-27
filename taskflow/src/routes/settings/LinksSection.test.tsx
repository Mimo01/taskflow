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
  function SelectValue(_props: GenericProps) {
    return null;
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

  it('lists System Default plus every detected browser', async () => {
    render(<LinksSection />);

    await waitFor(() => {
      expect(screen.getByText('Firefox')).toBeInTheDocument();
    });
    expect(screen.getByText('System Default')).toBeInTheDocument();
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

    expect(screen.getByText('System Default')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('list_browsers');
    });
    expect(screen.queryByText('Firefox')).not.toBeInTheDocument();
  });
});
