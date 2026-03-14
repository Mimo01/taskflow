/**
 * SearchOverlay — full-width fixed overlay with debounced parallel Jira/GitLab search.
 *
 * Debounce: 400ms. Minimum query length: 2 characters.
 * Uses Promise.allSettled so one failing integration never kills the other.
 * Results are grouped into two sections: Tasks (Jira) and Merge Requests (GitLab).
 * Clicking a result opens SearchResultPanel inline. Escape/backdrop closes overlay.
 */
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { readSecret } from '@/services/stronghold';
import { searchJira } from '@/services/jira';
import type { JiraIssue } from '@/services/jira';
import { searchGitLabMRs } from '@/services/gitlab';
import type { GitLabMR } from '@/services/gitlab';
import SearchResultPanel from './SearchResultPanel';

async function performSearch(
  jiraBaseUrl: string,
  jiraToken: string,
  gitlabBaseUrl: string,
  gitlabToken: string,
  projectKey: string,
  query: string,
): Promise<{ tasks: JiraIssue[]; mrs: GitLabMR[] }> {
  const [jiraResult, gitlabResult] = await Promise.allSettled([
    searchJira(jiraBaseUrl, jiraToken, projectKey, query),
    searchGitLabMRs(gitlabBaseUrl, gitlabToken, query),
  ]);
  return {
    tasks: jiraResult.status === 'fulfilled' ? jiraResult.value : [],
    mrs: gitlabResult.status === 'fulfilled' ? gitlabResult.value : [],
  };
}

function LoadingSkeleton() {
  return (
    <div data-testid="search-loading" className="flex flex-col gap-2 p-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-9 rounded bg-muted animate-pulse" />
      ))}
    </div>
  );
}

interface SearchOverlayProps {
  onClose: () => void;
  /** Called with the Jira issue key when a Jira result is clicked. When provided,
   *  Jira results open the IssueDetailSheet instead of the inline SearchResultPanel. */
  onIssueClick?: (issueKey: string) => void;
}

export default function SearchOverlay({ onClose, onIssueClick }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selected, setSelected] = useState<{
    item: JiraIssue | GitLabMR;
    type: 'jira' | 'gitlab';
  } | null>(null);

  const { jiraBaseUrl, gitlabBaseUrl, activeJiraProject } = useAuthStore();
  const [jiraToken, setJiraToken] = useState<string | null>(null);
  const [gitlabToken, setGitlabToken] = useState<string | null>(null);

  // Load tokens from Stronghold
  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then(setJiraToken)
        .catch(() => setJiraToken(null));
    }
  }, [jiraBaseUrl]);

  useEffect(() => {
    if (gitlabBaseUrl) {
      readSecret('gitlab-pat')
        .then(setGitlabToken)
        .catch(() => setGitlabToken(null));
    }
  }, [gitlabBaseUrl]);

  // Debounce query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  // Escape key listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const { data, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery, activeJiraProject],
    queryFn: () =>
      performSearch(
        jiraBaseUrl!,
        jiraToken!,
        gitlabBaseUrl!,
        gitlabToken!,
        activeJiraProject!,
        debouncedQuery,
      ),
    enabled:
      debouncedQuery.length >= 2 &&
      !!jiraToken &&
      !!gitlabToken &&
      !!jiraBaseUrl &&
      !!gitlabBaseUrl &&
      !!activeJiraProject,
    staleTime: 30_000,
  });

  const isEmpty =
    data !== undefined &&
    data.tasks.length === 0 &&
    data.mrs.length === 0 &&
    debouncedQuery.length >= 2;

  return (
    <div
      data-testid="search-backdrop"
      className="fixed inset-0 z-50 flex flex-col items-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl mt-16 bg-background border rounded-lg shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input row */}
        <div className="flex items-center border-b px-4 py-3 gap-3">
          <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <input
            autoFocus
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            placeholder="Search tasks and MRs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSelected(null);
              }}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Results area */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {selected ? (
            <SearchResultPanel
              result={selected.item}
              type={selected.type}
              jiraBaseUrl={jiraBaseUrl ?? ''}
              onBack={() => setSelected(null)}
            />
          ) : isLoading ? (
            <LoadingSkeleton />
          ) : isEmpty ? (
            <p className="text-center text-muted-foreground py-6 text-sm">No results found</p>
          ) : (
            <>
              {(data?.tasks.length ?? 0) > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase px-2 py-1">
                    Tasks
                  </h3>
                  {data!.tasks.map((task) => (
                    <button
                      key={task.key}
                      type="button"
                      className="w-full text-left px-3 py-2 rounded hover:bg-muted text-sm flex gap-2"
                      onClick={() => {
                        if (onIssueClick) {
                          // Open issue in the global IssueDetailSheet instead of inline panel
                          onIssueClick(task.key);
                          onClose();
                        } else {
                          setSelected({ item: task, type: 'jira' });
                        }
                      }}
                    >
                      <span className="text-muted-foreground font-mono">{task.key}</span>
                      <span className="truncate">{task.fields.summary}</span>
                    </button>
                  ))}
                </section>
              )}
              {(data?.mrs.length ?? 0) > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase px-2 py-1">
                    Merge Requests
                  </h3>
                  {data!.mrs.map((mr) => (
                    <button
                      key={mr.id}
                      type="button"
                      className="w-full text-left px-3 py-2 rounded hover:bg-muted text-sm flex gap-2"
                      onClick={() => setSelected({ item: mr, type: 'gitlab' })}
                    >
                      <span className="text-muted-foreground">!{mr.iid}</span>
                      <span className="truncate">{mr.title}</span>
                    </button>
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
