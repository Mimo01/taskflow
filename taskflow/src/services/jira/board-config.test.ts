import { beforeEach, describe, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

describe('board-config service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchBoardQuickFilters', () => {
    it.todo('returns quick filters array on success');
    it.todo('returns empty array on non-ok response');
    it.todo('calls correct Jira Agile endpoint with board ID');
  });
});
