// SRCH-01: Search query debouncing and parallel fetch
// SRCH-02: Search results rendering
// Wave 0 scaffold — component does not exist yet; tests are pending until Wave 3 implementation
import { describe, it } from 'vitest';

vi.mock('./SearchOverlay', () => ({
  default: () => null,
  SearchOverlay: () => null,
}));

describe('SearchOverlay', () => {
  // SRCH-01 + SRCH-02
  it.todo('does not fire search query when input is empty');
  it.todo('fires Jira JQL and GitLab MR search in parallel for non-empty query');
  it.todo('renders Tasks section and Merge Requests section in results');
  it.todo('shows loading state while search is in flight');
});
