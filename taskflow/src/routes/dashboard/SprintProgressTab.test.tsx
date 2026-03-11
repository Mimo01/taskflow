// PM-01: Sprint progress buckets from statusCategory
// Wave 0 scaffold — component does not exist yet; tests are pending until Wave 2 implementation
import { describe, it, vi } from 'vitest';

vi.mock('./SprintProgressTab', () => ({
  default: () => null,
  SprintProgressTab: () => null,
}));

describe('SprintProgressTab', () => {
  // PM-01: sprint progress buckets computed from statusCategory
  it.todo('groups issues into To Do / In Progress / Done buckets using statusCategory.key');
  it.todo('sums story points done vs remaining');
  it.todo('hides progress bar when all issues have null story points');
  it.todo('shows task count even when story points are hidden');
});
