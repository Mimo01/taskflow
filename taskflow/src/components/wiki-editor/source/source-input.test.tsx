import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { installLayoutStubs, textarea } from '../shell-test-utils';
import type { WikiEditorProps } from '../types';
import WikiEditor from '../WikiEditor';

installLayoutStubs();

const fetchAssignableUsers = vi.fn();
vi.mock('@/services/jira/users', () => ({
  fetchAssignableUsers: (...a: unknown[]) => fetchAssignableUsers(...a),
}));
vi.mock('@/services/stronghold', () => ({ readSecret: async () => 'tok' }));

const popovers = () => document.body.querySelectorAll('[data-suggestion]');

function mount(props: Partial<WikiEditorProps> = {}, inDialog = false) {
  const qc = new QueryClient();
  const ui = (
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <WikiEditor
          value=""
          onChange={() => {}}
          host={{ projectKey: 'DEMO', issueKey: 'DEMO-1' }}
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(inDialog ? <div role="dialog">{ui}</div> : ui);
}

function typeInto(ta: HTMLTextAreaElement, text: string) {
  fireEvent.change(ta, { target: { value: text } });
  ta.setSelectionRange(text.length, text.length);
  fireEvent.keyUp(ta, { key: 'a' });
}

beforeEach(() => {
  fetchAssignableUsers.mockReset();
  fetchAssignableUsers.mockResolvedValue([
    { name: 'jdoe', displayName: 'Jane Doe', avatarUrls: {} },
  ]);
  useAuthStore.setState({ jiraBaseUrl: 'https://jira.example.invalid' });
  useSettingsStore.setState({ wikiEditorMode: 'source' });
});

describe('source mode inputs', () => {
  it('opens a mention popover on @ and inserts [~username]', async () => {
    mount();
    const ta = textarea();
    typeInto(ta, 'hi @ja');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
    expect(fetchAssignableUsers).toHaveBeenCalledWith(
      'https://jira.example.invalid',
      'tok',
      'DEMO',
      'ja',
      { issueKey: 'DEMO-1' },
    );
    fireEvent.keyDown(ta, { key: 'Enter' });
    await waitFor(() => expect(textarea().value).toBe('hi [~jdoe] '));
    await waitFor(() => expect(popovers()).toHaveLength(0));
    await waitFor(() => expect(textarea().selectionStart).toBe(11));
  });

  it('does not open for an e-mail style a@b', async () => {
    mount();
    typeInto(textarea(), 'a@b');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 320));
    });
    expect(popovers()).toHaveLength(0);
    expect(fetchAssignableUsers).not.toHaveBeenCalled();
  });

  it('offers emoticons for :ch and replaces with the token', async () => {
    mount();
    const ta = textarea();
    typeInto(ta, 'ok :ch');
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
    fireEvent.keyDown(ta, { key: 'Enter' });
    await waitFor(() => expect(textarea().value).toBe('ok (/)'));
  });

  it('WR-05: no popover inside an open {code} or {noformat} block', async () => {
    mount();
    const ta = textarea();
    typeInto(ta, '{code:ruby}\nvalidates :id');
    await new Promise((r) => setTimeout(r, 50));
    expect(popovers()).toHaveLength(0);
    typeInto(ta, '{noformat}\n@Override');
    await new Promise((r) => setTimeout(r, 300));
    expect(popovers()).toHaveLength(0);
    expect(fetchAssignableUsers).not.toHaveBeenCalled();
    // Closed blocks no longer suppress triggers.
    typeInto(ta, '{code}x{code} ok :ch');
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
  });

  it('WR-06: compact footer Mention mid-text adds a leading space and opens the people list', async () => {
    mount({ value: 'foo bar', preset: 'compact' });
    const ta = textarea();
    act(() => {
      ta.focus();
      ta.setSelectionRange(3, 3);
    });
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Mention someone' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mention someone' }));
    await waitFor(() => expect(textarea().value).toBe('foo @ bar'));
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
  });

  it('WR-06: compact footer Emoticon opens the emoticon list', async () => {
    mount({ value: 'ok', preset: 'compact' });
    act(() => {
      textarea().focus();
      textarea().setSelectionRange(2, 2);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Emoticon' }));
    await waitFor(() => expect(textarea().value).toBe('ok :'));
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
    fireEvent.keyDown(textarea(), { key: 'Enter' });
    await waitFor(() => expect(textarea().value).not.toBe('ok :'));
    expect(textarea().value).toMatch(/^ok \S+$/);
  });

  it('never opens for 10:30', async () => {
    mount();
    typeInto(textarea(), 'at 10:30');
    expect(popovers()).toHaveLength(0);
  });

  it('moves the highlight with arrows', async () => {
    mount();
    const ta = textarea();
    typeInto(ta, ' :');
    typeInto(ta, ' :f');
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(1));
    const selected = () =>
      screen.getAllByRole('option').findIndex((o) => o.getAttribute('aria-selected') === 'true');
    expect(selected()).toBe(0);
    fireEvent.keyDown(ta, { key: 'ArrowDown' });
    expect(selected()).toBe(1);
    fireEvent.keyDown(ta, { key: 'ArrowUp' });
    expect(selected()).toBe(0);
  });

  it('Escape closes the popover first and is not seen by outer listeners', async () => {
    mount();
    const ta = textarea();
    typeInto(ta, 'hi @ja');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
    const spy = vi.fn();
    document.addEventListener('keydown', spy);
    fireEvent.keyDown(ta, { key: 'Escape' });
    fireEvent.keyUp(ta, { key: 'Escape' });
    document.removeEventListener('keydown', spy);
    expect(spy).not.toHaveBeenCalled();
    expect(popovers()).toHaveLength(0);
    expect(textarea().value).toBe('hi @ja');
  });

  it('uploads pasted files and leaves text paste alone', async () => {
    const uploadFile = vi
      .fn()
      .mockResolvedValue({ id: '1', filename: 'a.png', mimeType: 'image/png', content: 'u' });
    mount({ host: { projectKey: 'DEMO', issueKey: 'DEMO-1', uploadFile } });
    const ta = textarea();
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    const textEvent = fireEvent.paste(ta, { clipboardData: { files: [], getData: () => 'x' } });
    expect(textEvent).toBe(true);
    expect(uploadFile).not.toHaveBeenCalled();
    const notCancelled = fireEvent.paste(ta, { clipboardData: { files: [file] } });
    expect(notCancelled).toBe(false);
    await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(textarea().value).toContain('!a.png!'));
  });

  it('handles dropped files and stops propagation', async () => {
    const uploadFile = vi
      .fn()
      .mockResolvedValue({ id: '2', filename: 'r.pdf', mimeType: 'application/pdf', content: 'u' });
    mount({ host: { projectKey: 'DEMO', issueKey: 'DEMO-1', uploadFile } });
    const ta = textarea();
    const outer = vi.fn();
    document.addEventListener('drop', outer);
    const file = new File(['x'], 'r.pdf', { type: 'application/pdf' });
    const result = fireEvent.drop(ta, { dataTransfer: { files: [file], types: ['Files'] } });
    document.removeEventListener('drop', outer);
    expect(result).toBe(false);
    expect(outer).not.toHaveBeenCalled();
    await waitFor(() => expect(textarea().value).toContain('[^r.pdf]'));
  });

  it('shows the shared error line when an upload fails', async () => {
    const uploadFile = vi.fn().mockRejectedValue(new Error('x'));
    mount({ host: { projectKey: 'DEMO', issueKey: 'DEMO-1', uploadFile } });
    fireEvent.paste(textarea(), {
      clipboardData: { files: [new File(['x'], 'bad.pdf', { type: 'application/pdf' })] },
    });
    await waitFor(() => expect(screen.getByText(/Couldn't upload bad\.pdf/)).toBeTruthy());
  });

  it('leaves no popover node after unmount', async () => {
    const { unmount } = mount();
    typeInto(textarea(), 'hi @ja');
    await waitFor(() => expect(popovers()).toHaveLength(1));
    unmount();
    expect(popovers()).toHaveLength(0);
  });

  it('portals into an enclosing dialog', async () => {
    mount({}, true);
    typeInto(textarea(), 'hi @ja');
    await waitFor(() => expect(popovers()).toHaveLength(1));
    expect(popovers()[0].closest('[role="dialog"]')).not.toBeNull();
  });
});
