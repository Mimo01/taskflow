import { uploadAttachment } from '@/services/jira/attachments';

/**
 * Post-create upload of locally staged files. Sequential; a failing file never stops the
 * rest and never throws (issue creation must not roll back). Returns the failed names.
 */
export async function uploadStagedFiles(
  jiraBaseUrl: string,
  token: string,
  issueKey: string,
  files: readonly File[],
): Promise<string[]> {
  const failedNames: string[] = [];
  for (const file of files) {
    try {
      await uploadAttachment(jiraBaseUrl, token, issueKey, file);
    } catch (e) {
      console.error('Failed to upload staged attachment:', e);
      failedNames.push(file.name);
    }
  }
  return failedNames;
}
