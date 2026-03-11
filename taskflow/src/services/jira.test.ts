// AUTH-01: Jira PAT validation — to be implemented in Plan 02
// AUTH-06: Error banners for Jira validation failures — to be implemented in Plan 02
import { describe, it } from 'vitest';

describe('jira service', () => {
  it.todo('AUTH-01: validateJira returns user data on 200 response');
  it.todo('AUTH-01: validateJira throws "Invalid token or token has expired" on 401');
  it.todo('AUTH-01: validateJira throws "Token valid but lacks required permissions" on 403');
  it.todo('AUTH-01: validateJira throws "Cannot reach [URL]" on network error');
  it.todo('AUTH-06: fetchJiraProjects returns project list on success');
  it.todo('AUTH-06: fetchJiraProjects throws on 401');
});
