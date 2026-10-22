# 261022-kd8 Code Review (quick depth)

No blockers. Warnings fixed in 0150ae64:
- WR-01 aggregateStepStats dropped last-good data on a failed background refetch (isError + data) → now only errored-without-data counts as unavailable (+ test).
- WR-02 queued step fetches ignored the abort signal → queryFn reads `signal`, `throwIfAborted()` inside the limiter.
- WR-03 duplicate run ids double-counted → ids de-duplicated.

Info (accepted): inline `combine` re-aggregates per render; step tiles stay skeleton if the token never arrives; step data can lag Pass rate by up to the 5-min staleTime after an edit.
