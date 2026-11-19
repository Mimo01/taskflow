import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '../../stores/settings.store';
import { useWikiEditorLogStore } from '../../stores/wiki-editor-log.store';
import DevToolsPage from './DevToolsPage';
import { useDevToolsViewStore } from './dev-tools-view.store';
import EditorTab from './EditorTab';

describe('EditorTab', () => {
  beforeEach(() => {
    act(() => {
      useSettingsStore.setState({ devToolsEnabled: true });
      useWikiEditorLogStore.getState().clear();
      useDevToolsViewStore.getState().setSelected('editor', null);
      useDevToolsViewStore.getState().setSearch('editor', '');
      useDevToolsViewStore.getState().setFacet('editorLevels', new Set());
      useDevToolsViewStore.getState().setFacet('editorEvents', new Set());
    });
  });

  it('shows the disabled message when Developer Tools are off', () => {
    act(() => {
      useSettingsStore.setState({ devToolsEnabled: false });
    });
    render(<EditorTab />);
    expect(screen.getByText(/Developer Tools are disabled/)).toBeTruthy();
  });

  it('shows an empty state before anything is captured', () => {
    render(<EditorTab />);
    expect(screen.getByText('No editor events yet')).toBeTruthy();
  });

  it('expands an error entry to its reason, details and both markup blocks', () => {
    act(() => {
      useWikiEditorLogStore.getState().append({
        id: 'e1',
        timestamp: '2026-11-19T10:00:00.000Z',
        session: 3,
        event: 'save-failed',
        level: 'error',
        message: "Couldn't save safely: gap lost",
        context: { label: 'Description', issueKey: 'PROJ-1' },
        details: { mode: 'rich' },
        markup: { original: 'hello', produced: 'h1. hello' },
        error: { message: 'gap lost' },
      });
    });
    render(<EditorTab />);
    expect(screen.getByText('Description · PROJ-1')).toBeTruthy();
    fireEvent.click(screen.getAllByTestId('devtools-row')[0]);
    expect(screen.getByText('Details')).toBeTruthy();
    expect(screen.getByText('gap lost')).toBeTruthy();
    expect(screen.getByText('hello')).toBeTruthy();
    expect(screen.getByText('h1. hello')).toBeTruthy();
  });

  it('shows the failing block, both projections and the produced markup with the block marked', () => {
    act(() => {
      useWikiEditorLogStore.getState().append({
        id: 'e2',
        timestamp: '2026-11-19T10:00:00.000Z',
        session: 4,
        event: 'save-failed',
        level: 'error',
        message: "Couldn't save safely",
        markup: { original: 'intro\n\nh1 text', produced: 'intro\n\nh1. text' },
        diagnosis: {
          reason: 'block 1 (paragraph) does not read back as the edited structure',
          block: 1,
          blockType: 'paragraph',
          expected: { type: 'paragraph', inline: [{ text: 'h1. text', marks: '' }] },
          readBack: { type: 'heading', level: 1, inline: [{ text: 'text', marks: '' }] },
          savedSlice: 'h1. text',
        },
      });
    });
    render(<EditorTab />);
    fireEvent.click(screen.getAllByTestId('devtools-row')[0]);
    expect(
      screen.getByText('block 1 (paragraph) does not read back as the edited structure'),
    ).toBeTruthy();
    expect(screen.getByText('The edit (expected)')).toBeTruthy();
    expect(screen.getByText('heading level=1')).toBeTruthy();
    expect(screen.getByText('Produced markup (failing block outlined)')).toBeTruthy();
    const marked = screen
      .getAllByText('h1. text')
      .filter((el) => el.parentElement?.className.includes('border-amber-500'));
    expect(marked).toHaveLength(1);
  });
  it('filters rows by search text and by level', () => {
    act(() => {
      useWikiEditorLogStore.getState().append({
        id: 'f1',
        timestamp: '2026-11-19T10:00:00.000Z',
        session: 1,
        event: 'open',
        level: 'info',
        message: 'Editor opened',
      });
      useWikiEditorLogStore.getState().append({
        id: 'f2',
        timestamp: '2026-11-19T10:00:01.000Z',
        session: 1,
        event: 'crash',
        level: 'error',
        message: 'Editor exploded',
      });
    });
    render(<EditorTab />);
    expect(screen.getAllByTestId('devtools-row')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Search editor events'), {
      target: { value: 'opened' },
    });
    expect(screen.getAllByTestId('devtools-row')).toHaveLength(1);
    expect(screen.queryByText('Editor exploded')).toBeNull();
    fireEvent.change(screen.getByLabelText('Search editor events'), { target: { value: '' } });
    act(() => {
      useDevToolsViewStore.getState().setFacet('editorLevels', new Set(['error']));
    });
    expect(screen.getAllByTestId('devtools-row')).toHaveLength(1);
    expect(screen.queryByText('Editor opened')).toBeNull();
  });
});

describe('EditorTab copy menu', () => {
  beforeEach(() => {
    act(() => {
      useSettingsStore.setState({ devToolsEnabled: true });
      useWikiEditorLogStore.getState().clear();
      useDevToolsViewStore.getState().setSelected('editor', null);
      useDevToolsViewStore.getState().setSearch('editor', '');
      useDevToolsViewStore.getState().setFacet('editorLevels', new Set());
      useDevToolsViewStore.getState().setFacet('editorEvents', new Set());
    });
  });

  const base = {
    timestamp: '2026-11-19T10:00:00.000Z',
    session: 1,
    event: 'save-failed' as const,
    level: 'error' as const,
    message: 'x',
  };

  it('disables Copy produced markup when the entry has no markup', async () => {
    act(() => {
      useWikiEditorLogStore.getState().append({ ...base, id: 'n1' });
    });
    render(<EditorTab />);
    fireEvent.click(screen.getAllByTestId('devtools-row')[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    const item = await screen.findByRole('menuitem', { name: 'Copy produced markup' });
    expect(item.getAttribute('aria-disabled') ?? item.getAttribute('data-disabled')).not.toBeNull();
  });

  it('copies the produced markup when present', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    act(() => {
      useWikiEditorLogStore
        .getState()
        .append({ ...base, id: 'm1', markup: { original: 'orig', produced: 'h1. produced' } });
    });
    render(<EditorTab />);
    fireEvent.click(screen.getAllByTestId('devtools-row')[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Copy produced markup' }));
    expect(writeText).toHaveBeenCalledWith('h1. produced');
    vi.unstubAllGlobals();
  });
});

describe('DevToolsPage editor integration', () => {
  it('has an Editor tab and Clear logs clears editor entries', () => {
    act(() => {
      useSettingsStore.setState({ devToolsEnabled: true });
      useWikiEditorLogStore.getState().clear();
      useWikiEditorLogStore.getState().append({
        id: 'e1',
        timestamp: '2026-11-19T10:00:00.000Z',
        session: 1,
        event: 'open',
        level: 'info',
        message: 'Editor opened',
      });
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DevToolsPage />
      </QueryClientProvider>,
    );
    expect(screen.getByRole('tab', { name: 'Editor' })).toBeTruthy();
    const clear = screen.getByRole('button', { name: 'Clear logs' }) as HTMLButtonElement;
    expect(clear.disabled).toBe(false);
    fireEvent.click(clear);
    expect(useWikiEditorLogStore.getState().entries).toEqual([]);
  });
});
