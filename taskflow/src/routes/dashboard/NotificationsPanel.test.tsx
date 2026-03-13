/**
 * NotificationsPanel tests — DASH-04
 *
 * Tests unread notifications display, empty state,
 * inline detail on click, and "View all" link rendering.
 *
 * RED state: NotificationsPanel component does not exist yet.
 * These tests will fail at import resolution — that is expected.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

// Mock notifications store — NotificationsPanel reads items + readIds + markAsRead
vi.mock('@/stores/notifications.store', () => ({
  useNotificationsStore: vi.fn(() => ({
    items: [],
    readIds: [],
    markAsRead: vi.fn(),
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
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('NotificationsPanel (DASH-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('unread notification list', () => {
    it.todo('shows last 3 unread notifications sorted newest-first (items 4+ hidden)');
  });

  describe('empty state', () => {
    it.todo('shows "No unread notifications" empty state when all notifications are read or none exist');
  });

  describe('inline detail', () => {
    it.todo('clicking a notification row opens inline detail (NotificationDetail rendered), not navigation');
  });

  describe('"View all notifications" link', () => {
    it.todo('renders "View all notifications" link pointing to /notifications route');
  });
});
