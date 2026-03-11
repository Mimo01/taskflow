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
import { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { readSecret, storeSecret } from '@/services/stronghold';
import { validateJira, listJiraProjects, type JiraProject } from '@/services/jira';
import { validateGitLab } from '@/services/gitlab';
import { useAuthStore } from '@/stores/auth.store';

// Masked placeholder — never show the real token on render
const MASKED_PLACEHOLDER = '••••••••';

function TokenBlock({
  label,
  secretKey,
  onValidate,
  validating,
  errorMessage,
}: {
  label: string;
  secretKey: string;
  onValidate: (newToken: string) => void;
  validating: boolean;
  errorMessage: string | null;
}) {
  const [revealed, setRevealed] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string>('');
  const [newToken, setNewToken] = useState('');

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
    setGitlabConnected,
    activeJiraProject,
    setActiveJiraProject,
  } = useAuthStore();

  const [jiraProjects, setJiraProjects] = useState<JiraProject[]>([]);

  useEffect(() => {
    if (!jiraBaseUrl) return;
    (async () => {
      const pat = await readSecret('jira-pat').catch(() => null);
      if (!pat) return;
      const list = await listJiraProjects(jiraBaseUrl, pat).catch(() => []);
      setJiraProjects(list);
    })();
  }, [jiraBaseUrl]);

  const handleProjectChange = (projectId: string) => {
    setActiveJiraProject(projectId);
    queryClient.clear();
  };

  // Jira token update mutation
  const jiraMutation = useMutation({
    mutationFn: async (newToken: string) => {
      const url = jiraBaseUrl ?? '';
      await validateJira(url, newToken);
      await storeSecret('jira-pat', newToken);
      return { url };
    },
    onSuccess: ({ url }) => {
      setJiraConnected(true, url);
    },
  });

  // GitLab token update mutation
  const gitlabMutation = useMutation({
    mutationFn: async (newToken: string) => {
      const url = gitlabBaseUrl ?? '';
      await validateGitLab(url, newToken);
      await storeSecret('gitlab-pat', newToken);
      return { url };
    },
    onSuccess: ({ url }) => {
      setGitlabConnected(true, url);
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
          <Input
            id="jira-base-url"
            type="url"
            value={jiraBaseUrl ?? ''}
            readOnly
            className="text-muted-foreground"
          />
        </div>

        {jiraProjects.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="active-jira-project">Active Project</Label>
            <Select value={activeJiraProject ?? ''} onValueChange={(v) => v && handleProjectChange(v)}>
              <SelectTrigger id="active-jira-project">
                <SelectValue placeholder="Select project..." />
              </SelectTrigger>
              <SelectContent>
                {jiraProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.key} — {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <TokenBlock
          label="Jira Token"
          secretKey="jira-pat"
          onValidate={(token) => jiraMutation.mutate(token)}
          validating={jiraMutation.isPending}
          errorMessage={jiraMutation.isError ? jiraMutation.error?.message ?? null : null}
        />
      </div>

      <div className="border border-border rounded-lg p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gitlab-base-url">GitLab URL</Label>
          <Input
            id="gitlab-base-url"
            type="url"
            value={gitlabBaseUrl ?? ''}
            readOnly
            className="text-muted-foreground"
          />
        </div>

        <TokenBlock
          label="GitLab Token"
          secretKey="gitlab-pat"
          onValidate={(token) => gitlabMutation.mutate(token)}
          validating={gitlabMutation.isPending}
          errorMessage={gitlabMutation.isError ? gitlabMutation.error?.message ?? null : null}
        />
      </div>
    </div>
  );
}
