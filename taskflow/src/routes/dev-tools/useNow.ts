import { useEffect, useState } from 'react';
import { nowMs } from '../../lib/dev-tools/log-entry';

/**
 * High-resolution "now" that ticks every `intervalMs` while `enabled`. When `frozenAt` is given it
 * is returned as-is and nothing ticks, so a paused view keeps pending rows frozen.
 */
export function useNow(intervalMs: number, enabled: boolean, frozenAt?: number | null): number {
  const [now, setNow] = useState(nowMs);
  const frozen = frozenAt ?? null;
  useEffect(() => {
    if (!enabled || frozen !== null) return;
    setNow(nowMs());
    const id = setInterval(() => setNow(nowMs()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled, frozen]);
  return frozen ?? now;
}
