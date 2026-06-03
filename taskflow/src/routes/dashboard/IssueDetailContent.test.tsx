// Phase 77 Nyquist stubs — see 77-VALIDATION.md. Convert it.todo → it() as the covered plan lands.
// Requirements covered: DETAIL-01, DETAIL-02

import { describe, it } from 'vitest';

describe('IssueDetailContent', () => {
  // DETAIL-01: for a subtask fixture with fields.parent, an ArrowUpRight breadcrumb with the
  //            parent key renders ABOVE the h2 title
  // Covered by: Plan 02 (IssueDetailContent parent breadcrumb)
  // When the breadcrumb lands: render IssueDetailContent with a subtask fixture that has
  // fields.parent = { id: '1', key: 'PROJ-0', fields: { summary: 'Parent story' } };
  // assert that an element containing 'PROJ-0' and the ArrowUpRight icon appears ABOVE
  // the <h2> title element in the DOM (compareDocumentPosition).
  it.todo('DETAIL-01: for a subtask fixture with fields.parent, an ArrowUpRight breadcrumb with the parent key renders ABOVE the h2 title');

  // DETAIL-01: parent MetaRow no longer renders in the sidebar path
  // Covered by: Plan 02 (FieldsSection parent MetaRow removal)
  // When the MetaRow is removed from FieldsSection: render the sidebar with the same subtask
  // fixture and assert that the sidebar does NOT contain a "Parent" label MetaRow element.
  it.todo('DETAIL-01: parent MetaRow no longer renders in the sidebar path');

  // DETAIL-02: subtask row buttons carry the cursor-pointer class
  // Covered by: Plan 02 (IssueDetailContent cursor-pointer fixes)
  // When cursor-pointer is added to subtask row buttons: render IssueDetailContent with a
  // fixture that has subtasks; assert each subtask row <button> has className containing
  // 'cursor-pointer'.
  it.todo('DETAIL-02: subtask row buttons carry the cursor-pointer class');
});
