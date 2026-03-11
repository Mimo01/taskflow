// PM-02: Workload grouped by assignee
// Wave 0 scaffold — component does not exist yet; tests are pending until Wave 2 implementation
import { describe, it } from 'vitest';

vi.mock('./WorkloadTab', () => ({
  default: () => null,
  WorkloadTab: () => null,
}));

describe('WorkloadTab', () => {
  // PM-02: workload grouped by assignee
  it.todo('groups open (non-done) sprint issues by assignee displayName');
  it.todo('sums story points per assignee (unresolved only)');
  it.todo('shows Unassigned bucket for issues with null assignee');
});
