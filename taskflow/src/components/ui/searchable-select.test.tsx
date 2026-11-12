import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SearchableSelect, type SearchableSelectOption } from './searchable-select';

const OPTIONS: SearchableSelectOption[] = [
  { value: 'PROJ', label: 'PROJ — Project One', keywords: ['PROJ', 'Project One'] },
  { value: 'ALPHA', label: 'ALPHA — Alpha Team', keywords: ['ALPHA', 'Alpha Team'] },
  {
    value: '1234',
    label: 'Widgets',
    keywords: ['1234', 'Widgets', 'group/repo', 'Group / Widgets'],
  },
  { value: 'BETA', label: 'BETA — Beta Team', keywords: ['BETA', 'Beta Team'] },
];

function setup(value: string | null = null) {
  const onValueChange = vi.fn();
  render(
    <SearchableSelect
      id="sel"
      value={value}
      onValueChange={onValueChange}
      options={OPTIONS}
      placeholder="Pick one"
    />,
  );
  return { onValueChange, user: userEvent.setup() };
}

describe('SearchableSelect', () => {
  it('shows placeholder when no value, and selected label otherwise', () => {
    const { unmount } = render(
      <SearchableSelect id="a" value={null} onValueChange={() => {}} options={OPTIONS} />,
    );
    expect(screen.getByText('Select…')).toBeInTheDocument();
    unmount();
    setup('BETA');
    expect(screen.getByText('BETA — Beta Team')).toBeInTheDocument();
  });

  it('opens with a search box and filters by name', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /pick one/i }));
    await user.type(screen.getByPlaceholderText('Search…'), 'alpha');
    expect(screen.getByText('ALPHA — Alpha Team')).toBeInTheDocument();
    expect(screen.queryByText('PROJ — Project One')).not.toBeInTheDocument();
  });

  it('filters by key/id that only appears in keywords', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /pick one/i }));
    await user.type(screen.getByPlaceholderText('Search…'), 'group/repo');
    expect(screen.getByText('Widgets')).toBeInTheDocument();
    expect(screen.queryByText('ALPHA — Alpha Team')).not.toBeInTheDocument();
  });

  it('shows No matches when nothing hits', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /pick one/i }));
    await user.type(screen.getByPlaceholderText('Search…'), 'zzzzqqq');
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('ArrowDown + Enter selects the highlighted option and closes', async () => {
    const { user, onValueChange } = setup();
    await user.click(screen.getByRole('button', { name: /pick one/i }));
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('ALPHA');
    expect(screen.queryByPlaceholderText('Search…')).not.toBeInTheDocument();
  });

  it('clicking an option selects it', async () => {
    const { user, onValueChange } = setup();
    await user.click(screen.getByRole('button', { name: /pick one/i }));
    await user.click(screen.getByText('BETA — Beta Team'));
    expect(onValueChange).toHaveBeenCalledWith('BETA');
  });

  it('Escape closes without changing the value', async () => {
    const { user, onValueChange } = setup();
    await user.click(screen.getByRole('button', { name: /pick one/i }));
    await user.keyboard('{Escape}');
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText('Search…')).not.toBeInTheDocument();
  });

  it('shows a leading check only on the selected option', async () => {
    const { user } = setup('PROJ');
    await user.click(screen.getByRole('button'));
    const checks = screen.getAllByTestId('searchable-select-check');
    expect(checks).toHaveLength(1);
    expect(checks[0].closest('[data-checked="true"]')).toHaveTextContent('PROJ — Project One');
  });

  it('does not open when disabled', async () => {
    const user = userEvent.setup();
    render(<SearchableSelect disabled value={null} onValueChange={() => {}} options={OPTIONS} />);
    await user.click(screen.getByRole('button'));
    expect(screen.queryByPlaceholderText('Search…')).not.toBeInTheDocument();
  });

  describe('pinned option', () => {
    const NONE = { value: '__none__', label: 'None', keywords: [] };
    function setupPinned(value: string | null = null) {
      const onValueChange = vi.fn();
      render(
        <SearchableSelect
          value={value}
          onValueChange={onValueChange}
          options={OPTIONS}
          pinnedOption={NONE}
          placeholder="Pick one"
        />,
      );
      return { onValueChange, user: userEvent.setup() };
    }

    it('renders first and stays on top while searching', async () => {
      const { user } = setupPinned();
      await user.click(screen.getByRole('button', { name: /pick one/i }));
      expect(screen.getAllByRole('option')[0]).toHaveTextContent('None');
      await user.type(screen.getByPlaceholderText('Search…'), 'beta');
      const opts = screen.getAllByRole('option');
      expect(opts.map((o) => o.textContent)).toEqual(['None', 'BETA — Beta Team']);
    });

    it('stays visible above "No matches"', async () => {
      const { user } = setupPinned();
      await user.click(screen.getByRole('button', { name: /pick one/i }));
      await user.type(screen.getByPlaceholderText('Search…'), 'zzz');
      expect(screen.getByTestId('searchable-select-pinned')).toHaveTextContent('None');
      expect(screen.getByText('No matches')).toBeInTheDocument();
    });

    it('Enter while searching picks the first match, not the pinned option', async () => {
      const { user, onValueChange } = setupPinned();
      await user.click(screen.getByRole('button', { name: /pick one/i }));
      await user.type(screen.getByPlaceholderText('Search…'), 'alpha');
      await user.keyboard('{Enter}');
      expect(onValueChange).toHaveBeenCalledWith('ALPHA');
    });

    it('can be picked by click while searching', async () => {
      const { user, onValueChange } = setupPinned('BETA');
      await user.click(screen.getByRole('button'));
      await user.type(screen.getByPlaceholderText('Search…'), 'alpha');
      await user.click(screen.getByTestId('searchable-select-pinned'));
      expect(onValueChange).toHaveBeenCalledWith('__none__');
    });

    it('shows the pinned label in the trigger when it is the value', () => {
      setupPinned('__none__');
      expect(screen.getByRole('button')).toHaveTextContent('None');
    });
  });

  it('shows option detail muted next to the label', async () => {
    const user = userEvent.setup();
    render(
      <SearchableSelect
        value="K1"
        onValueChange={() => {}}
        options={[{ value: 'K1', label: 'Kappa', detail: 'K1', keywords: ['K1', 'Kappa'] }]}
      />,
    );
    expect(screen.getByRole('button')).toHaveTextContent('KappaK1');
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('option')).toHaveTextContent('KappaK1');
  });
});
