import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Discussion } from '@/services/gitlab';
import { DiscussionThreads } from './DiscussionThreads';

vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));

const openExternalMock = vi.fn();
vi.mock('@/lib/openExternal', () => ({
  openExternal: (...args: unknown[]) => openExternalMock(...args),
}));

vi.mock('@/lib/useDetectedBrowsers', () => ({
  useDetectedBrowsers: () => [
    { id: 'firefox', label: 'Firefox', path: '/Applications/Firefox.app' },
    { id: 'chrome', label: 'Google Chrome', path: '/Applications/Google Chrome.app' },
  ],
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ pathname: '/mr/123/1' }),
  };
});

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeGitlabProject: 123,
    activeGitlabProjectPath: 'group/project',
  }),
}));

const pushMock = vi.fn();
vi.mock('@/stores/breadcrumb.store', () => ({
  useBreadcrumbStore: (selector?: (s: { push: typeof pushMock }) => unknown) =>
    typeof selector === 'function' ? selector({ push: pushMock }) : { push: pushMock },
}));

function renderThreads(node: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

function makeDiscussion(overrides?: Partial<Discussion>): Discussion {
  return {
    id: 'disc-1',
    individual_note: false,
    notes: [
      {
        id: 1,
        type: 'DiscussionNote',
        body: '[docs](https://example.com/docs)',
        author: {
          id: 1,
          name: 'Jane Doe',
          username: 'jane',
          avatar_url: 'https://example.com/avatar.jpg',
        },
        created_at: '2026-03-11T10:00:00.000Z',
        updated_at: '2026-03-11T10:00:00.000Z',
        system: false,
        resolvable: false,
        resolved: false,
        resolved_by: null,
        resolved_at: null,
        position: null,
        confidential: false,
        internal: false,
      },
    ],
    ...overrides,
  };
}

describe('DiscussionThreads', () => {
  beforeEach(() => {
    openExternalMock.mockClear();
    navigateMock.mockClear();
    pushMock.mockClear();
  });

  it('right-clicking an external prose link shows the LinkContextMenu items', async () => {
    renderThreads(
      <DiscussionThreads
        discussions={[makeDiscussion()]}
        gitlabBaseUrl="https://gitlab.example.com"
      />,
    );
    const link = screen.getByRole('link', { name: 'docs' });
    fireEvent.contextMenu(link);
    expect(await screen.findByText('Open in System Default')).toBeInTheDocument();
    expect(screen.getByText('Copy link')).toBeInTheDocument();
  });

  it('left-click on an internal-path link navigates in-app and does NOT call openExternal', () => {
    const internalDiscussion = makeDiscussion({
      notes: [
        {
          ...makeDiscussion().notes[0],
          body: '[issue](https://jira.example.com/browse/PROD-123)',
        },
      ],
    });
    renderThreads(
      <DiscussionThreads
        discussions={[internalDiscussion]}
        gitlabBaseUrl="https://gitlab.example.com"
      />,
    );
    const link = screen.getByRole('link', { name: 'issue' });
    fireEvent.click(link);

    expect(navigateMock).toHaveBeenCalledWith('/issue/PROD-123');
    expect(openExternalMock).not.toHaveBeenCalled();
  });
});
