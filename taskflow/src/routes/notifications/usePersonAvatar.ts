/**
 * Render-time avatar lookup for a person named in a notification value change.
 *
 * Notification bodies only carry names (Jira display name / GitLab username), and items persisted
 * before `personAvatars` existed — or whose old value isn't in the fetch payload — have no URL.
 * So resolve each name once, cached by (source, base URL, name):
 *  - Jira: assignable-user search scoped to the notification's issue, queried by the name's first
 *    word (Jira prefix-matches display-name words), then an EXACT display-name match.
 *  - GitLab: exact `username=` lookup.
 * The PAT is read inside the queryFn and is never part of the key. Any miss -> null (initials).
 */
import { useQuery } from '@tanstack/react-query';
import { fetchGitLabUserAvatar } from '@/services/gitlab';
import { fetchAssignableUsers } from '@/services/jira/users';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';

export function usePersonAvatar(
  name: string,
  source: 'jira' | 'gitlab',
  issueKey: string | null,
  captured: string | undefined,
): string | null {
  const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);
  const gitlabBaseUrl = useAuthStore((s) => s.gitlabBaseUrl);
  const baseUrl = (source === 'jira' ? jiraBaseUrl : gitlabBaseUrl) ?? '';

  const { data } = useQuery({
    queryKey: ['notification-person-avatar', source, baseUrl, name],
    queryFn: async (): Promise<string | null> => {
      if (source === 'gitlab') {
        const token = await readSecret('gitlab-pat').catch(() => null);
        if (!token) return null;
        return fetchGitLabUserAvatar(baseUrl, token, name);
      }
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !issueKey) return null;
      const firstWord = name.trim().split(/\s+/)[0] ?? '';
      const users = await fetchAssignableUsers(baseUrl, token, '', firstWord, {
        issueKey,
        maxResults: 50,
      });
      const match = users.find((u) => u.displayName === name);
      return match?.avatarUrls?.['48x48'] ?? null;
    },
    enabled: !captured && !!baseUrl && !!name && (source === 'gitlab' || !!issueKey),
    staleTime: 60 * 60_000,
    gcTime: 60 * 60_000,
    retry: false,
  });

  return captured ?? data ?? null;
}
