---
status: complete
---
# Quick 261014-myz: Merge close burndown datapoints (AIO cycle detail)

Executions within 1 hour of the first execution in a cluster now collapse into a single burndown
point in `cycleBurndownSeries` (`taskflow/src/lib/aio-cycle-charts.ts`, `MERGE_WINDOW_MS`).
The merged point sits at the cluster's last execution, sums the counts, and takes the worst
status marker. Test added in `aio-cycle-charts.test.ts`. Done inline (no planner/executor spawn).
