import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WikiEditorHost } from '../../components/wiki-editor/types';
import { useSettingsStore } from '../../stores/settings.store';

const seen = vi.hoisted(() => ({ host: null as unknown, count: 0 }));

vi.mock('../../components/wiki-editor/WikiEditorLazy', () => ({
  WikiEditorLazy: (props: {
    value: string;
    preset?: string;
    host?: unknown;
    'aria-label'?: string;
    onVerdict?: (v: unknown) => void;
  }) => {
    seen.host = props.host;
    return (
      <div data-testid="editor" data-preset={props.preset} data-label={props['aria-label']}>
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
    );
  },
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

  async function loadDoc() {
    render(
      <MemoryRouter>
        <EditorTab />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('Paste wiki'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Load' }));
    await waitFor(() => expect(screen.getByTestId('editor-value')).toBeTruthy());
  }
  const host = () => seen.host as WikiEditorHost;

  describe('Host context', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('renders the row and feeds project key and staged mode to the host', async () => {
      await loadDoc();
      expect(screen.getByText('Host context')).toBeTruthy();
      expect(host().projectKey).toBe('DEMO');
      expect(host().staged).toBe(false);
      fireEvent.change(screen.getByLabelText('Project key'), { target: { value: 'ABC' } });
      fireEvent.click(screen.getByRole('switch', { name: 'Staged mode' }));
      expect(host().projectKey).toBe('ABC');
      expect(host().staged).toBe(true);
    });

    it('Succeed uploads a JiraAttachment-shaped file and lists it', async () => {
      await loadDoc();
      const file = new File(['x'], 'shot.png', { type: 'image/png' });
      let att: Awaited<ReturnType<NonNullable<WikiEditorHost['uploadFile']>>> | undefined;
      await act(async () => {
        att = await host().uploadFile?.(file);
      });
      expect(att?.filename).toBe('shot.png');
      expect(host().attachments?.map((a) => a.filename)).toEqual([
        'diagram.png',
        'report.pdf',
        'shot.png',
      ]);
    });

    it('Fail rejects', async () => {
      await loadDoc();
      fireEvent.click(screen.getByRole('button', { name: 'Fail' }));
      await expect(host().uploadFile?.(new File(['x'], 'a.png'))).rejects.toThrow();
    });

    it('Slow 3s resolves only after 3000ms', async () => {
      await loadDoc();
      fireEvent.click(screen.getByRole('button', { name: 'Slow 3s' }));
      vi.useFakeTimers();
      let done = false;
      const p = host()
        .uploadFile?.(new File(['x'], 'slow.png'))
        .then(() => {
          done = true;
        });
      await vi.advanceTimersByTimeAsync(2999);
      expect(done).toBe(false);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
        await p;
      });
      expect(done).toBe(true);
    });

    it('stageFile lists staged files and deleteAttachment removes from the list', async () => {
      await loadDoc();
      act(() => host().stageFile?.(new File(['x'], 'staged.txt')));
      expect(screen.getByText('Staged files')).toBeTruthy();
      expect(screen.getByText('staged.txt')).toBeTruthy();
      await act(async () => {
        await host().deleteAttachment?.('dev-a');
      });
      expect(host().attachments?.map((a) => a.id)).toEqual(['dev-b']);
    });
  });

  describe('Paste tools and dialog', () => {
    it('lists the paste fixtures in the Paste sample select', async () => {
      await loadDoc();
      fireEvent.click(screen.getByLabelText('Paste sample'));
      expect(await screen.findByText('word.html')).toBeTruthy();
      expect(screen.getByText('jira-rendered.html')).toBeTruthy();
    });

    it('captures the next paste read-only with a placeholder reminder', async () => {
      await loadDoc();
      fireEvent.click(screen.getByRole('button', { name: 'Capture next paste' }));
      const ev = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'clipboardData', {
        value: { getData: (t: string) => (t === 'text/html' ? '<b>hi</b>' : 'hi') },
      });
      act(() => {
        window.dispatchEvent(ev);
      });
      expect((screen.getByLabelText('Captured text/html') as HTMLTextAreaElement).value).toBe(
        '<b>hi</b>',
      );
      expect((screen.getByLabelText('Captured text/plain') as HTMLTextAreaElement).readOnly).toBe(
        true,
      );
      expect(screen.getByText(/Replace names and text with placeholders/)).toBeTruthy();
      expect(screen.getByText('Local only. Never saved.')).toBeTruthy();
    });

    it('Open in dialog renders a second editor in a dialog', async () => {
      await loadDoc();
      fireEvent.click(screen.getByRole('button', { name: 'Open in dialog' }));
      expect(await screen.findByText('Editor in a dialog')).toBeTruthy();
      expect(screen.getAllByTestId('editor').length).toBe(2);
    });
  });
});
