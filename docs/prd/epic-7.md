# Add Clear Filters Button - Brownfield Enhancement

## Epic Goal

Add a "Išvalyti filtrus" button to the user interface that allows users to clear all applied filters with a single click, resetting them to their default state.

## Epic Description

**Existing System Context:**

- Current relevant functionality: The application has filters for data, likely in components like SearchBar or DataTable.
- Technology stack: Svelte, CSS
- Integration points: Filters are applied to data display.

**Enhancement Details:**

- What's being added/changed: Introduce a new button labeled "Išvalyti filtrus" that clears all filters.
- How it integrates: The button will be placed near the filter controls, and clicking it will reset filter states and refresh the data view.
- Success criteria: Button is visible, functional, and clears all filters correctly.

## Stories

1. **Story 4-1:** Design and place the "Išvalyti filtrus" button in the UI layout.
2. **Story 4-2:** Implement the logic to clear all filters when the button is clicked.
3. **Story 4-3:** Test the button functionality and ensure no filters remain after clearing.

## Compatibility Requirements

- [ ] Existing filter functionality remains intact
- [ ] UI layout accommodates the new button without disruption
- [ ] Performance impact is minimal

## Risk Mitigation

- **Primary Risk:** Button might not clear all filters if logic is incomplete.
- **Mitigation:** Thorough testing of all filter combinations.
- **Rollback Plan:** Remove the button if issues arise.

## Definition of Done

- [ ] All stories completed with acceptance criteria met
- [ ] Button clears all filters successfully
- [ ] UI updates correctly after clearing
- [ ] Documentation updated if needed
- [ ] No regression in filter functionality
