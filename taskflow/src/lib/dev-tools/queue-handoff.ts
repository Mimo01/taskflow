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
