/**
 * ConnectionsSection — Jira + GitLab connection cards with inline test feedback
 * and project selection.
 *
 * Each card shows the service URL and a password token field. Test Connection
 * calls readSecret then validateFn with inline feedback. On success, a project
 * list is fetched and an inline project picker appears — mirroring the onboarding
 * step pattern.
 *
 * Locked decisions (from CONTEXT.md):
 * - No toast/sonner — all feedback is inline
 * - No createContext/useContext — prop drilling only
 */

import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import BoardPicker from '@/components/jira/BoardPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { GitLabProject } from '@/services/gitlab';
import { listGitLabProjects, validateGitLab } from '@/services/gitlab';
import type { JiraProject } from '@/services/jira';
import { listJiraProjects, validateJira } from '@/services/jira';
import { type JiraBoard, listProjectBoards } from '@/services/jira/sprints';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';

type TestStatus = 'idle' | 'pending' | 'success' | 'error';

// ---------------------------------------------------------------------------
// Jira card
// ---------------------------------------------------------------------------

interface JiraConnectionCardProps {
  initialBaseUrl: string;
  activeProject: string | null;
  activeBoardId: number | null;
  onConnected: (url: string) => void;
  onProjectSelected: (projectKey: string) => void;
  onBoardSelected: (projectKey: string, boardId: number) => void;
}

