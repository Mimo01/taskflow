import { beforeEach, describe, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

describe('filters service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createJiraFilter', () => {
    it.todo('creates filter via POST /rest/api/2/filter');
    it.todo('sets favourite: true on created filter');
    it.todo('throws on non-ok response');
  });

  describe('fetchFavouriteFilters', () => {
    it.todo('returns favourite filters array on success');
    it.todo('returns empty array on non-ok response');
  });

  describe('updateJiraFilter', () => {
    it.todo('updates filter via PUT with correct body');
    it.todo('throws on non-ok response');
  });

  describe('deleteJiraFilter', () => {
    it.todo('deletes filter via DELETE');
    it.todo('throws on non-ok response');
  });

  describe('buildJqlFromFilters', () => {
    it.todo('includes project clause');
    it.todo('adds epic link clause when epics provided');
    it.todo('adds labels clause with quoted values');
    it.todo('adds assignee clause');
    it.todo('adds status clause');
    it.todo('returns project-only JQL when no filters active');
  });
});
