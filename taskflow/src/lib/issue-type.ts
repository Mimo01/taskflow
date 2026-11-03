/**
 * True for the Jira Epic issue type. Jira Data Center (v2 API) exposes no
 * hierarchyLevel, so the type name is the codebase convention.
 */
export function isEpicTypeName(typeName: string | undefined): boolean {
  return (typeName ?? '').toLowerCase() === 'epic';
}