function JiraConnectionCard({
  initialBaseUrl,
  activeProject,
  activeBoardId,
  onConnected,
  onProjectSelected,
  onBoardSelected,
}: JiraConnectionCardProps) {
  const [draftUrl, setDraftUrl] = useState(initialBaseUrl);
  const [draftToken, setDraftToken] = useState('');
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(activeProject ?? '');
  const [boards, setBoards] = useState<JiraBoard[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(activeBoardId);

  const resetTestStatus = () => {
    setTestStatus('idle');
    setTestError(null);
    setProjects([]);
    setBoards([]);
  };

  // Load boards whenever a project is selected after a successful test.
  useEffect(() => {
    if (testStatus !== 'success' || !selectedProject) {
      setBoards([]);
      return;
    }
    let cancelled = false;
    setBoardsLoading(true);
    (async () => {
      try {
        const token = await readSecret('jira-pat');
        const list = await listProjectBoards(draftUrl || initialBaseUrl, token, selectedProject);
        if (!cancelled) setBoards(list);
      } catch {
        if (!cancelled) setBoards([]);
      } finally {
        if (!cancelled) setBoardsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [testStatus, selectedProject, draftUrl, initialBaseUrl]);

  const handleUrlChange = (value: string) => {
    setDraftUrl(value);
    resetTestStatus();
  };

  const handleTokenChange = (value: string) => {
    setDraftToken(value);
    resetTestStatus();
  };

  const handleSave = () => {
    onConnected(draftUrl);
  };

  const handleTest = async () => {
    setTestStatus('pending');
    setTestError(null);
    setProjects([]);
    try {
      const token = await readSecret('jira-pat');
      await validateJira(draftUrl || initialBaseUrl, token);
      const projectList = await listJiraProjects(draftUrl || initialBaseUrl, token);
      setProjects(projectList);
      setTestStatus('success');
    } catch (err) {
      setTestStatus('error');
      setTestError((err as Error)?.message ?? 'Connection failed');
    }
  };

  const handleProjectChange = (key: string) => {
    setSelectedProject(key);
    setSelectedBoardId(null);
    onProjectSelected(key);
  };

  const handleBoardChange = (boardId: number) => {
    setSelectedBoardId(boardId);
    if (selectedProject) onBoardSelected(selectedProject, boardId);
  };

  const showProjectPicker = testStatus === 'success' && projects.length > 0;

  return (
    <div className="border border-border rounded-lg p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold">Jira</span>
      </div>

      {/* URL field */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="jira-base-url">Jira URL</Label>
        <Input
          id="jira-base-url"
          type="url"
          value={draftUrl}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="https://yourorg.atlassian.net"
          className="truncate"
        />
      </div>

      {/* Token field — masked, editable for pasting new token */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="jira-api-token">Jira Token</Label>
        <Input
          id="jira-api-token"
          type="password"
          value={draftToken}
          onChange={(e) => handleTokenChange(e.target.value)}
          placeholder="••••••••"
        />
      </div>

      {/* Inline test status */}
      {testStatus === 'pending' && (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Testing connection…</span>
        </div>
      )}
      {testStatus === 'success' && (
        <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <span>Connected</span>
        </div>
      )}
      {testStatus === 'error' && (
        <div className="flex items-center gap-1.5 text-sm text-destructive">
          <XCircle className="h-4 w-4" />
          <span>{testError}</span>
        </div>
      )}

      {/* Inline project picker — appears after a successful test */}
      {showProjectPicker && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="jira-project-picker">Active Project</Label>
          <Select value={selectedProject} onValueChange={(v) => v && handleProjectChange(v)}>
            <SelectTrigger id="jira-project-picker" className="w-full">
              <span className="flex flex-1 text-left text-sm">
                {selectedProject ? (
                  (() => {
                    const p = projects.find((p) => p.key === selectedProject);
                    return p ? `${p.key} — ${p.name}` : selectedProject;
                  })()
                ) : (
                  <span className="text-muted-foreground">Choose a project…</span>
                )}
              </span>
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.key}>
                  {project.key} — {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Board picker — appears once a project is selected (FB8-4) */}
      {showProjectPicker && selectedProject && (
        <BoardPicker
          boards={boards}
          value={selectedBoardId}
          onChange={handleBoardChange}
          isLoading={boardsLoading}
        />
      )}

      {/* Current selection indicator when not in test-success state */}
      {testStatus !== 'success' && activeProject && (
        <p className="text-xs text-muted-foreground">
          Active project: <span className="font-medium text-foreground">{activeProject}</span>
        </p>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleSave} disabled={!draftUrl}>
          Save
        </Button>
        <Button type="button" size="sm" disabled={testStatus === 'pending'} onClick={handleTest}>
          {testStatus === 'pending' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
              Testing…
            </>
          ) : (
            'Test Connection'
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GitLab card
// ---------------------------------------------------------------------------

interface GitLabConnectionCardProps {
  initialBaseUrl: string;
  activeProject: number | null;
  activeProjectPath: string | null;
  onConnected: (url: string) => void;
  onProjectSelected: (id: number, path: string) => void;
}

function GitLabConnectionCard({
  initialBaseUrl,
  activeProject,
  activeProjectPath,
  onConnected,
  onProjectSelected,
}: GitLabConnectionCardProps) {
  const [draftUrl, setDraftUrl] = useState(initialBaseUrl);
  const [draftToken, setDraftToken] = useState('');
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [projects, setProjects] = useState<GitLabProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(activeProject);

  const resetTestStatus = () => {
    setTestStatus('idle');
    setTestError(null);
    setProjects([]);
  };

  const handleUrlChange = (value: string) => {
    setDraftUrl(value);
    resetTestStatus();
  };

  const handleTokenChange = (value: string) => {
    setDraftToken(value);
    resetTestStatus();
  };

  const handleSave = () => {
    onConnected(draftUrl);
  };

  const handleTest = async () => {
    setTestStatus('pending');
    setTestError(null);
    setProjects([]);
    try {
      const token = await readSecret('gitlab-pat');
      await validateGitLab(draftUrl || initialBaseUrl, token);
      const projectList = await listGitLabProjects(draftUrl || initialBaseUrl, token);
      setProjects(projectList);
      setTestStatus('success');
    } catch (err) {
      setTestStatus('error');
      setTestError((err as Error)?.message ?? 'Connection failed');
    }
  };

  const handleProjectChange = (value: string) => {
    const id = parseInt(value, 10);
    const project = projects.find((p) => p.id === id);
    if (!project) return;
    setSelectedProjectId(id);
    onProjectSelected(id, project.name_with_namespace);
  };

  const showProjectPicker = testStatus === 'success' && projects.length > 0;

  return (
    <div className="border border-border rounded-lg p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold">GitLab</span>
      </div>

      {/* URL field */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="gitlab-base-url">GitLab URL</Label>
        <Input
          id="gitlab-base-url"
          type="url"
          value={draftUrl}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="https://gitlab.com"
          className="truncate"
        />
      </div>

      {/* Token field */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="gitlab-token">GitLab Token</Label>
        <Input
          id="gitlab-token"
          type="password"
          value={draftToken}
          onChange={(e) => handleTokenChange(e.target.value)}
          placeholder="••••••••"
        />
      </div>

      {/* Inline test status */}
      {testStatus === 'pending' && (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Testing connection…</span>
        </div>
      )}
      {testStatus === 'success' && (
        <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <span>Connected</span>
        </div>
      )}
      {testStatus === 'error' && (
        <div className="flex items-center gap-1.5 text-sm text-destructive">
          <XCircle className="h-4 w-4" />
          <span>{testError}</span>
        </div>
      )}

      {/* Inline project picker — appears after a successful test */}
      {showProjectPicker && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gitlab-project-picker">Active Project</Label>
          <Select
            value={selectedProjectId ? String(selectedProjectId) : ''}
            onValueChange={(v) => v && handleProjectChange(v)}
          >
            <SelectTrigger id="gitlab-project-picker" className="w-full">
              <span className="flex flex-1 text-left text-sm">
                {selectedProjectId ? (
                  (() => {
                    const p = projects.find((p) => p.id === selectedProjectId);
                    return p ? p.name_with_namespace : String(selectedProjectId);
                  })()
                ) : (
                  <span className="text-muted-foreground">Choose a project…</span>
                )}
              </span>
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name_with_namespace}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Current selection indicator when not in test-success state */}
      {testStatus !== 'success' && activeProjectPath && (
        <p className="text-xs text-muted-foreground">
          Active project: <span className="font-medium text-foreground">{activeProjectPath}</span>
        </p>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleSave} disabled={!draftUrl}>
          Save
        </Button>
        <Button type="button" size="sm" disabled={testStatus === 'pending'} onClick={handleTest}>
          {testStatus === 'pending' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
              Testing…
            </>
          ) : (
            'Test Connection'
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section root
// ---------------------------------------------------------------------------

export default function ConnectionsSection() {
  const {
    jiraBaseUrl,
    setJiraConnected,
    setActiveJiraProject,
    setJiraBoardId,
    gitlabBaseUrl,
    setGitlabConnected,
    setActiveGitlabProject,
    activeJiraProject,
    jiraBoardIds,
    activeGitlabProject,
    activeGitlabProjectPath,
  } = useAuthStore();
  const queryClient = useQueryClient();

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">Connections</h2>
      <JiraConnectionCard
        initialBaseUrl={jiraBaseUrl ?? ''}
        activeProject={activeJiraProject}
        activeBoardId={activeJiraProject ? (jiraBoardIds?.[activeJiraProject] ?? null) : null}
        onConnected={(url) => setJiraConnected(true, url)}
        onProjectSelected={(key) => setActiveJiraProject(key)}
        onBoardSelected={(key, boardId) => {
          setJiraBoardId(key, boardId);
          // The runtime board switch must refresh active-sprint dependent views
          // immediately (RESEARCH pitfall 2 — distinct from the wizard path).
          queryClient.invalidateQueries({ queryKey: ['jira-active-sprint'] });
        }}
      />
      <GitLabConnectionCard
        initialBaseUrl={gitlabBaseUrl ?? ''}
        activeProject={activeGitlabProject}
        activeProjectPath={activeGitlabProjectPath}
        onConnected={(url) => setGitlabConnected(true, url)}
        onProjectSelected={(id, path) => setActiveGitlabProject(id, path)}
      />
    </div>
  );
}
