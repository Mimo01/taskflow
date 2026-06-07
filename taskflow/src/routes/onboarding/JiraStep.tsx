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
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import BoardPicker from '@/components/jira/BoardPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { listJiraProjects, validateJira } from '@/services/jira';
import { listProjectBoards } from '@/services/jira/sprints';
import { storeSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useOnboardingStore } from '@/stores/onboarding.store';

export default function JiraStep() {
  const { jiraUrl, jiraToken, jiraProject, jiraProjects, jiraBoardId, set, goBack, goNext } =
    useOnboardingStore();
  const { setJiraConnected, setActiveJiraProject, setJiraUser, setJiraBoardId } = useAuthStore();

  const projects = jiraProjects;
  const selectedProject = jiraProject ?? '';
  // Clear the chosen board when the project changes so a board id from a previous
  // project can never be persisted under a different project's key (WR-02). The
  // BoardPicker re-resolves: single board auto-selects, multiple boards gate Continue.
  const setSelectedProject = (v: string) => set({ jiraProject: v, jiraBoardId: null });

  // Fetch the scrum boards for the chosen project (FB8-4). Persist them in the
  // onboarding store so back-nav preserves the list and the chosen board id.
  const {
    data: boards = [],
    isLoading: boardsLoading,
    refetch: refetchBoards,
  } = useQuery({
    queryKey: ['jira-boards', selectedProject, jiraUrl],
    queryFn: () => listProjectBoards(jiraUrl, jiraToken, selectedProject),
    enabled: !!selectedProject,
  });

  const chosenBoardId = jiraBoardId;
  const handleBoardChange = (id: number) => set({ jiraBoardId: id });

  // Mirror the fetched board list into the store so back-nav preserves it.
  useEffect(() => {
    set({ jiraBoards: boards });
  }, [boards, set]);

  const mutation = useMutation({
    mutationFn: async () => {
      const user = await validateJira(jiraUrl, jiraToken);
      const projectList = await listJiraProjects(jiraUrl, jiraToken);
      return { user, projectList };
    },
    onSuccess: async ({ projectList }) => {
      // Store PAT in Stronghold — NEVER in Zustand
      await storeSecret('jira-pat', jiraToken);
      set({ jiraProjects: projectList });
    },
  });

  const handleValidate = () => {
    if (!jiraUrl || !jiraToken) return;
    mutation.mutate();
  };

  // Gate continue only when the user must pick among multiple boards and hasn't
  // yet. A single board auto-selects (BoardPicker fires onChange) and zero boards
  // falls back to discovery — both allow continue.
  const blockedOnBoardChoice = boards.length > 1 && chosenBoardId == null;

  const handleContinue = () => {
    if (!selectedProject || blockedOnBoardChoice) return;
    set({ jiraValidated: true });
    setJiraConnected(true, jiraUrl);
    setActiveJiraProject(selectedProject);
    // Persist the chosen board id (covers both auto-selected-single and explicit
    // multi-board cases). Skipped when no boards exist (discovery fallback).
    if (chosenBoardId != null) {
      const boardName = boards.find((b) => b.id === chosenBoardId)?.name;
      setJiraBoardId(selectedProject, chosenBoardId, boardName);
    }
    const user = mutation.data?.user;
    if (user) setJiraUser(user.displayName, user.name, undefined, user.avatarUrls?.['48x48']);
    goNext();
  };

  const showProjectDropdown = projects.length > 0;

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto py-8">
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
            <Select value={selectedProject} onValueChange={(v) => v && setSelectedProject(v)}>
              <SelectTrigger id="jira-project" className="w-full">
                <span className="flex flex-1 text-left text-sm">
                  {selectedProject ? (
                    (() => {
                      const p = projects.find((p) => p.key === selectedProject);
                      return p ? `${p.key} — ${p.name}` : selectedProject;
                    })()
                  ) : (
                    <span className="text-muted-foreground">Choose a project...</span>
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
        {showProjectDropdown && selectedProject && (
          <BoardPicker
            boards={boards}
            value={chosenBoardId}
            onChange={handleBoardChange}
            isLoading={boardsLoading}
            onRetry={() => refetchBoards()}
          />
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={goBack}>
          Back
        </Button>

        {showProjectDropdown ? (
          <Button onClick={handleContinue} disabled={!selectedProject || blockedOnBoardChoice}>
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
