---
status: complete
quick_id: 260521-u4u
commit: 62e932ab
---

# Quick Task 260521-u4u: Dashboard Welcome Redesign

## What was done

Redesigned the dashboard welcome section to be more visually engaging while matching the app's professional style.

### Changes to `taskflow/src/routes/dashboard/index.tsx`

**Greeting logic**
- Time-of-day greeting: "Good morning/afternoon/evening, {name}"
- Fixed first-name extraction for Jira `displayName` format "Surname Firstname [Status]" — takes token at index 1 (first name), falling back to index 0

**Visual**
- White background (`bg-background`) with `min-h-full` so it covers the full page
- Subtle flowing wave lines (bezier curves) emanating from top-right (orange #f97316) and bottom-left (cyan #06b6d4), fading as they spread across the page
- Heading bumped to `text-4xl font-semibold` (up from `text-3xl`), centered

## Final state

```
Good morning, Jane
Thursday, 21 May 2026
```

With flowing orange/cyan wave lines across the full page background.
