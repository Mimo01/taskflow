import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '../../stores/settings.store';
import { useWikiEditorLogStore } from '../../stores/wiki-editor-log.store';
import DevToolsPage from './DevToolsPage';
import EditorTab from './EditorTab';

describe('EditorTab', () => {
  beforeEach(() => {
    act(() => {
      useSettingsStore.setState({ devToolsEnabled: true });
      useWikiEditorLogStore.getState().clear();
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
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Details')).toBeTruthy();
    expect(screen.getByText('gap lost')).toBeTruthy();
    expect(screen.getByText('hello')).toBeTruthy();
    expect(screen.getByText('h1. hello')).toBeTruthy();
  });
});

describe('DevToolsPage editor integration', () => {
  it('has an Editor tab and Clear Logs clears editor entries', () => {
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
    render(<DevToolsPage />);
    expect(screen.getByRole('tab', { name: 'Editor' })).toBeTruthy();
    const clear = screen.getByRole('button', { name: 'Clear Logs' }) as HTMLButtonElement;
    expect(clear.disabled).toBe(false);
    fireEvent.click(clear);
    expect(useWikiEditorLogStore.getState().entries).toEqual([]);
  });
});
