// CREATE-01, CREATE-02, CREATE-03, CREATE-04: Wave 0 RED stubs
// All tests are stubs (vi.todo / test.skip) — CreateEditIssueModal.tsx does not yet exist.
// This file will fail to compile until plan 02 creates the component.
import { describe, it } from 'vitest';
import type { CreateEditIssueModal as _CreateEditIssueModal } from './CreateEditIssueModal';

describe('CreateEditIssueModal', () => {
  describe('CREATE-01: Issue type switcher', () => {
    it.todo('renders type switcher (Story / Subtask / Bug) as first field');

    it.todo('switching to Subtask shows Parent field, hides Epic Link');

    it.todo('switching to Story shows Epic Link, hides Parent');
  });

  describe('CREATE-02: Required custom fields', () => {
    it.todo('submit button disabled when required custom field is empty');
  });

  describe('CREATE-03: Edit mode pre-fill', () => {
    it.todo(
      'edit mode pre-fills summary, description, assignee, priority, story points, epic link from props',
    );
  });

  describe('CREATE-04: Issue links', () => {
    it.todo('link row visible after clicking "Add link"; has link type dropdown and issue search input');

    it.todo('multiple link rows can be added');
  });
});
