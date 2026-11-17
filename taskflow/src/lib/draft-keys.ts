/** Single source for local-draft key strings (drafts.store). */
export const draftKey = {
  commentNew: (issueKey: string) => `comment:new:${issueKey}`,
  commentEdit: (commentId: string) => `comment:edit:${commentId}`,
  description: (issueKey: string) => `description:${issueKey}`,
};
