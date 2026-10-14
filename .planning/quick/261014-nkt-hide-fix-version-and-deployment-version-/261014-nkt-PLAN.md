# Quick 261014-nkt: Hide Fix Versions + Deployment package on epic/subtask detail

Fix versions and the deployment package (derived from fix version) only apply to story-level issues.
Gate both MetaRows (and the package-mismatch warning) in `FieldsSection.tsx` on `isStory`.
Test: `FieldsSection.test.tsx` "Story-only rows" (Story shows; Epic/Sub-task hide).
