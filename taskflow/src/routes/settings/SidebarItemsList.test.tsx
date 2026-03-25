/**
 * SidebarItemsList integration tests — Phase 36: drag-reorder restoration.
 *
 * Tests verify drag handle rendering, checkbox toggle, section headers,
 * and row layout. Actual drag interaction is not tested (jsdom limitation
 * with dnd-kit pointer events). Store reorder logic is covered in
 * settings.store.test.ts.
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
import { DEV_SIDEBAR_PRESET, SIDEBAR_NAV_ITEMS } from '@/components/app/sidebar-items';
import { useSettingsStore } from '@/stores/settings.store';
import SidebarItemsList from './SidebarItemsList';

describe('SidebarItemsList', () => {
  const setSidebarItemVisible = vi.fn();
  const reorderSidebarItem = vi.fn();

  beforeEach(() => {
    setSidebarItemVisible.mockClear();
    reorderSidebarItem.mockClear();

    act(() => {
      useSettingsStore.setState({
        sidebarItems: DEV_SIDEBAR_PRESET.map((item) => ({ ...item })),
        setSidebarItemVisible,
        reorderSidebarItem,
      } as any);
    });
  });

  it('renders drag handles with aria-label "Drag to reorder" for each sidebar nav item', () => {
    render(<SidebarItemsList />);
    const handles = screen.getAllByLabelText('Drag to reorder');
    expect(handles).toHaveLength(SIDEBAR_NAV_ITEMS.length);
  });

  it('checkbox toggles call setSidebarItemVisible with correct id and boolean', async () => {
    const user = userEvent.setup();
    render(<SidebarItemsList />);

    // Find the checkbox for the first item (Dashboard)
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(SIDEBAR_NAV_ITEMS.length);

    // The first item in DEV_SIDEBAR_PRESET is 'dashboard' and is visible
    // Clicking it should toggle it off
    await user.click(checkboxes[0]);
    expect(setSidebarItemVisible).toHaveBeenCalledWith('dashboard', false);
  });

  it('renders section headers: Main, Planning, Code, Tracking', () => {
    render(<SidebarItemsList />);
    expect(screen.getByText('Main')).toBeInTheDocument();
    expect(screen.getByText('Planning')).toBeInTheDocument();
    expect(screen.getByText('Code')).toBeInTheDocument();
    expect(screen.getByText('Tracking')).toBeInTheDocument();
  });

  it('each item row contains drag handle, checkbox, and label text', () => {
    render(<SidebarItemsList />);

    // Find the first item label text
    const dashboardLabel = screen.getByText('Dashboard');
    const row = dashboardLabel.closest('[data-sortable-item]') ?? dashboardLabel.parentElement;
    expect(row).not.toBeNull();

    // Row should contain a button (drag handle) and a checkbox
    const button = row!.querySelector('button[aria-label="Drag to reorder"]');
    expect(button).not.toBeNull();

    const checkbox = row!.querySelector('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();

    // Verify order: button before checkbox before label
    const children = Array.from(row!.children);
    const buttonIdx = children.indexOf(button as Element);
    const checkboxIdx = children.indexOf(checkbox as Element);
    const labelIdx = children.indexOf(dashboardLabel);
    expect(buttonIdx).toBeLessThan(checkboxIdx);
    expect(checkboxIdx).toBeLessThan(labelIdx);
  });
});
