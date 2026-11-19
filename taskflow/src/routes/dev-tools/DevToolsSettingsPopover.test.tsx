/**
 * DevToolsSettingsPopover: capture options only; the master toggle lives in Settings → Advanced.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DevToolsSettingsPopover from './DevToolsSettingsPopover';

describe('DevToolsSettingsPopover', () => {
  it('shows the capture options and no master toggle', async () => {
    render(<DevToolsSettingsPopover />);
    fireEvent.click(screen.getByRole('button', { name: 'Developer Tools settings' }));
    expect(await screen.findByRole('switch', { name: 'Request logging' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Response body capture' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Retention limit' })).toBeTruthy();
    expect(screen.queryByRole('switch', { name: 'Developer Tools' })).toBeNull();
  });
});
