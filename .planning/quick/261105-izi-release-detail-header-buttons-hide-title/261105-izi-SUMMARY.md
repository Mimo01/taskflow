---
quick_id: 261105-izi
status: complete
commit: 9da8254a
---

# Quick 261105-izi: release detail header buttons hide title on small screens

Release detail header action group is `flex-none`; its collapse breakpoints (≤640px) predated the refresh
button + "Refreshed: <time>" text, so at ~640–900px page width the actions ate the row and the title
truncated to nothing.

**Fix (ReleaseHeader.tsx):** staged collapse, sooner
- "Refreshed:" timestamp hidden at `@max-[1024px]/page` (goes first)
- Pin / Edit release / Open in Jira labels sr-only (icon-only) at `@max-[896px]/page`

Tests: ReleaseHeader.test.tsx + ReleaseDetailPage.test.tsx breakpoint assertions updated; full suite green
(4404 passed). Executed inline (3-class change, no planner/executor spawn).
