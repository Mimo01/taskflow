/**
 * TokenSection — Credential management in Settings.
 *
 * Security rules (from CONTEXT.md — locked decisions):
 * - Tokens are ALWAYS displayed masked by default (type="password", value="••••••••")
 * - Eye-toggle reveal reads from Stronghold on first click — NEVER from Zustand
 * - Revealed token is local component state only — never stored in Zustand
 * - 'Update Token' validates before writing to Stronghold (same flow as onboarding)
 * - Switching active Jira project calls queryClient.clear() to purge stale data
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { type GitLabProject, listGitLabProjects, validateGitLab } from '@/services/gitlab';
import { type JiraProject, listJiraProjects, validateJira } from '@/services/jira';
import { readSecret, storeSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';

// Masked placeholder — never show the real token on render
const MASKED_PLACEHOLDER = '••••••••';

function TokenBlock({
  label,
  secretKey,
  onValidate,
  validating,
  succeeded,
  errorMessage,
}: {
  label: string;
  secretKey: string;
  onValidate: (newToken: string) => void;
  validating: boolean;
  succeeded: boolean;
  errorMessage: string | null;
}) {
  const [revealed, setRevealed] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string>('');
  const [newToken, setNewToken] = useState('');

  useEffect(() => {
    if (succeeded) setNewToken('');
  }, [succeeded]);

  const handleEyeClick = async () => {
    if (revealed) {
      setRevealedToken('');
      setRevealed(false);
    } else {
      const token = await readSecret(secretKey);
      setRevealedToken(token);
      setRevealed(true);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-sm font-medium">{label}</h4>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${secretKey}-current`}>Current Token</Label>
        <div className="flex gap-2 items-center">
          <Input
            id={`${secretKey}-current`}
            type={revealed ? 'text' : 'password'}
            value={revealed ? revealedToken : MASKED_PLACEHOLDER}
            readOnly
            className="font-mono"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleEyeClick}
            aria-label={revealed ? 'Hide token' : 'Show token'}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${secretKey}-new`}>New Token</Label>
        <div className="flex gap-2">
          <Input
            id={`${secretKey}-new`}
            type="password"
            placeholder="Paste new token..."
            value={newToken}
            onChange={(e) => setNewToken(e.target.value)}
            disabled={validating}
          />
          <Button
            type="button"
            onClick={() => onValidate(newToken)}
            disabled={validating || !newToken}
          >
            {validating ? 'Validating...' : 'Update Token'}
          </Button>
        </div>
      </div>

      {succeeded && (
        <p className="text-sm text-green-600 dark:text-green-400" role="status">
          Token updated successfully.
        </p>
      )}
      {errorMessage && (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

export default function TokenSection() {
  const queryClient = useQueryClient();
  const {
    jiraBaseUrl,
    gitlabBaseUrl,
    setJiraConnected,
    setJiraUser,
    setGitlabConnected,
    activeJiraProject,
    setActiveJiraProject,
    activeGitlabProject,
    activeGitlabProjectPath,
    setActiveGitlabProject,
    setGitlabUserId,
    setGitlabUsername,
  } = useAuthStore();

  const [jiraUrl, setJiraUrl] = useState(jiraBaseUrl ?? '');
  const [gitlabUrl, setGitlabUrl] = useState(gitlabBaseUrl ?? '');
  const [jiraProjects, setJiraProjects] = useState<JiraProject[]>([]);
  const [jiraProjectsLoading, setJiraProjectsLoading] = useState(false);
  const [jiraProjectsError, setJiraProjectsError] = useState<string | null>(null);
  const [gitlabProjects, setGitlabProjects] = useState<GitLabProject[]>([]);
  const [gitlabProjectsLoading, setGitlabProjectsLoading] = useState(false);
  const [gitlabProjectsError, setGitlabProjectsError] = useState<string | null>(null);

  useEffect(() => {
    if (!jiraBaseUrl) return;
    setJiraProjectsLoading(true);
    setJiraProjectsError(null);
    (async () => {
      try {
        const pat = await readSecret('jira-pat').catch(() => null);
        if (!pat) {
          setJiraProjectsError('Could not read Jira token');
          return;
        }
        const list = await listJiraProjects(jiraBaseUrl, pat);
        setJiraProjects(list);
      } catch (err) {
        const msg = (err as Error)?.message ?? '';
        setJiraProjectsError(
          msg.includes('error sending request')
            ? 'Could not reach Jira — check the URL and your network connection'
            : msg || 'Failed to load projects',
        );
        setJiraProjects([]);
      } finally {
        setJiraProjectsLoading(false);
      }
    })();
  }, [jiraBaseUrl]);

  useEffect(() => {
    if (!gitlabBaseUrl) return;
    setGitlabProjectsLoading(true);
    setGitlabProjectsError(null);
    (async () => {
      try {
        const pat = await readSecret('gitlab-pat').catch(() => null);
        if (!pat) {
          setGitlabProjectsError('Could not read GitLab token');
          return;
        }
        const list = await listGitLabProjects(gitlabBaseUrl, pat);
        setGitlabProjects(list);
      } catch (err) {
        const msg = (err as Error)?.message ?? '';
        setGitlabProjectsError(
          msg.includes('error sending request')
            ? 'Could not reach GitLab — check the URL and your network connection'
            : msg || 'Failed to load projects',
        );
        setGitlabProjects([]);
      } finally {
        setGitlabProjectsLoading(false);
      }
    })();
  }, [gitlabBaseUrl]);

  const handleProjectChange = (projectKey: string) => {
    setActiveJiraProject(projectKey);
    queryClient.clear();
  };

  const handleProjectChangeGitlab = (value: string) => {
    const id = parseInt(value, 10);
    const project = gitlabProjects.find((p) => p.id === id);
    const path = project?.name_with_namespace ?? null;
    setActiveGitlabProject(id, path);
    queryClient.clear();
  };

  // Jira URL save mutation — validates existing token against new URL
  const jiraUrlMutation = useMutation({
    mutationFn: async () => {
      const pat = await readSecret('jira-pat');
      const user = await validateJira(jiraUrl, pat);
      return { url: jiraUrl, user };
    },
    onSuccess: ({ url, user }) => {
      setJiraConnected(true, url);
      setJiraUser(user.displayName, user.name, user.key);
    },
  });

  // Jira token update mutation
  const jiraMutation = useMutation({
    mutationFn: async (newToken: string) => {
      const user = await validateJira(jiraUrl, newToken);
      await storeSecret('jira-pat', newToken);
      return { url: jiraUrl, user };
    },
    onSuccess: ({ url, user }) => {
      setJiraConnected(true, url);
      setJiraUser(user.displayName, user.name, user.key);
    },
  });

  // GitLab URL save mutation — validates existing token against new URL
  const gitlabUrlMutation = useMutation({
    mutationFn: async () => {
      const pat = await readSecret('gitlab-pat');
      const user = await validateGitLab(gitlabUrl, pat);
      return { url: gitlabUrl, userId: user.id, username: user.username };
    },
    onSuccess: ({ url, userId, username }) => {
      setGitlabConnected(true, url);
      setGitlabUserId(userId);
      setGitlabUsername(username);
    },
  });

  // GitLab token update mutation
  const gitlabMutation = useMutation({
    mutationFn: async (newToken: string) => {
      const user = await validateGitLab(gitlabUrl, newToken);
      await storeSecret('gitlab-pat', newToken);
      return { url: gitlabUrl, userId: user.id, username: user.username };
    },
    onSuccess: ({ url, userId, username }) => {
      setGitlabConnected(true, url);
      setGitlabUserId(userId);
      setGitlabUsername(username);
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base font-semibold">Credentials</h3>
        <p className="text-sm text-muted-foreground">
          Update your Jira and GitLab personal access tokens.
        </p>
      </div>

      <div className="border border-border rounded-lg p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="jira-base-url">Jira URL</Label>
          <div className="flex gap-2">
            <Input
              id="jira-base-url"
              type="url"
              value={jiraUrl}
              onChange={(e) => setJiraUrl(e.target.value)}
              placeholder="https://jira.example.com"
              disabled={jiraUrlMutation.isPending}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => jiraUrlMutation.mutate()}
              disabled={jiraUrlMutation.isPending || !jiraUrl || jiraUrl === jiraBaseUrl}
            >
              {jiraUrlMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
          {jiraUrlMutation.isSuccess && (
            <p className="text-sm text-green-600 dark:text-green-400">URL updated.</p>
          )}
          {jiraUrlMutation.isError && (
            <p className="text-sm text-destructive">{jiraUrlMutation.error?.message}</p>
          )}
        </div>

        {jiraBaseUrl && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="active-jira-project">Active Project</Label>
            {jiraProjectsLoading && (
              <p className="text-sm text-muted-foreground">Loading projects...</p>
            )}
            {jiraProjectsError && !jiraProjectsLoading && (
              <p className="text-sm text-destructive">{jiraProjectsError}</p>
            )}
            {!jiraProjectsLoading && !jiraProjectsError && (
              <Select
                value={activeJiraProject ?? ''}
                onValueChange={(v) => v && handleProjectChange(v)}
              >
                <SelectTrigger id="active-jira-project" className="w-full">
                  <span className="flex flex-1 text-left text-sm">
                    {activeJiraProject ? (
                      (() => {
                        const p = jiraProjects.find((p) => p.key === activeJiraProject);
                        return p ? `${p.key} — ${p.name}` : activeJiraProject;
                      })()
                    ) : (
                      <span className="text-muted-foreground">
                        {jiraProjects.length === 0 ? 'No projects found' : 'Select project...'}
                      </span>
                    )}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {jiraProjects.map((p) => (
                    <SelectItem key={p.id} value={p.key}>
                      {p.key} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <TokenBlock
          label="Jira Token"
          secretKey="jira-pat"
          onValidate={(token) => jiraMutation.mutate(token)}
          validating={jiraMutation.isPending}
          succeeded={jiraMutation.isSuccess}
          errorMessage={jiraMutation.isError ? (jiraMutation.error?.message ?? null) : null}
        />
      </div>

      <div className="border border-border rounded-lg p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gitlab-base-url">GitLab URL</Label>
          <div className="flex gap-2">
            <Input
              id="gitlab-base-url"
              type="url"
              value={gitlabUrl}
              onChange={(e) => setGitlabUrl(e.target.value)}
              placeholder="https://gitlab.example.com"
              disabled={gitlabUrlMutation.isPending}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => gitlabUrlMutation.mutate()}
              disabled={gitlabUrlMutation.isPending || !gitlabUrl || gitlabUrl === gitlabBaseUrl}
            >
              {gitlabUrlMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
          {gitlabUrlMutation.isSuccess && (
            <p className="text-sm text-green-600 dark:text-green-400">URL updated.</p>
          )}
          {gitlabUrlMutation.isError && (
            <p className="text-sm text-destructive">{gitlabUrlMutation.error?.message}</p>
          )}
        </div>

        {gitlabBaseUrl && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="active-gitlab-project">Active Project</Label>
            {gitlabProjectsLoading && (
              <p className="text-sm text-muted-foreground">Loading projects...</p>
            )}
            {gitlabProjectsError && !gitlabProjectsLoading && (
              <p className="text-sm text-destructive">{gitlabProjectsError}</p>
            )}
            {!gitlabProjectsLoading && !gitlabProjectsError && (
              <Select
                value={activeGitlabProject !== null ? String(activeGitlabProject) : ''}
                onValueChange={(v) => v && handleProjectChangeGitlab(v)}
              >
                <SelectTrigger id="active-gitlab-project" className="w-full">
                  <span className="flex flex-1 text-left text-sm">
                    {activeGitlabProject !== null ? (
                      (activeGitlabProjectPath ?? String(activeGitlabProject))
                    ) : (
                      <span className="text-muted-foreground">
                        {gitlabProjects.length === 0 ? 'No projects found' : 'Select project...'}
                      </span>
                    )}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {gitlabProjects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name_with_namespace}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <TokenBlock
          label="GitLab Token"
          secretKey="gitlab-pat"
          onValidate={(token) => gitlabMutation.mutate(token)}
          validating={gitlabMutation.isPending}
          succeeded={gitlabMutation.isSuccess}
          errorMessage={gitlabMutation.isError ? (gitlabMutation.error?.message ?? null) : null}
        />
      </div>
    </div>
  );
}
