import { FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { GitLabMilestone } from '@/services/gitlab';
import type { ReleaseMatch } from '@/services/releaseLinker';

interface DescriptionsSectionProps {
  gitlabMatchType: ReleaseMatch['type'];
  matchedMilestone: GitLabMilestone | null;
  versionDescription: string | null | undefined;
}

export function DescriptionsSection({
  gitlabMatchType,
  matchedMilestone,
  versionDescription,
}: DescriptionsSectionProps) {
  return gitlabMatchType !== 'none' &&
    matchedMilestone &&
    !versionDescription &&
    !matchedMilestone.description ? (
    <section>
      <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
        <FileText className="size-3.5" />
        Description
      </h3>
      <p className="text-sm text-muted-foreground italic">No description</p>
    </section>
  ) : (
    <>
      {/* Jira Description */}
      <section>
        <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
          <FileText className="size-3.5" />
          {gitlabMatchType !== 'none' && matchedMilestone ? 'Jira Description' : 'Description'}
        </h3>
        {versionDescription ? (
          <p className="text-sm whitespace-pre-wrap">{versionDescription}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No description</p>
        )}
      </section>

      {/* GitLab Description */}
      {gitlabMatchType !== 'none' && matchedMilestone && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <FileText className="size-3.5" />
            GitLab Description
          </h3>
          {matchedMilestone.description ? (
            <div className="text-sm prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ul]:pl-4 [&_li]:my-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {matchedMilestone.description}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No description</p>
          )}
        </section>
      )}
    </>
  );
}
