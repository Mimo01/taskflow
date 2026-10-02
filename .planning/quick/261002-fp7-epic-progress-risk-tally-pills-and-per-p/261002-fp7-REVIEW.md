---
status: reviewed
reviewed: eb2ebfa2..89d1ab12
depth: quick
---

# 261002-fp7 Code Review (recorded by orchestrator — reviewer returned findings inline)

Biome clean. No bugs/security issues.

| ID | Finding | Disposition |
|----|---------|-------------|
| WR-01 | Pills could overflow with 5 risks at narrow width | Not an issue — deriveRisks caps at 4 (overdue XOR late, stalled XOR scope, unestimated, unassigned); 4 pills fit. No overflow-hidden (would clip focus rings). UAT at 480px peek |
| WR-02 | amber-700 on amber/10 ≈ 4.6:1 in light mode | Accepted (passes AA for normal text); UAT |
| WR-03 | aria-label vs tooltip double announcement | UAT with a screen reader |
| IN-01 | EpicRisk.short now unused | Fixed — field + its tests removed |
| IN-02 | "0d" token | Not reachable (overdue only when due < today) |
| IN-03 | "By person" not a heading element | Fixed — h4 |
