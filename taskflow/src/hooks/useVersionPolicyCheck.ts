/**
 * useVersionPolicyCheck — Fetches version-policy.json and computes soft/hard enforcement state.
 *
 * Piggybacks on the same polling interval as useUpdatePolling (D-13).
 * Fail-open: when policy is null (unreachable or malformed), both flags are false.
 * Dev builds (buildInfo.version contains '-dev') skip enforcement entirely.
 */
import { useQuery } from '@tanstack/react-query';
import { buildInfo } from '@/lib/build-info';
import { fetchVersionPolicy, isBelow, type VersionPolicy } from '@/services/versionPolicy';
import { useSettingsStore } from '@/stores/settings.store';

// Public releases repo for version policy
const VERSION_POLICY_URL =
  'https://raw.githubusercontent.com/Mimo01/taskflow-releases/main/version-policy.json';

export function useVersionPolicyCheck(): {
  softMinimumActive: boolean;
  hardMinimumActive: boolean;
  policy: VersionPolicy | null;
} {
  const updateCheckInterval = useSettingsStore((s) => s.updateCheckInterval);
  const intervalMs =
    updateCheckInterval === 'manual' ? false : updateCheckInterval * 60 * 60 * 1000;

  const { data: policy = null } = useQuery({
    queryKey: ['version-policy'],
    queryFn: () => fetchVersionPolicy(VERSION_POLICY_URL),
    refetchInterval: intervalMs,
    refetchIntervalInBackground: false,
    staleTime: typeof intervalMs === 'number' ? intervalMs - 5_000 : Infinity,
    enabled: updateCheckInterval !== 'manual',
    retry: false,
  });

  const hardMinimumActive = policy !== null && isBelow(buildInfo.version, policy.hardMinimum);
  const softMinimumActive =
    policy !== null &&
    isBelow(buildInfo.version, policy.softMinimum) &&
    !hardMinimumActive;

  return { softMinimumActive, hardMinimumActive, policy };
}
