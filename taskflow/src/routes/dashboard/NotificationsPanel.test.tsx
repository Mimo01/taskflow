/**
 * NotificationsPanel tests — DASH-04
 *
 * Tests unread notifications display, empty state,
 * inline detail on click, and "View all" link rendering.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Mock @tanstack/react-query (useQuery, useQueryClient)
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({ data: undefined, isLoading: false, isError: false }),
    useQueryClient: vi.fn().mockReturnValue({ getQueryData: vi.fn() }),
  };
});

// Mock auth store
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
    gitlabBaseUrl: 'https://gitlab.example.com',
  })),
}));

// Mock settings store
vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn(() => ({
    storyPointsFieldKey: 'customfield_10016',
  })),
}));

// Mutable store state so tests can reconfigure per scenario
const mockMarkAsRead = vi.fn();
let mockStoreItems: ReturnType<typeof makeNotification>[] = [];
let mockReadIds: string[] = [];

vi.mock('@/stores/notifications.store', () => ({
  useNotificationsStore: vi.fn(() => ({
    items: mockStoreItems,
    readIds: mockReadIds,
    markAsRead: mockMarkAsRead,
  })),
}));

// Helper: build a NotificationItem fixture
function makeNotification(id: string, createdAt: string, source: 'jira' | 'gitlab' = 'jira') {
  return {
    id,
    source,
    entityTitle: `PROJ-${id}: Fix something`,
    author: 'J.Smith',
    bodyPreview: `Body preview for notification ${id}`,
    fullBody: `Full body for notification ${id}`,
    createdAt,
  };
}

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NotificationsPanel (DASH-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreItems = [];
    mockReadIds = [];
  });

  describe('unread notification list', () => {
    it('shows last 3 unread notifications sorted newest-first (items 4+ hidden)', async () => {
      const { default: NotificationsPanel } = await import('./NotificationsPanel');

      // 5 unread items — only first 3 (newest) should appear
      mockStoreItems = [
        makeNotification('1', '2024-01-01T10:00:00Z'),
        makeNotification('2', '2024-01-02T10:00:00Z'),
        makeNotification('3', '2024-01-03T10:00:00Z'),
        makeNotification('4', '2024-01-04T10:00:00Z'),
        makeNotification('5', '2024-01-05T10:00:00Z'), // newest
      ];
      mockReadIds = [];

      renderWithQuery(<NotificationsPanel />);

      // Newest-first: 5, 4, 3 shown; 1, 2 hidden
      expect(screen.getByText('PROJ-5: Fix something')).toBeInTheDocument();
      expect(screen.getByText('PROJ-4: Fix something')).toBeInTheDocument();
      expect(screen.getByText('PROJ-3: Fix something')).toBeInTheDocument();
      expect(screen.queryByText('PROJ-2: Fix something')).not.toBeInTheDocument();
      expect(screen.queryByText('PROJ-1: Fix something')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows "No unread notifications" empty state when all notifications are read or none exist', async () => {
      const { default: NotificationsPanel } = await import('./NotificationsPanel');

      // All items read
      mockStoreItems = [makeNotification('1', '2024-01-01T10:00:00Z')];
      mockReadIds = ['1'];

      renderWithQuery(<NotificationsPanel />);

      expect(screen.getByText('No unread notifications')).toBeInTheDocument();
    });
  });

  describe('inline detail', () => {
    it('clicking a notification row opens inline detail (NotificationDetail rendered), not navigation', async () => {
      const { default: NotificationsPanel } = await import('./NotificationsPanel');

      mockStoreItems = [makeNotification('42', '2024-01-01T10:00:00Z')];
      mockReadIds = [];

      renderWithQuery(<NotificationsPanel />);

      // Detail not shown initially
      expect(screen.queryByText('Full body for notification 42')).not.toBeInTheDocument();

      // Click the row (button element)
      const rowButton = screen.getByRole('button', { name: /PROJ-42/i });
      fireEvent.click(rowButton);

      // NotificationDetail rendered inline — fullBody text is visible
      expect(screen.getByText('Full body for notification 42')).toBeInTheDocument();
      expect(mockMarkAsRead).toHaveBeenCalledWith('42');
    });
  });

  describe('"View all notifications" link', () => {
    it('renders "View all notifications" link pointing to /notifications route', async () => {
      const { default: NotificationsPanel } = await import('./NotificationsPanel');

      renderWithQuery(<NotificationsPanel />);

      const link = screen.getByRole('link', { name: /view all notifications/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/notifications');
    });
  });
});
