/**
 * GitLabStep — GitLab credential entry with inline validation and group selection.
 *
 * Mirrors the JiraStep pattern exactly — same UX decisions apply:
 * - Field values in Zustand (not useState) — back nav preserves them
 * - PAT stored to Stronghold ('gitlab-pat') after successful validation
 * - Group dropdown appears inline after validation
 * - Error messages are exact strings from gitlab.ts
 */
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
import { validateGitLab, listGitLabGroups } from '@/services/gitlab';
import { storeSecret } from '@/services/stronghold';
import { useOnboardingStore } from '@/stores/onboarding.store';
import { useAuthStore } from '@/stores/auth.store';

export default function GitLabStep() {
  const { gitlabUrl, gitlabToken, gitlabGroup, gitlabGroups, set, goBack, goNext } = useOnboardingStore();
  const { setGitlabConnected, setActiveGitlabGroup } = useAuthStore();

  const groups = gitlabGroups;
  const selectedGroup = gitlabGroup ?? '';
  const setSelectedGroup = (v: string) => set({ gitlabGroup: v });

  const mutation = useMutation({
    mutationFn: async () => {
      const user = await validateGitLab(gitlabUrl, gitlabToken);
      const groupList = await listGitLabGroups(gitlabUrl, gitlabToken);
      return { user, groupList };
    },
    onSuccess: async ({ groupList }) => {
      // Store PAT in Stronghold — NEVER in Zustand
      await storeSecret('gitlab-pat', gitlabToken);
      set({ gitlabGroups: groupList });
    },
  });

  const handleValidate = () => {
    if (!gitlabUrl || !gitlabToken) return;
    mutation.mutate();
  };

  const handleContinue = () => {
    if (!selectedGroup) return;
    set({ gitlabValidated: true });
    setGitlabConnected(true, gitlabUrl);
    setActiveGitlabGroup(selectedGroup);
    goNext();
  };

  const showGroupDropdown = groups.length > 0;

  return (
    <div className="flex flex-col gap-6 max-w-md mx-auto py-8">
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

        {/* Inline group dropdown after successful validation */}
        {showGroupDropdown && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gitlab-group">Select Group</Label>
            <Select value={selectedGroup} onValueChange={(v) => v && setSelectedGroup(v)}>
              <SelectTrigger id="gitlab-group" className="w-full">
                <span className="flex flex-1 text-left text-sm">
                  {selectedGroup
                    ? (() => { const g = groups.find(g => g.full_path === selectedGroup); return g ? `${g.name} (${g.full_path})` : selectedGroup; })()
                    : <span className="text-muted-foreground">Choose a group...</span>
                  }
                </span>
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.full_path}>
                    {group.name} ({group.full_path})
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

        {showGroupDropdown ? (
          <Button onClick={handleContinue} disabled={!selectedGroup}>
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
