import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '../../stores/settings.store';

vi.mock('../../components/wiki-editor/WikiEditorLazy', () => ({
  WikiEditorLazy: (props: { value: string; preset?: string; onVerdict?: (v: unknown) => void }) => (
    <div data-testid="editor" data-preset={props.preset}>
      <span data-testid="editor-value">{props.value}</span>
      <button
        type="button"
        onClick={() =>
          props.onVerdict?.({
            load: { kind: 'rich-demoted', demoted: [2, 5], reason: null },
            save: { kind: 'saved', text: 'h1. Hi', reason: null, ms: 1.5 },
            mode: 'rich',
            forced: false,
            created: 1,
          })
        }
      >
        emit
      </button>
    </div>
  ),
}));

import EditorTab from './EditorTab';

describe('EditorTab', () => {
  beforeEach(() => {
    act(() => {
      useSettingsStore.setState({ devToolsEnabled: true });
    });
  });

  it('shows the disabled message when Developer Tools are off', () => {
    act(() => {
      useSettingsStore.setState({ devToolsEnabled: false });
    });
    render(
      <MemoryRouter>
        <EditorTab />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Developer Tools are disabled/)).toBeTruthy();
  });

  it('shows the empty state before a document is loaded', () => {
    render(
      <MemoryRouter>
        <EditorTab />
      </MemoryRouter>,
    );
    expect(screen.getByText('No document loaded')).toBeTruthy();
    expect(screen.getByText('Pick a fixture or paste wiki text to start.')).toBeTruthy();
  });

  it('loads pasted text locally, switches preset and shows the verdict', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    render(
      <MemoryRouter>
        <EditorTab />
      </MemoryRouter>,
    );
    expect(screen.getByText('Local only. Never saved.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Paste wiki'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Load' }));
    await waitFor(() => expect(screen.getByTestId('editor-value').textContent).toBe('hello'));
    fireEvent.click(screen.getByRole('button', { name: 'Compact' }));
    expect(screen.getByTestId('editor').getAttribute('data-preset')).toBe('compact');
    fireEvent.click(screen.getByRole('button', { name: 'emit' }));
    expect(screen.getByText('rich-demoted')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('saved')).toBeTruthy();
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});
