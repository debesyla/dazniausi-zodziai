# Dynamic Dataset Selector - Brownfield Enhancement

## Epic Goal

Automate the display of available JSON dataset files in the '.dataset-selector' component so that admins can simply add JSON files to the data directory without manual HTML edits.

## Epic Description

**Existing System Context:**

- Current relevant functionality: The dataset selector is manually configured, requiring edits to display new datasets.
- Technology stack: Svelte, JavaScript
- Integration points: Data folder containing JSON dataset files

**Enhancement Details:**

- What's being added/changed: Modify the dataset selector to dynamically list all JSON files from the data directory.
- How it integrates: Implement file system reading or build-time generation of dataset options.
- Success criteria: The selector automatically populates with JSON filenames, and new files appear without code changes.

## Stories

1. **Story 1:** Review current dataset selector implementation and identify hardcoded elements.
2. **Story 2:** Implement logic to dynamically retrieve JSON filenames from the data directory.
3. **Story 3:** Update the selector component to use the dynamic list of datasets.

## Compatibility Requirements

- [ ] Existing APIs remain unchanged
- [ ] Database schema changes are backward compatible
- [ ] UI changes follow existing patterns
- [ ] Performance impact is minimal

## Risk Mitigation

- **Primary Risk:** File system access might not work in all environments.
- **Mitigation:** Use build-time script to generate the list.
- **Rollback Plan:** Revert to manual configuration if issues arise.

## Definition of Done

- [ ] All stories completed with acceptance criteria met
- [ ] Existing functionality verified through testing
- [ ] Integration points working correctly
- [ ] Documentation updated appropriately
- [ ] No regression in existing features