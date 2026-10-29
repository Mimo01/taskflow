# Phase 93: Releases list and detail redesign - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log preserves the alternatives considered.

**Date:** 2026-10-29
**Phase:** 93-releases-list-and-detail-redesign-fix-version-driven-list-fi
**Areas discussed:** List structure & styling, Fast-loading behaviour, Detail page restyle (List row anatomy not selected → Claude's discretion)

---

## List structure & styling

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped sections | Upcoming / Released labels, AioCycleList column grid | ✓ |
| One flat table | Single grid, no group labels | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Soonest first | Overdue → due today → ascending → undated | |
| Keep today's order | Undated first, then date descending | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| One pill per row | Released/Overdue/Due today/In N days/No date | ✓ |
| Pill + muted timing | Released/Unreleased pill + relative text | |

| Option | Description | Selected |
|--------|-------------|----------|
| Drop it from the list | Four columns only | |
| Keep as progress bar | Lazy, visible rows only, streamed | ✓ |
| Keep, upcoming only | No bar on released rows | |

**Free-text clarification:** "I want a nice list. the rows can be bigger if needed. I want a graph of the issues in the release (small, nothing big). Make it look professional, polished and match the design of the app. You can be creative. But make sure it is not overwhelming"

| Option | Description | Selected |
|--------|-------------|----------|
| Segmented status bar | Slim status-category bar + done/total | |
| Mini donut | ~28px ring with total | |
| You decide | | ✓ |

---

## Fast-loading behaviour

| Option | Description | Selected |
|--------|-------------|----------|
| Fix versions only | Rows paint immediately; RM + graph stream into fixed slots | ✓ |
| Everything at once | Skeleton until all loaded | |

| Option | Description | Selected |
|--------|-------------|----------|
| 5 + 'Show more' | As today | ✓ |
| Last 10 + 'Show more' | | |
| All, virtualised | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Instant from cache | Background revalidate; AIO-style Refresh control | ✓ |
| Always reload | Skeleton every visit | |

---

## Detail page restyle

| Option | Description | Selected |
|--------|-------------|----------|
| Row-echo header | Name + pill + date + RM + wide status graph; Pin/Edit/Open in Jira in header | ✓ |
| Minimal header | Name + pill only | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Header owns it | Table drops progress (keeps flagged count); sidebar drops Status/Date | ✓ |
| Keep sidebar complete | | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Polish, don't restructure | Headings/spacing/type; P91.1 table behaviour untouched | ✓ |
| Header + sidebar only | | |
| Full rethink | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Paint header from list cache | No full-page skeleton when cached | |
| Keep today's skeleton | | |

**User's choice:** "you decide" → Claude: paint from cache.

---

## Claude's Discretion

- List row anatomy (row height, column layout, RM cell states)
- Issue graph form (leaning segmented status-category bar)
- Detail first-paint behaviour
- Batched single-search fetch for graph data (technical)

## Deferred Ideas

None.
