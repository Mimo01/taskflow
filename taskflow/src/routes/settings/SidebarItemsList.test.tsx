/**
 * SidebarItemsList integration tests — Phase 67: visibility-only list (no drag-reorder).
 *
 * Tests verify checkbox toggle, section headers, and row layout.
 * Drag-handle tests removed — reorder functionality has been stripped.
 * Store reorder logic is no longer tested here (action removed).
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Tauri plugin-store so LazyStore doesn't attempt IPC calls in jsdom
vi.mock('@tauri-apps/plugin-store', () => {
  class LazyStore {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue(undefined);
    save = vi.fn().mockResolvedValue(undefined);
    delete = vi.fn().mockResolvedValue(undefined);
  }
  return { LazyStore };
});

import { act } from '@testing-library/react';
import { getDefaultSidebarItems, SIDEBAR_NAV_ITEMS } from '@/components/app/sidebar-items';
import { useSettingsStore } from '@/stores/settings.store';
import SidebarItemsList from './SidebarItemsList';

describe('SidebarItemsList', () => {
  const setSidebarItemVisible = vi.fn();

  beforeEach(() => {
    setSidebarItemVisible.mockClear();

    act(() => {
      useSettingsStore.setState({
        sidebarItems: getDefaultSidebarItems().map((item) => ({ ...item })),
        setSidebarItemVisible,
      } as any);
    });
  });

  it('checkbox toggles call setSidebarItemVisible with correct id and boolean', async () => {
    const user = userEvent.setup();
    render(<SidebarItemsList />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(SIDEBAR_NAV_ITEMS.length);

    // Dashboard (index 0) is alwaysVisible — disabled, clicking it does nothing
    expect(checkboxes[0]).toBeDisabled();
    await user.click(checkboxes[0]);
    expect(setSidebarItemVisible).not.toHaveBeenCalledWith('dashboard', expect.anything());

    // Standup Notes (index 1) is a normal toggleable item
    await user.click(checkboxes[1]);
    expect(setSidebarItemVisible).toHaveBeenCalledWith('standup-notes', false);
  });

  it('renders section headers: Main, Planning, Code, Tracking, Testing', () => {
    render(<SidebarItemsList />);
    expect(screen.getByText('Main')).toBeInTheDocument();
    expect(screen.getByText('Planning')).toBeInTheDocument();
    expect(screen.getByText('Code')).toBeInTheDocument();
    expect(screen.getByText('Tracking')).toBeInTheDocument();
    expect(screen.getByText('Testing')).toBeInTheDocument();
  });

  it('each item row contains a checkbox and label text with no drag handle', () => {
    render(<SidebarItemsList />);

    // Find the first item label text
    const dashboardLabel = screen.getByText('Dashboard');
    const row = dashboardLabel.parentElement;
    expect(row).not.toBeNull();

    // Row must have a checkbox
    const checkbox = row!.querySelector('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();

    // Row must NOT have a drag-handle button
    const dragButton = row!.querySelector('button[aria-label="Drag to reorder"]');
    expect(dragButton).toBeNull();

    // Row must NOT have data-sortable-item attribute
    expect(row!.hasAttribute('data-sortable-item')).toBe(false);

    // Verify order: checkbox comes before label in DOM
    const children = Array.from(row!.children);
    const checkboxIdx = children.indexOf(checkbox as Element);
    const labelIdx = children.indexOf(dashboardLabel);
    expect(checkboxIdx).toBeLessThan(labelIdx);
  });
});
