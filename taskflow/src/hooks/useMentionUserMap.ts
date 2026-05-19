import { useEffect, useMemo, useRef, useState } from 'react';
import type { UserMap } from '@/routes/dashboard/WikiRenderer';
import { fetchJiraUserByName } from '@/services/jira/users';
import { readSecret } from '@/services/stronghold';

const MENTION_RE = /\[~(?!accountId:)([^\]]+)\]/g;

/**
 * Extends a base UserMap by fetching any [~username] mentions found in wikiTexts
 * that are not already present in initialMap. Returns the merged map.
 */
export function useMentionUserMap(
  initialMap: UserMap,
  wikiTexts: (string | null | undefined)[],
  jiraBaseUrl: string,
): UserMap {
  const [fetchedUsers, setFetchedUsers] = useState<UserMap>({});
  const fetchingRef = useRef<Set<string>>(new Set());

  const textsFingerprint = wikiTexts.map((t) => t ?? '').join('\x00');

  useEffect(() => {
    const toFetch: string[] = [];
    for (const text of wikiTexts) {
      if (!text) continue;
      for (const match of text.matchAll(MENTION_RE)) {
        const username = match[1];
        if (!initialMap[username] && !fetchingRef.current.has(username)) {
          fetchingRef.current.add(username);
          toFetch.push(username);
        }
      }
    }
    if (toFetch.length === 0 || !jiraBaseUrl) return;

    let cancelled = false;
    (async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || cancelled) return;
      const fetched: UserMap = {};
      await Promise.all(
        toFetch.map(async (username) => {
          const user = await fetchJiraUserByName(jiraBaseUrl, token, username).catch(() => null);
          if (user?.name) fetched[user.name] = user.displayName;
        }),
      );
      if (!cancelled && Object.keys(fetched).length > 0) {
        setFetchedUsers((prev) => ({ ...prev, ...fetched }));
      }
    })();

    return () => {
      cancelled = true;
      for (const u of toFetch) fetchingRef.current.delete(u);
    };
    // textsFingerprint is the stable proxy for wikiTexts content changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textsFingerprint, jiraBaseUrl]);

  return useMemo(() => ({ ...initialMap, ...fetchedUsers }), [initialMap, fetchedUsers]);
}
