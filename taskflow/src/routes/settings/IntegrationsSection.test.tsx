import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import IntegrationsSection from './IntegrationsSection';

const mockStore = {
  aioEnabled: false,
  setAioEnabled: vi.fn(),
};

vi.mock('../../stores/settings.store', () => ({
  useSettingsStore: () => mockStore,
}));

describe('IntegrationsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.aioEnabled = false;
  });

  it('renders Integrations heading', () => {
    render(<IntegrationsSection />);
    expect(screen.getByRole('heading', { name: /integrations/i })).toBeInTheDocument();
  });

  it('renders AIO Test Management checkbox', () => {
    render(<IntegrationsSection />);
    expect(
      screen.getByRole('checkbox', { name: /enable aio test management/i }),
    ).toBeInTheDocument();
  });

  it('checkbox is unchecked when aioEnabled=false', () => {
    render(<IntegrationsSection />);
    expect(screen.getByRole('checkbox', { name: /enable aio test management/i })).not.toBeChecked();
  });

  it('checkbox is checked when aioEnabled=true', () => {
    mockStore.aioEnabled = true;
    render(<IntegrationsSection />);
    expect(screen.getByRole('checkbox', { name: /enable aio test management/i })).toBeChecked();
  });

  it('toggling checkbox calls setAioEnabled(true)', () => {
    render(<IntegrationsSection />);
    fireEvent.click(screen.getByRole('checkbox', { name: /enable aio test management/i }));
    expect(mockStore.setAioEnabled).toHaveBeenCalledWith(true);
  });
});
