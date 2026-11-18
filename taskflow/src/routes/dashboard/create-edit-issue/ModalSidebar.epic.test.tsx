// D-08: ModalSidebar epic variant (Create Epic reuses the Issue sidebar field set).

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ModalSidebar } from './ModalSidebar';
import { buildInitialState } from './useCreateEditForm';

vi.mock('@/components/ui/person-picker', () => ({
  PersonPicker: () => <div data-testid="person-picker" />,
  toPersonValue: (u: unknown) => u,
}));
vi.mock('@/components/ui/epic-picker', () => ({ EpicPicker: () => <div /> }));
vi.mock('./FixVersionField', () => ({ FixVersionField: () => <div /> }));
vi.mock('./LabelsField', () => ({ LabelsField: () => <div /> }));
vi.mock('./IssueTypeSelector', () => ({
  ISSUE_TYPE_CONTROL_ID: 'issue-type-control',
  IssueTypeSelector: () => <div />,
}));
vi.mock('./CustomFieldsSection', () => ({
  CustomFieldsSection: () => <div data-testid="custom-fields" />,
}));

function renderSidebar(props: Partial<React.ComponentProps<typeof ModalSidebar>> = {}) {
  return render(
    <ModalSidebar
      mode="create"
      state={buildInitialState('Story')}
      dispatch={vi.fn()}
      isSubtask={false}
      isPending={false}
      projectKey="PROJ"
      jiraBaseUrl="https://jira.example.com"
      priorityOptions={[]}
      creatmetaLoading={false}
      customRequiredFields={[]}
      labelsRequired={false}
      fixVersionsOffered
      fixVersionsRequired={false}
      open
      {...props}
    />,
  );
}

function labelTexts(container: HTMLElement) {
  return Array.from(container.querySelectorAll('label')).map((l) =>
    (l.textContent ?? '').replace(/\s*\*$/, '').trim(),
  );
}

describe('ModalSidebar epic variant', () => {
  it('renders the epic field set without Issue type, Epic, Parent or Estimate', () => {
    const { container } = renderSidebar({ variant: 'epic' });
    const labels = labelTexts(container);
    expect(labels).toEqual(['Assignee', 'Priority', 'Labels', 'Fix version', 'Story points']);
    expect(screen.queryByText('Issue type')).toBeNull();
    expect(screen.queryByText('Epic')).toBeNull();
    expect(screen.queryByText('Parent')).toBeNull();
    expect(screen.queryByText('Estimate')).toBeNull();
  });

  it('hides Story points when not offered', () => {
    const { container } = renderSidebar({ variant: 'epic', storyPointsOffered: false });
    expect(labelTexts(container)).not.toContain('Story points');
  });

  it('shows Fix version only when offered', () => {
    const { container } = renderSidebar({ variant: 'epic', fixVersionsOffered: false });
    expect(labelTexts(container)).not.toContain('Fix version');
  });

  it('renders custom fields after Story points', () => {
    const { container } = renderSidebar({ variant: 'epic' });
    const custom = screen.getByTestId('custom-fields');
    const sp = container.querySelector('#story-points');
    expect(sp).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    expect(sp!.compareDocumentPosition(custom) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('default issue variant keeps Issue type and Epic rows', () => {
    const { container } = renderSidebar();
    const labels = labelTexts(container);
    expect(labels).toContain('Epic');
    expect(labels[0]).toBe('Issue type');
  });
});
