// AUTH-02: GitLab PAT validation — to be implemented in Plan 02
import { describe, it } from 'vitest';

describe('gitlab service', () => {
  it.todo('AUTH-02: validateGitlab returns user data on 200 response');
  it.todo('AUTH-02: validateGitlab throws "Invalid token or token has expired" on 401');
  it.todo('AUTH-02: validateGitlab throws "Token valid but lacks required permissions" on 403');
  it.todo('AUTH-02: validateGitlab throws "Cannot reach [URL]" on network error');
  it.todo('AUTH-02: fetchGitlabGroups returns groups list on success');
});
