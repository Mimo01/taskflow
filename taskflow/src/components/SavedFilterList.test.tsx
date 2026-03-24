import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mockSetActiveFilter = vi.fn();
const mockRemoveSavedFilter = vi.fn();

const DEFAULT_STATE = {
  savedFilters: [] as Array<{ id: string; name: string; jql: string; description?: string }>,
  activeFilterId: null as string | null,
  isLoading: false,
  setActiveFilter: mockSetActiveFilter,
  removeSavedFilter: mockRemoveSavedFilter,
  setSavedFilters: vi.fn(),
  addSavedFilter: vi.fn(),
  updateSavedFilter: vi.fn(),
  setLoading: vi.fn(),
};

let storeOverrides: Partial<typeof DEFAULT_STATE> = {};

vi.mock('@/stores/saved-filter.store', () => ({
  useSavedFilterStore: (selector: (s: typeof DEFAULT_STATE) => unknown) => {
    const state = { ...DEFAULT_STATE, ...storeOverrides };
    return selector(state);
  },
}));

// Mock EditFilterDialog to avoid pulling in heavy dependencies
vi.mock('./EditFilterDialog', () => ({
  EditFilterDialog: () => null,
}));

// Mock stronghold and filters service
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('mock-token'),
}));
vi.mock('@/services/jira/filters', () => ({
  deleteJiraFilter: vi.fn().mockResolvedValue(undefined),
}));

import { SavedFilterList } from './SavedFilterList';

describe('SavedFilterList', () => {
  beforeEach(() => {
    storeOverrides = {};
    mockSetActiveFilter.mockClear();
    mockRemoveSavedFilter.mockClear();
  });

  it('renders "No saved filters" when store has empty savedFilters array', () => {
    render(<SavedFilterList jiraBaseUrl="https://jira.example.com" />);
    expect(screen.getByText('No saved filters')).toBeTruthy();
  });

  it('renders filter names when store has filters', () => {
    storeOverrides = {
      savedFilters: [
        { id: '1', name: 'My Bugs', jql: 'type = Bug' },
        { id: '2', name: 'Open Tasks', jql: 'status != Done' },
      ],
    };
    render(<SavedFilterList jiraBaseUrl="https://jira.example.com" />);
    expect(screen.getByText('My Bugs')).toBeTruthy();
    expect(screen.getByText('Open Tasks')).toBeTruthy();
  });

  it('clicking a filter calls setActiveFilter with that filter id', () => {
    storeOverrides = {
      savedFilters: [{ id: '42', name: 'Sprint Filter', jql: 'sprint in openSprints()' }],
    };
    render(<SavedFilterList jiraBaseUrl="https://jira.example.com" />);
    fireEvent.click(screen.getByText('Sprint Filter'));
    expect(mockSetActiveFilter).toHaveBeenCalledWith('42');
  });

  it('clicking the active filter calls setActiveFilter(null) to deactivate', () => {
    storeOverrides = {
      savedFilters: [{ id: '42', name: 'Sprint Filter', jql: 'sprint in openSprints()' }],
      activeFilterId: '42',
    };
    render(<SavedFilterList jiraBaseUrl="https://jira.example.com" />);
    fireEvent.click(screen.getByText('Sprint Filter'));
    expect(mockSetActiveFilter).toHaveBeenCalledWith(null);
  });

  it('"Saved Filters" header text is rendered', () => {
    render(<SavedFilterList jiraBaseUrl="https://jira.example.com" />);
    expect(screen.getByText('Saved Filters')).toBeTruthy();
  });
});
