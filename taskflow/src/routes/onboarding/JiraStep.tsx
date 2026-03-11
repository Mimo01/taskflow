/**
 * JiraStep — Jira credential entry with inline validation and project selection.
 *
 * Key design decisions (from CONTEXT.md — locked):
 * - Field values live in Zustand (useOnboardingStore), NOT useState — back nav preserves them
 * - 'Test & Continue' fires validation; no blur/as-you-type validation
 * - PAT stored to Stronghold ('jira-pat') AFTER successful validation (not on input)
 * - Project dropdown appears INLINE on this step after validation — no separate screen
 * - Error messages are EXACT strings from jira.ts (locked per CONTEXT.md)
 *
 * storeSecret is called with key='jira-pat' after successful validateJira call.
 * Ref: PLAN 02 key_links → from JiraStep.tsx to stronghold.ts via storeSecret('jira-pat', token)
 */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
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
import { validateJira, listJiraProjects, type JiraProject } from '@/services/jira';
import { storeSecret } from '@/services/stronghold';
import { useOnboardingStore } from '@/stores/onboarding.store';
import { useAuthStore } from '@/stores/auth.store';

export default function JiraStep() {
  const { jiraUrl, jiraToken, set, goBack, goNext } = useOnboardingStore();
  const { setJiraConnected, setActiveJiraProject } = useAuthStore();

  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');

  const mutation = useMutation({
    mutationFn: async () => {
      const user = await validateJira(jiraUrl, jiraToken);
      const projectList = await listJiraProjects(jiraUrl, jiraToken);
      return { user, projectList };
    },
    onSuccess: async ({ projectList }) => {
      // Store PAT in Stronghold — NEVER in Zustand
      await storeSecret('jira-pat', jiraToken);
      setProjects(projectList);
    },
  });

  const handleValidate = () => {
    if (!jiraUrl || !jiraToken) return;
    mutation.mutate();
  };

  const handleContinue = () => {
    if (!selectedProject) return;
    set({ jiraProject: selectedProject, jiraValidated: true });
    setJiraConnected(true, jiraUrl);
    setActiveJiraProject(selectedProject);
    goNext();
  };

  const showProjectDropdown = mutation.isSuccess && projects.length > 0;

  return (
    <div className="flex flex-col gap-6 max-w-md mx-auto py-8">
      <div>
        <h2 className="text-xl font-semibold">Connect Jira</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enter your Jira Server base URL and a Personal Access Token.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="jira-url">Jira URL</Label>
          <Input
            id="jira-url"
            type="url"
            placeholder="https://jira.example.com"
            value={jiraUrl}
            onChange={(e) => set({ jiraUrl: e.target.value })}
            disabled={mutation.isPending}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="jira-token">Personal Access Token</Label>
          <Input
            id="jira-token"
            type="password"
            placeholder="Your Jira PAT"
            value={jiraToken}
            onChange={(e) => set({ jiraToken: e.target.value })}
            disabled={mutation.isPending}
          />
        </div>

        {/* Error message — exact string from jira.ts, locked per CONTEXT.md */}
        {mutation.isError && mutation.error && (
          <p className="text-sm text-destructive" role="alert">
            {mutation.error.message}
          </p>
        )}

        {/* Inline project dropdown after successful validation */}
        {showProjectDropdown && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="jira-project">Select Project</Label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger id="jira-project">
                <SelectValue placeholder="Choose a project..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.key} — {project.name}
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
          <Button onClick={handleContinue} disabled={!selectedProject}>
            Continue
          </Button>
        ) : (
          <Button onClick={handleValidate} disabled={mutation.isPending || !jiraUrl || !jiraToken}>
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
