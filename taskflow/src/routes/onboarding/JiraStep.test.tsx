// AUTH-04: Project dropdown appears after successful Jira validation — Plan 02
// AUTH-06: Error banners on validation failure — Plan 02
import { describe, it } from 'vitest';

describe('JiraStep', () => {
  it.todo('AUTH-04: project dropdown appears after successful validation');
  it.todo('AUTH-04: project dropdown is hidden before validation');
  it.todo('AUTH-06: shows "Invalid token or token has expired" on 401');
  it.todo('AUTH-06: shows "Token valid but lacks required permissions" on 403');
  it.todo('AUTH-06: shows "Cannot reach [URL]" on network error');
  it.todo('AUTH-06: "Test & Continue" button shows spinner while validating');
  it.todo('AUTH-06: "Test & Continue" button is disabled while validating');
});
