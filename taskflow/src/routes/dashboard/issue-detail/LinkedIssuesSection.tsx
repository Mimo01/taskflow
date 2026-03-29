import { Badge } from '@/components/ui/badge';
import { statusCategoryBadgeClass, statusCategoryDotClass } from '@/lib/statusStyles';
import type { JiraIssueDetail } from '@/services/jira';

interface LinkedIssuesSectionProps {
  issuelinks: JiraIssueDetail['fields']['issuelinks'];
  onOpenIssue?: (key: string) => void;
}

export function LinkedIssuesSection({ issuelinks, onOpenIssue }: LinkedIssuesSectionProps) {
  // Group linked issues by link type label
  const groupedLinks = new Map<
    string,
    Array<{
      link: (typeof issuelinks)[number];
      target: NonNullable<(typeof issuelinks)[number]['inwardIssue']>;
      label: string;
    }>
  >();
  for (const link of issuelinks) {
    const target = link.inwardIssue ?? link.outwardIssue;
    if (!target) continue;
    const label = link.inwardIssue ? link.type.inward : link.type.outward;
    const existing = groupedLinks.get(label) ?? [];
    existing.push({ link, target, label });
    groupedLinks.set(label, existing);
  }

  if (issuelinks.length === 0) return null;

  return (
    <section>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
        Linked Issues
      </p>
      <div className="space-y-2">
        {Array.from(groupedLinks.entries()).map(([label, items]) => (
          <div key={label}>
            <p className="text-[10px] text-muted-foreground capitalize mb-0.5 pl-1">{label}</p>
            {items.map(({ link, target }) => (
              <button
                key={link.id}
                type="button"
                onClick={() => onOpenIssue?.(target.key)}
                className="w-full text-left rounded px-1 py-1 hover:bg-accent transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`size-1.5 rounded-full shrink-0 ${statusCategoryDotClass(target.fields.status.statusCategory?.key)}`}
                  />
                  <span className="font-mono text-xs">{target.key}</span>
                  <Badge
                    className={`text-[10px] h-4 px-1.5 border-0 font-normal ${statusCategoryBadgeClass(target.fields.status.statusCategory?.key)}`}
                  >
                    {target.fields.status.name}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate pl-[18px]">
                  {target.fields.summary}
                </p>
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
