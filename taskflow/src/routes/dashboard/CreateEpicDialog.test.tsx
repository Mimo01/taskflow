import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { lastStubProps } from '@/test/wiki-editor-stub';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({
    epicNameFieldKey: 'customfield_10015',
  }),
}));
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
  }),
}));
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('tok'),
}));
vi.mock('@/services/jira', () => ({
  createIssue: vi.fn(),
}));
vi.mock(
  '@/components/wiki-editor/WikiEditorLazy',
  async () => (await import('@/test/wiki-editor-stub')).wikiEditorLazyMock,
);
vi.mock('@/lib/upload-staged-files', () => ({
  uploadStagedFiles: vi.fn().mockResolvedValue([]),
}));

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('CreateEpicDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('EPIC-04: submits createIssue with issuetype Epic, summary, and epicNameFieldKey', async () => {
    const { createIssue } = await import('@/services/jira');
    (createIssue as ReturnType<typeof vi.fn>).mockResolvedValue({ id: '99', key: 'PROJ-99' });
    const { CreateEpicDialog } = await import('./CreateEpicDialog');
    const onClose = vi.fn();
    render(
      <QueryClientProvider client={makeClient()}>
        <CreateEpicDialog open={true} onClose={onClose} />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByRole('textbox', { name: /epic name/i }), {
      target: { value: 'My New Epic' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create epic/i }));
    await waitFor(() =>
      expect(createIssue).toHaveBeenCalledWith(
        'https://jira.example.com',
        'tok',
        'PROJ',
        'My New Epic',
        expect.objectContaining({ issuetype: 'Epic', customfield_10015: 'My New Epic' }),
      ),
    );
  });

  it('EPIC-04: does not submit when epic name is empty', async () => {
    const { createIssue } = await import('@/services/jira');
    const { CreateEpicDialog } = await import('./CreateEpicDialog');
    render(
      <QueryClientProvider client={makeClient()}>
        <CreateEpicDialog open={true} onClose={vi.fn()} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /create epic/i }));
    await waitFor(() => expect(createIssue).not.toHaveBeenCalled());
  });

  async function setup(onClose = vi.fn()) {
    const { createIssue } = await import('@/services/jira');
    (createIssue as ReturnType<typeof vi.fn>).mockResolvedValue({ id: '9', key: 'PROJ-9' });
    const { uploadStagedFiles } = await import('@/lib/upload-staged-files');
    const { CreateEpicDialog } = await import('./CreateEpicDialog');
    render(
      <QueryClientProvider client={makeClient()}>
        <CreateEpicDialog open={true} onClose={onClose} />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByRole('textbox', { name: /epic name/i }), {
      target: { value: 'E' },
    });
    return { createIssue: createIssue as ReturnType<typeof vi.fn>, uploadStagedFiles, onClose };
  }

  it('renders the full-preset editor with host config', async () => {
    await setup();
    expect(lastStubProps.current?.preset).toBe('full');
    expect(lastStubProps.current?.placeholder).toBe('Optional description');
    expect(lastStubProps.current?.['aria-label']).toBe('Description');
    expect(lastStubProps.current?.host?.staged).toBe(true);
    expect(lastStubProps.current?.host?.projectKey).toBe('PROJ');
  });

  it('passes the editor text as description, undefined when empty', async () => {
    const { createIssue } = await setup();
    fireEvent.click(screen.getByRole('button', { name: /create epic/i }));
    await waitFor(() => expect(createIssue).toHaveBeenCalledTimes(1));
    expect(createIssue.mock.calls[0][4].description).toBeUndefined();
  });

  it('sends description text', async () => {
    const { createIssue } = await setup();
    fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), {
      target: { value: 'h1. Hi' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create epic/i }));
    await waitFor(() => expect(createIssue).toHaveBeenCalled());
    expect(createIssue.mock.calls[0][4].description).toBe('h1. Hi');
  });

  it('stages files via host.stageFile and removes chips', async () => {
    await setup();
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    act(() => lastStubProps.current?.host?.stageFile?.(file));
    expect(screen.getByText('a.png')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove a.png' }));
    expect(screen.queryByText('a.png')).toBeNull();
  });

  it('Attach file routes the chosen file through the editor handle', async () => {
    await setup();
    const file = new File(['x'], 'b.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('create-epic-file-input'), { target: { files: [file] } });
    expect(screen.getByText('b.png')).toBeTruthy();
  });

  it('uploads staged files to the created epic, then closes', async () => {
    const { uploadStagedFiles, onClose } = await setup();
    const file = new File(['x'], 'a.png');
    act(() => lastStubProps.current?.host?.stageFile?.(file));
    fireEvent.click(screen.getByRole('button', { name: /create epic/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(uploadStagedFiles).toHaveBeenCalledWith('https://jira.example.com', 'tok', 'PROJ-9', [
      file,
    ]);
  });

  it('does not call uploadStagedFiles with nothing staged', async () => {
    const { uploadStagedFiles, onClose } = await setup();
    fireEvent.click(screen.getByRole('button', { name: /create epic/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(uploadStagedFiles).not.toHaveBeenCalled();
  });

  it('keeps the dialog open with an error and blocks a duplicate epic on upload failure', async () => {
    const { uploadStagedFiles, createIssue, onClose } = await setup();
    (uploadStagedFiles as ReturnType<typeof vi.fn>).mockResolvedValueOnce(['a.png']);
    act(() => lastStubProps.current?.host?.stageFile?.(new File(['x'], 'a.png')));
    fireEvent.click(screen.getByRole('button', { name: /create epic/i }));
    await screen.findByText(/Issue created, but 1 file\(s\) failed to upload: a.png/);
    expect(onClose).not.toHaveBeenCalled();
    const btn = screen.getByRole('button', { name: /create epic/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(createIssue).toHaveBeenCalledTimes(1);
  });
});
