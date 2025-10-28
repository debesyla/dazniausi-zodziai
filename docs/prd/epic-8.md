# Set Default Descending Sort for Frequency Column - Brownfield Enhancement

## Epic Goal

Modify the default sorting behavior so that on initial load, the "Dažnumas" (frequency) column is sorted in descending order, displaying the highest frequency items first.

## Epic Description

**Existing System Context:**

- Current relevant functionality: The application displays data in a table with sortable columns, including "Dažnumas".
- Technology stack: Svelte, possibly with sorting logic in DataTable component.
- Integration points: Sorting affects data presentation on load.

**Enhancement Details:**

- What's being added/changed: Change the initial sort order for the frequency column to descending.
- How it integrates: On page load, the data will be sorted by frequency descending without user intervention.
- Success criteria: Data loads with highest frequency first by default.

## Stories

1. **Story 5-1:** Identify and modify the default sort configuration for the frequency column.
2. **Story 5-2:** Ensure the sort persists correctly on load and integrates with existing sort functionality.
3. **Story 5-3:** Test the default sort behavior across different data sets.

## Compatibility Requirements

- [ ] Existing sorting functionality for other columns remains unchanged
- [ ] User can still change sort order manually
- [ ] Performance impact is minimal

## Risk Mitigation

- **Primary Risk:** Changing default sort might affect user expectations or data loading.
- **Mitigation:** Test with sample data and ensure reversibility.
- **Rollback Plan:** Revert the default sort setting.

## Definition of Done

- [ ] All stories completed with acceptance criteria met
- [ ] Frequency column sorts descending by default on load
- [ ] Manual sorting still works
- [ ] Documentation updated if needed
- [ ] No regression in sorting functionality
