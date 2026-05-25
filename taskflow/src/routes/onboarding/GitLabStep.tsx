/**
 * GitLabStep — GitLab credential entry with inline validation and project selection.
 *
 * Mirrors the JiraStep pattern exactly — same UX decisions apply:
 * - Field values in Zustand (not useState) — back nav preserves them
 * - PAT stored to Stronghold ('gitlab-pat') after successful validation
 * - Project dropdown appears inline after validation
 * - Error messages are exact strings from gitlab.ts
 */
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { type GitLabProject, listGitLabProjects, validateGitLab } from '@/services/gitlab';
import { storeSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useOnboardingStore } from '@/stores/onboarding.store';

export default function GitLabStep() {
  const { gitlabUrl, gitlabToken, gitlabProject, gitlabProjects, set, goBack, goNext } =
    useOnboardingStore();
  const {
    setGitlabConnected,
    setActiveGitlabProject,
    setGitlabUserId,
    setGitlabUsername,
    setGitlabName,
    setGitlabEmail,
  } = useAuthStore();

  const projects = gitlabProjects;
  const selectedProjectId = gitlabProject;
  const setSelectedProject = (v: string) => set({ gitlabProject: parseInt(v, 10) });

  const mutation = useMutation({
    mutationFn: async () => {
      const user = await validateGitLab(gitlabUrl, gitlabToken);
      const projectList = await listGitLabProjects(gitlabUrl, gitlabToken);
      return { user, projectList };
    },
    onSuccess: async ({ user, projectList }) => {
      // Store PAT in Stronghold — NEVER in Zustand
      await storeSecret('gitlab-pat', gitlabToken);
      // Persist user ID and username for MR filtering and @mention detection
      setGitlabUserId(user.id);
      setGitlabUsername(user.username);
      setGitlabName(user.name);
      setGitlabEmail(user.email);
      set({ gitlabProjects: projectList });
    },
  });

  const handleValidate = () => {
    if (!gitlabUrl || !gitlabToken) return;
    mutation.mutate();
  };

  const handleContinue = () => {
    if (!selectedProjectId) return;
    const selectedProject: GitLabProject | undefined = projects.find(
      (p) => p.id === selectedProjectId,
    );
    if (!selectedProject) return;
    set({ gitlabValidated: true });
    setGitlabConnected(true, gitlabUrl);
    setActiveGitlabProject(selectedProject.id, selectedProject.name_with_namespace);
    goNext();
  };

  const showProjectDropdown = projects.length > 0;

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto py-8">
      <div>
        <h2 className="text-xl font-semibold">Connect GitLab</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enter your GitLab base URL and a Personal Access Token.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gitlab-url">GitLab URL</Label>
          <Input
            id="gitlab-url"
            type="url"
            placeholder="https://gitlab.example.com"
            value={gitlabUrl}
            onChange={(e) => set({ gitlabUrl: e.target.value })}
            disabled={mutation.isPending}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gitlab-token">Personal Access Token</Label>
          <Input
            id="gitlab-token"
            type="password"
            placeholder="Your GitLab PAT"
            value={gitlabToken}
            onChange={(e) => set({ gitlabToken: e.target.value })}
            disabled={mutation.isPending}
          />
        </div>

        {/* Error message — exact string from gitlab.ts */}
        {mutation.isError && mutation.error && (
          <p className="text-sm text-destructive" role="alert">
            {mutation.error.message}
          </p>
        )}

        {/* Inline project dropdown after successful validation */}
        {showProjectDropdown && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gitlab-project">Select Project</Label>
            <Select
              value={selectedProjectId ? String(selectedProjectId) : ''}
              onValueChange={(v) => v && setSelectedProject(v)}
            >
              <SelectTrigger id="gitlab-project" className="w-full">
                <span className="flex flex-1 text-left text-sm">
                  {selectedProjectId ? (
                    (() => {
                      const p = projects.find((p) => p.id === selectedProjectId);
                      return p ? p.name_with_namespace : String(selectedProjectId);
                    })()
                  ) : (
                    <span className="text-muted-foreground">Choose a project...</span>
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
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={goBack}>
          Back
        </Button>

        {showProjectDropdown ? (
          <Button onClick={handleContinue} disabled={!selectedProjectId}>
            Continue
          </Button>
        ) : (
          <Button
            onClick={handleValidate}
            disabled={mutation.isPending || !gitlabUrl || !gitlabToken}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              'Test & Continue'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
