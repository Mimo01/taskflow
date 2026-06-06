/**
 * Tests for FieldsSection — priority icon and Severity MetaRow.
 *
 * These tests use the extractSeverity pure helper directly (for logic coverage)
 * and a minimal render test for the React output.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

// Mock all store / hook dependencies so FieldsSection renders without network or Tauri
vi.mock('@/stores/auth.store', () => {
  const state = {
    jiraBaseUrl: 'https://jira.example.com',
    jiraConnected: true,
    jiraUsername: 'testuser',
    jiraUserDisplayName: 'Test User',
    activeJiraProject: 'PROJ',
  };
  const useAuthStore = vi.fn((selector?: (s: typeof state) => unknown) =>
    selector ? selector(state) : state,
  );
  (useAuthStore as any).getState = () => state;
  return { useAuthStore };
});

vi.mock('@/stores/settings.store', () => {
  const state = {
    epicLinkFieldKey: 'customfield_10014',
    epicNameFieldKey: 'customfield_10015',
    sprintFieldKey: 'customfield_10020',
    storyPointsFieldKey: 'customfield_10016',
    epicColorFieldKey: 'customfield_10013',
  };
  return {
    useSettingsStore: vi.fn((selector?: (s: typeof state) => unknown) =>
      selector ? selector(state) : state,
    ),
  };
});

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-token'),
}));

vi.mock('@/lib/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/hooks/useBoardId', () => ({
  useBoardId: vi.fn().mockReturnValue({ boardId: null }),
}));

vi.mock('@/services/jira/backlog', () => ({
  fetchSprintList: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/services/jira/sprints', () => ({
  addIssuesToSprint: vi.fn(),
  moveIssuesToBacklog: vi.fn(),
}));

vi.mock('@/services/jira/transitions', () => ({
  postTransition: vi.fn(),
  fetchIssueTransitionsWithFields: vi.fn().mockResolvedValue([]),
  transitionsWithFieldsKey: (issueKey: string, baseUrl: string, statusId: string) => [
    'jira-issue-transitions-fields',
    issueKey,
    baseUrl,
    statusId,
  ],
}));

vi.mock('@/services/jira/versions', () => ({
  fetchFixVersions: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/services/jira/resolutions', () => ({
  fetchResolutions: vi.fn().mockResolvedValue([
    { id: '1', name: 'Done' },
    { id: '2', name: "Won't Do" },
  ]),
}));

// Replace the base-ui Select primitive with a deterministic <select>+<option>
// stand-in. Reason: base-ui Select renders its options into a positioned portal
// driven by floating-ui, which does not lay out reliably in jsdom — clicking an
// option never drives onValueChange. The stand-in keeps the same prop API
// (`value`, `onValueChange`) so the FieldsSection → mutation.mutate wiring is
// what gets exercised. (Mirrors AioBlock.test.tsx / IntegrationsSection.test.tsx.)
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
        <option value="" disabled hidden>
          —
        </option>
        {children}
      </select>
    );
  }
  function SelectItem({ value, children }: ItemProps) {
    return <option value={value}>{children}</option>;
  }
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

vi.mock('../StatusPopover', () => ({
  default: ({ currentStatus }: { currentStatus: string }) => <span>{currentStatus}</span>,
}));

vi.mock('./WatcherToggle', () => ({
  WatcherToggle: () => null,
}));

vi.mock('./TimeTrackingSummary', () => ({
  TimeTrackingSummary: () => null,
}));

vi.mock('./OverdueBadge', () => ({
  OverdueBadge: () => null,
}));

vi.mock('./useFieldMutation', () => ({
  useFieldMutation: vi.fn().mockReturnValue({
    isPending: false,
    isError: false,
    mutate: vi.fn(),
    variables: undefined,
    data: undefined,
  }),
  useDebounce: vi.fn((fn: unknown) => fn),
}));

import type { JiraIssueDetail } from '@/services/jira';
import { extractSeverity } from './FieldsSection';

// --- Pure helper tests ---
describe('extractSeverity', () => {
  it('returns value when customfield_13415 has .value', () => {
    expect(extractSeverity({ value: 'Major' })).toBe('Major');
  });

  it('returns name when customfield_13415 has .name but no .value', () => {
    expect(extractSeverity({ name: 'Minor' })).toBe('Minor');
  });

  it('prefers .value over .name when both present', () => {
    expect(extractSeverity({ value: 'Critical', name: 'SomeName' })).toBe('Critical');
  });

  it('returns null for null input', () => {
    expect(extractSeverity(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(extractSeverity(undefined)).toBeNull();
  });

  it('returns null when both value and name are absent', () => {
    expect(extractSeverity({})).toBeNull();
  });
});

// --- Render tests ---
function makeIssue(overrides: Partial<JiraIssueDetail['fields']> = {}): JiraIssueDetail {
  return {
    id: 'PROJ-1',
    key: 'PROJ-1',
    fields: {
      summary: 'Test issue',
      description: null,
      status: { id: '1', name: 'Open', statusCategory: { key: 'new' } },
      issuetype: { name: 'Story', subtask: false },
      priority: { name: 'High' },
      resolution: null,
      assignee: { displayName: 'Jane', name: 'jane', avatarUrls: { '48x48': '' } },
      reporter: { displayName: 'John', name: 'john', avatarUrls: { '48x48': '' } },
      subtasks: [],
      issuelinks: [],
      comment: { comments: [] },
      labels: [],
      fixVersions: [],
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-03-01T00:00:00.000Z',
      duedate: null,
      customfield_10016: null,
      customfield_10014: null,
      customfield_10015: null,
      customfield_10020: null,
      ...overrides,
    },
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

async function renderFieldsSection(issue: JiraIssueDetail) {
  const { FieldsSection } = await import('./FieldsSection');
  const mutation = {
    isPending: false,
    isError: false,
    mutate: vi.fn(),
    variables: undefined,
    data: undefined,
  };
  render(
    <FieldsSection
      issue={issue}
      issueKey={issue.key}
      jiraBaseUrl="https://jira.example.com"
      storyPointsFieldKey="customfield_10016"
      epicLinkFieldKey="customfield_10014"
      epicNameFieldKey="customfield_10015"
      sprintFieldKey="customfield_10020"
      epicColorFieldKey="customfield_10013"
      mutation={mutation as any}
      epicIssue={null}
    />,
    { wrapper },
  );
}

describe('FieldsSection', () => {
  describe('Priority row', () => {
    it('renders priority icon img when iconUrl is present', async () => {
      const issue = makeIssue({
        priority: { name: 'High', iconUrl: 'http://example.com/icon.svg' },
      });
      await renderFieldsSection(issue);
      const img = screen.getByTestId('priority-icon');
      expect(img).toBeTruthy();
      expect(img.getAttribute('src')).toBe('http://example.com/icon.svg');
    });

    it('renders priority name text without img when iconUrl is absent', async () => {
      const issue = makeIssue({ priority: { name: 'Low' } });
      await renderFieldsSection(issue);
      expect(screen.queryByTestId('priority-icon')).toBeNull();
      expect(screen.getByText('Low')).toBeTruthy();
    });
  });

  describe('Severity MetaRow', () => {
    it('renders Severity row with value from customfield_13415.value', async () => {
      const issue = makeIssue({ customfield_13415: { value: 'Major' } });
      await renderFieldsSection(issue);
      expect(screen.getByText('Severity')).toBeTruthy();
      expect(screen.getByText('Major')).toBeTruthy();
    });

    it('renders Severity row using .name when .value is absent', async () => {
      const issue = makeIssue({ customfield_13415: { name: 'Minor' } });
      await renderFieldsSection(issue);
      expect(screen.getByText('Severity')).toBeTruthy();
      expect(screen.getByText('Minor')).toBeTruthy();
    });

    it('does NOT render Severity row when customfield_13415 is null', async () => {
      const issue = makeIssue({ customfield_13415: null });
      await renderFieldsSection(issue);
      expect(screen.queryByText('Severity')).toBeNull();
    });

    it('does NOT render Severity row when customfield_13415 is undefined', async () => {
      const issue = makeIssue();
      await renderFieldsSection(issue);
      expect(screen.queryByText('Severity')).toBeNull();
    });
  });

  describe('Flagged MetaRow', () => {
    async function renderFieldsSectionWithFlag(
      issue: JiraIssueDetail,
      flaggedFieldKey = 'customfield_10021',
    ) {
      const { FieldsSection } = await import('./FieldsSection');
      const mutateMock = vi.fn();
      const mutation = {
        isPending: false,
        isError: false,
        mutate: mutateMock,
        variables: undefined,
        data: undefined,
      };
      render(
        <FieldsSection
          issue={issue}
          issueKey={issue.key}
          jiraBaseUrl="https://jira.example.com"
          storyPointsFieldKey="customfield_10016"
          epicLinkFieldKey="customfield_10014"
          epicNameFieldKey="customfield_10015"
          sprintFieldKey="customfield_10020"
          epicColorFieldKey="customfield_10013"
          flaggedFieldKey={flaggedFieldKey}
          mutation={mutation as any}
          epicIssue={null}
        />,
        { wrapper },
      );
      return mutateMock;
    }

    it('renders "Add flag" button when issue is not flagged', async () => {
      const issue = makeIssue({ customfield_10021: null });
      await renderFieldsSectionWithFlag(issue);
      expect(screen.getByText('— Add flag')).toBeTruthy();
    });

    it('renders "Flagged (Impediment)" when customfield is set', async () => {
      const issue = makeIssue({ customfield_10021: [{ value: 'Impediment' }] });
      await renderFieldsSectionWithFlag(issue);
      expect(screen.getByText('Flagged (Impediment)')).toBeTruthy();
    });

    it('calls mutation.mutate with flag value when unflagged issue toggle is clicked', async () => {
      const { fireEvent } = await import('@testing-library/react');
      const issue = makeIssue({ customfield_10021: null });
      const mutateMock = await renderFieldsSectionWithFlag(issue);
      const btn = screen.getByTitle('Flag this issue as an impediment');
      fireEvent.click(btn);
      expect(mutateMock).toHaveBeenCalledWith({
        fieldName: 'customfield_10021',
        value: [{ value: 'Impediment' }],
      });
    });
  });

  describe('Resolution MetaRow (transition-driven)', () => {
    async function renderResolution(issue: JiraIssueDetail) {
      const { FieldsSection } = await import('./FieldsSection');
      const mutation = {
        isPending: false,
        isError: false,
        mutate: vi.fn(),
        variables: undefined,
        data: undefined,
      };
      render(
        <FieldsSection
          issue={issue}
          issueKey={issue.key}
          jiraBaseUrl="https://jira.example.com"
          storyPointsFieldKey="customfield_10016"
          epicLinkFieldKey="customfield_10014"
          epicNameFieldKey="customfield_10015"
          sprintFieldKey="customfield_10020"
          epicColorFieldKey="customfield_10013"
          mutation={mutation as any}
          epicIssue={null}
        />,
        { wrapper },
      );
    }

    // An in-place (loop) transition whose `to.id` equals the issue's status id and
    // which exposes a resolution field — i.e. resolution-capable in place.
    const inPlaceTransition = (statusId: string) => ({
      id: 'txn-resolve',
      name: 'Set Resolution',
      to: { id: statusId, name: 'Closed' },
      fields: {
        resolution: {
          required: false,
          allowedValues: [
            { id: '1', name: 'Done' },
            { id: '2', name: "Won't Do" },
          ],
        },
      },
    });

    it('renders read-only value + explanation when no in-place resolution-capable transition exists', async () => {
      const { fetchIssueTransitionsWithFields } = await import('@/services/jira/transitions');
      vi.mocked(fetchIssueTransitionsWithFields).mockResolvedValue([]);
      const issue = makeIssue({
        status: { id: '1', name: 'Closed', statusCategory: { key: 'done' } },
        resolution: null,
      });
      await renderResolution(issue);

      const { fireEvent } = await import('@testing-library/react');
      // Enter edit mode; with no capable transition it must stay read-only + note.
      fireEvent.click(screen.getByTestId('resolution-edit'));
      expect(await screen.findByText(/status transition/i)).toBeTruthy();
      expect(screen.getByTestId('resolution-value').textContent).toBe('Unresolved');
    });

    it('hides the Resolution row entirely for an unresolved, non-done issue', async () => {
      const issue = makeIssue({
        status: { id: '1', name: 'In Progress', statusCategory: { key: 'indeterminate' } },
        resolution: null,
      });
      await renderResolution(issue);
      // No row, no edit affordance — resolution only shows where it makes sense.
      expect(screen.queryByText('Resolution')).toBeNull();
      expect(screen.queryByTestId('resolution-edit')).toBeNull();
    });

    it('shows the Resolution row for a resolved issue even when not done', async () => {
      const issue = makeIssue({
        status: { id: '1', name: 'In Progress', statusCategory: { key: 'indeterminate' } },
        resolution: { id: '1', name: 'Done' },
      });
      await renderResolution(issue);
      expect(screen.getByText('Resolution')).toBeTruthy();
      expect(screen.getByTestId('resolution-edit').textContent).toBe('Done');
    });

    it('shows a Select of the transition allowedValues and runs the in-place transition with fields.resolution', async () => {
      const { fetchIssueTransitionsWithFields, postTransition } = await import(
        '@/services/jira/transitions'
      );
      vi.mocked(fetchIssueTransitionsWithFields).mockResolvedValue([inPlaceTransition('1')]);
      vi.mocked(postTransition).mockResolvedValue(undefined);

      const issue = makeIssue({
        status: { id: '1', name: 'Closed', statusCategory: { key: 'done' } },
        resolution: null,
      });
      await renderResolution(issue);

      const { fireEvent } = await import('@testing-library/react');
      fireEvent.click(screen.getByTestId('resolution-edit'));
      // Options come from the transition's allowedValues.
      await screen.findByRole('option', { name: 'Done' });
      fireEvent.change(screen.getByTestId('select-native'), { target: { value: '1' } });

      await vi.waitFor(() => {
        expect(vi.mocked(postTransition)).toHaveBeenCalledWith(
          'https://jira.example.com',
          'test-token',
          'PROJ-1',
          'txn-resolve',
          { resolution: { id: '1' } },
        );
      });
    });

    // WR-01/WR-02: clearing is a locked product requirement. The "Unresolved"
    // option must render even when the transition's resolution is `required`,
    // and selecting it must run the in-place transition with resolution: null.
    it('always offers an Unresolved clear option, even when resolution is required', async () => {
      const { fetchIssueTransitionsWithFields, postTransition } = await import(
        '@/services/jira/transitions'
      );
      const requiredTransition = {
        ...inPlaceTransition('1'),
        fields: {
          resolution: {
            required: true,
            allowedValues: [{ id: '1', name: 'Done' }],
          },
        },
      };
      vi.mocked(fetchIssueTransitionsWithFields).mockResolvedValue([requiredTransition]);
      vi.mocked(postTransition).mockResolvedValue(undefined);

      const issue = makeIssue({
        status: { id: '1', name: 'Closed', statusCategory: { key: 'done' } },
        resolution: { id: '1', name: 'Done' },
      });
      await renderResolution(issue);

      const { fireEvent } = await import('@testing-library/react');
      fireEvent.click(screen.getByTestId('resolution-edit'));
      // The clear option is present despite required: true.
      await screen.findByRole('option', { name: 'Unresolved' });
      fireEvent.change(screen.getByTestId('select-native'), {
        target: { value: '__unresolved__' },
      });

      await vi.waitFor(() => {
        expect(vi.mocked(postTransition)).toHaveBeenCalledWith(
          'https://jira.example.com',
          'test-token',
          'PROJ-1',
          'txn-resolve',
          { resolution: null },
        );
      });
    });

    // WR-03: when the issue's current resolution is absent from allowedValues,
    // render it as a synthetic option so the trigger never shows blank.
    it('includes the current resolution as a synthetic option when missing from allowedValues', async () => {
      const { fetchIssueTransitionsWithFields } = await import('@/services/jira/transitions');
      vi.mocked(fetchIssueTransitionsWithFields).mockResolvedValue([inPlaceTransition('1')]);

      const issue = makeIssue({
        status: { id: '1', name: 'Closed', statusCategory: { key: 'done' } },
        // id '99' is NOT in the transition's allowedValues (1, 2).
        resolution: { id: '99', name: 'Legacy Resolution' },
      });
      await renderResolution(issue);

      const { fireEvent } = await import('@testing-library/react');
      fireEvent.click(screen.getByTestId('resolution-edit'));
      // Current resolution surfaced as a synthetic option so the value matches.
      expect(await screen.findByRole('option', { name: 'Legacy Resolution' })).toBeTruthy();
      // And the normal allowedValues are still present.
      expect(screen.getByRole('option', { name: 'Done' })).toBeTruthy();
    });
  });
});
