import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '../../stores/settings.store';
import NotificationSettingsSection from './NotificationSettingsSection';

describe('NotificationSettingsSection banner duration', () => {
  beforeEach(() => {
    act(() => {
      useSettingsStore.setState({ notifBannerDurationSecs: 5 });
    });
  });

  it('shows Off / 3s / 5s / 8s with the current value pressed', () => {
    render(<NotificationSettingsSection />);
    expect(screen.getByText('Banner duration')).toBeInTheDocument();
    expect(screen.getByText('How long in-app banners stay on screen')).toBeInTheDocument();
    for (const label of ['Off', '3s', '5s', '8s']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: '5s' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '8s' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('clicking 8s stores 8, Off stores 0', () => {
    render(<NotificationSettingsSection />);
    fireEvent.click(screen.getByRole('button', { name: '8s' }));
    expect(useSettingsStore.getState().notifBannerDurationSecs).toBe(8);
    expect(screen.getByRole('button', { name: '8s' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Off' }));
    expect(useSettingsStore.getState().notifBannerDurationSecs).toBe(0);
  });
});
