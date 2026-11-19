/**
 * Best-effort handoff of the "enqueued at" time from the Jira concurrency limiter to apiFetch.
 *
 * The limiter wraps each call in `runWithQueuedAt(queuedAt, fn)`, which publishes the enqueue
 * time in a module-level slot for the synchronous part of `fn`. apiFetch reads it with
 * `takeQueuedAt()` as its first statement, before any await. This works because both current
 * call sites invoke apiFetch in the synchronous part of fn. A fn that awaits before apiFetch gets
 * no queuedAt rather than a wrong one. If a future call site needs that, pass `queuedAt`
 * explicitly via a new optional apiFetch option.
 */
let handoff: number | null = null;

export function runWithQueuedAt<T>(queuedAt: number, fn: () => T): T {
  handoff = queuedAt;
  try {
    return fn();
  } finally {
    handoff = null;
  }
}

/** Returns the current handoff and clears it, so only the first apiFetch in a slot consumes it. */
export function takeQueuedAt(): number | undefined {
  if (handoff === null) return undefined;
  const v = handoff;
  handoff = null;
  return v;
}

/**
 * A free limiter slot still hands over a queuedAt a fraction of a millisecond before the fetch
 * starts. Below this the "wait" is scheduling noise; showing "Queued 0 ms" on every Jira request
 * and an always-on queued series would hide the waits that matter.
 */
export const QUEUE_NOISE_MS = 2;

export function meaningfulQueuedAt(
  queuedAt: number | undefined,
  startedAt: number,
): number | undefined {
  if (queuedAt === undefined) return undefined;
  return startedAt - queuedAt >= QUEUE_NOISE_MS ? queuedAt : undefined;
}

/** Splits wait-for-a-slot time from network time. Queue time is never folded into durationMs. */
export function queueSplit(e: { queuedAt?: number; startedAt?: number; durationMs: number }): {
  queuedMs: number | null;
  networkMs: number;
} {
  const queuedMs =
    e.queuedAt !== undefined && e.startedAt !== undefined
      ? Math.max(0, Math.round(e.startedAt - e.queuedAt))
      : null;
  return { queuedMs, networkMs: e.durationMs };
}
