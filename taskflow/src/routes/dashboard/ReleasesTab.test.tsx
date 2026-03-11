// PM-03: Fix version rows with date and GitLab release links
// PM-04: Completion status per fix version row
// Wave 0 scaffold — component does not exist yet; tests are pending until Wave 2 implementation
import { describe, it, vi } from 'vitest';

vi.mock('./ReleasesTab', () => ({
  default: () => null,
  ReleasesTab: () => null,
}));

describe('ReleasesTab', () => {
  // PM-03 + PM-04
  it.todo('renders fix version rows with name and release date');
  it.todo('shows linked GitLab milestone for exact date match');
  it.todo('shows dashed border indicator for fuzzy date match');
  it.todo('shows No GitLab link label when no match within 1 day');
  it.todo('shows task count and completion status per fix version row');
});
