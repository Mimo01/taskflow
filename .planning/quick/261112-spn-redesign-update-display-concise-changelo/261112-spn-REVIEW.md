# Quick Task 261112-spn — Code Review (quick depth)

No critical findings. Warnings verified against code and resolved in 740688cd unless noted.

| ID | Finding | Outcome |
|----|---------|---------|
| WR-01 | release.sh silently swallowed unknown `--` flags (typo'd --skip-bump would bump) | Fixed — unknown flag exits 1 |
| WR-02 | `--skip-bump` blocked on interactive stdin; awk regex unescaped dots | stdin fixed; awk dot-match left (version is validated X.Y.Z, no realistic collision) |
| WR-03 | Release fetch had no timeout; retried on 403/429 rate limit | Fixed — 10s AbortSignal timeout, Accept header, no retry on 403/429 |
| WR-04 | Duplicate versions (v1.2.3 + 1.2.3) → duplicate React keys; unflagged -rc tags shown | Fixed — dedupe by version, strict X.Y.Z |
| WR-05 | `setSearchParams({})` dropped other params | Fixed — deletes only `section` |
| WR-06 | Release-notes links passed any scheme to openExternal | Fixed — http(s) only |
| IN-01 | Scripts need Node with TS type stripping (≥23.6 default) | Documented here; local Node 26 |
| IN-02..04 | Pre-existing partial-write in bump-version; CSP null; buildInfo reads | No change needed |
