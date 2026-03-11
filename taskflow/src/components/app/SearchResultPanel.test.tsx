// SRCH-02: Search result panel display for Jira tasks and GitLab MRs
// Wave 0 scaffold — component does not exist yet; tests are pending until Wave 3 implementation
import { describe, it, vi } from 'vitest';

vi.mock('./SearchResultPanel', () => ({
  default: () => null,
  SearchResultPanel: () => null,
}));

describe('SearchResultPanel', () => {
  // SRCH-02
  it.todo('renders Jira task panel with title, status, assignee, story points, description excerpt');
  it.todo('renders GitLab MR panel with title, status, author, linked task key');
  it.todo('Open in Jira button calls openUrl with correct browse URL');
  it.todo('Open in GitLab button calls openUrl with mr.web_url');
});
