# Quick 261007-hmj: Time-led epic forecast

Change `averageForecasts` (taskflow/src/lib/epic-progress.ts) so the Finish forecast is led by logged time.
Rationale: time reflects in-progress work; Items/SP only move on completion.

- Weight time 4x (TIME_FORECAST_WEIGHT) vs 1x for Items/SP in the weighted mean of nLikely/nOpt/nPess.
- Confidence comes from the time forecast when it contributes (disagreement still lowers it one notch).
- Without time, behaviour is the previous equal average / min confidence.
- Test: weighting + confidence.
