import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IssueTypeSelector } from './IssueTypeSelector';

async function openOptions() {
  await userEvent.click(screen.getByRole('combobox'));
  return within(await screen.findByRole('listbox'))
    .getAllByRole('option')
    .map((o) => o.textContent);
}

describe('IssueTypeSelector', () => {
  it('offers Story, Bug and Defect, never Subtask', async () => {
    render(<IssueTypeSelector selectedIssueType="Story" dispatch={vi.fn()} />);
    expect(await openOptions()).toEqual(['Story', 'Bug', 'Defect']);
  });

  it('hides types the project does not offer', async () => {
    render(
      <IssueTypeSelector
        selectedIssueType="Story"
        availableTypeNames={['Story', 'Bug', 'Epic', 'Sub-task']}
        dispatch={vi.fn()}
      />,
    );
    expect(await openOptions()).toEqual(['Story', 'Bug']);
  });
});
